'use client';

import { useEffect, useRef, useCallback } from 'react';
import { UserData, CompraCompleta } from '@/types/compras';

interface ChatMessage {
  id: string;
  idConversacion: number;
  fechaHoraMensaje: string;
  remitente: 'Solicitante' | 'Administrador de Compras';
  nombreRemitente: string;
  mensaje: string;
  realizaRegistro?: string;
  solicitudCompra: string[];
  fechaHoraVisto?: string;
}

interface MessagePollingOptions {
  userData: UserData | null;
  solicitudes: CompraCompleta[];
  onNewMessage: (compraId: string, messageCount: number) => void;
  enabled?: boolean;
  interval?: number; // en milisegundos
}

export function useMessagePolling({
  userData,
  solicitudes,
  onNewMessage,
  enabled = true,
  interval = 30000 // 30 segundos por defecto
}: MessagePollingOptions) {
  const lastMessageCountsRef = useRef<Record<string, number>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const checkForNewMessages = useCallback(async () => {
    if (!userData || !solicitudes.length || isPollingRef.current) return;

    isPollingRef.current = true;

    try {
      const newCounts: Record<string, number> = {};

      // Verificar mensajes para cada solicitud
      const promises = solicitudes.map(async (solicitud) => {
        try {
          const response = await fetch(`/api/chat-compras?compraId=${solicitud.id}`);
          if (response.ok) {
            const data = await response.json();
            const mensajes = data.mensajes || [];

            // Contar mensajes del administrador que no han sido vistos
            const unreadCount = mensajes.filter((msg: ChatMessage) =>
              msg.remitente === 'Administrador de Compras' && !msg.fechaHoraVisto
            ).length;

            if (unreadCount > 0) {
              newCounts[solicitud.id] = unreadCount;
            }
          }
        } catch (error) {
          console.error(`Error verificando mensajes para solicitud ${solicitud.id}:`, error);
        }
      });

      await Promise.all(promises);

      // Comparar con los conteos anteriores y notificar si hay cambios
      Object.entries(newCounts).forEach(([compraId, newCount]) => {
        const lastCount = lastMessageCountsRef.current[compraId] || 0;

        if (newCount > lastCount) {
          // Hay nuevos mensajes
          const newMessages = newCount - lastCount;
          onNewMessage(compraId, newMessages);
        }
      });

      // Actualizar los conteos de referencia
      lastMessageCountsRef.current = newCounts;

    } catch (error) {
      console.error('Error en polling de mensajes:', error);
    } finally {
      isPollingRef.current = false;
    }
  }, [userData, solicitudes, onNewMessage]);

  // Iniciar/detener polling
  useEffect(() => {
    if (enabled && userData && solicitudes.length > 0) {
      // Verificación inicial
      checkForNewMessages();

      // Iniciar polling periódico
      intervalRef.current = setInterval(checkForNewMessages, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, userData, solicitudes.length, checkForNewMessages, interval]);

  // Limpiar cuando cambian las solicitudes
  useEffect(() => {
    lastMessageCountsRef.current = {};
  }, [solicitudes]);

  return {
    isPolling: isPollingRef.current,
    checkNow: checkForNewMessages
  };
}