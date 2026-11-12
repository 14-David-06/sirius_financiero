import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security/validation';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { importarExcelPendientesDian } from '@/lib/dian/importar-excel';
import { resumirImportacion } from '@/lib/importacion/archivos-pendientes';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const usuario = obtenerUsuarioSesion(request);
  if (!usuario) {
    return NextResponse.json({ success: false, error: 'Sesión no válida' }, { status: 401 });
  }
  if (usuario.categoria === 'Colaborador') {
    return NextResponse.json({ success: false, error: 'No tiene permisos para esta acción' }, { status: 403 });
  }

  const clientIP = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  if (!checkRateLimit(clientIP, 5, 60000)) {
    console.warn('⚠️ Rate limit excedido para movimientos DIAN', clientIP);
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Espere un momento antes de volver a ejecutar.' },
      { status: 429 }
    );
  }

  try {
    console.log(`🚀 Importación DIAN solicitada por ${usuario.nombre}`);
    const resultado = await importarExcelPendientesDian(Date.now() + 45_000);
    const message = resumirImportacion('DIAN', resultado);
    const totalMovimientos = resultado.procesados.reduce((suma, archivo) => suma + archivo.registrosCreados, 0);

    console.log(`✅ ${message}`);
    return NextResponse.json({
      success: resultado.errores.length === 0,
      message,
      totalMovimientos,
      resultado,
      ...(resultado.errores.length > 0 && { error: message }),
    });
  } catch (error) {
    console.error('❌ Error en movimientos-dian:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al importar los movimientos DIAN',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de Movimientos DIAN',
    description: 'Importa los Excel de la DIAN (OneDrive) que aún no estén en Airtable',
    methods: ['POST'],
  });
}
