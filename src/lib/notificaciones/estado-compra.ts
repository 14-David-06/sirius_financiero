import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { escapeAirtableQuery } from '@/lib/security/validation';

export interface CambioEstadoCompra {
  nombreSolicitante: string;
  equipoFinancieroIds: string[];
  fechaSolicitud?: string;
  valorTotal?: number;
  documentoUrl?: string;
  estadoAnterior?: string;
  estadoNuevo: string;
  actualizadoPor: string;
}

export type ResultadoNotificacion =
  | { enviado: true; destinatario: string }
  | { enviado: false; motivo: string };

const ESTADOS: Record<string, { color: string; icono: string; titulo: string; mensaje: string }> = {
  Pendiente: {
    color: '#d97706',
    icono: '⏳',
    titulo: 'volvió a estado Pendiente',
    mensaje: 'Tu solicitud quedó nuevamente en revisión por el área de compras.',
  },
  Aprobado: {
    color: '#059669',
    icono: '✅',
    titulo: 'fue aprobada',
    mensaje: 'El área de compras continuará con la gestión de tu solicitud.',
  },
  Rechazado: {
    color: '#e11d48',
    icono: '❌',
    titulo: 'fue rechazada',
    mensaje: 'Si tienes dudas sobre esta decisión, comunícate con la persona que la revisó.',
  },
  Comprado: {
    color: '#0891b2',
    icono: '🛒',
    titulo: 'ya fue comprada',
    mensaje: 'La compra de tu solicitud ya se realizó.',
  },
};

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function airtableGet(url: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    console.warn(`⚠️ Airtable respondió ${response.status} al buscar el correo del solicitante`);
    return null;
  }
  return response.json();
}

async function buscarEnNomina(campo: string, valor: string): Promise<string[]> {
  const baseId = process.env.NOMINA_AIRTABLE_BASE_ID;
  const tableId = process.env.NOMINA_PERSONAL_TABLE_ID;
  const apiKey = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
  const emailField = process.env.NOMINA_PERSONAL_EMAIL_FIELD || 'Correo electrónico';
  if (!baseId || !tableId || !apiKey) return [];

  const formula = `{${campo}} = "${escapeAirtableQuery(valor)}"`;
  const url =
    `https://api.airtable.com/v0/${baseId}/${tableId}` +
    `?filterByFormula=${encodeURIComponent(formula)}` +
    `&fields%5B%5D=${encodeURIComponent(emailField)}&maxRecords=2`;

  const data = await airtableGet(url, apiKey);
  const records = (data?.records as { fields: Record<string, unknown> }[] | undefined) ?? [];
  return records
    .map(r => String(r.fields[emailField] ?? '').trim())
    .filter(email => EMAIL_VALIDO.test(email));
}

