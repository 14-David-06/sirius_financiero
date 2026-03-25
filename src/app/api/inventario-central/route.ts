import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const INSUMO_TABLE = process.env.AIRTABLE_INS_TABLE_ID || '';
const CATEGORIAS_TABLE = process.env.AIRTABLE_CAT_INSUMO_TABLE_ID || '';
const MOVIMIENTOS_TABLE = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID || '';
const STOCK_TABLE = process.env.AIRTABLE_STOCK_INSUMO_TABLE_ID || '';

const base = new Airtable({ apiKey: process.env.AIRTABLE_INS_API_KEY }).base(INSUMOS_BASE_ID);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seccion = searchParams.get('seccion') || 'resumen';

    if (seccion === 'resumen') {
      // Fetch all tables in parallel for KPIs
      const [insumos, categorias, movimientos, stocks] = await Promise.all([
        fetchInsumos(),
        fetchCategorias(),
        fetchMovimientos(),
        fetchStocks(),
      ]);

      // Compute KPIs
      const insumosActivos = insumos.filter(i => i.estadoInsumo === 'Activo').length;
      const stockBajoMinimo = stocks.filter(s => {
        const insumo = insumos.find(i => i.id === s.insumoId);
        return insumo && insumo.stockMinimo > 0 && s.stockActual < insumo.stockMinimo;
      }).length;
      const movimientosRecientes = movimientos
        .sort((a, b) => new Date(b.creada).getTime() - new Date(a.creada).getTime())
        .slice(0, 20);

      return NextResponse.json({
        success: true,
        kpis: {
          totalInsumos: insumos.length,
          insumosActivos,
          totalCategorias: categorias.length,
          totalMovimientos: movimientos.length,
          stockBajoMinimo,
        },
        insumos,
        categorias,
        movimientos: movimientosRecientes,
        stocks,
      });
    }

    if (seccion === 'insumos') {
      const insumos = await fetchInsumos();
      return NextResponse.json({ success: true, insumos });
    }

    if (seccion === 'movimientos') {
      const movimientos = await fetchMovimientos();
      return NextResponse.json({ success: true, movimientos });
    }

    if (seccion === 'stock') {
      const stocks = await fetchStocks();
      return NextResponse.json({ success: true, stocks });
    }

    if (seccion === 'categorias') {
      const categorias = await fetchCategorias();
      return NextResponse.json({ success: true, categorias });
    }

    return NextResponse.json({ success: false, error: 'Sección no válida' }, { status: 400 });
  } catch (error) {
    console.error('❌ Error en inventario-central:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error al cargar inventario' },
      { status: 500 }
    );
  }
}

interface InsumoRecord {
  id: string;
  codigoSirius: string;
  idNumero: number;
  nombre: string;
  unidadMedida: string;
  stockMinimo: number;
  estadoInsumo: string;
  etiquetas: string[];
  fichaTecnica: string;
  referenciaComercial: string;
  categoriaIds: string[];
  imagenReferencia: { url: string; filename: string; thumbnailUrl: string }[];
}

async function fetchInsumos(): Promise<InsumoRecord[]> {
  const insumos: InsumoRecord[] = [];
  await base(INSUMO_TABLE)
    .select({
      fields: [
        'Código SIRIUS-INS', 'ID', 'Nombre', 'Unidad Medida', 'Stock Minimo',
        'Estado Insumo', 'Etiquetas', 'Ficha Tecnica', 'Referencia Comercial',
        'Categoria', 'Imagen Referencia',
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const imagenes = record.fields['Imagen Referencia'] as Array<{
          url: string; filename: string; thumbnails?: { small?: { url: string } };
        }> | undefined;

        const refComercial = record.fields['Referencia Comercial'] as unknown;
        let refStr = '';
        if (refComercial && typeof refComercial === 'object' && 'value' in (refComercial as Record<string, unknown>)) {
          refStr = (refComercial as { value: string }).value || '';
        } else if (typeof refComercial === 'string') {
          refStr = refComercial;
        }

        insumos.push({
          id: record.id,
          codigoSirius: record.fields['Código SIRIUS-INS'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          nombre: record.fields['Nombre'] as string || '',
          unidadMedida: record.fields['Unidad Medida'] as string || '',
          stockMinimo: record.fields['Stock Minimo'] as number || 0,
          estadoInsumo: record.fields['Estado Insumo'] as string || '',
          etiquetas: record.fields['Etiquetas'] as string[] || [],
          fichaTecnica: record.fields['Ficha Tecnica'] as string || '',
          referenciaComercial: refStr,
          categoriaIds: record.fields['Categoria'] as string[] || [],
          imagenReferencia: imagenes?.map(img => ({
            url: img.url,
            filename: img.filename,
            thumbnailUrl: img.thumbnails?.small?.url || img.url,
          })) || [],
        });
      });
      fetchNextPage();
    });
  return insumos;
}

