// Store para mantener conexiones SSE activas
export const activeConnections = new Map<string, ReadableStreamDefaultController>();

// Store para resultados pendientes
export const pendingResults = new Map<string, any>();

// Función helper para enviar eventos a un stream específico
export function sendStreamEvent(transactionId: string, event: any) {
  const controller = activeConnections.get(transactionId);
  
  if (controller) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    controller.enqueue(new TextEncoder().encode(data));
    console.log(`📤 Evento enviado a ${transactionId}:`, event.type);
    return true;
  } else {
    // Si no hay conexión activa, guardar SOLO el último evento
    if (!pendingResults.has(transactionId)) {
      console.log(`💾 Guardando eventos para ${transactionId} (conexión aún no establecida)`);
    }
    pendingResults.set(transactionId, event);
    return false;
  }
}
