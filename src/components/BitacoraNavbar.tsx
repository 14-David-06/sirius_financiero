'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface BitacoraNavbarProps {
  userData: {
    id?: string;
    nombre?: string;
    recordId?: string;
  } | null;
}

export default function BitacoraNavbar({ userData }: BitacoraNavbarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
    try {
      // Por ahora, crear transcripción con información del audio real
      const transcription = `Nota de audio grabada el ${new Date().toLocaleString()} - Duración: ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')} - Tamaño: ${(audioBlob.size / 1024).toFixed(2)}KB`;
      
      console.log('Audio grabado:', {
        size: audioBlob.size,
        type: audioBlob.type,
        duration: recordingTime
      });

      // Enviar a Airtable
      const response = await fetch('/api/bitacora-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcripcion: transcription,
          usuario: userData?.nombre || 'Usuario desconocido',
          usuarioId: userData?.recordId || userData?.id,
          audioSize: audioBlob.size,
          audioDuration: recordingTime
        }),
      });

      if (response.ok) {
        // Mostrar indicador de éxito brevemente
        setTimeout(() => {
          setRecordingTime(0);
        }, 1000);
      } else {
        console.error('Error al enviar audio:', await response.text());
      }

    } catch (error) {
      console.error('Error processing audio:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMouseDown = () => {
    if (!isProcessing) {
      startRecording();
    }
  };

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isProcessing) {
      startRecording();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopRecording();
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-3">
      {/* Timer display cuando está grabando */}
      {(isRecording || isProcessing) && (
        <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-200 shadow-sm">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-gray-700 text-sm font-medium">
            {isProcessing ? 'Enviando...' : formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Botón de grabación minimalista */}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 select-none group ${
          isRecording
            ? 'bg-red-500 scale-105 shadow-lg shadow-red-500/30'
            : isProcessing
            ? 'bg-green-500 animate-pulse'
            : 'bg-[#00A3FF] hover:bg-[#0092E6] hover:scale-105 shadow-md hover:shadow-lg'
        } ${!isRecording && !isProcessing ? 'hover:shadow-[#00A3FF]/30' : ''}`}
        title={isRecording ? "Suelta para enviar" : "Mantén presionado para grabar"}
        disabled={isProcessing}
        style={{
          boxShadow: isRecording 
            ? '0 4px 20px rgba(239, 68, 68, 0.4)' 
            : isProcessing 
            ? '0 4px 20px rgba(34, 197, 94, 0.4)'
            : '0 2px 8px rgba(0, 163, 255, 0.2)'
        }}
      >
        {/* Efecto de onda mientras graba */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75"></div>
        )}
        
        {isRecording ? (
          <MicOff className="w-5 h-5 text-white" />
        ) : (
          <Mic className={`w-5 h-5 text-white transition-transform duration-300 ${!isProcessing ? 'group-hover:scale-110' : ''}`} />
        )}
      </button>
    </div>
  );
}