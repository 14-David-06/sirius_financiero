import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

// Configuración Azure AD
const AZURE_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const AZURE_TENANT_ID = process.env.MICROSOFT_TENANT_ID!;
const AZURE_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const FROM_EMAIL = process.env.MICROSOFT_FROM_EMAIL;
const FROM_NAME = 'Caja Menor - Sirius Financiero';

interface ConsolidacionData {
  cajaMenor: {
    fechaAnticipo: string;
    fechaCierre: string;
    beneficiario: string;
    nitCC: string;
    concepto: string;
    valorInicial: number;
  };
  totales: {
    totalLegalizado: number;
    valorReintegrarSirius: number;
    valorReintegrarBeneficiario: number;
  };
  items: Array<{
    item: number;
    fecha: string;
    beneficiario: string;
    concepto: string;
    centroCosto: string;
    valor: number;
    comprobanteUrl?: string; // URL del comprobante de pago
  }>;
  pdfUrl?: string; // URL del PDF de consolidación
  attachmentUrls?: string[]; // URLs adicionales de anexos
  toEmails?: string[]; // Correos destinatarios
}

// Crear cliente Graph
function createGraphClient() {
  const credential = new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        return token.token;
      }
    }
  });
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Función para descargar y preparar anexos
async function getAttachment(url: string, name?: string): Promise<{ name: string; contentType: string; contentBytes: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    const contentBytes = Buffer.from(arrayBuffer).toString('base64');
    
    // Extraer nombre del URL si no se proporciona
    const fileName = name || url.split('/').pop() || 'documento.pdf';
    
    return {
      name: fileName,
      contentType,
      contentBytes
    };
  } catch (error) {
    console.error(`Error descargando anexo ${url}:`, error);
    return null;
  }
}

