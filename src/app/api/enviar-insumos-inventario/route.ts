import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Sirius Insumos Core
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const INSUMO_TABLE = process.env.AIRTABLE_INS_TABLE_ID || '';
const MOVIMIENTOS_TABLE = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID || '';
const CATEGORIAS_TABLE = process.env.AIRTABLE_CAT_INSUMO_TABLE_ID || '';
const UNIDADES_TABLE = process.env.AIRTABLE_UNIDADES_TABLE_ID || '';

// Inicializar Airtable con API key global
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(INSUMOS_BASE_ID);

// Código de área de Sirius. Los campos de área son texto libre desde el rediseño
// del esquema, así que hay que validar antes de escribir.
const PATRON_CODIGO_AREA = /^SIRIUS-AREA-\d+$/i;

// Interface para item a enviar
interface ItemParaInventario {
  id: string;
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
  'Unidad de Negocio'?: string;
  'Centro de Costo'?: string;
}

// Interface para validación IA
interface ValidacionIA {
  itemFacturaId: string;
  itemFacturaNombre: string;
  encontrado: boolean;
  insumoExistenteId?: string;
  insumoExistenteNombre?: string;
  insumoExistenteCodigo?: string;
  similitud: number;
  accion: 'vincular' | 'crear_nuevo' | 'ignorar';
  sugerencia?: string;
}

// Interface para resultado de envío
interface ResultadoEnvio {
  itemId: string;
  itemNombre: string;
  exito: boolean;
  accion: 'vinculado' | 'creado' | 'ignorado' | 'error';
  insumoId?: string;
  movimientoId?: string;
  mensaje: string;
}

// Cache de unidades de medida
interface UnidadMedida {
  id: string;
  nombre: string;
  simbolo: string;
  tipo: string;
  factorABase: number;
  unidadBaseDeTipo: string;
}

async function cargarUnidades(): Promise<UnidadMedida[]> {
  const unidades: UnidadMedida[] = [];
  await base(UNIDADES_TABLE)
    .select({ fields: ['Nombre', 'Simbolo', 'Tipo', 'Factor a Base', 'Unidad Base de Tipo'] })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        unidades.push({
          id: record.id,
          nombre: record.fields['Nombre'] as string || '',
          simbolo: record.fields['Simbolo'] as string || '',
          tipo: record.fields['Tipo'] as string || '',
          factorABase: record.fields['Factor a Base'] as number || 1,
          unidadBaseDeTipo: record.fields['Unidad Base de Tipo'] as string || '',
        });
      });
      fetchNextPage();
    });
  return unidades;
}

