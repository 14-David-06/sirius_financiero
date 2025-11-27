'use client';

import { useState, useEffect, useRef } from 'react';
import { UserData } from '@/types/compras';

// Declarar tipos para Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface MensajeChat {
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
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mensajesMarcadosComoVistosRef = useRef<Set<string>>(new Set());
  const mensajesMarcadosInicialmenteRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    cargarMensajes();
  }, [compraId]);

  useEffect(() => {
    // Resetear el tracking de mensajes marcados como vistos cuando cambia la compra
    mensajesMarcadosComoVistosRef.current.clear();
    mensajesMarcadosInicialmenteRef.current = false;
  }, [compraId]);

  useEffect(() => {
    if (mensajes.length > 0 && !mensajesMarcadosInicialmenteRef.current && userData.categoria !== 'Administrador' && userData.categoria !== 'Gerencia' && userData.categoria !== 'Desarrollador') {
      marcarMensajesComoVistos();
      mensajesMarcadosInicialmenteRef.current = true;
    }
  }, [mensajes, userData.categoria]);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

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

      // Los mensajes se marcarán como vistos automáticamente por el useEffect
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

          // Los mensajes se marcarán como vistos automáticamente por el useEffect
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

  const marcarMensajesComoVistos = async () => {
    let mensajesNoVistos: MensajeChat[] = [];
    
    try {
      // Solo marcar mensajes del admin como vistos cuando el solicitante los lee
      mensajesNoVistos = mensajes.filter(
        msg => msg.remitente === 'Administrador de Compras' && 
               !msg.fechaHoraVisto && 
               !mensajesMarcadosComoVistosRef.current.has(msg.id)
      );

      if (mensajesNoVistos.length === 0) return;

      // Marcar como procesados para evitar loops
      mensajesNoVistos.forEach(msg => mensajesMarcadosComoVistosRef.current.add(msg.id));

      // Actualizar en Airtable
      const updatePromises = mensajesNoVistos.map(async (mensaje) => {
        const response = await fetch('/api/chat-compras', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: mensaje.id,
            fechaHoraVisto: new Date().toISOString()
          }),
        });
        return response.ok;
      });

      await Promise.all(updatePromises);

      // Actualizar estado local
      setMensajes(prev => prev.map(msg =>
        mensajesNoVistos.some(m => m.id === msg.id)
          ? { ...msg, fechaHoraVisto: new Date().toISOString() }
          : msg
      ));

    } catch (error) {
      console.error('Error al marcar mensajes como vistos:', error);
      // Si hay error, remover de la lista de procesados para permitir reintento
      mensajesNoVistos.forEach((msg: MensajeChat) => mensajesMarcadosComoVistosRef.current.delete(msg.id));
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
            solicitudCompra: [compraId],
            fechaHoraVisto: undefined
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

  const iniciarGrabacion = () => {
    if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz. Intenta con Chrome o Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'es-CO'; // Español de Colombia

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNuevoMensaje(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Error en reconocimiento de voz:', event.error);
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        alert('Error al reconocer voz: ' + event.error);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const detenerGrabacion = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
                  <div className="text-xs opacity-75 mb-1 flex items-center gap-1">
                    {mensaje.nombreRemitente} • {formatDate(mensaje.fechaHoraMensaje)}
                  </div>
                  <div className="whitespace-pre-wrap">{mensaje.mensaje}</div>
                  <div className="flex items-center justify-between mt-2">
                    {mensaje.realizaRegistro && (
                      <div className="text-xs opacity-75 italic">
                        Registro: {mensaje.realizaRegistro}
                      </div>
                    )}
                    {mensaje.remitente === 'Administrador de Compras' && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">
                          {mensaje.fechaHoraVisto ? 'visto' : 'enviado'}
                        </span>
                        <span className={`text-xs ${mensaje.fechaHoraVisto ? 'text-green-400' : 'text-gray-600'}`}>
                          ✓✓
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-white/20 p-6">
          <div className="flex justify-center">
            <div className="relative w-full max-w-sm">
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
                className="w-full bg-white/10 border border-white/30 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/70 focus:outline-none focus:border-blue-400 resize-none"
                rows={2}
                disabled={isSending}
              />
              <button
                onClick={isRecording ? detenerGrabacion : iniciarGrabacion}
                disabled={isSending}
                className={`absolute top-2 right-2 p-1 rounded-md transition-all duration-300 ${
                  isRecording
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isRecording ? 'Detener grabación' : 'Grabar mensaje de voz'}
              >
                {isRecording ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={enviarMensaje}
              disabled={!nuevoMensaje.trim() || isSending}
              className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-teal-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-3"
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