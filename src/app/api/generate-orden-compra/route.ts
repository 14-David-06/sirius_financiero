import { NextRequest, NextResponse } from 'next/server';
import { CompraCompleta, CompraItem } from '@/types/compras';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

async function getBrowser() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  
  if (isProduction) {
    const executablePath = await chromium.executablePath();
    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
    });
  } else {
    const executablePath = process.platform === 'win32'
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome';
    
    return puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      return NextResponse.json(
        { error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    const data = await request.json();
    
    if (!data.solicitudData) {
      return NextResponse.json(
        { error: 'Datos de solicitud requeridos' },
        { status: 400 }
      );
    }

    if (!data.solicitudData.cotizacionDoc) {
      return NextResponse.json(
        { error: 'Se requiere una cotización cargada para generar la orden de compra' },
        { status: 400 }
      );
    }

    const htmlContent = generateOrdenCompraHTML(data.solicitudData);

    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();

    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreLimpio = (data.solicitudData.nombreSolicitante || '')
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g, '');
    const fileName = `ordencompra[${nombreLimpio}][${fechaActual}].pdf`;
    const fullPath = `ordenes de compra/${fileName}`;

    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fullPath,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
      Metadata: {
        'tipo-documento': 'orden-compra',
        'solicitante': data.solicitudData.nombreSolicitante || '',
        'fecha-generacion': new Date().toISOString(),
      }
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${encodeURIComponent(fullPath)}`;

    // Actualizar campo en Airtable si se proporcionó compraId
    if (data.compraId) {
      const apiKey = process.env.AIRTABLE_API_KEY;
      const baseId = process.env.AIRTABLE_BASE_ID;
      const comprasTableId = process.env.AIRTABLE_COMPRAS_TABLE_ID;

      if (apiKey && baseId && comprasTableId) {
        await fetch(
          `https://api.airtable.com/v0/${baseId}/${comprasTableId}/${data.compraId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                'Documento Solicitud': fileUrl
              }
            })
          }
        );
      }
    }

    return NextResponse.json({
      success: true,
      pdfUrl: fileUrl,
      fileName,
      fullPath,
    });

  } catch (error) {
    console.error('Error generando orden de compra:', error);
    return NextResponse.json(
      { error: 'Error generando PDF de orden de compra' },
      { status: 500 }
    );
  }
}

