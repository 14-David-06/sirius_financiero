import { NextRequest, NextResponse } from 'next/server';
import { conciliarCartera, obtenerEstadisticasCartera } from '@/lib/cartera/conciliacion';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Endpoint: Conciliar Cartera
 *
 * POST /api/cartera/conciliar
 * Aplica los pagos de movimientos bancarios a las facturas pendientes en cascada.
 * Reemplaza el workflow n8n "AUTOMA_Actualizar_Cartera" (GPrg5lNezVBlDdbm).
 *
 * Requiere autenticación (categoría: Administrador, Gerencia, Desarrollador)
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let decoded: { categoria: string; nombre: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { categoria: string; nombre: string };
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar permisos
    const categoriasPermitidas = ['Administrador', 'Gerencia', 'Desarrollador'];
    if (!categoriasPermitidas.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Sin permisos para ejecutar esta operación' },
        { status: 403 }
      );
    }

    const inicio = Date.now();
    console.log(`🔄 [Conciliar Cartera] Iniciando conciliación - usuario: ${decoded.nombre}`);

    // Obtener estadísticas antes de conciliar
    const estadisticasAntes = await obtenerEstadisticasCartera();
    console.log('📊 [Conciliar Cartera] Estado inicial:', estadisticasAntes);

    // Ejecutar conciliación
    const resultado = await conciliarCartera();

    // Obtener estadísticas después de conciliar
    const estadisticasDespues = await obtenerEstadisticasCartera();

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log('✅ [Conciliar Cartera] Completado:', {
      duracion: `${duracion}s`,
      actualizadas: resultado.facturasActualizadas,
      movimientos: resultado.movimientosProcesados,
    });

    // Resumen de cambios
    const cambios = {
      sinPagar: {
        antes: estadisticasAntes.sinPagar,
        despues: estadisticasDespues.sinPagar,
        diferencia: estadisticasDespues.sinPagar - estadisticasAntes.sinPagar,
      },
      parcial: {
        antes: estadisticasAntes.parcial,
        despues: estadisticasDespues.parcial,
        diferencia: estadisticasDespues.parcial - estadisticasAntes.parcial,
      },
      pagada: {
        antes: estadisticasAntes.pagada,
        despues: estadisticasDespues.pagada,
        diferencia: estadisticasDespues.pagada - estadisticasAntes.pagada,
      },
      totalPendiente: {
        antes: estadisticasAntes.totalPendiente,
        despues: estadisticasDespues.totalPendiente,
        diferencia: estadisticasDespues.totalPendiente - estadisticasAntes.totalPendiente,
      },
    };

    return NextResponse.json({
      success: true,
      mensaje: 'Conciliación de cartera completada',
      resultado: {
        facturasActualizadas: resultado.facturasActualizadas,
        movimientosProcesados: resultado.movimientosProcesados,
        duracionSegundos: parseFloat(duracion),
      },
      cambios,
      detalles: resultado.detalles,
      timestamp: new Date().toISOString(),
      usuario: decoded.nombre,
    });
  } catch (error) {
    console.error('❌ [Conciliar Cartera] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error al conciliar cartera',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Obtener estadísticas de cartera sin conciliar
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const estadisticas = await obtenerEstadisticasCartera();

    return NextResponse.json({
      success: true,
      estadisticas,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Estadísticas Cartera] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener estadísticas',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
