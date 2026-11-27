import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { checkRateLimit } from '@/lib/security/validation';
import { CUENTAS_BANCARIAS, esBancoId } from '@/lib/bancos/cuentas';
import { EXTRACTOS, validarExtracto } from '@/lib/bancos/importar-extractos';
import { subirArchivo } from '@/lib/microsoft-graph';

export const maxDuration = 60;

// Vercel no acepta cuerpos de más de 4,5 MB y la carga simple de Graph llega a 4 MB
const TAMANO_MAXIMO = 4 * 1024 * 1024;

/** "2026-11-27 12-38-05 EXTRACTO OCTUBRE.pdf": legible en OneDrive y sin choques de nombre. */
function nombreEnOneDrive(original: string): string {
  const marca = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
    .format(new Date())
    .replace(/:/g, '-');
  const base = original
    .replace(/\.pdf$/i, '')
    .replace(/["*:<>?/\\|#%]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return `${marca} ${base || 'extracto'}.pdf`;
}

/**
 * Carga un extracto PDF de UN banco: lo valida, lo guarda en la carpeta de OneDrive de
 * ese banco e importa de inmediato sus movimientos a la tabla de ese banco.
 * multipart/form-data: banco (bancolombia | bbva), archivo (PDF)
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
      { success: false, error: 'Demasiadas cargas seguidas. Espera un minuto e inténtalo de nuevo.' },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'No se recibió el archivo' }, { status: 400 });
  }

  const banco = formData.get('banco');
  const archivo = formData.get('archivo');
  if (!esBancoId(banco)) {
    return NextResponse.json({ success: false, error: 'Banco no válido (bancolombia o bbva)' }, { status: 400 });
  }
  if (!(archivo instanceof File)) {
    return NextResponse.json({ success: false, error: 'No se recibió el archivo' }, { status: 400 });
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return NextResponse.json({ success: false, error: 'El archivo supera el máximo de 4 MB' }, { status: 413 });
  }

  const contenido = Buffer.from(await archivo.arrayBuffer());
  // Los PDF que descarga el portal de BBVA traen un encabezado MIME antes de "%PDF-";
  // los lectores de PDF lo toleran si aparece en el primer KB.
  if (!contenido.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
    return NextResponse.json({ success: false, error: 'El archivo no es un PDF' }, { status: 400 });
  }

  const cuenta = CUENTAS_BANCARIAS[banco];
  const extracto = EXTRACTOS[banco];

  let validado;
  try {
    validado = await validarExtracto(banco, contenido);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'No se pudo revisar el extracto' },
      { status: 422 }
    );
  }

  let subido;
  try {
    subido = await subirArchivo(extracto.carpetaId, nombreEnOneDrive(archivo.name), contenido, 'application/pdf');
  } catch (error) {
    console.error(`❌ Error subiendo extracto de ${cuenta.nombre} a OneDrive:`, error);
    return NextResponse.json(
      { success: false, error: 'No se pudo guardar el extracto en OneDrive. Inténtalo de nuevo.' },
      { status: 502 }
    );
  }
  console.log(`🏦 Extracto de ${cuenta.nombre} subido por ${usuario.nombre}: ${subido.name}`);

  const archivoSubido = { nombre: subido.name, url: subido.webUrl };
  try {
    // Importa todos los pendientes de la carpeta en orden de carga, incluido este
    const importacion = await extracto.importar(Date.now() + 40_000);
    return NextResponse.json({
      success: importacion.errores.length === 0,
      archivo: archivoSubido,
      extracto: validado,
      importacion,
    });
  } catch (error) {
    console.error(`❌ Error importando extractos de ${cuenta.nombre}:`, error);
    return NextResponse.json({
      success: false,
      archivo: archivoSubido,
      extracto: validado,
      error: `El extracto quedó guardado en OneDrive, pero no se pudo importar: ${
        error instanceof Error ? error.message : 'error desconocido'
      }`,
    });
  }
}
