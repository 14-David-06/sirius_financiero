import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentRequest {
  message: string;
  userData: any;
  conversationHistory: Message[];
}

export async function POST(request: NextRequest) {
  try {
    const { message, userData, conversationHistory }: AgentRequest = await request.json();

    if (!message || !userData) {
      return NextResponse.json(
        { error: 'Mensaje y datos de usuario requeridos' },
        { status: 400 }
      );
    }

    // Obtener datos de análisis de caja menor
    const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/caja-menor-analisis`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!analysisResponse.ok) {
      throw new Error('Error al obtener datos de análisis de caja menor');
    }

    const analysisData = await analysisResponse.json();

    // Preparar el contexto para OpenAI
    const systemPrompt = `Eres un asistente financiero especializado en el análisis de Caja Menor para Sirius Financiero.

Tu personalidad:
- Profesional pero amigable
- Experto en finanzas y contabilidad
- Preventivo y proactivo en recomendaciones
- Claro y conciso en explicaciones
- Siempre dispuesto a profundizar cuando se solicita

Información disponible:
${JSON.stringify(analysisData, null, 2)}

Instrucciones específicas:
1. Analiza los datos proporcionados y responde preguntas sobre caja menor
2. Identifica patrones, tendencias y posibles problemas
3. Proporciona recomendaciones basadas en mejores prácticas financieras
4. Si no tienes suficiente información, solicita aclaraciones
5. Mantén un tono profesional pero accesible
6. Usa formato claro con viñetas cuando sea apropiado
7. Incluye números y porcentajes cuando analices datos cuantitativos

Pregunta del usuario: ${message}

Historial de conversación (últimos mensajes):
${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Responde de manera útil y precisa.`;

// Llamar a OpenAI para generar respuesta
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      throw new Error('No se pudo generar respuesta');
    }

    return NextResponse.json({
      response: response.trim(),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error en agente de caja menor:', error);

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}