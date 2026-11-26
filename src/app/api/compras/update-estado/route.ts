import { NextResponse } from 'next/server';
import { notificarCambioEstadoCompra, type ResultadoNotificacion } from '@/lib/notificaciones/estado-compra';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const COMPRAS_TABLE_ID = process.env.AIRTABLE_COMPRAS_TABLE_ID;

export async function POST(request: Request) {
  try {
    const { compraId, nuevoEstado, nombresAdmin } = await request.json();

    if (!compraId || !nuevoEstado || !nombresAdmin) {
      console.error('Faltan datos requeridos');
      return NextResponse.json(
        { error: 'ID de compra, nuevo estado y nombre del administrador son requeridos' },
        { status: 400 }
      );
    }

    // Validar configuración de Airtable
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !COMPRAS_TABLE_ID) {
      console.error('Variables de entorno de Airtable no encontradas');
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const recordUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}/${compraId}`;

    // Leer el estado anterior antes de actualizar, para notificar solo si cambia
    const actualResponse = await fetch(recordUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!actualResponse.ok) {
      const errorData = await actualResponse.json().catch(() => ({}));
      console.error('Error de Airtable al leer la solicitud:', errorData);
      return NextResponse.json(
        { error: `No se pudo leer la solicitud: ${errorData.error?.message || 'Error desconocido'}` },
        { status: actualResponse.status }
      );
    }
    const registroActual = await actualResponse.json();
    const estadoAnterior = registroActual.fields['Estado Solicitud'] as string | undefined;

    console.log('Actualizando registro en Airtable...');

    // Actualizar el estado en Airtable
    const response = await fetch(recordUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Estado Solicitud': nuevoEstado,
          'Nombres Admin': nombresAdmin
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de Airtable:', errorData);
      return NextResponse.json(
        { error: `Error al actualizar el estado en la base de datos: ${errorData.error?.message || 'Error desconocido'}` },
        { status: response.status }
      );
    }

    const updatedRecord = await response.json();
    console.log(`Estado de ${compraId} actualizado: ${estadoAnterior ?? '—'} → ${nuevoEstado}`);

    let notificacion: ResultadoNotificacion = { enviado: false, motivo: 'El estado no cambió' };
    if (estadoAnterior !== nuevoEstado) {
      const fields = updatedRecord.fields;
      notificacion = await notificarCambioEstadoCompra({
        nombreSolicitante: fields['Nombre Solicitante'] || '',
        equipoFinancieroIds: fields['Equipo Financiero'] || [],
        fechaSolicitud: fields['Fecha de solicitud'],
        valorTotal: typeof fields['Valor Total'] === 'number' ? fields['Valor Total'] : undefined,
        documentoUrl: fields['Documento Solicitud'],
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        actualizadoPor: nombresAdmin,
      });
      if (!notificacion.enviado) {
        console.warn(`⚠️ Notificación de estado no enviada (${compraId}): ${notificacion.motivo}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Estado actualizado correctamente',
      notificacion
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
