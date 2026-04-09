import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  CrearMovimientoRequest,
  CrearMovimientoResponse
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
const ITEMS_OC_TABLE_ID = process.env.AIRTABLE_ITEMS_OC_TABLE_ID;

// Base de insumos (Inventario)
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID;
const MOV_INSUMO_TABLE_ID = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID;
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
 * GET /api/warehouse/movimientos
 *
 * Lista movimientos de inventario en estado "En Espera" que requieren confirmación
 */
export async function GET(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 20, 60000)) {
      secureLog('⚠️ Rate limit excedido en GET warehouse/movimientos', { ip: clientIP });
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
        { error: 'Permisos insuficientes. Se requiere rol gerencial o administrativo.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!INSUMOS_BASE_ID || !MOV_INSUMO_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de base de insumos no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Buscar movimientos en estado "En Espera"
    const filterFormula = `{${process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo'}} = 'En Espera'`;
    const url = new URL(`https://api.airtable.com/v0/${INSUMOS_BASE_ID}/${MOV_INSUMO_TABLE_ID}`);
    url.searchParams.set('filterByFormula', filterFormula);
    url.searchParams.set('sort[0][field]', 'Creada');
    url.searchParams.set('sort[0][direction]', 'desc');
    url.searchParams.set('maxRecords', '100');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Airtable error: ${response.status} ${response.statusText}`);
    }

    const movimientosData = await response.json();

    const movimientos = movimientosData.records.map((record: any) => ({
      id: record.id,
      codigo: record.fields[process.env.AIRTABLE_MOV_CODIGO_FIELD || 'Código Movimiento Insumo'] || '',
      nombre: record.fields[process.env.AIRTABLE_MOV_NOMBRE_FIELD || 'Name'] || '',
      tipo: record.fields[process.env.AIRTABLE_MOV_TIPO_FIELD || 'Tipo Movimiento'] || '',
      subtipo: record.fields[process.env.AIRTABLE_MOV_SUBTIPO_FIELD || 'Subtipo'] || '',
      estado: record.fields[process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo'] || '',
      cantidadOriginal: record.fields[process.env.AIRTABLE_MOV_CANTIDAD_ORIGINAL_FIELD || 'Cantidad Original'] || 0,
      cantidadBase: record.fields[process.env.AIRTABLE_MOV_CANTIDAD_BASE_FIELD || 'Cantidad Base'] || 0,
      unidadOriginal: record.fields[process.env.AIRTABLE_MOV_UNIDAD_ORIGINAL_FIELD || 'Unidad Original'] || [],
      areaDestino: record.fields[process.env.AIRTABLE_MOV_AREA_DESTINO_LINK_FIELD || 'Area Destino Link'] || [],
      costoUnitario: record.fields[process.env.AIRTABLE_MOV_COSTO_UNITARIO_FIELD || 'Costo Unitario'] || 0,
      costoTotal: record.fields[process.env.AIRTABLE_MOV_COSTO_TOTAL_FIELD || 'Costo Total'] || 0,
      documentoOrigen: record.fields[process.env.AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD || 'Documento Origen'] || '',
      insumo: record.fields[process.env.AIRTABLE_MOV_INSUMO_FIELD || 'Insumo'] || [],
      notas: record.fields[process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas'] || '',
      responsable: record.fields[process.env.AIRTABLE_MOV_ID_RESPONSABLE_CORE_FIELD || 'ID Responsable Core'] || '',
      fechaCreacion: record.fields['Creada'] || '',
    }));

    secureLog('✅ Movimientos en espera obtenidos', {
      usuario: decoded.nombre,
      cantidad: movimientos.length,
    });

    return NextResponse.json({
      success: true,
      movimientos,
      total: movimientos.length,
    }, { headers: securityHeaders });

  } catch (error) {
    console.error('Error obteniendo movimientos en espera:', error);
    secureLog('🚨 Error en GET warehouse/movimientos', {
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

export async function POST(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 10, 60000)) {
      secureLog('⚠️ Rate limit excedido en POST warehouse/movimientos', { ip: clientIP });
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

    // 🔒 Autorización (solo roles gerenciales/administrativos)
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol gerencial o administrativo.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !ORDENES_TABLE_ID || !ITEMS_OC_TABLE_ID) {
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
    const data: CrearMovimientoRequest = await request.json();
    const { ordenCompraId, items } = data;

    if (!ordenCompraId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Datos incompletos: ordenCompraId e items son requeridos' },
        { status: 400, headers: securityHeaders }
      );
    }

    // 1. Verificar que la OC existe y está en estado válido
    const ordenData = await airtableFetch(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, `/${ordenCompraId}`);
    const estadoOC = ordenData.fields['Estado Orden de Compra'];
    const idOrdenCompra = ordenData.fields['ID Orden de Compra'];

    const estadosValidos = ['Emitida', 'En Tránsito', 'Recibida'];
    if (!estadosValidos.includes(estadoOC)) {
      return NextResponse.json(
        {
          error: `La orden de compra está en estado "${estadoOC}". Solo se pueden recibir OCs en estados: ${estadosValidos.join(', ')}`,
          estadoActual: estadoOC,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    // 2. Crear movimientos en "En Espera" en la base de insumos
    const movimientosCreados: Array<{ id: string; codigoMovimiento: string; insumo: string; cantidad: number; estado: string }> = [];

    const recordsToCreate = items.map((item, index) => {
      const descripcion = `Ingreso OC ${idOrdenCompra} - Item ${index + 1}`;

      return {
        fields: {
          [process.env.AIRTABLE_MOV_NOMBRE_FIELD || 'Name']: sanitizeInput(descripcion),
          [process.env.AIRTABLE_MOV_TIPO_FIELD || 'Tipo Movimiento']: 'Ingreso',
          [process.env.AIRTABLE_MOV_SUBTIPO_FIELD || 'Subtipo']: 'Compra',
          [process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo']: 'En Espera',
          [process.env.AIRTABLE_MOV_INSUMO_FIELD || 'Insumo']: [item.insumoId],
          [process.env.AIRTABLE_MOV_CANTIDAD_ORIGINAL_FIELD || 'Cantidad Original']: item.cantidadRecibida,
          [process.env.AIRTABLE_MOV_UNIDAD_ORIGINAL_FIELD || 'Unidad Original']: [item.unidadOriginalId],
          [process.env.AIRTABLE_MOV_AREA_DESTINO_LINK_FIELD || 'Area Destino Link']: [item.areaDestinoId],
          [process.env.AIRTABLE_MOV_COSTO_UNITARIO_FIELD || 'Costo Unitario']: item.costoUnitario || 0,
          [process.env.AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD || 'Documento Origen']: sanitizeInput(item.documentoOrigen || idOrdenCompra),
          [process.env.AIRTABLE_MOV_ID_SOLICITUD_FIELD || 'ID Solicitud Compra']: ordenData.fields['Compra Relacionada']?.[0] || '',
          [process.env.AIRTABLE_MOV_ID_RESPONSABLE_CORE_FIELD || 'ID Responsable Core']: decoded.cedula,
          [process.env.AIRTABLE_MOV_LOTE_FIELD || 'Lote']: item.lote ? sanitizeInput(item.lote) : undefined,
          [process.env.AIRTABLE_MOV_FECHA_VENC_FIELD || 'Fecha Vencimiento']: item.fechaVencimiento || undefined,
          [process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas']: item.observaciones ? sanitizeInput(item.observaciones) : undefined,
        }
      };
    });

    // Crear movimientos en batch (max 10 por request de Airtable)
    for (let i = 0; i < recordsToCreate.length; i += 10) {
      const batch = recordsToCreate.slice(i, i + 10);
      const result = await airtableFetch(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, '', 'POST', {
        records: batch
      });

      result.records.forEach((record: any) => {
        movimientosCreados.push({
          id: record.id,
          codigoMovimiento: record.fields[process.env.AIRTABLE_MOV_CODIGO_FIELD || 'Código Movimiento Insumo'] || record.id,
          insumo: record.fields[process.env.AIRTABLE_MOV_NOMBRE_FIELD || 'Name'] || '',
          cantidad: record.fields[process.env.AIRTABLE_MOV_CANTIDAD_ORIGINAL_FIELD || 'Cantidad Original'] || 0,
          estado: 'En Espera',
        });
      });
    }

    // 3. Actualizar estado de OC a "Recibida" (si estaba en Emitida o En Tránsito)
    let ordenCompraActualizada;
    if (estadoOC !== 'Recibida') {
      await airtableFetch(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, `/${ordenCompraId}`, 'PATCH', {
        fields: {
          'Estado Orden de Compra': 'Recibida',
        }
      });

      ordenCompraActualizada = {
        id: ordenCompraId,
        nuevoEstado: 'Recibida',
      };
    }

    // 4. Registrar en bitácora
    await registrarEnBitacora(
      'Recepción de Insumos (En Espera)',
      decoded.nombre || decoded.cedula,
      {
        ordenCompraId,
        idOrdenCompra,
        cantidadItems: items.length,
        movimientosCreados: movimientosCreados.map(m => m.codigoMovimiento),
      }
    );

    const response: CrearMovimientoResponse = {
      success: true,
      movimientosCreados,
      ordenCompraActualizada,
    };

    return NextResponse.json(response, { headers: securityHeaders });

  } catch (error) {
    console.error('Error creando movimientos de warehouse:', error);
    secureLog('🚨 Error en POST warehouse/movimientos', {
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
