import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // Verificar que tenemos la API key de OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OpenAI API key');
      return NextResponse.json(
        { error: 'Configuración de IA faltante' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo de audio' },
        { status: 400 }
      );
    }

    // Verificar tipo de archivo
    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'];
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado' },
        { status: 400 }
      );
    }

    // Verificar tamaño (max 25MB para OpenAI)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande (máximo 25MB)' },
        { status: 400 }
      );
    }

    console.log(`Transcribiendo audio: ${audioFile.name}, ${audioFile.size} bytes, ${audioFile.type}`);

    try {
      // Transcribir el audio usando OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "es", // Español
        response_format: "text"
      });

      console.log('Transcripción completada exitosamente');

      return NextResponse.json({
        success: true,
        transcription: transcription,
        metadata: {
          filename: audioFile.name,
          size: audioFile.size,
          type: audioFile.type,
          duration: null // OpenAI no retorna duración
        }
      });

    } catch (openaiError) {
      console.error('Error de OpenAI:', openaiError);
      
      return NextResponse.json(
        { 
          error: 'Error en la transcripción de audio',
          details: process.env.NODE_ENV === 'development' ? openaiError : undefined
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error procesando audio:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API de transcripción de audio activa',
    supported_formats: ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'],
    max_file_size: '25MB',
    language: 'Spanish (es)',
    model: 'whisper-1'
  });
}
