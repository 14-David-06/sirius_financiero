import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { checkRateLimit } from '@/lib/security/validation';
import { importarExtractosBancolombia, importarExtractosBbva } from '@/lib/bancos/importar-extractos';
import { resumirImportacion, type ResultadoImportacion } from '@/lib/importacion/archivos-pendientes';

export const maxDuration = 60;

async function importar(etiqueta: string, importador: () => Promise<ResultadoImportacion>) {
  try {
    const resultado = await importador();
    return { resultado, resumen: resumirImportacion(etiqueta, resultado), ok: resultado.errores.length === 0 };
  } catch (error) {
    console.error(`❌ Error importando ${etiqueta}:`, error);
    return { resultado: null, resumen: `${etiqueta}: ${error instanceof Error ? error.message : 'error desconocido'}`, ok: false };
  }
}

/** Importa los extractos pendientes de Bancolombia y BBVA (antes: webhooks n8n desde el navegador). */
export async function POST(request: NextRequest) {
  const usuario = obtenerUsuarioSesion(request);
  if (!usuario) {
    return NextResponse.json({ success: false, error: 'Sesión no válida' }, { status: 401 });
  }
  if (usuario.categoria === 'Colaborador') {
    return NextResponse.json({ success: false, error: 'No tiene permisos para esta acción' }, { status: 403 });
  }

  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIP, 5, 60000)) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Espere un momento antes de volver a ejecutar.' },
      { status: 429 }
    );
  }

  console.log(`🏦 Importación de extractos solicitada por ${usuario.nombre}`);
  const limite = Date.now() + 40_000;
  const bancolombia = await importar('Bancolombia', () => importarExtractosBancolombia(limite));
  const bbva = await importar('BBVA', () => importarExtractosBbva(limite));
  const message = `${bancolombia.resumen}\n${bbva.resumen}`;
  console.log(message);

  return NextResponse.json({
    success: bancolombia.ok && bbva.ok,
    message,
    bancolombia: bancolombia.resultado,
    bbva: bbva.resultado,
  });
}
