import { NextRequest } from 'next/server';
import { activeConnections, pendingResults } from '@/lib/stream-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      // Registrar conexión
      activeConnections.set(transactionId, controller);
      console.log(`📡 Cliente conectado a stream: ${transactionId}`);

      // Enviar mensaje inicial
      const data = `data: ${JSON.stringify({ type: 'connected', message: 'Conexión establecida' })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));

      // Si ya hay un resultado pendiente, enviarlo
      if (pendingResults.has(transactionId)) {
        const result = pendingResults.get(transactionId);
        const resultData = `data: ${JSON.stringify(result)}\n\n`;
        controller.enqueue(new TextEncoder().encode(resultData));
        pendingResults.delete(transactionId);
      }

      // Limpiar conexión después de 3 minutos (un poco más que el timeout del cliente)
      setTimeout(() => {
        if (activeConnections.has(transactionId)) {
          controller.close();
          activeConnections.delete(transactionId);
          console.log(`⏱️ Timeout - Cerrando stream: ${transactionId}`);
        }
      }, 3 * 60 * 1000);
    },
    cancel() {
      activeConnections.delete(transactionId);
      console.log(`❌ Cliente desconectado: ${transactionId}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
