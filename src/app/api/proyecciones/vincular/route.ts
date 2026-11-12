import { NextRequest, NextResponse } from 'next/server';
import { vincularProyecciones } from '@/lib/centralizacion-proyecciones';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

/**
 * Endpoint manual: Vincular Proyecciones con Centralización General
 *
 * POST /api/proyecciones/vincular
 * Requiere autenticación (categoría: Administrador, Gerencia, Desarrollador)
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let decoded: { categoria: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { categoria: string };
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
    console.log('🔄 [Vincular Proyecciones] Iniciando vinculación manual...');

    // Ejecutar vinculación
    const resultado = await vincularProyecciones();

    const duracion = ((Date.now() - inicio) / 1000).toFixed(2);

    console.log('✅ [Vincular Proyecciones] Completado:', {
      duracion: `${duracion}s`,
      ...resultado,
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Vinculación de proyecciones completada',
      estadisticas: {
        procesadas: resultado.procesadas,
        vinculadas: resultado.vinculadas,
        sinVincular: resultado.sinVincular,
        duracionSegundos: parseFloat(duracion),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [Vincular Proyecciones] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Error al vincular proyecciones',
        detalles: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
