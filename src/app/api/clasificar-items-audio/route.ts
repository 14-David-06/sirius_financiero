import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcripcion } = await request.json();

    if (!transcripcion || typeof transcripcion !== 'string' || transcripcion.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó texto para clasificar' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Configuración de IA faltante' },
        { status: 500 }
      );
    }

    const prompt = `Eres un experto en gestión de inventarios e insumos industriales. Tu tarea es extraer items de un texto dictado por voz.

TEXTO DICTADO:
"${transcripcion}"

Extrae TODOS los items mencionados. Para cada item determina:
1. **nombre**: El nombre del insumo o producto (claro y conciso)
2. **cantidad**: La cantidad mencionada (número). Si no se menciona, usa 1
3. **unidad**: La unidad de medida (Unidad, Kg, Lt, Galon, Caja, Bulto, Rollo, Paquete, Global). Si no se menciona, usa "Unidad"
4. **area**: El área, centro de costos o destino mencionado para ese item. Si se menciona un área general para todos, aplícala a todos. Si no se menciona, déjalo vacío

REGLAS:
- El texto viene de dictado por voz, puede tener errores de transcripción. Interpreta la intención
- Si dicen "para producción", "para el laboratorio", "para administración", eso es el área
- Si dicen "20 kilos de cal", la cantidad es 20 y la unidad es Kg
- Si dicen "3 cajas de guantes", la cantidad es 3 y la unidad es Caja
- Si mencionan un área general al inicio o final, aplícala a todos los items que no tengan área específica
- NO inventes items que no estén en el texto

Responde SOLO con un JSON válido sin markdown ni backticks:
{
  "items": [
    {
      "nombre": "string",
      "cantidad": number,
      "unidad": "string",
      "area": "string o vacío"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en gestión de inventarios. Responde siempre con JSON válido sin markdown ni backticks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || '';

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Error parseando respuesta de IA:', responseText);
      return NextResponse.json(
        { success: false, error: 'Error al procesar la respuesta de la IA' },
        { status: 500 }
      );
    }

    const items = (parsed.items || []).map((item: { nombre: string; cantidad: number; unidad: string; area: string }, index: number) => ({
      id: `audio-${Date.now()}-${index}`,
      nombre: item.nombre || '',
      cantidad: item.cantidad || 1,
      unidad: item.unidad || 'Unidad',
      area: item.area || '',
    }));

    return NextResponse.json({
      success: true,
      items,
      totalItems: items.length,
    });
  } catch (error) {
    console.error('Error clasificando items de audio:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error al clasificar items' },
      { status: 500 }
    );
  }
}
