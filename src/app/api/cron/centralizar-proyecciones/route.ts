import { NextRequest, NextResponse } from 'next/server';
import { vincularProyecciones } from '@/lib/centralizacion-proyecciones';

/**
 * Cron job: Centralización de Proyecciones
 *
 * Vincula registros de Proyección con Centralización General por Año + Semana.
 * Reemplaza el workflow n8n "Centralización Proyecciones" (iAWXjBOQrnJFfAJ2YewCl).
 *
 * Cron schedule (vercel.json): L-V 15:00 y 19:00 UTC (10:00 y 14:00 COT)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autorización del cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ [Cron Centralizar Proyecciones] Autorización inválida');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const inicio = Date.now();
    console.log('🔄 [Cron Centralizar Proyecciones] Iniciando vinculación...');

    // Ejecutar vinculación
    const resultado = await vincularProyecciones();

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log('✅ [Cron Centralizar Proyecciones] Completado:', {
      duracion: `${duracion}s`,
      ...resultado,
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Centralización de proyecciones completada',
      estadisticas: {
        procesadas: resultado.procesadas,
        vinculadas: resultado.vinculadas,
        sinVincular: resultado.sinVincular,
        duracionSegundos: parseFloat(duracion),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Cron Centralizar Proyecciones] Error:', error);

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