async function sendEmail(data: ConsolidacionData): Promise<void> {
  const { cajaMenor, totales, items } = data;
  
  // Preparar anexos
  const attachments = [];
  if (data.pdfUrl) {
    const att = await getAttachment(data.pdfUrl, 'consolidacion-caja-menor.pdf');
    if (att) attachments.push(att);
  }
  for (const item of data.items) {
    if (item.comprobanteUrl) {
      const att = await getAttachment(item.comprobanteUrl, `comprobante-item-${item.item}.pdf`);
      if (att) attachments.push(att);
    }
  }
  if (data.attachmentUrls) {
    for (const url of data.attachmentUrls) {
      const att = await getAttachment(url);
      if (att) attachments.push(att);
    }
  }
  
  console.log(`📎 Anexos preparados: ${attachments.length} archivos`);
  attachments.forEach(att => console.log(`  - ${att.name}`));
  
  // Crear tabla de items para el email
  const itemsRows = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: center; color: #374151;">${item.item}</td>
      <td style="padding: 12px; color: #374151;">${formatDate(item.fecha)}</td>
      <td style="padding: 12px; color: #374151;">${item.beneficiario}</td>
      <td style="padding: 12px; color: #374151;">${item.concepto}</td>
      <td style="padding: 12px; text-align: center; color: #374151;">${item.centroCosto}</td>
      <td style="padding: 12px; text-align: right; color: #374151; font-weight: 600;">${formatCurrency(item.valor)}</td>
    </tr>
  `).join('');

  const emailBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f6f6f6;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f6f6;">
          <tr>
            <td align="center" style="padding: 20px;">
              <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 8px 8px 0 0; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">
                      ✅ Caja Menor Consolidada
                    </h1>
                    <p style="margin: 10px 0 0 0; color: #e0f2fe; font-size: 16px;">
                      ${cajaMenor.concepto}
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px;">
                    
                    <!-- Información General -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">📋 Información General</h2>
                          <table width="100%" border="0" cellspacing="0" cellpadding="10">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Responsable:</td>
                              <td style="color: #111827; font-weight: 600;">${cajaMenor.beneficiario}</td>
                              <td style="color: #6b7280; font-size: 14px;">NIT/CC:</td>
                              <td style="color: #111827; font-weight: 600;">${cajaMenor.nitCC}</td>
                            </tr>
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Fecha Anticipo:</td>
                              <td style="color: #111827; font-weight: 600;">${formatDate(cajaMenor.fechaAnticipo)}</td>
                              <td style="color: #6b7280; font-size: 14px;">Fecha Cierre:</td>
                              <td style="color: #111827; font-weight: 600;">${formatDate(cajaMenor.fechaCierre)}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Resumen Financiero -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-left: 4px solid #10b981; margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px;">💰 Resumen Financiero</h2>
                          <table width="100%" border="0" cellspacing="10" cellpadding="10">
                            <tr>
                              <td align="center" style="background-color: white; border-radius: 8px; padding: 15px;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px;">Valor Inicial</p>
                                <p style="margin: 8px 0 0 0; color: #10b981; font-size: 20px; font-weight: bold;">${formatCurrency(cajaMenor.valorInicial)}</p>
                              </td>
                              <td align="center" style="background-color: white; border-radius: 8px; padding: 15px;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px;">Total Legalizado</p>
                                <p style="margin: 8px 0 0 0; color: #ef4444; font-size: 20px; font-weight: bold;">${formatCurrency(totales.totalLegalizado)}</p>
                              </td>
                              <td align="center" style="background-color: white; border-radius: 8px; padding: 15px;">
                                <p style="margin: 0; color: #6b7280; font-size: 12px;">Saldo a Reintegrar</p>
                                <p style="margin: 8px 0 0 0; color: #3b82f6; font-size: 20px; font-weight: bold;">${formatCurrency(totales.valorReintegrarSirius)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Detalle de Gastos -->
                    <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">📊 Detalle de Gastos (${items.length} registros)</h2>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr style="background-color: #f9fafb;">
                          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">#</th>
                          <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Fecha</th>
                          <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Beneficiario</th>
                          <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Concepto</th>
                          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Centro Costo</th>
                          <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsRows}
                      </tbody>
                    </table>

                    <!-- Documentos Adjuntos -->
                    ${attachments.length > 0 ? `
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 20px;">
                      <tr>
                        <td>
                          <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">📎 Documentos Adjuntos</h2>
                          <ul style="padding-left: 20px; color: #374151; margin: 0;">
                            ${attachments.map(att => `<li style="margin-bottom: 5px;">${att.name}</li>`).join('')}
                          </ul>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Footer -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #e5e7eb; margin-top: 20px; padding-top: 20px; text-align: center;">
                      <tr>
                        <td>
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            Este es un correo automático generado por el sistema de Caja Menor de Sirius Financiero.
                          </p>
                          <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
                            © ${new Date().getFullYear()} Sirius Regenerative Solutions - Todos los derechos reservados
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  // Crear cliente Graph
  const client = createGraphClient();

  // Configurar el mensaje
  const message = {
    subject: `✅ Caja Menor Consolidada - ${cajaMenor.concepto}`,
    body: {
      contentType: 'html',
      content: emailBody
    },
    toRecipients: data.toEmails ? data.toEmails.map(email => ({ emailAddress: { address: email } })) : [
      { emailAddress: { address: 'adm@siriusregenerative.com' } },
      { emailAddress: { address: 'Contabilidad@siriusregenerative.com' } }
    ],
    from: {
      emailAddress: {
        address: FROM_EMAIL
      }
    },
    attachments: attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes
    }))
  };

  // Enviar el correo
  await client.api(`/users/${FROM_EMAIL}/sendMail`).post({ message });
}

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Iniciando envío de email de consolidación...');

    const data: ConsolidacionData = await request.json();

    // Validar datos requeridos
    if (!data.cajaMenor || !data.totales || !data.items) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos requeridos para enviar el email'
      }, { status: 400 });
    }

    console.log('📨 Enviando email por Graph API...');
    await sendEmail(data);

    console.log('✅ Email enviado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Email de consolidación enviado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al enviar email'
    }, { status: 500 });
  }
}