interface CategoriaRecord {
  id: string;
  codigoCategoria: string;
  idNumero: number;
  tipoInsumo: string;
  descripcion: string;
  insumoIds: string[];
  cantidadInsumos: number;
}

async function fetchCategorias(): Promise<CategoriaRecord[]> {
  const categorias: CategoriaRecord[] = [];
  await base(CATEGORIAS_TABLE)
    .select({
      fields: ['Código CAT-INS', 'ID', 'Tipo de insumo', 'Descripción', 'Insumo'],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields['Insumo'] as string[] || [];
        categorias.push({
          id: record.id,
          codigoCategoria: record.fields['Código CAT-INS'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          tipoInsumo: record.fields['Tipo de insumo'] as string || '',
          descripcion: record.fields['Descripción'] as string || '',
          insumoIds,
          cantidadInsumos: insumoIds.length,
        });
      });
      fetchNextPage();
    });
  return categorias;
}

interface MovimientoRecord {
  id: string;
  codigoMovimiento: string;
  idNumero: number;
  nombre: string;
  cantidad: number;
  tipoMovimiento: string;
  estadoEntrada: string;
  idResponsable: string;
  idAreaOrigen: string;
  idAreaDestino: string;
  creada: string;
  ultimaModificacion: string;
  insumoIds: string[];
  stockIds: string[];
}

async function fetchMovimientos(): Promise<MovimientoRecord[]> {
  const movimientos: MovimientoRecord[] = [];
  await base(MOVIMIENTOS_TABLE)
    .select({
      fields: [
        'Código Movimiento Insumo', 'ID', 'Name', 'Cantidad ', 'Tipo Movimiento',
        'Estado Entrada Insumo', 'ID Responsable Core', 'ID Area Origen',
        'ID Area Destino', 'Creada', 'Última modificación', 'Insumo', 'Stock Insumos',
      ],
      sort: [{ field: 'Creada', direction: 'desc' }],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        movimientos.push({
          id: record.id,
          codigoMovimiento: record.fields['Código Movimiento Insumo'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          nombre: record.fields['Name'] as string || '',
          cantidad: record.fields['Cantidad '] as number || 0,
          tipoMovimiento: record.fields['Tipo Movimiento'] as string || '',
          estadoEntrada: record.fields['Estado Entrada Insumo'] as string || '',
          idResponsable: record.fields['ID Responsable Core'] as string || '',
          idAreaOrigen: record.fields['ID Area Origen'] as string || '',
          idAreaDestino: record.fields['ID Area Destino'] as string || '',
          creada: record.fields['Creada'] as string || '',
          ultimaModificacion: record.fields['Última modificación'] as string || '',
          insumoIds: record.fields['Insumo'] as string[] || [],
          stockIds: record.fields['Stock Insumos'] as string[] || [],
        });
      });
      fetchNextPage();
    });
  return movimientos;
}

interface StockRecord {
  id: string;
  idStock: string;
  idNumero: number;
  stockActual: number;
  ultimaActualizacion: string;
  cantidadIngresa: number[];
  cantidadSale: number[];
  insumoId: string;
  movimientoIds: string[];
}

async function fetchStocks(): Promise<StockRecord[]> {
  const stocks: StockRecord[] = [];
  await base(STOCK_TABLE)
    .select({
      fields: [
        'id_stock', 'ID', 'stock_actual', 'Ultima Actualizacion',
        'Cantidad Ingresa', 'Cantidad Sale', 'Insumo ID', 'Movimiento Insumo ID',
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields['Insumo ID'] as string[] || [];
        stocks.push({
          id: record.id,
          idStock: record.fields['id_stock'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          stockActual: record.fields['stock_actual'] as number || 0,
          ultimaActualizacion: record.fields['Ultima Actualizacion'] as string || '',
          cantidadIngresa: (record.fields['Cantidad Ingresa'] as unknown as number[]) || [],
          cantidadSale: (record.fields['Cantidad Sale'] as unknown as number[]) || [],
          insumoId: insumoIds[0] || '',
          movimientoIds: record.fields['Movimiento Insumo ID'] as string[] || [],
        });
      });
      fetchNextPage();
    });
  return stocks;
}
