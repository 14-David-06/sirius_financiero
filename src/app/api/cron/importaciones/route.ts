import { NextRequest, NextResponse } from 'next/server';
import { importarExcelPendientesDian } from '@/lib/dian/importar-excel';
import { importarExtractosBancolombia, importarExtractosBbva } from '@/lib/bancos/importar-extractos';
import { resumirImportacion, type ResultadoImportacion } from '@/lib/importacion/archivos-pendientes';

export const maxDuration = 60;

const IMPORTACIONES: [string, (limite: number) => Promise<ResultadoImportacion>][] = [
  ['DIAN', importarExcelPendientesDian],
  ['Bancolombia', importarExtractosBancolombia],
  ['BBVA', importarExtractosBbva],
];

// Vercel Cron envía "Authorization: Bearer <CRON_SECRET>" cuando la variable existe
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  const limite = Date.now() + 45_000;
  const resumenes: string[] = [];
  let conErrores = false;

  for (const [etiqueta, importar] of IMPORTACIONES) {
    try {
      const resultado = await importar(limite);
      resumenes.push(resumirImportacion(etiqueta, resultado));
      conErrores ||= resultado.errores.length > 0;
    } catch (error) {
      console.error(`❌ Cron: error en ${etiqueta}:`, error);
      resumenes.push(`${etiqueta}: ${error instanceof Error ? error.message : 'error desconocido'}`);
      conErrores = true;
    }
  }

  console.log('⏰ Cron importaciones:\n' + resumenes.join('\n'));
  return NextResponse.json({ success: !conErrores, resumenes }, { status: conErrores ? 500 : 200 });
}
