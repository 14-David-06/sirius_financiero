import { NextRequest, NextResponse } from 'next/server';
import { CompraCompleta, CompraItem } from '@/types/compras';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import puppeteer from 'puppeteer';

// Configurar cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: NextRequest) {
  console.log('🔥 API de generación de PDF iniciado');
  try {
    // Verificar credenciales de AWS
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
      console.error('❌ Missing AWS S3 credentials');
      return NextResponse.json(
        { error: 'Configuración de almacenamiento faltante' },
        { status: 500 }
      );
    }

    const data = await request.json();
    console.log('📄 Datos recibidos para PDF:', {
      nombreSolicitante: data.solicitudData?.nombreSolicitante,
      solicitudId: data.solicitudId,
      numeroItems: data.solicitudData?.items?.length
    });
    
    if (!data.solicitudData) {
      console.error('❌ No se proporcionaron datos de solicitud');
      return NextResponse.json(
        { error: 'Datos de solicitud requeridos' },
        { status: 400 }
      );
    }

    console.log('✅ Generando PDF para solicitud:', data.solicitudData.nombreSolicitante);

    // Generar el HTML para el PDF
    console.log('📝 Generando contenido HTML...');
    const htmlContent = generateSolicitudHTML(data.solicitudData);
    console.log('✅ HTML generado, longitud:', htmlContent.length);

    // Generar PDF usando Puppeteer
    console.log('🚀 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log('📄 Página de Puppeteer creada');
    
    // Configurar el contenido HTML
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    console.log('✅ Contenido HTML configurado en la página');
    
    // Generar PDF
    console.log('📋 Generando PDF...');
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
    console.log('✅ PDF generado exitosamente, tamaño:', pdfBuffer.length, 'bytes');

    // Generar nombre del archivo según el formato requerido
    const fechaActual = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const nombreLimpio = data.solicitudData.nombreSolicitante
      .replace(/\s+/g, '')
      .replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `solicitudcompra${nombreLimpio}${fechaActual}.pdf`;
    const fullPath = `solicitudes de compras/${fileName}`;
    
    console.log(`☁️ Subiendo PDF a S3: ${fullPath}`);

    // Configurar parámetros para S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fullPath,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
      Metadata: {
        'tipo-documento': 'solicitud-compra',
        'solicitante': data.solicitudData.nombreSolicitante,
        'area': data.solicitudData.areaSolicitante,
        'fecha-generacion': new Date().toISOString(),
        'numero-items': data.solicitudData.items.length.toString()
      }
    };

    // Subir PDF a S3
    console.log('📤 Iniciando subida a S3...');
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    console.log('✅ PDF subido exitosamente a S3');

    // Generar URL del archivo
    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fullPath}`;

    console.log('🔗 PDF generado y subido exitosamente:', fileUrl);

    return NextResponse.json({
      success: true,
      pdfUrl: fileUrl,
      fileName: fileName,
      fullPath: fullPath,
      metadata: {
        solicitante: data.solicitudData.nombreSolicitante,
        area: data.solicitudData.areaSolicitante,
        numeroItems: data.solicitudData.items.length,
        fechaGeneracion: fechaActual
      }
    });

  } catch (error) {
    console.error('Error generando PDF:', error);
    return NextResponse.json(
      { 
        error: 'Error generando PDF de solicitud',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

function generateSolicitudHTML(solicitudData: CompraCompleta): string {
  const fechaActual = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const valorTotal = solicitudData.items.reduce((total: number, item: CompraItem) => 
    total + (item.valorItem * item.cantidad), 0
  );

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Solicitud de Compra - ${solicitudData.nombreSolicitante}</title>
      <style>
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20px;
          background-color: #fff;
        }
        
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        
        .logo-section {
          margin-bottom: 20px;
        }
        
        .company-name {
          font-size: 28px;
          font-weight: bold;
          color: #1e40af;
          margin: 0;
        }
        
        .document-title {
          font-size: 24px;
          font-weight: bold;
          color: #374151;
          margin: 10px 0;
        }
        
        .date-section {
          text-align: right;
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 30px;
        }
        
        .section {
          margin-bottom: 25px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background-color: #f9fafb;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #ddd6fe;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 15px;
        }
        
        .info-item {
          margin-bottom: 10px;
        }
        
        .info-label {
          font-weight: bold;
          color: #374151;
          display: inline-block;
          min-width: 120px;
        }
        
        .info-value {
          color: #1f2937;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        
        .items-table th,
        .items-table td {
          border: 1px solid #d1d5db;
          padding: 12px;
          text-align: left;
        }
        
        .items-table th {
          background-color: #3b82f6;
          color: white;
          font-weight: bold;
        }
        
        .items-table tbody tr:nth-child(even) {
          background-color: #f3f4f6;
        }
        
        .items-table tbody tr:nth-child(odd) {
          background-color: white;
        }
        
        .priority-high { color: #dc2626; font-weight: bold; }
        .priority-medium { color: #d97706; font-weight: bold; }
        .priority-low { color: #059669; font-weight: bold; }
        
        .total-section {
          text-align: right;
          margin-top: 20px;
          padding: 15px;
          background-color: #eff6ff;
          border-radius: 8px;
          border: 1px solid #bfdbfe;
        }
        
        .total-amount {
          font-size: 20px;
          font-weight: bold;
          color: #1d4ed8;
        }
        
        .description-section {
          background-color: #f0f9ff;
          border: 1px solid #bae6fd;
        }
        
        .description-text {
          white-space: pre-wrap;
          line-height: 1.8;
          color: #374151;
        }
        
        .footer {
          margin-top: 40px;
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        
        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-section">
          <h1 class="company-name">SIRIUS FINANCIERO</h1>
        </div>
        <h2 class="document-title">SOLICITUD DE COMPRA</h2>
        <div class="status-badge status-pending">Pendiente</div>
      </div>
      
      <div class="date-section">
        <strong>Fecha de generación:</strong> ${fechaActual}
      </div>
      
      <div class="section">
        <h3 class="section-title">📋 Información del Solicitante</h3>
        <div class="info-grid">
          <div>
            <div class="info-item">
              <span class="info-label">Nombre:</span>
              <span class="info-value">${solicitudData.nombreSolicitante}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Área:</span>
              <span class="info-value">${solicitudData.areaCorrespondiente}</span>
            </div>
          </div>
          <div>
            <div class="info-item">
              <span class="info-label">Cargo:</span>
              <span class="info-value">${solicitudData.cargoSolicitante}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Prioridad:</span>
              <span class="info-value priority-${solicitudData.prioridadSolicitud?.toLowerCase() || 'normal'}">${solicitudData.prioridadSolicitud || 'Normal'}</span>
            </div>
          </div>
        </div>
      </div>
      
      ${solicitudData.descripcionIA ? `
        <div class="section description-section">
          <h3 class="section-title">📝 Descripción de la Solicitud</h3>
          <div class="description-text">${solicitudData.descripcionIA}</div>
        </div>
      ` : solicitudData.descripcionSolicitud ? `
        <div class="section description-section">
          <h3 class="section-title">📝 Descripción de la Solicitud</h3>
          <div class="description-text">${solicitudData.descripcionSolicitud}</div>
        </div>
      ` : ''}
      
      <div class="section">
        <h3 class="section-title">🛒 Ítems Solicitados</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Objeto</th>
              <th>Centro de Costos</th>
              <th>Cantidad</th>
              <th>Valor Unitario</th>
              <th>Valor Total</th>
              <th>Prioridad</th>
            </tr>
          </thead>
          <tbody>
            ${solicitudData.items.map((item: CompraItem) => `
              <tr>
                <td>${item.objeto}</td>
                <td>${item.centroCostos}</td>
                <td>${item.cantidad}</td>
                <td>$${item.valorItem.toLocaleString('es-CO')}</td>
                <td>$${(item.valorItem * item.cantidad).toLocaleString('es-CO')}</td>
                <td class="priority-${item.prioridad?.toLowerCase() || 'normal'}">${item.prioridad || 'Normal'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-amount">
            <strong>Valor Total de la Solicitud: $${valorTotal.toLocaleString('es-CO')}</strong>
          </div>
        </div>
      </div>
      
      ${solicitudData.hasProvider === 'si' && solicitudData.razonSocialProveedor ? `
        <div class="section">
          <h3 class="section-title">🏢 Información del Proveedor</h3>
          <div class="info-item">
            <span class="info-label">Razón Social:</span>
            <span class="info-value">${solicitudData.razonSocialProveedor}</span>
          </div>
          ${solicitudData.cotizacionDoc ? `
            <div class="info-item">
              <span class="info-label">Cotización:</span>
              <span class="info-value">
                <a href="${solicitudData.cotizacionDoc}" target="_blank" style="color: #2563eb; text-decoration: none;">
                  📎 Ver cotización adjunta
                </a>
              </span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      <div class="footer">
        <p>Este documento fue generado automáticamente por el sistema Sirius Financiero</p>
        <p>Fecha y hora de generación: ${new Date().toLocaleString('es-CO')}</p>
      </div>
    </body>
    </html>
  `;
}

export async function GET() {
  return NextResponse.json({
    message: 'API de generación de PDF de solicitudes activa',
    format: 'A4',
    output_folder: 'solicitudes/',
    naming_format: 'solicitudcompra[NombreSolicitante][YYYY-MM-DD].pdf'
  });
}