// El correo vive en Nómina Core; la solicitud solo enlaza al usuario de "Equipo Financiero", que tiene la cédula
async function resolverCorreoSolicitante(data: CambioEstadoCompra): Promise<string | null> {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const equipoTable = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';
  const cedulaField = process.env.NOMINA_PERSONAL_CEDULA_FIELD || 'Numero Documento';
  const nombreField = process.env.NOMINA_PERSONAL_NOMBRE_FIELD || 'Nombre completo';

  const equipoId = data.equipoFinancieroIds[0];
  if (equipoId && baseId && apiKey) {
    const usuario = await airtableGet(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(equipoTable)}/${equipoId}`,
      apiKey
    );
    const cedula = (usuario?.fields as { Cedula?: string } | undefined)?.Cedula?.trim();
    if (cedula) {
      const [correo] = await buscarEnNomina(cedulaField, cedula);
      if (correo) return correo;
    }
  }

  // Solicitudes antiguas no tienen el vínculo: solo se acepta si el nombre identifica a una única persona
  const nombre = data.nombreSolicitante.trim();
  if (nombre) {
    const correos = await buscarEnNomina(nombreField, nombre);
    if (correos.length === 1) return correos[0];
  }

  return null;
}

function formatearFecha(iso?: string): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Bogota',
  });
}

function construirHtml(data: CambioEstadoCompra): string {
  const estado = ESTADOS[data.estadoNuevo] ?? {
    color: '#475569',
    icono: '📋',
    titulo: `cambió a ${data.estadoNuevo}`,
    mensaje: '',
  };
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sirius-financiero.vercel.app').replace(/\/+$/, '');
  const nombre = escaparHtml(data.nombreSolicitante);
  const actualizadoPor = escaparHtml(data.actualizadoPor);
  const estadoNuevo = escaparHtml(data.estadoNuevo);
  const valorTotal =
    typeof data.valorTotal === 'number'
      ? `$${data.valorTotal.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
      : null;

  const fila = (etiqueta: string, valor: string) => `
    <tr>
      <td style="padding: 10px 16px; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb; width: 40%;">${etiqueta}</td>
      <td style="padding: 10px 16px; color: #111827; font-size: 14px; border-bottom: 1px solid #e5e7eb;">${valor}</td>
    </tr>`;

  const filas = [
    fila('Fecha de solicitud', formatearFecha(data.fechaSolicitud)),
    data.estadoAnterior ? fila('Estado anterior', escaparHtml(data.estadoAnterior)) : '',
    fila('Nuevo estado', `<strong style="color: ${estado.color};">${estadoNuevo}</strong>`),
    valorTotal ? fila('Valor total', valorTotal) : '',
    fila('Actualizado por', actualizadoPor),
  ].join('');

  const enlacePdf = data.documentoUrl
    ? `<p style="margin: 16px 0 0 0; text-align: center; font-size: 13px;">
         <a href="${escaparHtml(data.documentoUrl.replace(/ /g, '%20'))}" style="color: #4f46e5;">Ver PDF de la solicitud</a>
       </p>`
    : '';

  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 28px 24px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 22px;">${estado.icono} Tu solicitud de compra ${estado.titulo}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px 24px;">
                <p style="margin: 0 0 12px 0; color: #111827; font-size: 15px;">Hola <strong>${nombre}</strong>,</p>
                <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px; line-height: 1.5;">${estado.mensaje}</p>
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-left: 4px solid ${estado.color}; border-radius: 8px;">
                  ${filas}
                </table>
                <p style="margin: 28px 0 0 0; text-align: center;">
                  <a href="${appUrl}/mis-solicitudes-compras" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px;">Ver mis solicitudes</a>
                </p>
                ${enlacePdf}
              </td>
            </tr>
            <tr>
              <td style="background-color: #f9fafb; padding: 16px 24px; text-align: center; color: #9ca3af; font-size: 12px;">
                Correo automático de Sirius Financiero. No respondas a este mensaje.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function enviarCorreo(destinatario: string, asunto: string, html: string): Promise<void> {
  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;
  const remitente = process.env.OUTLOOK_SENDER_EMAIL!;

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const client = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => (await credential.getToken('https://graph.microsoft.com/.default')).token,
    },
  });

  await client.api(`/users/${remitente}/sendMail`).post({
    message: {
      subject: asunto,
      body: { contentType: 'html', content: html },
      toRecipients: [{ emailAddress: { address: destinatario } }],
      from: { emailAddress: { address: remitente, name: 'Compras - Sirius Financiero' } },
    },
  });
}

export async function notificarCambioEstadoCompra(data: CambioEstadoCompra): Promise<ResultadoNotificacion> {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, OUTLOOK_SENDER_EMAIL } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !OUTLOOK_SENDER_EMAIL) {
    return { enviado: false, motivo: 'Configuración de correo incompleta' };
  }

  try {
    const destinatario = await resolverCorreoSolicitante(data);
    if (!destinatario) {
      return { enviado: false, motivo: 'No se encontró el correo del solicitante en Nómina' };
    }

    const icono = ESTADOS[data.estadoNuevo]?.icono ?? '📋';
    await enviarCorreo(
      destinatario,
      `${icono} Tu solicitud de compra está: ${data.estadoNuevo}`,
      construirHtml(data)
    );
    console.log(`📧 Notificación de estado "${data.estadoNuevo}" enviada a ${destinatario}`);
    return { enviado: true, destinatario };
  } catch (error) {
    console.error('❌ Error enviando notificación de estado de compra:', error);
    return { enviado: false, motivo: 'Error al enviar el correo' };
  }
}
