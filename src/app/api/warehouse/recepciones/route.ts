import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { sanitizeInput, checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Base financiera (Órdenes de Compra)
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;
const ITEMS_OC_TABLE_ID = process.env.AIRTABLE_ITEMS_OC_TABLE_ID;

// Base de insumos (Inventario)
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID;
const MOV_INSUMO_TABLE_ID = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID;
const BITACORA_TABLE_ID = process.env.AIRTABLE_BITACORA_TABLE_ID;

// Tablas de recepción warehouse
const WAREHOUSE_RECEIPTS_TABLE_ID = process.env.AIRTABLE_WAREHOUSE_RECEIPTS_TABLE_ID;
const WAREHOUSE_RECEIPT_ITEMS_TABLE_ID = process.env.AIRTABLE_WAREHOUSE_RECEIPT_ITEMS_TABLE_ID;

// Roles con acceso a warehouse
const WAREHOUSE_ALLOWED_ROLES = [
  'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)',
  'CTO (CHIEF TECHNOLOGY OFFICER)',
  'DIRECTOR FINANCIERO',
  'COORDINADORA LIDER GERENCIA',
  'INGENIERO DE DESARROLLO',
  'JEFE DE PLANTA',
  'JEFE DE PRODUCCION',
  'SUPERVISOR DE PRODUCCION',
  'CONTADORA',
  'ASISTENTE FINANCIERO Y CONTABLE',
];

interface ItemRecepcion {
  itemOCId: string;
  insumoId: string;
  areaDestinoId: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  notaDiferencia?: string;
}

interface RecepcionRequest {
  ordenCompraId: string;
  items: ItemRecepcion[];
  notasGenerales?: string;
}

async function airtableFetch(baseId: string, tableId: string, endpoint: string = '', method: string = 'GET', body?: unknown) {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
}

async function registrarEnBitacora(
  accion: string,
  usuario: string,
  detalles: Record<string, unknown>
) {
  if (!BITACORA_TABLE_ID || !AIRTABLE_BASE_ID) return;

  try {
    await airtableFetch(AIRTABLE_BASE_ID, BITACORA_TABLE_ID, '', 'POST', {
      fields: {
        'Fecha': new Date().toISOString(),
        'Accion': accion,
        'Usuario': usuario,
        'Detalles': JSON.stringify(detalles, null, 2),
      }
    });
  } catch (error) {
    console.error('Error registrando en bitácora:', error);
  }
}

/**
 * POST /api/warehouse/recepciones
 *
 * Crea una recepción de mercancía completa desde una Orden de Compra:
 * 1. Crea registro en "Recepciones Almacén"
 * 2. Crea registros en "Items Recepción Almacén" por cada ítem
 * 3. Crea movimientos de inventario en estado "En Espera"
 * 4. Actualiza estado de la OC según cantidades recibidas
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 10, 60000)) {
      secureLog('⚠️ Rate limit excedido en POST warehouse/recepciones', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        {
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401, headers: securityHeaders }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401, headers: securityHeaders }
      );
    }

    // 🔒 Autorización
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol de almacén o gerencial.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!AIRTABLE_BASE_ID || !ORDENES_TABLE_ID || !ITEMS_OC_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de base financiera no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    if (!INSUMOS_BASE_ID || !MOV_INSUMO_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de base de insumos no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Obtener datos del request
    const data: RecepcionRequest = await request.json();
    const { ordenCompraId, items, notasGenerales } = data;

    if (!ordenCompraId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Datos incompletos: ordenCompraId e items son requeridos' },
        { status: 400, headers: securityHeaders }
      );
    }

    // 1. Verificar que la OC existe y está en estado válido
    const ordenData = await airtableFetch(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, `/${ordenCompraId}`);
    const estadoOC = ordenData.fields[process.env.AIRTABLE_OC_ESTADO_FIELD || 'Estado Orden de Compra'];
    const idOrdenCompra = ordenData.fields[process.env.AIRTABLE_OC_ID_FIELD || 'ID Orden de Compra'];

    const estadosValidos = ['Emitida', 'Recibida Parcial'];
    if (!estadosValidos.includes(estadoOC)) {
      return NextResponse.json(
        {
          error: `La orden de compra está en estado "${estadoOC}". Solo se pueden recibir OCs en estados: ${estadosValidos.join(', ')}`,
          estadoActual: estadoOC,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    // 2. Crear registro de Recepción (si están configuradas las tablas)
    let recepcionId: string | undefined;
    const itemsRecepcionCreados: string[] = [];

    if (WAREHOUSE_RECEIPTS_TABLE_ID && WAREHOUSE_RECEIPT_ITEMS_TABLE_ID) {
      // Determinar estado de recepción
      const todosCompletos = items.every(item => item.cantidadRecibida === item.cantidadPedida);
      const algunaDiferencia = items.some(item => item.cantidadRecibida !== item.cantidadPedida);
      const estadoRecepcion = todosCompletos ? 'Completa' : algunaDiferencia ? 'Con Diferencias' : 'Parcial';

      const recepcionFields = {
        [process.env.AIRTABLE_WR_OC_ID_FIELD || 'Orden de Compra Relacionada']: idOrdenCompra,
        [process.env.AIRTABLE_WR_FECHA_FIELD || 'Fecha Recepción']: new Date().toISOString().split('T')[0],
        [process.env.AIRTABLE_WR_USUARIO_FIELD || 'Recibido Por']: decoded.nombre || decoded.cedula,
        [process.env.AIRTABLE_WR_ESTADO_FIELD || 'Estado Recepción']: estadoRecepcion,
      };

      if (notasGenerales) {
        recepcionFields[process.env.AIRTABLE_WR_NOTAS_FIELD || 'Notas Generales'] = sanitizeInput(notasGenerales);
      }

      const recepcionRecord = await airtableFetch(INSUMOS_BASE_ID, WAREHOUSE_RECEIPTS_TABLE_ID, '', 'POST', {
        fields: recepcionFields
      });
      recepcionId = recepcionRecord.id;

      // Crear Items de Recepción en lotes de 10
      for (let i = 0; i < items.length; i += 10) {
        const batch = items.slice(i, i + 10);
        const records = batch.map(item => {
          const diferencia = item.cantidadRecibida - item.cantidadPedida;
          let tipoDiferencia = 'Ninguna';
          if (diferencia < 0) tipoDiferencia = 'Faltante';
          if (diferencia > 0) tipoDiferencia = 'Sobrante';

          const itemFields: Record<string, unknown> = {
            [process.env.AIRTABLE_WRI_RECEIPT_ID_FIELD || 'Recepción Relacionada']: [recepcionId],
            [process.env.AIRTABLE_WRI_OC_ITEM_ID_FIELD || 'Item OC Relacionado']: item.itemOCId,
            [process.env.AIRTABLE_WRI_INSUMO_ID_FIELD || 'Insumo Relacionado']: [item.insumoId],
            [process.env.AIRTABLE_WRI_AREA_FIELD || 'Área de Destino']: [item.areaDestinoId],
            [process.env.AIRTABLE_WRI_CANT_PEDIDA_FIELD || 'Cantidad Pedida']: item.cantidadPedida,
            [process.env.AIRTABLE_WRI_CANT_RECIBIDA_FIELD || 'Cantidad Recibida']: item.cantidadRecibida,
            [process.env.AIRTABLE_WRI_TIPO_DIF_FIELD || 'Tipo Diferencia']: tipoDiferencia,
          };

          if (item.notaDiferencia) {
            itemFields[process.env.AIRTABLE_WRI_NOTAS_DIF_FIELD || 'Notas Diferencia'] = sanitizeInput(item.notaDiferencia);
          }

          return { fields: itemFields };
        });

        const batchResult = await airtableFetch(INSUMOS_BASE_ID, WAREHOUSE_RECEIPT_ITEMS_TABLE_ID, '', 'POST', {
          records
        });
        itemsRecepcionCreados.push(...batchResult.records.map((r: any) => r.id));
      }
    }

    // 3. Crear movimientos en "En Espera" en la base de insumos
    const movimientosCreados: Array<{ id: string; codigoMovimiento: string; insumo: string; cantidad: number }> = [];

    for (const item of items) {
      if (item.cantidadRecibida <= 0) continue; // Skip items sin cantidad recibida

      const descripcion = `Ingreso OC ${idOrdenCompra} - ${item.insumoId.slice(0, 20)}`;

      const movFields = {
        [process.env.AIRTABLE_MOV_NOMBRE_FIELD || 'Name']: sanitizeInput(descripcion),
        [process.env.AIRTABLE_MOV_TIPO_FIELD || 'Tipo Movimiento']: 'Ingreso',
        [process.env.AIRTABLE_MOV_SUBTIPO_FIELD || 'Subtipo']: 'Compra',
        [process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo']: 'En Espera',
        [process.env.AIRTABLE_MOV_INSUMO_FIELD || 'Insumo']: [item.insumoId],
        [process.env.AIRTABLE_MOV_CANTIDAD_ORIGINAL_FIELD || 'Cantidad Original']: item.cantidadRecibida,
        [process.env.AIRTABLE_MOV_CANTIDAD_BASE_FIELD || 'Cantidad Base']: item.cantidadRecibida,
        [process.env.AIRTABLE_MOV_AREA_DESTINO_LINK_FIELD || 'Area Destino Link']: [item.areaDestinoId],
        [process.env.AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD || 'Documento Origen']: sanitizeInput(idOrdenCompra),
        [process.env.AIRTABLE_MOV_ID_SOLICITUD_FIELD || 'ID Solicitud Compra']: ordenData.fields['Compra Relacionada']?.[0] || '',
        [process.env.AIRTABLE_MOV_ID_RESPONSABLE_CORE_FIELD || 'ID Responsable Core']: decoded.cedula,
      };

      if (item.notaDiferencia) {
        movFields[process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas'] = sanitizeInput(item.notaDiferencia);
      }

      const movRecord = await airtableFetch(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, '', 'POST', {
        fields: movFields
      });

      movimientosCreados.push({
        id: movRecord.id,
        codigoMovimiento: movRecord.fields[process.env.AIRTABLE_MOV_CODIGO_FIELD || 'Código Movimiento Insumo'] || movRecord.id,
        insumo: item.insumoId,
        cantidad: item.cantidadRecibida,
      });

      // Vincular movimiento al item de recepción si existe
      if (WAREHOUSE_RECEIPT_ITEMS_TABLE_ID && itemsRecepcionCreados.length > 0) {
        const itemRecepcionIdx = items.indexOf(item);
        if (itemRecepcionIdx >= 0 && itemRecepcionIdx < itemsRecepcionCreados.length) {
          try {
            await airtableFetch(INSUMOS_BASE_ID, WAREHOUSE_RECEIPT_ITEMS_TABLE_ID, `/${itemsRecepcionCreados[itemRecepcionIdx]}`, 'PATCH', {
              fields: {
                [process.env.AIRTABLE_WRI_MOV_ID_FIELD || 'Movimiento Inventario ID']: movRecord.id,
              }
            });
          } catch (error) {
            console.error('Error vinculando movimiento a item recepción:', error);
          }
        }
      }
    }

    // 4. Actualizar estado de OC
    let nuevoEstadoOC = estadoOC;
    const itemsOC = ordenData.fields['Items OC'] || [];

    // Determinar si es recepción total o parcial
    if (items.length === itemsOC.length && items.every(i => i.cantidadRecibida === i.cantidadPedida)) {
      nuevoEstadoOC = 'Recibida Total';
    } else {
      nuevoEstadoOC = 'Recibida Parcial';
    }

    if (nuevoEstadoOC !== estadoOC) {
      await airtableFetch(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, `/${ordenCompraId}`, 'PATCH', {
        fields: {
          [process.env.AIRTABLE_OC_ESTADO_FIELD || 'Estado Orden de Compra']: nuevoEstadoOC,
        }
      });
    }

    // 5. Registrar en bitácora
    await registrarEnBitacora(
      'Recepción de Mercancía (En Espera)',
      decoded.nombre || decoded.cedula,
      {
        ordenCompraId,
        idOrdenCompra,
        recepcionId,
        cantidadItems: items.length,
        movimientosCreados: movimientosCreados.map(m => m.codigoMovimiento),
        estadoOCAnterior: estadoOC,
        estadoOCNuevo: nuevoEstadoOC,
      }
    );

    secureLog('✅ Recepción creada exitosamente', {
      usuario: decoded.nombre,
      ordenCompraId,
      movimientosCreados: movimientosCreados.length,
    });

    return NextResponse.json({
      success: true,
      recepcionId,
      itemsRecepcionCreados: itemsRecepcionCreados.length,
      movimientosCreados,
      ordenCompraActualizada: {
        id: ordenCompraId,
        estadoAnterior: estadoOC,
        estadoNuevo: nuevoEstadoOC,
      },
    }, { headers: securityHeaders });

  } catch (error) {
    console.error('Error creando recepción de warehouse:', error);
    secureLog('🚨 Error en POST warehouse/recepciones', {
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno del servidor',
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
