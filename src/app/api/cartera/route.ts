import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { obtenerRegistrosCartera } from '@/lib/cartera/registros';

export async function GET(request: NextRequest) {
  if (!obtenerUsuarioSesion(request)) {
    return NextResponse.json({ success: false, error: 'Sesión no válida' }, { status: 401 });
  }

  try {
    const data = await obtenerRegistrosCartera();
    return NextResponse.json({ success: true, data, generadoEn: new Date().toISOString() });
  } catch (error: unknown) {
    console.error('Error al obtener cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
