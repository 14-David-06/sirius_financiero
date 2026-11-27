import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { obtenerRegistrosCartera } from '@/lib/cartera/registros';
import { ALCANCES_INFORME, analizarFacturas, hoyBogota } from '@/lib/cartera/analisis';
import { fechaLarga, htmlInformeCartera } from '@/lib/cartera/informe-pdf';
import { htmlAPdf } from '@/lib/pdf/html-a-pdf';

export const maxDuration = 60;

function leerLogo(): string | null {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'public', 'Logo-Sirius.png')).toString('base64');
  } catch (error) {
    console.warn('No se pudo cargar el logo para el informe de cartera:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!obtenerUsuarioSesion(request)) {
    return NextResponse.json({ success: false, error: 'Sesión no válida' }, { status: 401 });
  }

  const alcance = ALCANCES_INFORME.find(a => a.id === request.nextUrl.searchParams.get('alcance'));
  if (!alcance) {
    return NextResponse.json({ success: false, error: 'Alcance de informe no válido' }, { status: 400 });
  }

  try {
    const hoy = hoyBogota();
    const facturas = analizarFacturas(await obtenerRegistrosCartera(), hoy);
    const html = htmlInformeCartera({ facturas, alcance: alcance.id, hoy, logoBase64: leerLogo() });

    const pdf = await htmlAPdf(html, {
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;padding:0 12mm;font-family:'Segoe UI',Arial,sans-serif;font-size:7pt;color:#666;display:flex;justify-content:space-between">
        <span>Informe de cartera · ${alcance.titulo} · Corte ${fechaLarga(hoy)}</span>
        <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
      </div>`,
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe-cartera-${alcance.id}-${hoy}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Error al generar informe PDF de cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