function generateOrdenCompraHTML(solicitudData: CompraCompleta): string {
  const fechaActual = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const valorTotal = solicitudData.items.reduce((total: number, item: CompraItem) => 
    total + (item.valorItem * item.cantidad), 0
  );

  const iva = solicitudData.iva || 0;
  const retencion = solicitudData.retencion || 0;
  const totalNeto = solicitudData.totalNeto || (valorTotal + iva - retencion);

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Orden de Compra - ${solicitudData.nombreSolicitante}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.5;
          color: #1f2937;
          max-width: 210mm;
          margin: 0 auto;
          padding: 15px;
          background: #fff;
          font-size: 13px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header-left h1 {
          font-size: 22px;
          color: #1e40af;
          margin-bottom: 2px;
        }
        .header-left p {
          font-size: 11px;
          color: #6b7280;
        }
        .header-right {
          text-align: right;
        }
        .header-right .doc-type {
          font-size: 20px;
          font-weight: bold;
          color: #dc2626;
          letter-spacing: 1px;
        }
        .header-right .doc-date {
          font-size: 11px;
          color: #6b7280;
          margin-top: 4px;
        }
        .section {
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }
        .section-header {
          background: #1e40af;
          color: white;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: bold;
        }
        .section-body {
          padding: 14px;
        }
        .info-row {
          display: flex;
          gap: 20px;
          margin-bottom: 6px;
        }
        .info-item {
          flex: 1;
        }
        .info-label {
          font-weight: bold;
          color: #374151;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .info-value {
          color: #1f2937;
          font-size: 13px;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        table th {
          background: #1e40af;
          color: white;
          padding: 8px 10px;
          font-size: 11px;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        table td {
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 12px;
        }
        table tbody tr:nth-child(even) {
          background: #f9fafb;
        }
        .totals {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
        }
        .totals-box {
          width: 260px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 14px;
          font-size: 12px;
        }
        .totals-row.total {
          background: #1e40af;
          color: white;
          font-weight: bold;
          font-size: 14px;
          padding: 10px 14px;
        }
        .cotizacion-ref {
          margin-top: 10px;
          padding: 10px 14px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          font-size: 12px;
        }
        .cotizacion-ref a {
          color: #1e40af;
          text-decoration: none;
          font-weight: bold;
        }
        .signatures {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          gap: 40px;
        }
        .signature-box {
          flex: 1;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #9ca3af;
          margin-top: 50px;
          padding-top: 6px;
          font-size: 11px;
          color: #6b7280;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 10px;
        }
        .priority-alta { color: #dc2626; font-weight: bold; }
        .priority-media { color: #d97706; font-weight: bold; }
        .priority-baja { color: #059669; font-weight: bold; }
        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          background: #dcfce7;
          color: #166534;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>SIRIUS FINANCIERO</h1>
          <p>Sistema de Gestión de Compras</p>
        </div>
        <div class="header-right">
          <div class="doc-type">ORDEN DE COMPRA</div>
          <div class="doc-date">${fechaActual}</div>
          <div style="margin-top:4px;">
            <span class="status-badge">${solicitudData.estadoSolicitud || 'Aprobado'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">INFORMACIÓN DEL SOLICITANTE</div>
        <div class="section-body">
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Nombre</div>
              <div class="info-value">${solicitudData.nombreSolicitante}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Área</div>
              <div class="info-value">${solicitudData.areaCorrespondiente}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Cargo</div>
              <div class="info-value">${solicitudData.cargoSolicitante}</div>
            </div>
          </div>
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Prioridad</div>
              <div class="info-value priority-${(solicitudData.prioridadSolicitud || '').toLowerCase()}">${solicitudData.prioridadSolicitud || 'Normal'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Fecha de Solicitud</div>
              <div class="info-value">${solicitudData.fechaSolicitud ? new Date(solicitudData.fechaSolicitud).toLocaleDateString('es-CO') : 'N/A'}</div>
            </div>
            ${solicitudData.nombresAdmin ? `
            <div class="info-item">
              <div class="info-label">Aprobado por</div>
              <div class="info-value">${solicitudData.nombresAdmin}</div>
            </div>
            ` : '<div class="info-item"></div>'}
          </div>
        </div>
      </div>

      ${(solicitudData.nombreProveedor?.[0] || solicitudData.razonSocialProveedor) ? `
      <div class="section">
        <div class="section-header">INFORMACIÓN DEL PROVEEDOR</div>
        <div class="section-body">
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Razón Social</div>
              <div class="info-value">${solicitudData.razonSocialProveedor || solicitudData.nombreProveedor?.[0] || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">NIT / C.C.</div>
              <div class="info-value">${solicitudData.nitProveedor?.[0] || 'N/A'}</div>
            </div>
          </div>
          <div class="info-row">
            <div class="info-item">
              <div class="info-label">Ciudad</div>
              <div class="info-value">${solicitudData.ciudadProveedor?.[0] || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Departamento</div>
              <div class="info-value">${solicitudData.departamentoProveedor?.[0] || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      ${solicitudData.descripcionIA || solicitudData.descripcionSolicitud ? `
      <div class="section">
        <div class="section-header">DESCRIPCIÓN</div>
        <div class="section-body">
          <div style="white-space:pre-wrap;font-size:12px;color:#374151;">${solicitudData.descripcionIA || solicitudData.descripcionSolicitud}</div>
        </div>
      </div>
      ` : ''}

      <div class="section">
        <div class="section-header">DETALLE DE ÍTEMS</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Descripción</th>
              <th>Centro de Costos</th>
              <th>Cant.</th>
              <th>Valor Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${solicitudData.items.map((item: CompraItem, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.objeto}</td>
                <td>${item.centroCostos || 'N/A'}</td>
                <td style="text-align:center">${item.cantidad}</td>
                <td style="text-align:right">$${(item.valorItem || 0).toLocaleString('es-CO')}</td>
                <td style="text-align:right">$${((item.valorItem || 0) * (item.cantidad || 0)).toLocaleString('es-CO')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="totals-box">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>$${valorTotal.toLocaleString('es-CO')}</span>
            </div>
            ${iva > 0 ? `
            <div class="totals-row">
              <span>IVA:</span>
              <span>$${iva.toLocaleString('es-CO')}</span>
            </div>
            ` : ''}
            ${retencion > 0 ? `
            <div class="totals-row">
              <span>Retención:</span>
              <span>-$${retencion.toLocaleString('es-CO')}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
              <span>TOTAL:</span>
              <span>$${totalNeto.toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
      </div>

      ${solicitudData.cotizacionDoc ? `
      <div class="cotizacion-ref">
         📎 <strong>Cotización de referencia:</strong> 
         <a href="${solicitudData.cotizacionDoc}">Ver cotización adjunta</a>
      </div>
      ` : ''}

      <div class="signatures">
        <div class="signature-box">
          <div class="signature-line">SOLICITANTE<br/>${solicitudData.nombreSolicitante}</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">AUTORIZADO POR<br/>${solicitudData.nombresAdmin || '_______________'}</div>
        </div>
      </div>

      <div class="footer">
        <p>Documento generado automáticamente por Sirius Financiero — ${new Date().toLocaleString('es-CO')}</p>
      </div>
    </body>
    </html>
  `;
}
