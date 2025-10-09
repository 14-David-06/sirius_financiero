'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Check, X, Loader2 } from 'lucide-react';
import { UserData } from '@/types/compras';

interface BitacoraNavbarProps {
  userData: UserData | null;
}

export default function BitacoraNavbar({ userData }: BitacoraNavbarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'success' | 'error' | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Solicitar permisos de audio con configuración específica
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          sampleSize: 16,
          channelCount: 1
        } 
      });
      
      // Verificar si MediaRecorder es compatible
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      } else {
        options.mimeType = 'audio/wav';
      }

      mediaRecorder.current = new MediaRecorder(stream, options);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log('Audio chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.current.onstop = async () => {
        const mimeType = mediaRecorder.current?.mimeType || 'audio/wav';
        const audioBlob = new Blob(audioChunks.current, { type: mimeType });
        console.log('Recording stopped. Final blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
        
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('Audio track stopped');
        });
        
        await processAndSendAudio(audioBlob);
      };

      mediaRecorder.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Iniciar grabación con timeslice para capturar datos periódicamente
      mediaRecorder.current.start(100); // Capturar cada 100ms
      setIsRecording(true);
      setRecordingTime(0);

      console.log('Recording started with format:', options.mimeType);

      // Iniciar timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      
      // Mostrar mensaje de error más específico
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          alert('Permisos de micrófono denegados. Por favor, permite el acceso al micrófono en la configuración del navegador.');
        } else if (error.name === 'NotFoundError') {
          alert('No se encontró un micrófono. Verifica que tengas un micrófono conectado.');
        } else {
          alert('Error al acceder al micrófono: ' + error.message);
        }
      } else {
        alert('Error desconocido al acceder al micrófono.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const processAndSendAudio = async (audioBlob: Blob) => {
    if (!userData) return;

    setIsProcessing(true);
    setProcessingStatus(null);
    
    try {
      console.log('Iniciando transcripción de audio:', {
        size: audioBlob.size,
        type: audioBlob.type,
        typeBase: audioBlob.type.split(';')[0],
        duration: recordingTime
      });

      // Transcribir el audio usando OpenAI Whisper
      const formData = new FormData();
      
      // Determinar la extensión correcta basada en el tipo MIME
      let filename = 'recording';
      const mimeType = audioBlob.type.split(';')[0]; // Extraer tipo base
      switch (mimeType) {
        case 'audio/webm':
          filename += '.webm';
          break;
        case 'audio/mp4':
          filename += '.mp4';
          break;
        case 'audio/wav':
          filename += '.wav';
          break;
        case 'audio/ogg':
          filename += '.ogg';
          break;
        default:
          filename += '.webm'; // fallback
      }
      
      formData.append('audio', audioBlob, filename);

      const transcriptionResponse = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        const errorData = await transcriptionResponse.json();
        throw new Error(`Error en transcripción: ${errorData.error || 'Error desconocido'}`);
      }

      const transcriptionData = await transcriptionResponse.json();
      const transcription = transcriptionData.transcription;

      console.log('Transcripción completada:', transcription);

      // Verificar datos del usuario antes de enviar
      const userId = userData?.recordId;
      console.log('Datos del usuario para bitácora:', {
        nombre: userData?.nombre,
        recordId: userData?.recordId,
        userId: userId
      });

      // Enviar transcripción a Airtable
      const response = await fetch('/api/bitacora-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcripcion: transcription,
          usuario: userData?.nombre || 'Usuario desconocido',
          usuarioId: userId,
          audioSize: audioBlob.size,
          audioDuration: recordingTime
        }),
      });

      if (response.ok) {
        console.log('Nota de bitácora guardada exitosamente');
        setProcessingStatus('success');
        
        // Resetear el tiempo después de un breve delay
        setTimeout(() => {
          setRecordingTime(0);
        }, 1000);
      } else {
        const errorText = await response.text();
        console.error('Error al guardar en Airtable:', errorText);
        throw new Error('Error al guardar la nota en la bitácora');
      }

    } catch (error) {
      console.error('Error processing audio:', error);
      setProcessingStatus('error');
      
      // Mostrar error al usuario
      if (error instanceof Error) {
        console.error(`Error al procesar audio: ${error.message}`);
      } else {
        console.error('Error desconocido al procesar el audio');
      }
    } finally {
      setIsProcessing(false);
      
      // Limpiar el estado después de 3 segundos
      statusTimeoutRef.current = setTimeout(() => {
        setProcessingStatus(null);
      }, 3000);
    }
  };

  const handleMouseDown = () => {
    // Funcionalidad de click para activar/desactivar grabación
    if (isProcessing) return;
    
    if (isRecording) {
      // Si está grabando, detener y procesar
      stopRecording();
    } else {
      // Si no está grabando, iniciar
      startRecording();
    }
  };

  const handleMouseUp = () => {
    // Ya no necesitamos esta funcionalidad para el modo click
    // El comportamiento se maneja completamente en handleMouseDown
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    // Usar la misma lógica que handleMouseDown para dispositivos móviles
    if (isProcessing) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    // Ya no necesitamos esta funcionalidad para el modo click
  };

  return (
    <div className="flex items-center">
      {/* Botón de grabación con estados y efectos avanzados */}
      <button
        onClick={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-500 select-none group overflow-hidden ${
          isRecording
            ? 'bg-red-500 scale-110 shadow-2xl shadow-red-500/50 animate-pulse'
            : processingStatus === 'success'
            ? 'bg-green-500 shadow-2xl shadow-green-500/50 scale-110'
            : processingStatus === 'error'
            ? 'bg-red-600 shadow-2xl shadow-red-600/50 scale-110 animate-bounce'
            : isProcessing
            ? 'bg-gradient-to-r from-blue-500 to-purple-600 shadow-2xl shadow-blue-500/50 scale-105'
            : 'bg-gradient-to-r from-[#00A3FF] to-[#0066CC] hover:from-[#0092E6] hover:to-[#0055BB] hover:scale-110 shadow-lg hover:shadow-2xl transform hover:rotate-3'
        } ${!isRecording && !isProcessing && !processingStatus ? 'hover:shadow-[#00A3FF]/40' : ''}`}
        title={
          isRecording 
            ? "Click para detener y enviar" 
            : processingStatus === 'success'
            ? "¡Nota guardada exitosamente!"
            : processingStatus === 'error'
            ? "Error al procesar audio"
            : isProcessing 
            ? "Procesando audio..." 
            : "Click para iniciar grabación"
        }
        disabled={isProcessing}
        style={{
          boxShadow: isRecording 
            ? '0 8px 32px rgba(239, 68, 68, 0.6), 0 0 20px rgba(239, 68, 68, 0.4)' 
            : processingStatus === 'success'
            ? '0 8px 32px rgba(34, 197, 94, 0.6), 0 0 20px rgba(34, 197, 94, 0.4)'
            : processingStatus === 'error'
            ? '0 8px 32px rgba(220, 38, 38, 0.6), 0 0 20px rgba(220, 38, 38, 0.4)'
            : isProcessing 
            ? '0 8px 32px rgba(59, 130, 246, 0.6), 0 0 20px rgba(147, 51, 234, 0.4)'
            : '0 4px 16px rgba(0, 163, 255, 0.3)'
        }}
      >
        {/* Efecto de ondas múltiples mientras graba */}
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75"></div>
            <div className="absolute inset-0 rounded-full border border-red-300 animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute inset-0 rounded-full border border-red-200 animate-ping opacity-25" style={{ animationDelay: '1s' }}></div>
          </>
        )}

        {/* Efecto de partículas en éxito */}
        {processingStatus === 'success' && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-green-300 animate-ping opacity-75"></div>
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 opacity-20 animate-pulse"></div>
          </>
        )}

        {/* Efecto de shake en error */}
        {processingStatus === 'error' && (
          <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75"></div>
        )}

        {/* Efecto de breathing en procesamiento */}
        {isProcessing && (
          <>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-30 animate-pulse"></div>
            <div className="absolute -inset-2 rounded-full border border-blue-300 animate-ping opacity-40"></div>
          </>
        )}

        {/* Efecto de glow sutil en reposo */}
        {!isRecording && !isProcessing && !processingStatus && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#00A3FF] to-[#0066CC] opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
        )}

        {/* Efectos de brillo en hover */}
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
        
        {/* Íconos según el estado con animaciones */}
        {isRecording ? (
          <MicOff className="w-7 h-7 text-white animate-pulse transform group-hover:scale-110 transition-transform duration-200" />
        ) : processingStatus === 'success' ? (
          <Check className="w-7 h-7 text-white animate-bounce transform scale-110" />
        ) : processingStatus === 'error' ? (
          <X className="w-7 h-7 text-white animate-pulse transform scale-110" />
        ) : isProcessing ? (
          <Loader2 className="w-7 h-7 text-white animate-spin transform group-hover:scale-110 transition-transform duration-200" />
        ) : (
          <Mic className="w-7 h-7 text-white transition-all duration-300 transform group-hover:scale-125 group-hover:rotate-12 drop-shadow-lg" />
        )}

        {/* Efecto de ondas concéntricas en hover (solo en reposo) */}
        {!isRecording && !isProcessing && !processingStatus && (
          <div className="absolute inset-0 rounded-full border border-white/20 opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-500"></div>
        )}
      </button>
    </div>
  );
}