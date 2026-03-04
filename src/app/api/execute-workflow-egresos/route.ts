import { NextRequest, NextResponse } from 'next/server';

// Interface para la respuesta esperada del workflow de n8n
interface FacturaCreada {
  id: string;
  numeroFactura?: string;
  proveedor?: string;
  monto?: number;
}

interface WorkflowResponse {
  success: boolean;
  facturasCreadas?: FacturaCreada[];
  totalFacturas?: number;
  mensaje?: string;
  error?: string;
}

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

    // Configurar timeout más largo para workflows que crean múltiples facturas
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos de timeout

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

    if (webhookResponse.ok) {
      const webhookResultText = await webhookResponse.text();
      console.log('✅ Workflow ejecutado exitosamente');
      console.log('📄 Respuesta webhook (raw):', webhookResultText || '(sin contenido)');

      // Intentar parsear la respuesta JSON del workflow
      let workflowData: WorkflowResponse | null = null;
      
      if (webhookResultText) {
        try {
          workflowData = JSON.parse(webhookResultText);
          console.log('📊 Datos parseados del workflow:', JSON.stringify(workflowData, null, 2));
        } catch (parseError) {
          console.warn('⚠️ No se pudo parsear la respuesta como JSON:', parseError);
        }
      }

      // Construir respuesta con los datos de las facturas creadas
      return NextResponse.json({
        success: true,
        message: workflowData?.mensaje || 'Workflow ejecutado exitosamente',
        mode: mode,
        facturasCreadas: workflowData?.facturasCreadas || [],
        totalFacturas: workflowData?.totalFacturas || 0,
        rawResponse: webhookResultText || null,
      });
    } else {
      const errorBody = await webhookResponse.text();
      console.error('❌ ERROR WEBHOOK (EGRESOS - All):');
      console.error('   Status:', webhookResponse.status);
      console.error('   Body:', errorBody);

      return NextResponse.json(
        { 
          success: false, 
          error: `Error al ejecutar webhook: ${webhookResponse.status}`,
          details: errorBody
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error en execute-workflow-egresos:', error);
    
    // Manejar timeout específicamente
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'El workflow tardó demasiado en responder (timeout de 2 minutos)',
          isTimeout: true
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al ejecutar el workflow' 
      },
      { status: 500 }
    );
  }
}
