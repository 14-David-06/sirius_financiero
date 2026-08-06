import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security/validation';

// Respuesta esperada (opcional) del workflow de n8n
interface WorkflowResponse {
  success?: boolean;
  mensaje?: string;
  totalMovimientos?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: el webhook dispara un proceso pesado en n8n
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    if (!checkRateLimit(clientIP, 5, 60000)) { // 5 ejecuciones por minuto
      console.warn('⚠️ Rate limit excedido para movimientos DIAN', clientIP);
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Espere un momento antes de volver a ejecutar.' },
        { status: 429 }
      );
    }

    const webhookUrl = process.env.N8N_WEBHOOK_MOVIMIENTOS_DIAN_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_MOVIMIENTOS_DIAN_URL no está configurada en las variables de entorno');
    }

    // El body es opcional: el botón puede invocar sin payload
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const webhookPayload = {
      action: 'consultar_movimientos_dian',
      type: 'movimiento_dian',
      timestamp: new Date().toISOString(),
      usuario: body.usuario || 'Usuario',
    };

    console.log('🚀 Ejecutando workflow de Movimientos DIAN...');
    console.log('📤 Payload webhook (DIAN):', JSON.stringify(webhookPayload, null, 2));

    // Timeout amplio: la consulta a la DIAN puede tardar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log('📥 Webhook status:', webhookResponse.status, webhookResponse.statusText);

    if (!webhookResponse.ok) {
      const errorBody = await webhookResponse.text();
      console.error('❌ ERROR WEBHOOK (DIAN):');
      console.error('   Status:', webhookResponse.status);
      console.error('   Body:', errorBody);

      return NextResponse.json(
        {
          success: false,
          error: `Error al ejecutar webhook: ${webhookResponse.status}`,
          details: errorBody,
        },
        { status: 500 }
      );
    }

    const webhookResultText = await webhookResponse.text();
    console.log('✅ Workflow de Movimientos DIAN ejecutado exitosamente');
    console.log('📄 Respuesta webhook (raw):', webhookResultText || '(sin contenido)');

    // Intentar parsear la respuesta JSON del workflow
    let workflowData: WorkflowResponse | null = null;

    if (webhookResultText) {
      try {
        workflowData = JSON.parse(webhookResultText);
      } catch (parseError) {
        console.warn('⚠️ No se pudo parsear la respuesta como JSON:', parseError);
      }
    }

    return NextResponse.json({
      success: true,
      message: workflowData?.mensaje || 'Consulta de movimientos DIAN iniciada exitosamente',
      totalMovimientos: workflowData?.totalMovimientos || 0,
      rawResponse: webhookResultText || null,
    });
  } catch (error) {
    console.error('❌ Error en movimientos-dian:', error);

    // Manejar timeout específicamente
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          success: false,
          error: 'El workflow tardó demasiado en responder (timeout de 2 minutos)',
          isTimeout: true,
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al ejecutar el workflow',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de Movimientos DIAN',
    description: 'Ejecuta el workflow de n8n que consulta los movimientos de la DIAN',
    methods: ['POST'],
    webhook_configured: !!process.env.N8N_WEBHOOK_MOVIMIENTOS_DIAN_URL,
  });
}
