import { NextRequest, NextResponse } from 'next/server';
import { vincularProyecciones } from '@/lib/centralizacion-proyecciones';

/**
 * Webhook para Automatización de Airtable: Centralizar Proyecciones
 *
 * POST /api/webhook/centralizar-proyecciones
 * Sin autenticación (llamado desde Airtable automation)
 *
 * Reemplaza webhook n8n 879c3821-... en automatización wflK7AosIDcBJmcYU
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔗 [Webhook Airtable] Centralizar Proyecciones iniciado');

    // Opcional: Validar que viene de Airtable
    const userAgent = request.headers.get('user-agent') || '';
    if (!userAgent.includes('Airtable')) {
      console.warn('⚠️ [Webhook Airtable] User-Agent no es de Airtable:', userAgent);
      // No bloqueamos, solo advertimos
    }

    const resultado = await vincularProyecciones();

    console.log('✅ [Webhook Airtable] Completado:', resultado);

    return NextResponse.json({
      success: true,
      mensaje: 'Centralización de proyecciones completada desde Airtable',
      estadisticas: {
        procesadas: resultado.procesadas,
        vinculadas: resultado.vinculadas,
        sinVincular: resultado.sinVincular,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Webhook Airtable] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error al centralizar proyecciones',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
