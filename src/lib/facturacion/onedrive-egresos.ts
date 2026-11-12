import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

/**
 * Crea cliente de Microsoft Graph con credenciales de aplicación
 */
function crearClienteGraph(): Client {
  const { ADM_MICROSOFT_CLIENT_ID, ADM_MICROSOFT_CLIENT_SECRET, ADM_MICROSOFT_TENANT_ID } =
    process.env;

  if (!ADM_MICROSOFT_CLIENT_ID || !ADM_MICROSOFT_CLIENT_SECRET || !ADM_MICROSOFT_TENANT_ID) {
    throw new Error('Faltan credenciales de Microsoft Graph');
  }

  const credential = new ClientSecretCredential(
    ADM_MICROSOFT_TENANT_ID,
    ADM_MICROSOFT_CLIENT_ID,
    ADM_MICROSOFT_CLIENT_SECRET
  );

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        return token.token;
      },
    },
  });
}

interface ArchivoOneDrive {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  downloadUrl?: string;
}

/**
 * Busca carpeta por nombre entre los hijos de una carpeta padre
 */
async function buscarCarpetaPorNombre(
  client: Client,
  userId: string,
  parentId: string,
  nombreCarpeta: string
): Promise<string | null> {
  try {
    const response = await client
      .api(`/users/${userId}/drive/items/${parentId}/children`)
      .select('id,name,folder')
      .get();

    const carpeta = response.value.find(
      (item: any) => item.folder && item.name === nombreCarpeta
    );

    return carpeta?.id || null;
  } catch (error) {
    console.error(`❌ Error buscando carpeta "${nombreCarpeta}":`, error);
    return null;
  }
}

/**
 * Obtiene nombre del mes actual en español (formato usado en OneDrive)
 * Ejemplos: "1. Enero", "6. Junio", "12. Diciembre"
 */
function obtenerNombreMesActual(): string {
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const ahora = new Date();
  const numeroMes = ahora.getMonth() + 1; // 1-12
  const nombreMes = meses[ahora.getMonth()];

  return `${numeroMes}. ${nombreMes}`;
}

/**
 * Búsqueda inteligente de carpeta de facturación egresos
 *
 * Ruta esperada:
 * General/Documentos Soporte/{año actual}/Egresos/{mes actual}/
 *
 * Ejemplo: General/Documentos Soporte/2026/Egresos/11. Noviembre/
 *
 * CORRIGE el bug del workflow n8n que tenía hardcoded "6. Junio"
 */
export async function buscarCarpetaEgresosActual(): Promise<string> {
  const client = crearClienteGraph();
  const userId = process.env.ADM_MICROSOFT_EMAIL;

  if (!userId) {
    throw new Error('Falta ADM_MICROSOFT_EMAIL');
  }

  const añoActual = new Date().getFullYear().toString();
  const mesActual = obtenerNombreMesActual();

  console.log(`🔍 [OneDrive] Buscando carpeta: {año}/${añoActual}/Egresos/${mesActual}`);

  // Carpeta raíz: "General/Documentos Soporte"
  // ID conocido del workflow n8n: 01LXL6CJF3C4WQAY7LBNA2F6IC2SKNW65M
  const carpetaRaiz = '01LXL6CJF3C4WQAY7LBNA2F6IC2SKNW65M';

  // Buscar carpeta del año
  const carpetaAño = await buscarCarpetaPorNombre(client, userId, carpetaRaiz, añoActual);
  if (!carpetaAño) {
    throw new Error(`No se encontró carpeta para el año ${añoActual}`);
  }

  console.log(`✅ [OneDrive] Carpeta año encontrada:`, carpetaAño);

  // Buscar carpeta "Egresos"
  const carpetaEgresos = await buscarCarpetaPorNombre(client, userId, carpetaAño, 'Egresos');
  if (!carpetaEgresos) {
    throw new Error(`No se encontró carpeta "Egresos" en ${añoActual}`);
  }

  console.log(`✅ [OneDrive] Carpeta Egresos encontrada:`, carpetaEgresos);

  // Buscar carpeta del mes actual
  const carpetaMes = await buscarCarpetaPorNombre(client, userId, carpetaEgresos, mesActual);
  if (!carpetaMes) {
    throw new Error(`No se encontró carpeta "${mesActual}" en Egresos/${añoActual}`);
  }

  console.log(`✅ [OneDrive] Carpeta mes encontrada:`, carpetaMes);

  return carpetaMes;
}

/**
 * Lista archivos PDF pendientes de procesar en la carpeta de egresos
 */
export async function listarPDFsPendientes(carpetaId: string): Promise<ArchivoOneDrive[]> {
  const client = crearClienteGraph();
  const userId = process.env.ADM_MICROSOFT_EMAIL;

  if (!userId) {
    throw new Error('Falta ADM_MICROSOFT_EMAIL');
  }

  console.log(`📂 [OneDrive] Listando archivos en carpeta:`, carpetaId);

  const archivos: ArchivoOneDrive[] = [];
  let nextLink: string | undefined = `/users/${userId}/drive/items/${carpetaId}/children`;

  // Paginar todos los archivos
  while (nextLink) {
    const response = await client
      .api(nextLink)
      .select('id,name,size,createdDateTime,file,@microsoft.graph.downloadUrl')
      .get();

    // Filtrar solo PDFs
    const pdfs = response.value
      .filter((item: any) => item.file && item.name.toLowerCase().endsWith('.pdf'))
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        createdDateTime: item.createdDateTime,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
      }));

    archivos.push(...pdfs);

    nextLink = response['@odata.nextLink'];
  }

  console.log(`✅ [OneDrive] ${archivos.length} PDFs encontrados`);

  return archivos;
}

/**
 * Descarga un archivo de OneDrive
 */
export async function descargarArchivo(archivoId: string): Promise<Buffer> {
  const client = crearClienteGraph();
  const userId = process.env.ADM_MICROSOFT_EMAIL;

  if (!userId) {
    throw new Error('Falta ADM_MICROSOFT_EMAIL');
  }

  console.log(`⬇️ [OneDrive] Descargando archivo:`, archivoId);

  const response = await client.api(`/users/${userId}/drive/items/${archivoId}/content`).get();

  // La respuesta es un ArrayBuffer
  const buffer = Buffer.from(response);

  console.log(`✅ [OneDrive] Archivo descargado: ${buffer.length} bytes`);

  return buffer;
}
