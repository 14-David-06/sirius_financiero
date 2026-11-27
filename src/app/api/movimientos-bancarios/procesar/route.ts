import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { checkRateLimit } from '@/lib/security/validation';
import { BANCOS, CUENTAS_BANCARIAS, esBancoId, type BancoId } from '@/lib/bancos/cuentas';
import { EXTRACTOS } from '@/lib/bancos/importar-extractos';
import { resumirImportacion, type ResultadoImportacion } from '@/lib/importacion/archivos-pendientes';

export const maxDuration = 60;

async function importar(banco: BancoId, limite: number) {
  const etiqueta = CUENTAS_BANCARIAS[banco].nombre;
  try {
    const resultado = await EXTRACTOS[banco].importar(limite);
    return { resultado, resumen: resumirImportacion(etiqueta, resultado), ok: resultado.errores.length === 0 };
  } catch (error) {
    console.error(`❌ Error importando ${etiqueta}:`, error);
    const mensaje = error instanceof Error ? error.message : 'error desconocido';
    return { resultado: null as ResultadoImportacion | null, resumen: `${etiqueta}: ${mensaje}`, ok: false, error: mensaje };
  }
}

/**
 * Importa los extractos que estén en la carpeta de OneDrive y aún no estén en Airtable
 * (p. ej. PDFs copiados directamente a la carpeta). Body opcional: { banco }.
 * Con banco: solo ese banco. Sin banco: Bancolombia y luego BBVA.
 */
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

  const cuerpo: { banco?: unknown } = await request.json().catch(() => ({}));
  if (cuerpo.banco !== undefined && !esBancoId(cuerpo.banco)) {
    return NextResponse.json({ success: false, error: 'Banco no válido (bancolombia o bbva)' }, { status: 400 });
  }
  const bancos = esBancoId(cuerpo.banco) ? [cuerpo.banco] : BANCOS;

  console.log(`🏦 Importación de extractos (${bancos.join(', ')}) solicitada por ${usuario.nombre}`);
  const limite = Date.now() + 40_000;
  const resultados: Partial<Record<BancoId, Awaited<ReturnType<typeof importar>>>> = {};
  for (const banco of bancos) {
    resultados[banco] = await importar(banco, limite);
  }

  const lista = Object.values(resultados);
  const message = lista.map(r => r.resumen).join('\n');
  console.log(message);

  return NextResponse.json({
    success: lista.every(r => r.ok),
    message,
    ...Object.fromEntries(Object.entries(resultados).map(([banco, r]) => [banco, r.resultado])),
    error: lista.find(r => r.error)?.error,
  });
}
