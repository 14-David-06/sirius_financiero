'use client';

import { useState, useEffect, useRef } from 'react';
import { UserData } from '@/types/compras';

interface MensajeChat {
  id: string;
  idConversacion: number;
  fechaHoraMensaje: string;
  remitente: 'Solicitante' | 'Administrador de Compras';
  nombreRemitente: string;
  mensaje: string;
  realizaRegistro?: string;
  solicitudCompra: string[];
}

interface ChatCompraProps {
  compraId: string;
  userData: UserData;
  onClose: () => void;
}

export default function ChatCompra({ compraId, userData, onClose }: ChatCompraProps) {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    cargarMensajes();
  }, [compraId]);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const cargarMensajes = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Agregar timeout a la petición
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

      const response = await fetch(`/api/chat-compras?compraId=${compraId}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));

        // Si la tabla no existe, mostrar chat vacío pero funcional
        if (response.status === 404 && errorData.error?.includes('no encontrada')) {
          console.log('Tabla no existe, cargando mensajes locales');
          const mensajesLocales = JSON.parse(localStorage.getItem(`chat_${compraId}`) || '[]');
          setMensajes(mensajesLocales);
          setError('La tabla de conversaciones no está configurada. Los mensajes se guardarán localmente hasta que se configure.');
          return;
        }

        throw new Error(errorData.error || `Error HTTP: ${response.status}`);
      }

      const data = await response.json();

      // Combinar mensajes de Airtable con mensajes locales
      const mensajesAirtable = data.mensajes || [];
      const mensajesLocales = JSON.parse(localStorage.getItem(`chat_${compraId}`) || '[]');

      // Filtrar mensajes locales que ya existen en Airtable (por si se sincronizaron)
      const mensajesLocalesFiltrados = mensajesLocales.filter((msg: MensajeChat) =>
        !mensajesAirtable.some((airtableMsg: MensajeChat) => airtableMsg.mensaje === msg.mensaje && airtableMsg.nombreRemitente === msg.nombreRemitente)
      );

      const todosLosMensajes = [...mensajesAirtable, ...mensajesLocalesFiltrados];

      // Ordenar por fecha
      todosLosMensajes.sort((a, b) => new Date(a.fechaHoraMensaje).getTime() - new Date(b.fechaHoraMensaje).getTime());

      setMensajes(todosLosMensajes);
    } catch (error) {
      console.error('Error al cargar los mensajes:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      // Intentar cargar mensajes locales como fallback
      try {
        const mensajesLocales = JSON.parse(localStorage.getItem(`chat_${compraId}`) || '[]');
        if (mensajesLocales.length > 0) {
          console.log('Cargando mensajes locales como fallback');
          setMensajes(mensajesLocales);
          setError(`Error de conexión. Mostrando mensajes locales. ${errorMessage}`);
          return;
        }
      } catch (localStorageError) {
        console.error('Error al cargar mensajes locales:', localStorageError);
      }

      setError(`Error al cargar los mensajes: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim()) return;

    try {
      setIsSending(true);
      const response = await fetch('/api/chat-compras', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compraId,
          mensaje: nuevoMensaje.trim(),
          nombreRemitente: userData.nombre,
          remitente: 'Administrador de Compras',
          realizaRegistro: userData.nombre
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));

        // Si la tabla no existe, guardar localmente
        if (response.status === 404 && errorData.error?.includes('no encontrada')) {
          console.log('Tabla no existe, guardando mensaje localmente');
          const mensajeLocal: MensajeChat = {
            id: `local_${Date.now()}`,
            idConversacion: 1,
            fechaHoraMensaje: new Date().toISOString(),
            remitente: 'Administrador de Compras',
            nombreRemitente: userData.nombre,
            mensaje: nuevoMensaje.trim(),
            realizaRegistro: userData.nombre,
            solicitudCompra: [compraId]
          };

          // Guardar en localStorage
          const key = `chat_${compraId}`;
          const mensajesLocales = JSON.parse(localStorage.getItem(key) || '[]');
          mensajesLocales.push(mensajeLocal);
          localStorage.setItem(key, JSON.stringify(mensajesLocales));

          // Actualizar estado
          setMensajes(prev => [...prev, mensajeLocal]);
          setNuevoMensaje('');
          return;
        }

        throw new Error(errorData.error || 'Error al enviar el mensaje');
      }

      setNuevoMensaje('');
      await cargarMensajes(); // Recargar mensajes después de enviar
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al enviar el mensaje: ${errorMessage}`);
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageStyle = (remitente: string) => {
    const isCurrentUser = remitente === 'Administrador de Compras';

    return isCurrentUser
      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white self-end'
      : 'bg-white/10 text-white border border-white/20 self-start';
  };

  if (isLoading) {
    console.log('Mostrando estado de carga');
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl max-w-md w-full mx-4">
          <div className="flex items-center justify-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="text-white text-lg font-semibold">Cargando chat...</span>
          </div>
        </div>
      </div>
    );
  }

  console.log('Renderizando chat principal, mensajes:', mensajes.length, 'error:', !!error);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white/15 backdrop-blur-md rounded-3xl border border-white/20 shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h2 className="text-xl font-bold text-white">💬 Chat de Compra</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 text-red-300 text-center">
              <p className="mb-3">{error}</p>
              <button
                onClick={cargarMensajes}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}

          {mensajes.length === 0 ? (
            <div className="text-center text-white/70 py-8">
              <div className="text-4xl mb-4">💬</div>
              <p>No hay mensajes en esta conversación aún.</p>
              <p className="text-sm mt-2">¡Sé el primero en enviar un mensaje!</p>
            </div>
          ) : (
            mensajes.map((mensaje) => (
              <div
                key={mensaje.id}
                className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ${mensaje.remitente === 'Administrador de Compras' ? 'self-end' : 'self-start'}`}
              >
                <div className={`rounded-2xl px-4 py-3 ${getMessageStyle(mensaje.remitente)}`}>
                  <div className="text-xs opacity-75 mb-1">
                    {mensaje.nombreRemitente} • {formatDate(mensaje.fechaHoraMensaje)}
                  </div>
                  <div className="whitespace-pre-wrap">{mensaje.mensaje}</div>
                  {mensaje.realizaRegistro && (
                    <div className="text-xs opacity-75 mt-2 italic">
                      Registro: {mensaje.realizaRegistro}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/20 p-6">
          <div className="flex gap-3 justify-center">
            <textarea
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviarMensaje();
                }
              }}
              placeholder="Escribe tu mensaje..."
              className="w-full max-w-sm bg-white/10 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-white/70 focus:outline-none focus:border-blue-400 resize-none"
              rows={2}
              disabled={isSending}
            />
            <button
              onClick={enviarMensaje}
              disabled={!nuevoMensaje.trim() || isSending}
              className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-teal-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b border-white"></div>
              ) : (
                '📤'
              )}
              Enviar
            </button>
          </div>
          <div className="text-xs text-white/50 mt-2">
            Presiona Enter para enviar, Shift+Enter para nueva línea
          </div>
        </div>
      </div>
    </div>
  );
}