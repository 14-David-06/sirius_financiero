/**
 * Cliente mínimo de Microsoft Graph para el OneDrive de la cuenta ADM
 * (client credentials: ADM_MICROSOFT_CLIENT_ID / SECRET / TENANT_ID + ADM_MICROSOFT_EMAIL).
 */

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export interface DriveItem {
  id: string;
  name: string;
  createdDateTime: string;
  file?: { mimeType: string };
  folder?: { childCount: number };
}

let tokenEnCache: { valor: string; expiraEn: number } | null = null;

export async function obtenerTokenGraph(): Promise<string> {
  if (tokenEnCache && tokenEnCache.expiraEn > Date.now()) {
    return tokenEnCache.valor;
  }

  const clientId = process.env.ADM_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.ADM_MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.ADM_MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Faltan credenciales de Microsoft Azure (ADM_MICROSOFT_*) en las variables de entorno');
  }

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo token de Microsoft Graph: ${response.status} ${await response.text()}`);
  }

  const data: { access_token: string; expires_in: number } = await response.json();
  // Margen de 5 minutos para no usar un token a punto de expirar
  tokenEnCache = { valor: data.access_token, expiraEn: Date.now() + (data.expires_in - 300) * 1000 };
  return data.access_token;
}

function urlDrive(): string {
  const email = process.env.ADM_MICROSOFT_EMAIL;
  if (!email) {
    throw new Error('ADM_MICROSOFT_EMAIL no está configurado');
  }
  return `${GRAPH_API_BASE}/users/${email}/drive`;
}

export async function listarHijosCarpeta(carpetaId: string): Promise<DriveItem[]> {
  const token = await obtenerTokenGraph();
  const items: DriveItem[] = [];
  let url: string | undefined =
    `${urlDrive()}/items/${carpetaId}/children?$select=id,name,createdDateTime,file,folder&$top=200`;

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(`Error listando carpeta de OneDrive: ${response.status} ${await response.text()}`);
    }
    const data: { value: DriveItem[]; '@odata.nextLink'?: string } = await response.json();
    items.push(...data.value);
    url = data['@odata.nextLink'];
  }

  return items;
}

export async function descargarArchivo(itemId: string): Promise<Buffer> {
  const token = await obtenerTokenGraph();
  const response = await fetch(`${urlDrive()}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Error descargando archivo de OneDrive: ${response.status} ${await response.text()}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
