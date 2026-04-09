import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;
const ITEMS_OC_TABLE_ID = process.env.AIRTABLE_ITEMS_OC_TABLE_ID;

// Datos de la empresa
const COMPANY_NAME = process.env.COMPANY_NAME || 'SIRIUS FINANCIERO';
const COMPANY_NIT = process.env.COMPANY_NIT || 'NIT: 000000000-0';
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || 'Dirección de la empresa';

// Roles con acceso a warehouse (gerenciales/administrativos de Sirius Nomina Core)
const WAREHOUSE_ALLOWED_ROLES = [
  'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)',
  'CTO (CHIEF TECHNOLOGY OFFICER)',
  'DIRECTOR FINANCIERO',
  'COORDINADORA LIDER GERENCIA',
  'INGENIERO DE DESARROLLO',
  'JEFE DE PLANTA',
  'JEFE DE PRODUCCION',
  'SUPERVISOR DE PRODUCCION',
  'CONTADORA',
  'ASISTENTE FINANCIERO Y CONTABLE',
];

async function airtableFetch(url: string) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params (Next.js 15 requirement)
  const { id } = await params;

  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 10, 60000)) {
      secureLog('⚠️ Rate limit excedido en GET ordenes-compra/pdf', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        {
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401, headers: securityHeaders }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401, headers: securityHeaders }
      );
    }

    // 🔒 Autorización (solo roles gerenciales/administrativos)
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol gerencial o administrativo.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !ORDENES_TABLE_ID || !ITEMS_OC_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Obtener orden de compra
    const ordenUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ORDENES_TABLE_ID}/${id}`;
    const ordenData = await airtableFetch(ordenUrl);
    const f = ordenData.fields;

    // Obtener items relacionados
    const itemsIds: string[] = f['Items Orden de Compra'] || [];
    const items: any[] = [];

    for (const itemId of itemsIds) {
      const itemUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_OC_TABLE_ID}/${itemId}`;
      const itemData = await airtableFetch(itemUrl);
      items.push(itemData.fields);
    }

    // Crear PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPosition = height - 50;
    const leftMargin = 50;
    const rightMargin = width - 50;

    // Función helper para dibujar texto
    const drawText = (text: string, x: number, y: number, options: any = {}) => {
      page.drawText(text, {
        x,
        y,
        size: options.size || 10,
        font: options.bold ? fontBold : font,
        color: options.color || rgb(0, 0, 0),
      });
    };

    // 1. Encabezado empresa
    drawText(COMPANY_NAME, leftMargin, yPosition, { size: 16, bold: true, color: rgb(0.1, 0.3, 0.7) });
    yPosition -= 20;
    drawText(COMPANY_NIT, leftMargin, yPosition, { size: 10 });
    yPosition -= 15;
    drawText(COMPANY_ADDRESS, leftMargin, yPosition, { size: 9 });
    yPosition -= 40;

    // 2. Título y datos de OC
    drawText('ORDEN DE COMPRA', leftMargin, yPosition, { size: 18, bold: true });
    drawText(`N° ${f['ID Orden de Compra'] || 'N/A'}`, rightMargin - 150, yPosition, { size: 12, bold: true });
    yPosition -= 20;
    drawText(`Fecha: ${f['Fecha de Emisión'] || 'N/A'}`, rightMargin - 150, yPosition, { size: 10 });
    drawText(`Estado: ${f['Estado Orden de Compra'] || 'Emitida'}`, leftMargin, yPosition, { size: 10, bold: true });
    yPosition -= 30;

    // Línea separadora
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 20;

    // 3. Bloque proveedor
    drawText('PROVEEDOR', leftMargin, yPosition, { size: 12, bold: true });
    yPosition -= 18;
    const proveedorNombre = Array.isArray(f['Nombre (from Proveedor)'])
      ? f['Nombre (from Proveedor)'][0]
      : 'No especificado';
    drawText(`Nombre: ${proveedorNombre}`, leftMargin, yPosition, { size: 10 });
    yPosition -= 15;
    const proveedorNit = Array.isArray(f['C.c o Nit (from Proveedor)'])
      ? f['C.c o Nit (from Proveedor)'][0]
      : 'N/A';
    drawText(`NIT/CC: ${proveedorNit}`, leftMargin, yPosition, { size: 10 });
    yPosition -= 30;

    // 4. Información del solicitante
    drawText('SOLICITADO POR', leftMargin, yPosition, { size: 12, bold: true });
    yPosition -= 18;
    drawText(`Nombre: ${f['Nombre Solicitante'] || 'N/A'}`, leftMargin, yPosition, { size: 10 });
    yPosition -= 15;
    drawText(`Cargo: ${f['Cargo Solicitante'] || 'N/A'}`, leftMargin, yPosition, { size: 10 });
    yPosition -= 15;
    drawText(`Área: ${f['Area Correspondiente'] || 'N/A'}`, leftMargin, yPosition, { size: 10 });
    yPosition -= 30;

    // Línea separadora
    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    yPosition -= 20;

    // 5. Tabla de ítems
    drawText('DETALLE DE ÍTEMS', leftMargin, yPosition, { size: 12, bold: true });
    yPosition -= 20;

    // Encabezado de tabla
    const colX = {
      desc: leftMargin,
      cant: leftMargin + 280,
      unidad: leftMargin + 330,
      precio: leftMargin + 390,
      subtotal: leftMargin + 460,
    };

    drawText('Descripción', colX.desc, yPosition, { size: 9, bold: true });
    drawText('Cant.', colX.cant, yPosition, { size: 9, bold: true });
    drawText('Unidad', colX.unidad, yPosition, { size: 9, bold: true });
    drawText('Precio Unit.', colX.precio, yPosition, { size: 9, bold: true });
    drawText('Subtotal', colX.subtotal, yPosition, { size: 9, bold: true });
    yPosition -= 15;

    // Ítems
    items.forEach((item, index) => {
      if (yPosition < 100) {
        // Crear nueva página si no hay espacio
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 50;
      }

      const descripcion = item['Descripcion del Item'] || 'N/A';
      const descripcionCorta = descripcion.length > 40 ? descripcion.substring(0, 37) + '...' : descripcion;

      drawText(descripcionCorta, colX.desc, yPosition, { size: 8 });
      drawText(String(item['Cantidad'] || 0), colX.cant, yPosition, { size: 8 });
      drawText(item['Unidad de Medida'] || 'UN', colX.unidad, yPosition, { size: 8 });
      drawText(`$${(item['Valor Unitario'] || 0).toLocaleString('es-CO')}`, colX.precio, yPosition, { size: 8 });
      drawText(`$${(item['Valor Total Item'] || 0).toLocaleString('es-CO')}`, colX.subtotal, yPosition, { size: 8 });
      yPosition -= 12;
    });

    yPosition -= 20;

    // 6. Bloque de totales
    const totalX = rightMargin - 150;
    drawText('Subtotal:', totalX - 50, yPosition, { size: 10, bold: true });
    drawText(`$${(f['Subtotal'] || 0).toLocaleString('es-CO')}`, totalX + 20, yPosition, { size: 10 });
    yPosition -= 15;

    if (f['IVA'] && f['IVA'] > 0) {
      drawText('IVA:', totalX - 50, yPosition, { size: 10, bold: true });
      drawText(`$${f['IVA'].toLocaleString('es-CO')}`, totalX + 20, yPosition, { size: 10 });
      yPosition -= 15;
    }

    if (f['Retencion'] && f['Retencion'] > 0) {
      drawText('Retención:', totalX - 50, yPosition, { size: 10, bold: true });
      drawText(`-$${f['Retencion'].toLocaleString('es-CO')}`, totalX + 20, yPosition, { size: 10 });
      yPosition -= 15;
    }

    page.drawLine({
      start: { x: totalX - 60, y: yPosition },
      end: { x: rightMargin, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    drawText('TOTAL NETO:', totalX - 50, yPosition, { size: 12, bold: true });
    drawText(`$${(f['Total Neto'] || 0).toLocaleString('es-CO')}`, totalX + 20, yPosition, { size: 12, bold: true });
    yPosition -= 30;

    // 7. Condiciones y notas
    if (f['Descripción']) {
      if (yPosition < 120) {
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        yPosition = height - 50;
      }
      drawText('OBSERVACIONES:', leftMargin, yPosition, { size: 10, bold: true });
      yPosition -= 15;
      const descripcion = String(f['Descripción']).substring(0, 200);
      drawText(descripcion, leftMargin, yPosition, { size: 9 });
      yPosition -= 30;
    }

    // 8. Espacio para firma
    if (yPosition < 150) {
      const newPage = pdfDoc.addPage([595.28, 841.89]);
      yPosition = height - 50;
    }
    yPosition -= 40;

    page.drawLine({
      start: { x: leftMargin, y: yPosition },
      end: { x: leftMargin + 200, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
    drawText('Firma y sello del proveedor', leftMargin, yPosition, { size: 9 });

    page.drawLine({
      start: { x: rightMargin - 200, y: yPosition + 15 },
      end: { x: rightMargin, y: yPosition + 15 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
    drawText(`Aprobado por: ${f['Autorizado Por'] || '______________'}`, rightMargin - 200, yPosition, { size: 9 });

    // Generar PDF
    const pdfBytes = await pdfDoc.save();

    // Retornar PDF (convertir Uint8Array a Buffer)
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="OC-${f['ID Orden de Compra'] || id}.pdf"`,
        ...securityHeaders,
      },
    });

  } catch (error) {
    console.error('Error generando PDF de orden de compra:', error);
    secureLog('🚨 Error en GET ordenes-compra/pdf', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      ordenId: id,
    });

    return NextResponse.json(
      {
        error: 'Error generando PDF',
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
