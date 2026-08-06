import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { DIAN_FIELDS } from '@/lib/config/dian-fields';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const DIAN_TABLE_ID = process.env.AIRTABLE_DIAN_TABLE_ID || '';

// Cuántos documentos se devuelven cuando no se acota por fecha de ejecución
const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 500;

interface DocumentoDian {
  id: string;
  creada: string;
  tipoDocumento: string;
  prefijoFolio: string;
  cufe: string;
  fechaEmision: string;
  fechaRecepcion: string;
  nitEmisor: string;
  nombreEmisor: string;
  nombreReceptor: string;
  iva: number;
  total: number;
  estado: string;
  grupo: string;
}

/** Agrupa documentos por una clave y devuelve conteo + valor, de mayor a menor */
function agrupar(
  documentos: DocumentoDian[],
  obtenerClave: (doc: DocumentoDian) => string
): Array<{ nombre: string; cantidad: number; valor: number }> {
  const mapa = new Map<string, { cantidad: number; valor: number }>();

  for (const doc of documentos) {
    const clave = obtenerClave(doc) || 'Sin especificar';
    const actual = mapa.get(clave) || { cantidad: 0, valor: 0 };
    actual.cantidad += 1;
    actual.valor += doc.total;
    mapa.set(clave, actual);
  }

  return Array.from(mapa.entries())
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !DIAN_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas para el resumen DIAN');
      console.error('   - AIRTABLE_API_KEY:', !!AIRTABLE_API_KEY);
      console.error('   - AIRTABLE_BASE_ID:', !!AIRTABLE_BASE_ID);
      console.error('   - AIRTABLE_DIAN_TABLE_ID:', !!DIAN_TABLE_ID);
      return NextResponse.json(
        { success: false, error: 'Configuración incompleta del servidor' },
        { status: 500 }
      );
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const { searchParams } = new URL(request.url);
    const desdeParam = searchParams.get('desde');
    const limiteParam = parseInt(searchParams.get('limite') || '', 10);
    const limite = Number.isFinite(limiteParam)
      ? Math.min(Math.max(limiteParam, 1), LIMITE_MAXIMO)
      : LIMITE_POR_DEFECTO;

    // Validar y normalizar `desde`: solo un ISO re-serializado llega a la fórmula
    let desdeISO: string | null = null;
    if (desdeParam) {
      const fecha = new Date(desdeParam);
      if (isNaN(fecha.getTime())) {
        return NextResponse.json(
          { success: false, error: 'El parámetro "desde" no es una fecha válida' },
          { status: 400 }
        );
      }
      desdeISO = fecha.toISOString();
    }

    const acotadoPorEjecucion = Boolean(desdeISO);

    console.log('🔄 API /movimientos-dian/resumen iniciando...');
    console.log(acotadoPorEjecucion ? `📅 Documentos creados desde: ${desdeISO}` : `📋 Últimos ${limite} documentos`);

    const documentos: DocumentoDian[] = [];

    await base(DIAN_TABLE_ID)
      .select({
        // Al acotar por ejecución queremos todo lo que entró; si no, solo los más recientes
        ...(acotadoPorEjecucion
          ? { filterByFormula: `IS_AFTER({${DIAN_FIELDS.CREADA}}, DATETIME_PARSE('${desdeISO}'))` }
          : { maxRecords: limite }),
        sort: [{ field: DIAN_FIELDS.CREADA, direction: 'desc' }],
        pageSize: 100,
      })
      .eachPage((pageRecords, fetchNextPage) => {
        for (const record of pageRecords) {
          const f = record.fields;
          documentos.push({
            id: record.id,
            creada: (f[DIAN_FIELDS.CREADA] as string) || '',
            tipoDocumento: (f[DIAN_FIELDS.TIPO_DOCUMENTO] as string) || '',
            prefijoFolio: (f[DIAN_FIELDS.PREFIJO_FOLIO] as string) || '',
            cufe: (f[DIAN_FIELDS.CUFE] as string) || '',
            fechaEmision: (f[DIAN_FIELDS.FECHA_EMISION] as string) || '',
            fechaRecepcion: (f[DIAN_FIELDS.FECHA_RECEPCION] as string) || '',
            nitEmisor: String(f[DIAN_FIELDS.NIT_EMISOR] ?? ''),
            nombreEmisor: (f[DIAN_FIELDS.NOMBRE_EMISOR] as string) || '',
            nombreReceptor: (f[DIAN_FIELDS.NOMBRE_RECEPTOR] as string) || '',
            iva: Number(f[DIAN_FIELDS.IVA] ?? 0),
            total: Number(f[DIAN_FIELDS.TOTAL] ?? 0),
            estado: (f[DIAN_FIELDS.ESTADO] as string) || '',
            grupo: (f[DIAN_FIELDS.GRUPO] as string) || '',
          });
        }
        fetchNextPage();
      });

    console.log('✅ Documentos DIAN obtenidos:', documentos.length);

    // Rango de fechas de emisión presente en el lote
    const fechasEmision = documentos.map(d => d.fechaEmision).filter(Boolean).sort();

    const resumen = {
      totalDocumentos: documentos.length,
      totalValor: documentos.reduce((suma, d) => suma + d.total, 0),
      totalIva: documentos.reduce((suma, d) => suma + d.iva, 0),
      porTipoDocumento: agrupar(documentos, d => d.tipoDocumento),
      porGrupo: agrupar(documentos, d => d.grupo),
      porEstado: agrupar(documentos, d => d.estado),
      topEmisores: agrupar(documentos, d => d.nombreEmisor).slice(0, 10),
      rangoFechaEmision: fechasEmision.length
        ? { desde: fechasEmision[0], hasta: fechasEmision[fechasEmision.length - 1] }
        : null,
    };

    console.log(`📊 Resumen: ${resumen.totalDocumentos} documentos, total $${resumen.totalValor.toLocaleString('es-CO')}`);

    return NextResponse.json({
      success: true,
      alcance: {
        tipo: acotadoPorEjecucion ? 'desde-ejecucion' : 'ultimos-registros',
        desde: desdeISO,
        limite: acotadoPorEjecucion ? null : limite,
      },
      resumen,
      documentos,
    });
  } catch (error) {
    console.error('❌ Error en /movimientos-dian/resumen:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener el resumen de movimientos DIAN',
      },
      { status: 500 }
    );
  }
}
