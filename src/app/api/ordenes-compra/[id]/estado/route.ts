import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  ActualizarEstadoOCRequest,
  ActualizarEstadoOCResponse
} from '@/types/inventario';
import { sanitizeInput, checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;
const BITACORA_TABLE_ID = process.env.AIRTABLE_BITACORA_TABLE_ID;

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

// Transiciones de estado válidas (modelo de negocio sin etapa de tránsito)
const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  'Emitida': ['Recibida Parcial', 'Recibida Total', 'Anulada'],
  'Recibida Parcial': ['Recibida Total', 'Anulada'],
  'Recibida Total': [], // Estado final
  'Anulada': [], // Estado final
};

async function airtableFetch(url: string, method: string = 'GET', body?: unknown) {
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
  if (!BITACORA_TABLE_ID) return;

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BITACORA_TABLE_ID}`;
    await airtableFetch(url, 'POST', {
      fields: {
        'Fecha': new Date().toISOString(),
        'Accion': accion,
        'Usuario': usuario,
        'Detalles': JSON.stringify(detalles, null, 2),
      }
    });
  } catch (error) {
    console.error('Error registrando en bitácora:', error);
    // No bloqueamos la operación principal si falla el log
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
      secureLog('⚠️ Rate limit excedido en PATCH ordenes-compra/estado', { ip: clientIP });
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

    // 🔒 Autorización (solo roles gerenciales/administrativos pueden actualizar estado)
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol gerencial o administrativo.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !ORDENES_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Obtener datos del request
    const data: ActualizarEstadoOCRequest = await request.json();
    const { nuevoEstado, comentarios } = data;

    // Validar nuevo estado
    const estadosValidos = ['Recibida Parcial', 'Recibida Total', 'Anulada'];
    if (!estadosValidos.includes(nuevoEstado)) {
      return NextResponse.json(
        { error: `Estado inválido: ${nuevoEstado}` },
        { status: 400, headers: securityHeaders }
      );
    }

    // Obtener orden de compra actual
    const ordenUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ORDENES_TABLE_ID}/${id}`;
    const ordenData = await airtableFetch(ordenUrl);
    const estadoAnterior = ordenData.fields['Estado Orden de Compra'] || 'Emitida';

    // Validar transición de estado
    const transicionesPermitidas = TRANSICIONES_VALIDAS[estadoAnterior] || [];
    if (!transicionesPermitidas.includes(nuevoEstado)) {
      return NextResponse.json(
        {
          error: `Transición de estado no permitida: ${estadoAnterior} → ${nuevoEstado}`,
          estadoActual: estadoAnterior,
          transicionesPermitidas,
        },
        { status: 400, headers: securityHeaders }
      );
    }

    // Actualizar estado en Airtable
    const updateFields: Record<string, unknown> = {
      'Estado Orden de Compra': nuevoEstado,
    };

    if (comentarios) {
      const comentariosAnteriores = ordenData.fields['Comentarios'] || '';
      const timestamp = new Date().toLocaleString('es-CO');
      const nuevoComentario = `[${timestamp}] ${decoded.nombre}: ${comentarios}`;
      updateFields['Comentarios'] = comentariosAnteriores
        ? `${comentariosAnteriores}\n\n${nuevoComentario}`
        : nuevoComentario;
    }

    // Si cambia a "Recibida Total", actualizar fecha de aprobación
    const estadoOrden = ordenData.fields['Estado Orden de Compra'] as string;
    if (estadoOrden === 'Recibida Total' && !ordenData.fields['Fecha de Aprobación']) {
      updateFields['Fecha de Aprobación'] = new Date().toISOString().split('T')[0];
    }

    await airtableFetch(ordenUrl, 'PATCH', { fields: updateFields });

    // Registrar en bitácora
    await registrarEnBitacora(
      'Actualización Estado Orden de Compra',
      decoded.nombre || decoded.cedula,
      {
        ordenCompraId: id,
        idOrdenCompra: ordenData.fields['ID Orden de Compra'],
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        comentarios,
      }
    );

    const response: ActualizarEstadoOCResponse = {
      success: true,
      ordenCompraId: id,
      estadoAnterior,
      estadoNuevo: nuevoEstado,
      fechaActualizacion: new Date().toISOString(),
      actualizadoPor: decoded.nombre || decoded.cedula,
    };

    return NextResponse.json(response, { headers: securityHeaders });

  } catch (error) {
    console.error('Error actualizando estado de orden de compra:', error);
    secureLog('🚨 Error en PATCH ordenes-compra/estado', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      ordenId: id,
    });

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
