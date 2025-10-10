import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Obtener el payload del frontend
    const payload = await request.json();
    
    console.log('Proxy recibió payload:', payload);
    
    // Obtener la URL del webhook desde variables de entorno
    const webhookUrl = process.env.N8N_SIMULATION_WEBHOOK;
    
    if (!webhookUrl) {
      console.error('N8N_SIMULATION_WEBHOOK no configurado');
      return NextResponse.json(
        { error: 'Configuración del webhook no encontrada' },
        { status: 500 }
      );
    }
    
    console.log('Enviando a n8n:', webhookUrl);
    
    // Hacer el request server-side al webhook de n8n
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sirius-Financiero-Proxy/1.0',
      },
      body: JSON.stringify(payload),
    });
    
    console.log('Respuesta de n8n:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de n8n:', errorText);
      
      return NextResponse.json(
        { 
          error: 'Error en el webhook de n8n',
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      );
    }
    
    // Intentar parsear la respuesta
    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }
    
    console.log('Datos de respuesta de n8n:', responseData);
    
    return NextResponse.json({
      success: true,
      message: 'Simulación enviada exitosamente al webhook',
      n8n_response: responseData
    });
    
  } catch (error) {
    console.error('Error en proxy de simulación:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del proxy',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Proxy de simulación activo',
    description: 'Este endpoint hace de proxy entre el frontend y n8n para evitar problemas de CORS',
    methods: ['POST'],
    webhook_configured: !!process.env.N8N_SIMULATION_WEBHOOK
  });
}