function buscarUnidad(unidades: UnidadMedida[], unidadTexto: string): UnidadMedida | undefined {
  const texto = unidadTexto.toLowerCase().trim();
  return unidades.find(u =>
    u.nombre.toLowerCase() === texto ||
    u.simbolo.toLowerCase() === texto ||
    texto.includes(u.nombre.toLowerCase()) ||
    texto.includes(u.simbolo.toLowerCase())
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // `areaDestino` es el código de área (texto). Se acepta `areaDestinoId` por
    // compatibilidad con clientes que aún envían el nombre anterior.
    const { items, validaciones, facturaId, numeroFactura, areaDestino, areaDestinoId } = body as {
      items: ItemParaInventario[];
      validaciones: ValidacionIA[];
      facturaId: string;
      numeroFactura: string;
      areaDestino?: string;
      areaDestinoId?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron items para enviar' },
        { status: 400 }
      );
    }

    // `ID Area Destino` es texto libre: se valida el formato para no escribir
    // record IDs ni referencias de factura, que ya contaminaron registros viejos.
    const candidatoArea = (areaDestino || areaDestinoId || '').trim();
    const areaDestinoCodigo = PATRON_CODIGO_AREA.test(candidatoArea) ? candidatoArea : '';
    if (candidatoArea && !areaDestinoCodigo) {
      console.warn(`⚠️ Área destino ignorada por formato inválido: ${candidatoArea} (se esperaba SIRIUS-AREA-####)`);
    }

    console.log(`📦 Enviando ${items.length} items al inventario desde factura ${numeroFactura}...`);

    // Cargar unidades de medida para conversiones
    const unidades = await cargarUnidades();

    const resultados: ResultadoEnvio[] = [];

    // Obtener categoría por defecto (primera categoría activa)
    let categoriaDefecto: string | null = null;
    try {
      const categoriasResult = await base(CATEGORIAS_TABLE)
        .select({ maxRecords: 1 })
        .firstPage();
      if (categoriasResult.length > 0) {
        categoriaDefecto = categoriasResult[0].id;
      }
    } catch (error) {
      console.warn('No se pudo obtener categoría por defecto:', error);
    }

    // Procesar cada item
    for (const item of items) {
      const validacion = validaciones.find(v => v.itemFacturaId === item.id);
      
      if (!validacion || validacion.accion === 'ignorar') {
        resultados.push({
          itemId: item.id,
          itemNombre: item.Item,
          exito: true,
          accion: 'ignorado',
          mensaje: 'Item ignorado según validación IA',
        });
        continue;
      }

      // Si creamos el insumo en esta iteración y luego falla el movimiento,
      // hay que revertirlo: si no, queda un insumo sin ingreso y el reintento
      // lo duplica.
      let insumoCreadoId: string | null = null;

      try {
        let insumoId: string;

        // Resolver unidad de medida para convertir la cantidad a unidad base
        const unidadEncontrada = buscarUnidad(unidades, item.Unidad);
        const factorConversion = unidadEncontrada?.factorABase || 1;
        const cantidadBase = item.Cantidad * factorConversion;

        if (validacion.accion === 'vincular' && validacion.insumoExistenteId) {
          insumoId = validacion.insumoExistenteId;
          console.log(`🔗 Vinculando item "${item.Item}" a insumo existente: ${validacion.insumoExistenteNombre}`);
        } else {
          console.log(`➕ Creando nuevo insumo: "${item.Item}"`);

          // Determinar unidad base para el insumo (g, ml o und)
          const unidadBase = unidadEncontrada
            ? unidades.find(u => u.simbolo === unidadEncontrada.unidadBaseDeTipo)
            : unidades.find(u => u.simbolo === 'und');

          const nuevoInsumo = await base(INSUMO_TABLE).create({
            'Nombre': item.Item,
            'Unidad Medida': item.Unidad || 'Unidad',
            'Estado Insumo': 'Activo',
            ...(unidadBase && { 'Unidad Base': [unidadBase.id] }),
            ...(categoriaDefecto && { 'Categoria': [categoriaDefecto] }),
          });

          insumoId = nuevoInsumo.id;
          insumoCreadoId = nuevoInsumo.id;
          console.log(`✅ Insumo creado con ID: ${insumoId}`);
        }

        // Movimiento de ingreso. El esquema ya no guarda costos, subtipo,
        // documento de origen ni conversión: la cantidad se persiste ya
        // convertida a unidad base.
        const movimientoFields: Record<string, string | number | string[] | boolean> = {
          'Name': `Entrada - ${numeroFactura} - ${item.Item}`.slice(0, 100),
          // "Entrada"/"Salida"/"Ajuste" son las únicas opciones del singleSelect
          'Tipo Movimiento': 'Entrada',
          'Insumo': [insumoId],
          'Cantidad ': cantidadBase,
        };

        // El área destino es texto libre desde el rediseño
        if (areaDestinoCodigo) {
          movimientoFields['ID Area Destino'] = areaDestinoCodigo;
        }

        const movimiento = await base(MOVIMIENTOS_TABLE).create(movimientoFields);
        console.log(`✅ Movimiento creado: ${movimiento.id} (${item.Cantidad} ${item.Unidad} → ${cantidadBase} base)`);

        resultados.push({
          itemId: item.id,
          itemNombre: item.Item,
          exito: true,
          accion: validacion.accion === 'vincular' ? 'vinculado' : 'creado',
          insumoId,
          movimientoId: movimiento.id,
          mensaje: validacion.accion === 'vincular'
            ? `Vinculado a "${validacion.insumoExistenteNombre}" — ${item.Cantidad} ${item.Unidad} (${cantidadBase} base)`
            : `Nuevo insumo creado — ${item.Cantidad} ${item.Unidad} (${cantidadBase} base)`,
        });

      } catch (error) {
        console.error(`❌ Error procesando item "${item.Item}":`, error);

        // Revertir el insumo recién creado para no dejarlo huérfano
        if (insumoCreadoId) {
          try {
            await base(INSUMO_TABLE).destroy(insumoCreadoId);
            console.log(`↩️ Insumo ${insumoCreadoId} revertido tras fallar el movimiento`);
          } catch (rollbackError) {
            console.error(`⚠️ No se pudo revertir el insumo ${insumoCreadoId}:`, rollbackError);
          }
        }

        resultados.push({
          itemId: item.id,
          itemNombre: item.Item,
          exito: false,
          accion: 'error',
          mensaje: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    const exitosos = resultados.filter(r => r.exito && r.accion !== 'ignorado').length;
    const ignorados = resultados.filter(r => r.accion === 'ignorado').length;
    const errores = resultados.filter(r => !r.exito).length;

    console.log(`📊 Resumen: ${exitosos} exitosos, ${ignorados} ignorados, ${errores} errores`);

    return NextResponse.json({
      success: errores === 0,
      facturaId,
      numeroFactura,
      totalItems: items.length,
      exitosos,
      ignorados,
      errores,
      resultados,
    });

  } catch (error) {
    console.error('❌ Error enviando insumos al inventario:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al enviar insumos',
      },
      { status: 500 }
    );
  }
}
