import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

// Configuración Azure AD para cuenta Notify (sirius-notificaciones-core)
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID!;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const FROM_EMAIL = process.env.OUTLOOK_SENDER_EMAIL;
const FROM_NAME = 'Solicitudes de Compra - Sirius Financiero';

interface ItemCompra {
  objeto: string;
  centroCostos: string;
  cantidad: number;
  valorItem: number;
  compraServicio: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  fechaRequerida?: string;
  formaPago?: string;
}

interface SolicitudCompraEmail {
  solicitudId: string;
  numeroSolicitud?: string;
  nombreSolicitante: string;
  areaSolicitante: string;
  cargoSolicitante: string;
  prioridadSolicitud: 'Alta' | 'Media' | 'Baja';
  hasProvider: 'si' | 'no';
  razonSocialProveedor?: string;
  descripcionTranscripcion?: string;
  items: ItemCompra[];
  valorTotal: number;
  pdfUrl?: string;
  toEmails?: string[];
  ccEmails?: string[];
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
  return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

function getPrioridadColor(prioridad: 'Alta' | 'Media' | 'Baja'): string {
  switch (prioridad) {
    case 'Alta':
      return '#dc2626'; // Rojo
    case 'Media':
      return '#f59e0b'; // Naranja
    case 'Baja':
      return '#10b981'; // Verde
    default:
      return '#6b7280'; // Gris
  }
}

function getPrioridadIcon(prioridad: 'Alta' | 'Media' | 'Baja'): string {
  switch (prioridad) {
    case 'Alta':
      return '🔴';
    case 'Media':
      return '🟡';
    case 'Baja':
      return '🟢';
    default:
      return '⚪';
  }
}

async function sendEmail(data: SolicitudCompraEmail): Promise<void> {
  const {
    solicitudId,
    numeroSolicitud,
    nombreSolicitante,
    areaSolicitante,
    cargoSolicitante,
    prioridadSolicitud,
    hasProvider,
    razonSocialProveedor,
    descripcionTranscripcion,
    items,
    valorTotal,
    pdfUrl
  } = data;

  // Crear tabla de items para el email
  const itemsRows = items.map((item, index) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: center; color: #374151; font-weight: 600;">${index + 1}</td>
      <td style="padding: 12px; color: #374151;">${item.objeto}</td>
      <td style="padding: 12px; text-align: center; color: #374151;">${item.centroCostos}</td>
      <td style="padding: 12px; text-align: center; color: #374151;">${item.cantidad}</td>
      <td style="padding: 12px; text-align: right; color: #374151; font-weight: 600;">${formatCurrency(item.valorItem)}</td>
      <td style="padding: 12px; text-align: right; color: #111827; font-weight: 700;">${formatCurrency(item.valorItem * item.cantidad)}</td>
      <td style="padding: 12px; text-align: center;">
        <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; color: white; background-color: ${getPrioridadColor(item.prioridad)};">
          ${getPrioridadIcon(item.prioridad)} ${item.prioridad}
        </span>
      </td>
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
              <table width="650" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px 8px 0 0; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: white; font-size: 26px; font-weight: bold;">
                      📋 Nueva Solicitud de Compra
                    </h1>
                    <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">
                      ${numeroSolicitud ? `Solicitud #${numeroSolicitud}` : `ID: ${solicitudId.substring(0, 8)}...`}
                    </p>
                  </td>
                </tr>

                <!-- Prioridad Badge -->
                <tr>
                  <td align="center" style="padding: 20px 30px 0 30px;">
                    <span style="display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 700; color: white; background-color: ${getPrioridadColor(prioridadSolicitud)}; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${getPrioridadIcon(prioridadSolicitud)} PRIORIDAD ${prioridadSolicitud}
                    </span>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 30px;">

                    <!-- Información del Solicitante -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-left: 4px solid #6366f1; margin-bottom: 20px; border-radius: 4px;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 15px 0; color: #4f46e5; font-size: 18px;">👤 Información del Solicitante</h2>
                          <table width="100%" border="0" cellspacing="0" cellpadding="8">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; width: 30%;">Nombre:</td>
                              <td style="color: #111827; font-weight: 600; font-size: 15px;">${nombreSolicitante}</td>
                            </tr>
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Área:</td>
                              <td style="color: #111827; font-weight: 600; font-size: 15px;">${areaSolicitante}</td>
                            </tr>
                            <tr>
                              <td style="color: #6b7280; font-size: 14px;">Cargo:</td>
                              <td style="color: #111827; font-weight: 600; font-size: 15px;">${cargoSolicitante}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    ${descripcionTranscripcion ? `
                    <!-- Descripción de la Solicitud -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fefce8; border-left: 4px solid #eab308; margin-bottom: 20px; border-radius: 4px;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 10px 0; color: #ca8a04; font-size: 18px;">💬 Descripción</h2>
                          <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">
                            ${descripcionTranscripcion}
                          </p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    ${hasProvider === 'si' && razonSocialProveedor ? `
                    <!-- Información del Proveedor -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border-left: 4px solid #10b981; margin-bottom: 20px; border-radius: 4px;">
                      <tr>
                        <td style="padding: 20px;">
                          <h2 style="margin: 0 0 10px 0; color: #059669; font-size: 18px;">🏢 Proveedor Sugerido</h2>
                          <p style="margin: 0; color: #111827; font-weight: 600; font-size: 15px;">
                            ${razonSocialProveedor}
                          </p>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Resumen Financiero -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                      <tr>
                        <td>
                          <table width="100%" border="0" cellspacing="10" cellpadding="0">
                            <tr>
                              <td align="center" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 8px; padding: 20px;">
                                <p style="margin: 0; color: #dbeafe; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Total Items</p>
                                <p style="margin: 8px 0 0 0; color: white; font-size: 32px; font-weight: bold;">${items.length}</p>
                              </td>
                              <td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 20px;">
                                <p style="margin: 0; color: #d1fae5; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Valor Total</p>
                                <p style="margin: 8px 0 0 0; color: white; font-size: 32px; font-weight: bold;">${formatCurrency(valorTotal)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Detalle de Items -->
                    <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 18px;">📦 Detalle de Items</h2>
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr style="background-color: #f9fafb;">
                          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">#</th>
                          <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Descripción</th>
                          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">C.Costo</th>
                          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Cant.</th>
                          <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Valor Unit.</th>
                          <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Subtotal</th>
                          <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Prioridad</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${items.length > 0 ? itemsRows : `
                          <tr>
                            <td colspan="7" style="padding: 30px; text-align: center; color: #6b7280; font-style: italic;">
                              📋 No se agregaron items específicos a esta solicitud
                            </td>
                          </tr>
                        `}
                      </tbody>
                      <tfoot>
                        <tr style="background-color: #f9fafb; border-top: 2px solid #e5e7eb;">
                          <td colspan="5" style="padding: 15px; text-align: right; color: #111827; font-size: 16px; font-weight: 700;">TOTAL:</td>
                          <td style="padding: 15px; text-align: right; color: #10b981; font-size: 20px; font-weight: 900;">${formatCurrency(valorTotal)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>

                    ${pdfUrl ? `
                    <!-- Botón de Descarga PDF -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
                      <tr>
                        <td align="center">
                          <a href="${pdfUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);">
                            📄 Descargar PDF de Solicitud
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ''}

                    <!-- Footer -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 2px solid #e5e7eb; margin-top: 30px; padding-top: 20px;">
                      <tr>
                        <td align="center">
                          <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            Este es un correo automático generado por el sistema de Solicitudes de Compra.
                          </p>
                          <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
                            Por favor, no responda a este correo. Para consultas, contacte a ${nombreSolicitante}.
                          </p>
                          <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 12px;">
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

  // Configurar destinatarios
  const toRecipients = data.toEmails && data.toEmails.length > 0
    ? data.toEmails.map(email => ({ emailAddress: { address: email } }))
    : [{ emailAddress: { address: 'angi@siriusregenerative.com' } }];

  const ccRecipients = data.ccEmails && data.ccEmails.length > 0
    ? data.ccEmails.map(email => ({ emailAddress: { address: email } }))
    : [
        { emailAddress: { address: 'adm@siriusregenerative.com' } },
        { emailAddress: { address: 'alejandro@siriusregenerative.com' } },
        { emailAddress: { address: 'david@siriusregenerative.com' } }
      ];

  // Configurar el mensaje
  const message = {
    subject: `${getPrioridadIcon(prioridadSolicitud)} Nueva Solicitud de Compra - ${nombreSolicitante} (${prioridadSolicitud})`,
    body: {
      contentType: 'html',
      content: emailBody
    },
    toRecipients,
    ccRecipients,
    from: {
      emailAddress: {
        address: FROM_EMAIL,
        name: FROM_NAME
      }
    },
    importance: prioridadSolicitud === 'Alta' ? 'high' : 'normal'
  };

  console.log('📧 Enviando correo de solicitud de compra...');
  console.log(`  Para: ${toRecipients.map(r => r.emailAddress.address).join(', ')}`);
  console.log(`  CC: ${ccRecipients.map(r => r.emailAddress.address).join(', ')}`);
  console.log(`  Prioridad: ${prioridadSolicitud}`);

  // Enviar el correo
  await client.api(`/users/${FROM_EMAIL}/sendMail`).post({ message });

  console.log('✅ Correo enviado exitosamente');
}

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Iniciando envío de email de solicitud de compra...');

    const data: SolicitudCompraEmail = await request.json();

    // Validar datos requeridos (mínimos para enviar el email)
    if (!data.nombreSolicitante || !data.areaSolicitante || !data.cargoSolicitante) {
      return NextResponse.json({
        success: false,
        error: 'Faltan datos requeridos para enviar el email: nombreSolicitante, areaSolicitante y cargoSolicitante son obligatorios'
      }, { status: 400 });
    }

    // Asegurar que items sea un array (puede estar vacío)
    if (!Array.isArray(data.items)) {
      data.items = [];
    }

    // Validar configuración de Microsoft Graph
    if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET || !FROM_EMAIL) {
      console.error('❌ Configuración de Microsoft Graph incompleta');
      return NextResponse.json({
        success: false,
        error: 'Configuración de correo incompleta'
      }, { status: 500 });
    }

    console.log('📨 Enviando email por Graph API...');
    await sendEmail(data);

    console.log('✅ Email de solicitud enviado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Email de solicitud de compra enviado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error enviando email de solicitud:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al enviar email'
    }, { status: 500 });
  }
}
