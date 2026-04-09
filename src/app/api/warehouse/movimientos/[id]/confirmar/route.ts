import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  ConfirmarMovimientoRequest,
  ConfirmarMovimientoResponse
} from '@/types/inventario';
import { sanitizeInput, checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Roles con acceso a warehouse (gerenciales/administrativos de Sirius Nomina Core)
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

// Base financiera (Órdenes de Compra)
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;

// Base de insumos (Inventario)
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID;
const MOV_INSUMO_TABLE_ID = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID;
const STOCK_INSUMO_TABLE_ID = process.env.AIRTABLE_STOCK_INSUMO_TABLE_ID;
const BITACORA_TABLE_ID = process.env.AIRTABLE_BITACORA_TABLE_ID;

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

async function airtableList(baseId: string, tableId: string, filterFormula: string) {
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
  url.searchParams.set('filterByFormula', filterFormula);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params (Next.js 15 requirement)
  const { id } = await params;

  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 10, 60000)) {
      secureLog('⚠️ Rate limit excedido en PATCH warehouse/movimientos/confirmar', { ip: clientIP });
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

    // 🔒 Autorización (solo roles gerenciales/administrativos pueden confirmar)
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol gerencial o administrativo para confirmar ingresos.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!INSUMOS_BASE_ID || !MOV_INSUMO_TABLE_ID || !STOCK_INSUMO_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de base de insumos no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Obtener datos del request
    const data: ConfirmarMovimientoRequest = await request.json();
    const { confirmarMovimiento, observacionesFinales } = data;

    if (!confirmarMovimiento) {
      return NextResponse.json(
        { error: 'Confirmación no válida' },
        { status: 400, headers: securityHeaders }
      );
    }

    // 1. Obtener movimiento actual
    const movimiento = await airtableFetch(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, `/${id}`);
    const estadoActual = movimiento.fields[process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo'];

    if (estadoActual !== 'En Espera') {
      return NextResponse.json(
        {
          error: `El movimiento no puede ser confirmado. Estado actual: "${estadoActual}". Solo se pueden confirmar movimientos en estado "En Espera"`,
          estadoActual,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    // 2. Obtener datos del movimiento
    const insumoIds = movimiento.fields[process.env.AIRTABLE_MOV_INSUMO_FIELD || 'Insumo'] || [];
    const areaDestinoIds = movimiento.fields[process.env.AIRTABLE_MOV_AREA_DESTINO_LINK_FIELD || 'Area Destino Link'] || [];
    const cantidadBase = movimiento.fields[process.env.AIRTABLE_MOV_CANTIDAD_BASE_FIELD || 'Cantidad Base'] || 0;
    const documentoOrigen = movimiento.fields[process.env.AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD || 'Documento Origen'] || '';

    if (insumoIds.length === 0 || areaDestinoIds.length === 0) {
      return NextResponse.json(
        { error: 'El movimiento no tiene insumo o área de destino vinculada' },
        { status: 400, headers: securityHeaders }
      );
    }

    const insumoId = insumoIds[0];
    const areaId = areaDestinoIds[0];

    // 3. Buscar o crear registro de Stock Insumos para este insumo × área
    const filterFormula = `AND(
      FIND("${insumoId}", ARRAYJOIN({${process.env.AIRTABLE_STOCK_INSUMO_LINK_FIELD || 'Insumo ID'}})),
      FIND("${areaId}", ARRAYJOIN({${process.env.AIRTABLE_STOCK_AREA_FIELD || 'Area'}}))
    )`;

    const stockResults = await airtableList(INSUMOS_BASE_ID, STOCK_INSUMO_TABLE_ID, filterFormula);

    let stockRecordId: string;
    let stockAnterior = 0;

    if (stockResults.records.length > 0) {
      // Stock ya existe, obtener valor actual
      stockRecordId = stockResults.records[0].id;
      stockAnterior = stockResults.records[0].fields[process.env.AIRTABLE_STOCK_ACTUAL_FIELD || 'stock_actual'] || 0;
    } else {
      // Crear nuevo registro de stock
      const newStock = await airtableFetch(INSUMOS_BASE_ID, STOCK_INSUMO_TABLE_ID, '', 'POST', {
        fields: {
          [process.env.AIRTABLE_STOCK_INSUMO_LINK_FIELD || 'Insumo ID']: [insumoId],
          [process.env.AIRTABLE_STOCK_AREA_FIELD || 'Area']: [areaId],
        }
      });
      stockRecordId = newStock.id;
      stockAnterior = 0;
    }

    // 4. Actualizar movimiento: cambiar estado a "Confirmado" y vincular al stock
    const updateFields: Record<string, unknown> = {
      [process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo']: 'Confirmado',
      [process.env.AIRTABLE_MOV_STOCK_LINK_FIELD || 'Stock Insumos']: [stockRecordId],
    };

    if (observacionesFinales) {
      const notasAnteriores = movimiento.fields[process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas'] || '';
      const timestamp = new Date().toLocaleString('es-CO');
      const nuevaNota = `[${timestamp}] Confirmado por ${decoded.nombre}: ${observacionesFinales}`;
      updateFields[process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas'] = notasAnteriores
        ? `${notasAnteriores}\n\n${nuevaNota}`
        : nuevaNota;
    }

    await airtableFetch(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, `/${id}`, 'PATCH', {
      fields: updateFields
    });

    // 5. El stock se actualiza automáticamente por la fórmula en Airtable
    // Obtener el valor actualizado
    const stockActualizado = await airtableFetch(INSUMOS_BASE_ID, STOCK_INSUMO_TABLE_ID, `/${stockRecordId}`);
    const stockNuevo = stockActualizado.fields[process.env.AIRTABLE_STOCK_ACTUAL_FIELD || 'stock_actual'] || 0;

    // 6. Verificar si todos los movimientos de la OC están confirmados
    let ordenCompraActualizada;
    const ordenCompraMatch = documentoOrigen.match(/OC-\d{4}-\d+/);

    if (ordenCompraMatch && AIRTABLE_BASE_ID && ORDENES_TABLE_ID) {
      const ocId = ordenCompraMatch[0];

      // Buscar OC por ID
      const ocFilterFormula = `{ID Orden de Compra} = "${ocId}"`;
      const ocResults = await airtableList(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, ocFilterFormula);

      if (ocResults.records.length > 0) {
        const ocRecordId = ocResults.records[0].id;
        const estadoOC = ocResults.records[0].fields['Estado Orden de Compra'];

        // Buscar todos los movimientos de esta OC
        const movFilterFormula = `SEARCH("${ocId}", {${process.env.AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD || 'Documento Origen'}})`;
        const todosMovimientos = await airtableList(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, movFilterFormula);

        const todosConfirmados = todosMovimientos.records.every((mov: any) => {
          const estado = mov.fields[process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo'];
          return estado === 'Confirmado';
        });

        if (todosConfirmados && estadoOC !== 'Ingresada a Inventario') {
          await airtableFetch(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, `/${ocRecordId}`, 'PATCH', {
            fields: {
              'Estado Orden de Compra': 'Ingresada a Inventario',
            }
          });

          ordenCompraActualizada = {
            id: ocRecordId,
            nuevoEstado: 'Ingresada a Inventario',
            todosMovimientosConfirmados: true,
          };
        }
      }
    }

    // 7. Registrar en bitácora
    await registrarEnBitacora(
      'Confirmación de Ingreso a Inventario',
      decoded.nombre || decoded.cedula,
      {
        movimientoId: id,
        documentoOrigen,
        insumoId,
        areaId,
        cantidadBase,
        stockAnterior,
        stockNuevo,
        ordenCompraActualizada: ordenCompraActualizada?.nuevoEstado,
      }
    );

    const response: ConfirmarMovimientoResponse = {
      success: true,
      movimientoId: id,
      nuevoEstado: 'Confirmado',
      stockActualizado: [
        {
          insumoId,
          area: areaId,
          stockAnterior,
          stockNuevo,
        }
      ],
      ordenCompraActualizada,
    };

    return NextResponse.json(response, { headers: securityHeaders });

  } catch (error) {
    console.error('Error confirmando movimiento de warehouse:', error);
    secureLog('🚨 Error en PATCH warehouse/movimientos/confirmar', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      movimientoId: id,
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
