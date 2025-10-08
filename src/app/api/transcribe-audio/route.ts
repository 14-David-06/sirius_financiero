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

    // Verificar tipo de archivo (permitir codecs específicos)
    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg'];
    const audioType = audioFile.type.split(';')[0]; // Extraer solo el tipo base sin codecs
    
    if (!allowedTypes.includes(audioType)) {
      console.log('Tipo de archivo recibido:', audioFile.type);
      console.log('Tipo base extraído:', audioType);
      return NextResponse.json(
        { error: `Tipo de archivo no soportado: ${audioFile.type}` },
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
      // Crear un nuevo archivo con nombre y extensión apropiados para OpenAI
      let processedFile = audioFile;
      
      // Si es webm con codecs, crear un nuevo archivo sin los codecs en el tipo MIME
      if (audioFile.type.includes('webm') && audioFile.type.includes('codecs')) {
        const audioBuffer = await audioFile.arrayBuffer();
        processedFile = new File([audioBuffer], 'audio.webm', { 
          type: 'audio/webm' 
        });
        console.log(`Archivo procesado: ${processedFile.name}, tipo: ${processedFile.type}`);
      }

      // Transcribir el audio usando OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: processedFile,
        model: "whisper-1",
        language: "es", // Español
        response_format: "text"
      });

      console.log('Transcripción completada exitosamente');

      return NextResponse.json({
        success: true,
        transcription: transcription,
        metadata: {
          filename: processedFile.name,
          size: processedFile.size,
          type: processedFile.type,
          originalType: audioFile.type,
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
    supported_formats: ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/wav', 'audio/ogg'],
    max_file_size: '25MB',
    language: 'Spanish (es)',
    model: 'whisper-1',
    note: 'Los archivos webm con codecs se procesan automáticamente para compatibilidad con OpenAI'
  });
}
