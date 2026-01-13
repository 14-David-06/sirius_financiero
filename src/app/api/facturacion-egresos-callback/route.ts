import { NextRequest, NextResponse } from 'next/server';
import { activeConnections } from '@/lib/stream-manager';

// Endpoint que n8n llamará cuando termine de procesar EGRESOS
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transactionId, success, data, error } = body;

    console.log('🔔 Callback recibido de n8n (EGRESOS):', {
      transactionId,
      success,
      hasData: !!data,
      error: error || 'none'
    });

    // Log específico para factura duplicada
    if (!success && data?.error === 'Factura ya procesada, validar registros en Airtable') {
      console.log('⚠️ FACTURA EGRESO DUPLICADA DETECTADA:', {
        transactionId,
        mensaje: data.error,
        timestamp: new Date().toISOString()
      });
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: 'transactionId es requerido' },
        { status: 400 }
      );
    }

    // Buscar la conexión SSE activa
    const controller = activeConnections.get(transactionId);

    const event = {
      type: success ? 'complete' : 'error',
      message: success ? '✅ Procesamiento completado' : '❌ Error en procesamiento',
      data: data || null,
      error: error || null,
      timestamp: new Date().toISOString()
    };

    if (controller) {
      // Enviar resultado por SSE
      const eventData = `data: ${JSON.stringify(event)}\n\n`;
      controller.enqueue(new TextEncoder().encode(eventData));
      console.log('✅ Resultado EGRESOS enviado por SSE a cliente');
    } else {
      console.log('⚠️ No hay conexión SSE activa para este transactionId (EGRESOS)');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Callback de EGRESOS recibido correctamente',
      sentToClient: !!controller
    });

  } catch (error) {
    console.error('❌ Error en facturacion-egresos-callback:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al procesar callback de EGRESOS' 
      },
      { status: 500 }
    );
  }
}
