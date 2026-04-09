import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { sanitizeInput, checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Base de insumos (Inventario)
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const MOV_INSUMO_TABLE_ID = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID;
const BITACORA_TABLE_ID = process.env.AIRTABLE_BITACORA_TABLE_ID;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

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
 * PATCH /api/warehouse/movimientos/[id]/rechazar
 *
 * Rechaza un movimiento de inventario en estado "En Espera"
 * El stock NO se actualiza, el movimiento cambia a estado "Rechazado"
 */
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
      secureLog('⚠️ Rate limit excedido en PATCH warehouse/movimientos/rechazar', { ip: clientIP });
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

    // 🔒 Autorización (solo roles gerenciales/administrativos pueden rechazar)
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol gerencial o administrativo para rechazar ingresos.' },
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

    // Obtener datos del request
    const data = await request.json();
    const { motivoRechazo } = data;

    if (!motivoRechazo || !motivoRechazo.trim()) {
      return NextResponse.json(
        { error: 'El motivo de rechazo es obligatorio' },
        { status: 400, headers: securityHeaders }
      );
    }

    // 1. Obtener movimiento actual
    const movimiento = await airtableFetch(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, `/${id}`);
    const estadoActual = movimiento.fields[process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo'];

    if (estadoActual !== 'En Espera') {
      return NextResponse.json(
        {
          error: `El movimiento no puede ser rechazado. Estado actual: "${estadoActual}". Solo se pueden rechazar movimientos en estado "En Espera"`,
          estadoActual,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    // 2. Actualizar movimiento: cambiar estado a "Rechazado" y agregar notas
    const notasAnteriores = movimiento.fields[process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas'] || '';
    const timestamp = new Date().toLocaleString('es-CO');
    const nuevaNota = `[${timestamp}] Rechazado por ${decoded.nombre}: ${sanitizeInput(motivoRechazo)}`;
    const notasActualizadas = notasAnteriores
      ? `${notasAnteriores}\n\n${nuevaNota}`
      : nuevaNota;

    const updateFields = {
      [process.env.AIRTABLE_MOV_ESTADO_FIELD || 'Estado Entrada Insumo']: 'Rechazado',
      [process.env.AIRTABLE_MOV_NOTAS_FIELD || 'Notas']: notasActualizadas,
    };

    await airtableFetch(INSUMOS_BASE_ID, MOV_INSUMO_TABLE_ID, `/${id}`, 'PATCH', {
      fields: updateFields
    });

    // 3. Registrar en bitácora
    const documentoOrigen = movimiento.fields[process.env.AIRTABLE_MOV_DOCUMENTO_ORIGEN_FIELD || 'Documento Origen'] || '';
    const cantidadBase = movimiento.fields[process.env.AIRTABLE_MOV_CANTIDAD_BASE_FIELD || 'Cantidad Base'] || 0;

    await registrarEnBitacora(
      'Rechazo de Ingreso a Inventario',
      decoded.nombre || decoded.cedula,
      {
        movimientoId: id,
        documentoOrigen,
        cantidadBase,
        motivoRechazo: sanitizeInput(motivoRechazo),
        estadoAnterior: estadoActual,
      }
    );

    secureLog('✅ Movimiento rechazado', {
      usuario: decoded.nombre,
      movimientoId: id,
      documentoOrigen,
    });

    return NextResponse.json({
      success: true,
      movimientoId: id,
      nuevoEstado: 'Rechazado',
      mensaje: 'Movimiento rechazado exitosamente. El stock no ha sido afectado.',
    }, { headers: securityHeaders });

  } catch (error) {
    console.error('Error rechazando movimiento de warehouse:', error);
    secureLog('🚨 Error en PATCH warehouse/movimientos/rechazar', {
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
