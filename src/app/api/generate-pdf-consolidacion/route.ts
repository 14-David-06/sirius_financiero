import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

interface ItemConsolidacion {
  item: number;
  fecha: string;
  beneficiario: string;
  nitCC: string;
  concepto: string;
  centroCosto: string;
  valor: number;
}

interface DatosConsolidacion {
  cajaMenor: {
    fechaAnticipo: string;
    fechaCierre: string;
    beneficiario: string;
    nitCC: string;
    concepto: string;
    valorInicial: number;
  };
  items: ItemConsolidacion[];
  totales: {
    totalLegalizado: number;
    valorReintegrarSirius: number;
    valorReintegrarBeneficiario: number;
  };
}

function generateConsolidacionHTML(datos: DatosConsolidacion): string {
  // Leer y convertir el logo a base64
  const logoPath = path.join(process.cwd(), 'public', 'Logo-Sirius.png');
  let logoBase64 = '';
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = logoBuffer.toString('base64');
    console.log('✅ Logo cargado y convertido a base64');
  } catch (error) {
    console.error('❌ Error al cargar el logo:', error);
  }
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      // Parsear fecha ISO sin problemas de zona horaria
      const [year, month, day] = dateString.split('T')[0].split('-');
      const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      
      if (isNaN(fecha.getTime())) return 'Fecha inválida';
      
      return fecha.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const itemsHTML = datos.items.map((item, index) => `
    <tr>
      <td class="td-center">${item.item}</td>
      <td class="td-center">${formatDate(item.fecha)}</td>
      <td>${item.beneficiario}</td>
      <td class="td-center">${item.nitCC || '-'}</td>
      <td>${item.concepto}</td>
      <td class="td-center">${item.centroCosto || '-'}</td>
      <td class="td-right">${formatCurrency(item.valor)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Formato de Legalización de Anticipo General - Sirius</title>
      <style>
        @page {
          size: A4;
          margin: 20mm 15mm;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 10pt;
          line-height: 1.5;
          color: #3C4858;
          background: white;
        }
        
        /* ========== ENCABEZADO ========== */
        .brand-bar {
          height: 4px;
          background: #0154AC;
          margin-bottom: 24px;
          border-radius: 2px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid #E5E9F0;
        }
        
        .logo {
          width: 140px;
          height: 140px;
        }
        
        .logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .header-date {
          text-align: right;
        }
        
        .header-date-label {
          font-size: 8.5pt;
          font-weight: 600;
          color: #0154AC;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        
        .header-date-value {
          font-size: 11pt;
          font-weight: 700;
          color: #3C4858;
        }
        
        /* ========== TÍTULO ========== */
        .document-title {
          text-align: center;
          font-size: 16pt;
          font-weight: 700;
          color: #0154AC;
          margin-bottom: 28px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        
        /* ========== GRID DE INFORMACIÓN ========== */
        .info-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 32px;
          page-break-inside: avoid;
        }
        
        .info-card {
          background: #F5F8FB;
          padding: 18px;
          border-radius: 8px;
          border: 1px solid #E5E9F0;
          box-shadow: 0 1px 3px rgba(1, 84, 172, 0.06);
          page-break-inside: avoid;
        }
        
        .info-card-title {
          font-size: 8.5pt;
          font-weight: 700;
          color: #0154AC;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        
        .info-card-content {
          font-size: 10pt;
          color: #3C4858;
          font-weight: 500;
          line-height: 1.4;
        }
        
        .info-card-large {
          font-size: 18pt;
          font-weight: 700;
          color: #0154AC;
          margin-top: 4px;
        }
        
        /* ========== TABLA DE GASTOS ========== */
        .table-section {
          margin: 28px 0;
          page-break-inside: auto;
        }
        
        .table-header {
          font-size: 11pt;
          font-weight: 700;
          color: #3C4858;
          margin-bottom: 12px;
          padding-left: 4px;
        }
        
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #E5E9F0;
          font-size: 9pt;
        }
        
        thead {
          background: #0154AC;
        }
        
        th {
          padding: 14px 12px;
          text-align: left;
          font-weight: 700;
          font-size: 8.5pt;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 2px solid #003D7A;
        }
        
        th.th-center { text-align: center; }
        th.th-right { text-align: right; }
        
        td {
          padding: 12px;
          border-bottom: 1px solid #E5E9F0;
          color: #3C4858;
        }
        
        .td-center { text-align: center; }
        .td-right { text-align: right; font-weight: 600; }
        
        tbody tr {
          background: white;
          page-break-inside: avoid;
          page-break-after: auto;
        }
        
        tbody tr:nth-child(even) {
          background: #F8F9FA;
        }
        
        tbody tr:last-child td {
          border-bottom: none;
        }
        
        thead {
          display: table-header-group;
        }
        
        tfoot {
          display: table-footer-group;
        }
        
        /* ========== INDICADORES KPI ========== */
        .kpi-section {
          margin: 32px 0;
          page-break-inside: avoid;
        }
        
        .kpi-header {
          font-size: 11pt;
          font-weight: 700;
          color: #3C4858;
          margin-bottom: 16px;
          padding-left: 4px;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          page-break-inside: avoid;
        }
        
        .kpi-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #E5E9F0;
          text-align: center;
          box-shadow: 0 2px 4px rgba(1, 84, 172, 0.08);
          page-break-inside: avoid;
        }
        
        .kpi-card-label {
          font-size: 8.5pt;
          font-weight: 700;
          color: #0154AC;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        
        .kpi-card-value {
          font-size: 22pt;
          font-weight: 700;
          line-height: 1;
        }
        
        .kpi-primary { color: #0154AC; }
        .kpi-success { color: #059669; }
        .kpi-warning { color: #DC2626; }
        
        /* ========== NOTAS ========== */
        .notes-section {
          background: #F0F3F7;
          border-left: 4px solid #0154AC;
          padding: 20px;
          border-radius: 0 6px 6px 0;
          margin: 28px 0;
          page-break-inside: avoid;
        }
        
        .notes-title {
          font-size: 10pt;
          font-weight: 700;
          color: #0154AC;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .notes-content {
          font-size: 8.5pt;
          color: #3C4858;
          line-height: 1.7;
        }
        
        .notes-content ul {
          list-style: none;
          padding-left: 0;
        }
        
        .notes-content li {
          padding-left: 20px;
          position: relative;
          margin-bottom: 8px;
        }
        
        .notes-content li:before {
          content: "•";
          color: #0154AC;
          font-weight: bold;
          position: absolute;
          left: 4px;
        }
        
        /* ========== FOOTER ========== */
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #E5E9F0;
          text-align: center;
          font-size: 8pt;
          color: #6B7280;
        }
        
        .footer-company {
          font-weight: 600;
          color: #0154AC;
          margin-bottom: 4px;
        }
        
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <!-- Barra corporativa -->
      <div class="brand-bar"></div>
      
      <!-- Encabezado -->
      <div class="header">
        <div class="logo">
          <img src="data:image/png;base64,${logoBase64}" alt="Sirius Logo" />
        </div>
        <div class="header-date">
          <div class="header-date-label">Fecha de Actualización</div>
          <div class="header-date-value">${formatDate(datos.cajaMenor.fechaCierre)}</div>
        </div>
      </div>
      
      <!-- Título del Documento -->
      <div class="document-title">
        Formato de Legalización de Anticipo General
      </div>
      
      <!-- Grid de Información Principal -->
      <div class="info-cards">
        <div class="info-card">
          <div class="info-card-title">Fechas del Período</div>
          <div class="info-card-content">
            <strong>Anticipo:</strong> ${formatDate(datos.cajaMenor.fechaAnticipo)}<br>
            <strong>Cierre:</strong> ${formatDate(datos.cajaMenor.fechaCierre)}
          </div>
        </div>
        
        <div class="info-card">
          <div class="info-card-title">Beneficiario</div>
          <div class="info-card-content">
            ${datos.cajaMenor.beneficiario}<br>
            <strong>NIT/CC:</strong> ${datos.cajaMenor.nitCC || 'N/A'}
          </div>
        </div>
        
        <div class="info-card">
          <div class="info-card-title">Concepto</div>
          <div class="info-card-content">
            ${datos.cajaMenor.concepto}
          </div>
          <div class="info-card-large">
            ${formatCurrency(datos.cajaMenor.valorInicial)}
          </div>
        </div>
      </div>
      
      <!-- Tabla de Gastos -->
      <div class="table-section">
        <div class="table-header">Detalle de Gastos</div>
        <table>
          <thead>
            <tr>
              <th class="th-center">#</th>
              <th class="th-center">Fecha</th>
              <th>Beneficiario</th>
              <th class="th-center">NIT/CC</th>
              <th>Concepto</th>
              <th class="th-center">Centro de Costo</th>
              <th class="th-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
      </div>
      
      <!-- Indicadores KPI -->
      <div class="kpi-section">
        <div class="kpi-header">Resumen Financiero</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-card-label">Total Legalizado</div>
            <div class="kpi-card-value kpi-primary">${formatCurrency(datos.totales.totalLegalizado)}</div>
          </div>
          
          <div class="kpi-card">
            <div class="kpi-card-label">Valor a Reintegrar a Sirius</div>
            <div class="kpi-card-value kpi-success">${formatCurrency(datos.totales.valorReintegrarSirius)}</div>
          </div>
          
          <div class="kpi-card">
            <div class="kpi-card-label">Valor a Reintegrar al Beneficiario</div>
            <div class="kpi-card-value kpi-warning">${formatCurrency(datos.totales.valorReintegrarBeneficiario)}</div>
          </div>
        </div>
      </div>
      
      <!-- Notas Institucionales -->
      <div class="notes-section">
        <div class="notes-title">Notas Importantes</div>
        <div class="notes-content">
          <ul>
            <li>Este documento constituye la legalización formal del anticipo general otorgado para gastos de caja menor del período especificado.</li>
            <li>Todos los gastos relacionados han sido verificados y cumplen con las políticas internas de la organización.</li>
            <li>Los comprobantes de pago correspondientes se encuentran archivados según los procedimientos establecidos.</li>
            <li>El valor a reintegrar debe ser procesado dentro de los siguientes 5 días hábiles posteriores a la fecha de cierre.</li>
          </ul>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <div class="footer-company">Sirius Regenerative Solutions S.A.S ZOMAC</div>
        <div>Documento generado electrónicamente • ${formatDate(datos.cajaMenor.fechaCierre)}</div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  console.log('🔥 API de generación de PDF de consolidación iniciado');
  
  try {
    const datos: DatosConsolidacion = await request.json();
    console.log('📄 Datos recibidos para PDF de consolidación:', {
      beneficiario: datos.cajaMenor.beneficiario,
      numeroItems: datos.items.length,
      total: datos.totales.totalLegalizado
    });

    // Generar el HTML para el PDF
    console.log('📝 Generando contenido HTML...');
    const htmlContent = generateConsolidacionHTML(datos);
    console.log('✅ HTML generado, longitud:', htmlContent.length);

    // Generar PDF usando Puppeteer
    console.log('🚀 Iniciando Puppeteer...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    console.log('📄 Configurando página...');
    
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    console.log('🖨️ Generando PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
    });

    await browser.close();
    console.log('✅ PDF generado exitosamente, tamaño:', pdfBuffer.length, 'bytes');

    // Generar nombre del archivo
    const fechaAnticipo = new Date(datos.cajaMenor.fechaAnticipo);
    const mes = fechaAnticipo.toLocaleDateString('es-CO', { month: 'long' }).toLowerCase();
    const anio = fechaAnticipo.getFullYear();
    const fileName = `consolidacion-caja-menor-${mes}-${anio}.pdf`;

    // Devolver el PDF directamente como descarga
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('❌ Error generando PDF de consolidación:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al generar PDF',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
