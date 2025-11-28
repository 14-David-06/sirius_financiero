'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { Send, Bot, User, Loader2, AlertCircle, Mic, MicOff, Square, Volume2 } from 'lucide-react';
import type { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '@/types/speech-recognition';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isVoiceMessage?: boolean;
}

interface CajaMenorAgentProps {
  onClose?: () => void;
}

export default function CajaMenorAgent({ onClose }: CajaMenorAgentProps) {
  const { userData } = useAuthSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Verificar soporte de Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-CO'; // Español de Colombia

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsTranscribing(false);
        // Automáticamente enviar el mensaje de voz después de un breve delay
        setTimeout(() => {
          if (transcript.trim()) {
            sendMessage(true);
          }
        }, 500);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        setIsRecording(false);
        setIsTranscribing(false);
        setError('Error al transcribir audio. Verifica los permisos del micrófono.');
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
        setRecordingTime(0);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Mensaje inicial del agente
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `¡Hola! Soy tu asistente de IA especializado en Caja Menor. Puedo ayudarte con:

• 📊 **Análisis de saldos** - Estado actual de todas las cajas menores
• ⚠️ **Alertas y recomendaciones** - Identificar problemas o áreas de mejora
• 📈 **Tendencias y patrones** - Análisis de gastos por período
• 🔍 **Consultas específicas** - Información detallada sobre beneficiarios, conceptos, etc.
• 📋 **Reportes** - Resúmenes ejecutivos y estados financieros

¿En qué puedo ayudarte hoy?`,
        timestamp: new Date()
      }]);
    }
  }, [messages.length]);

  const startRecording = async () => {
    if (!speechSupported || !recognitionRef.current) {
      setError('El reconocimiento de voz no está disponible en este navegador.');
      return;
    }

    try {
      setIsRecording(true);
      setIsTranscribing(true);
      setRecordingTime(0);
      setError('');

      // Solicitar permisos del micrófono
      await navigator.mediaDevices.getUserMedia({ audio: true });

      recognitionRef.current.start();

      // Iniciar contador de tiempo
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error al iniciar grabación:', error);
      setIsRecording(false);
      setIsTranscribing(false);
      setError('Error al acceder al micrófono. Verifica los permisos.');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const handleSendMessage = () => {
    sendMessage(false);
  };

  const sendMessage = useCallback(async (isVoiceMessage = false) => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      isVoiceMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/caja-menor-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          userData: userData,
          conversationHistory: messages.slice(-10) // Últimos 10 mensajes para contexto
        }),
      });

      if (!response.ok) {
        throw new Error('Error al comunicarse con el agente');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error:', error);
      setError('Error al procesar la consulta. Por favor intenta de nuevo.');

      // Agregar mensaje de error
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, tuve un problema al procesar tu consulta. Por favor intenta de nuevo.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, userData, messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors duration-300 ${
              isRecording
                ? 'bg-red-500/20 animate-pulse'
                : isLoading
                ? 'bg-blue-500/20'
                : 'bg-blue-500/20'
            }`}>
              <Bot className={`w-6 h-6 transition-colors duration-300 ${
                isRecording
                  ? 'text-red-400'
                  : isLoading
                  ? 'text-blue-400 animate-pulse'
                  : 'text-blue-400'
              }`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Asistente IA - Caja Menor</h2>
              <div className="flex items-center gap-2">
                <p className="text-white/70 text-sm">Análisis inteligente de tus finanzas</p>
                {isRecording && (
                  <div className="flex items-center gap-1 bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/30">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
                    <span className="text-red-300 text-xs font-medium">ESCUCHANDO</span>
                  </div>
                )}
                {isLoading && (
                  <div className="flex items-center gap-1 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span className="text-blue-300 text-xs font-medium">PENSANDO</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!speechSupported && (
              <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-full border border-yellow-500/30">
                <MicOff className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-300 text-xs">Sin voz</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              disabled={isRecording}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="p-2 bg-blue-500/20 rounded-xl flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
              )}

              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600/80 text-white'
                    : 'bg-white/10 text-white border border-white/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  <p className="whitespace-pre-wrap flex-1">{message.content}</p>
                  {message.isVoiceMessage && (
                    <div className="flex items-center gap-1 text-blue-300 opacity-70">
                      <Mic className="w-3 h-3" />
                      <span className="text-xs">voz</span>
                    </div>
                  )}
                </div>
                <p className="text-xs opacity-60 mt-2">
                  {message.timestamp.toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {message.role === 'user' && (
                <div className="p-2 bg-blue-600/80 rounded-xl flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="p-2 bg-blue-500/20 rounded-xl flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div className="bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-white/70">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-2">
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-6 border-t border-white/10">
          {/* Indicador de grabación */}
          {isRecording && (
            <div className="mb-4 flex items-center justify-center gap-3 bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <Volume2 className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-medium">Grabando...</span>
                <span className="text-red-200 text-sm">{formatRecordingTime(recordingTime)}</span>
              </div>
            </div>
          )}

          {/* Indicador de transcripción */}
          {isTranscribing && !isRecording && (
            <div className="mb-4 flex items-center justify-center gap-3 bg-blue-500/20 border border-blue-500/30 rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-blue-300 font-medium">Transcribiendo audio...</span>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isRecording ? "Habla ahora..." : "Pregunta sobre el estado de la caja menor..."}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
                disabled={isLoading || isRecording}
              />

              {/* Botón de micrófono */}
              {speechSupported && (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-2 rounded-lg transition-all duration-200 ${
                    isRecording
                      ? 'bg-red-500/80 hover:bg-red-600/80 text-white animate-pulse'
                      : 'bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isRecording ? 'Detener grabación' : 'Grabar voz'}
                >
                  {isRecording ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || isRecording}
              className="bg-blue-600/80 hover:bg-blue-700/80 disabled:bg-gray-600/50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-blue-500/25 disabled:hover:shadow-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-3">
            <p className="text-white/50 text-xs">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
            {speechSupported && (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Mic className="w-3 h-3" />
                <span>Voz disponible</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}