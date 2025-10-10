import { NextRequest, NextResponse } from 'next/server';

// En producción, usar Redis o una base de datos
// Por simplicidad, usamos un Map en memoria
const simulationResponses = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log('Respuesta recibida de n8n:', data);
    
    const { request_id, result, status, error } = data;
    
    if (!request_id) {
      return NextResponse.json(
        { error: 'request_id es requerido' },
        { status: 400 }
      );
    }
    
    // Guardar la respuesta con timestamp
    simulationResponses.set(request_id, {
      result,
      status,
      error,
      completed: true,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Respuesta guardada para request_id: ${request_id}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'Respuesta recibida correctamente'
    });
    
  } catch (error) {
    console.error('Error procesando respuesta de simulación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const requestId = url.searchParams.get('id');
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'ID de request requerido' },
        { status: 400 }
      );
    }
    
    const response = simulationResponses.get(requestId);
    
    if (response) {
      // Opcional: limpiar respuesta después de ser consultada
      // simulationResponses.delete(requestId);
      return NextResponse.json(response);
    }
    
    return NextResponse.json({ 
      completed: false,
      message: 'Simulación en proceso...'
    });
    
  } catch (error) {
    console.error('Error consultando respuesta de simulación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}