import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = body.mode || 'All';

    console.log(`🚀 Ejecutando workflow de egresos en modo: ${mode}`);

    const webhookUrl = process.env.N8N_WEBHOOK_FACTURACION_EGRESOS_URL;
    
    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_FACTURACION_EGRESOS_URL no está configurada en las variables de entorno');
    }

    const webhookPayload = {
      mode: mode, // 'All' para procesar todas las facturas pendientes
      timestamp: new Date().toISOString(),
      type: 'factura_egreso',
      action: 'execute_workflow'
    };

    console.log('📤 Payload webhook (EGRESOS - All):', JSON.stringify(webhookPayload, null, 2));

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    console.log('📥 Webhook status:', webhookResponse.status, webhookResponse.statusText);

    if (webhookResponse.ok) {
      const webhookResult = await webhookResponse.text();
      console.log('✅ Workflow ejecutado exitosamente');
      console.log('📄 Respuesta webhook:', webhookResult || '(sin contenido)');

      return NextResponse.json({
        success: true,
        message: 'Workflow ejecutado exitosamente',
        mode: mode,
      });
    } else {
      const errorBody = await webhookResponse.text();
      console.error('❌ ERROR WEBHOOK (EGRESOS - All):');
      console.error('   Status:', webhookResponse.status);
      console.error('   Body:', errorBody);

      return NextResponse.json(
        { 
          success: false, 
          error: `Error al ejecutar webhook: ${webhookResponse.status}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error en execute-workflow-egresos:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al ejecutar el workflow' 
      },
      { status: 500 }
    );
  }
}
