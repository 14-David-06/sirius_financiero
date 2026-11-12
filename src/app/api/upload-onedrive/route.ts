import { NextRequest, NextResponse } from 'next/server';
import { obtenerUsuarioSesion } from '@/lib/auth/api-session';
import { importarExtractosBancolombia } from '@/lib/bancos/importar-extractos';
import { resumirImportacion } from '@/lib/importacion/archivos-pendientes';

export const maxDuration = 60;

// Configuración de Microsoft Graph API
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const ONEDRIVE_FOLDER_PATH = 'General/Documentos Soporte/2026/Movimientos Bancolombia';

interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Función para obtener token de acceso usando Client Credentials Flow
async function getAccessToken(): Promise<string> {
  const clientId = process.env.ADM_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.ADM_MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.ADM_MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Faltan credenciales de Microsoft Azure en las variables de entorno');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error obteniendo token:', errorText);
      throw new Error(`Error obteniendo token: ${response.status}`);
    }

    const data: GraphTokenResponse = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error en getAccessToken:', error);
    throw error;
  }
}

// Función para verificar/crear la estructura de carpetas
async function ensureFolderExists(accessToken: string, folderPath: string): Promise<string> {
  const email = process.env.ADM_MICROSOFT_EMAIL;
  if (!email) {
    throw new Error('Email de ADM Microsoft no configurado');
  }

  const pathParts = folderPath.split('/');
  let currentPath = '';
  let currentFolderId = 'root';

  for (const folderName of pathParts) {
    if (!folderName) continue;
    
    currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    
    try {
      // Intentar buscar la carpeta existente usando un enfoque más simple
      console.log(`🔍 Buscando carpeta: ${folderName} en ${currentFolderId}`);
      
      const searchUrl = `${GRAPH_API_BASE}/users/${email}/drive/items/${currentFolderId}/children`;
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log(`📁 Respuesta de búsqueda para ${folderName}:`, searchData);
        
        // Buscar la carpeta por nombre en los resultados
        const existingFolder = searchData.value?.find((item: any) => 
          item.name === folderName && item.folder
        );
        
        if (existingFolder) {
          // La carpeta existe
          currentFolderId = existingFolder.id;
          console.log(`✅ Carpeta encontrada: ${folderName} (ID: ${currentFolderId})`);
        } else {
          // La carpeta no existe, crearla
          console.log(`➕ Creando carpeta: ${folderName}`);
          const createUrl = `${GRAPH_API_BASE}/users/${email}/drive/items/${currentFolderId}/children`;
          
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: folderName,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename'
            }),
          });

          if (createResponse.ok) {
            const createData = await createResponse.json();
            currentFolderId = createData.id;
            console.log(`✅ Carpeta creada: ${folderName} (ID: ${currentFolderId})`);
          } else {
            const errorText = await createResponse.text();
            console.error(`❌ Error creando carpeta ${folderName}:`, errorText);
            throw new Error(`Error creando carpeta ${folderName}: ${errorText}`);
          }
        }
      } else {
        const errorText = await searchResponse.text();
        console.error(`❌ Error buscando carpeta ${folderName}:`, errorText);
        console.error(`❌ Status: ${searchResponse.status}, URL: ${searchUrl}`);
        
        // Si es un error de permisos, intentar con el directorio raíz del sitio
        if (searchResponse.status === 403 || searchResponse.status === 401) {
          throw new Error(`Permisos insuficientes para acceder a OneDrive. Verificar configuración de la aplicación Azure.`);
        }
        
        throw new Error(`Error buscando carpeta ${folderName}: ${searchResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.error(`❌ Error procesando carpeta ${folderName}:`, error);
      throw error;
    }
  }

  return currentFolderId;
}

// Función para subir archivo a OneDrive
async function uploadFileToOneDrive(
  accessToken: string, 
  folderId: string, 
  fileName: string, 
  fileBuffer: Buffer,
  contentType: string
): Promise<any> {
  const email = process.env.ADM_MICROSOFT_EMAIL;
  if (!email) {
    throw new Error('Email de ADM Microsoft no configurado');
  }

  // Para archivos pequeños (< 4MB), usar simple upload
  if (fileBuffer.length < 4 * 1024 * 1024) {
    const uploadUrl = `${GRAPH_API_BASE}/users/${email}/drive/items/${folderId}:/${fileName}:/content`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Error subiendo archivo:', errorText);
      throw new Error(`Error subiendo archivo: ${uploadResponse.status}`);
    }

    return await uploadResponse.json();
  } else {
    // Para archivos grandes, usar upload session (implementar si es necesario)
    throw new Error('Archivos grandes no soportados en esta versión');
  }
}

// Función para verificar si el archivo existe en OneDrive
async function checkFileExists(accessToken: string, folderId: string, fileName: string): Promise<boolean> {
  const email = process.env.ADM_MICROSOFT_EMAIL;
  if (!email) {
    throw new Error('Email de ADM Microsoft no configurado');
  }

  try {
    const checkUrl = `${GRAPH_API_BASE}/users/${email}/drive/items/${folderId}:/${fileName}`;
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return checkResponse.ok;
  } catch (error) {
    console.error('Error verificando archivo:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const usuario = obtenerUsuarioSesion(request);
  if (!usuario || usuario.categoria === 'Colaborador') {
    return NextResponse.json({ error: 'No autorizado' }, { status: usuario ? 403 : 401 });
  }

  try {
    console.log('🔄 Iniciando carga de archivo a OneDrive...');

    // Verificar credenciales
    if (!process.env.ADM_MICROSOFT_CLIENT_ID || !process.env.ADM_MICROSOFT_CLIENT_SECRET || 
        !process.env.ADM_MICROSOFT_TENANT_ID || !process.env.ADM_MICROSOFT_EMAIL) {
      console.error('❌ Faltan credenciales de Microsoft Azure (ADM Account)');
      console.error('Variables faltantes:', {
        ADM_MICROSOFT_CLIENT_ID: !!process.env.ADM_MICROSOFT_CLIENT_ID,
        ADM_MICROSOFT_CLIENT_SECRET: !!process.env.ADM_MICROSOFT_CLIENT_SECRET,
        ADM_MICROSOFT_TENANT_ID: !!process.env.ADM_MICROSOFT_TENANT_ID,
        ADM_MICROSOFT_EMAIL: !!process.env.ADM_MICROSOFT_EMAIL
      });
      return NextResponse.json(
        { 
          error: 'Configuración de OneDrive no disponible',
          message: 'Las credenciales de Microsoft Azure (ADM) no están configuradas en el servidor',
          requiresSetup: true,
          instructions: [
            'Configurar variables de entorno en Vercel:',
            '- ADM_MICROSOFT_CLIENT_ID',
            '- ADM_MICROSOFT_CLIENT_SECRET',
            '- ADM_MICROSOFT_TENANT_ID',
            '- ADM_MICROSOFT_EMAIL'
          ]
        },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const descripcion = formData.get('descripcion') as string || 'Documento de movimientos bancarios';

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    // Verificar que sea un PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF' },
        { status: 400 }
      );
    }

    // Verificar tamaño (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Archivo demasiado grande (máximo 10MB)' },
        { status: 400 }
      );
    }

    console.log(`📄 Procesando archivo: ${file.name}, ${file.size} bytes`);

    // Convertir archivo a buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Obtener token de acceso
    console.log('🔑 Obteniendo token de acceso...');
    const accessToken = await getAccessToken();

    // Asegurar que la estructura de carpetas existe
    console.log('📁 Verificando/creando estructura de carpetas...');
    const folderId = await ensureFolderExists(accessToken, ONEDRIVE_FOLDER_PATH);

    // Generar nombre único para el archivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `movimientos-bancarios-${timestamp}.pdf`;

    // Subir archivo
    console.log(`☁️ Subiendo archivo: ${fileName}`);
    const uploadResult = await uploadFileToOneDrive(
      accessToken, 
      folderId, 
      fileName, 
      buffer, 
      file.type
    );

    // Verificar que el archivo se subió correctamente
    console.log('✅ Verificando carga exitosa...');
    const fileExists = await checkFileExists(accessToken, folderId, fileName);

    if (!fileExists) {
      console.error('❌ El archivo no se encontró después de la carga');
      return NextResponse.json(
        { error: 'Error verificando la carga del archivo' },
        { status: 500 }
      );
    }

    console.log('🎉 Archivo cargado exitosamente a OneDrive');

    // El extracto ya quedó en OneDrive: un error al importarlo no invalida la carga
    let resumenImportacion: string;
    try {
      const resultado = await importarExtractosBancolombia(Date.now() + 30_000);
      resumenImportacion = resumirImportacion('Bancolombia', resultado);
    } catch (importError) {
      console.error('❌ Error importando movimientos de Bancolombia:', importError);
      resumenImportacion = `Bancolombia: error al importar (${importError instanceof Error ? importError.message : 'desconocido'})`;
    }
    console.log(`🏦 ${resumenImportacion}`);

    return NextResponse.json({
      success: true,
      message: 'Archivo cargado exitosamente a OneDrive',
      file: {
        id: uploadResult.id,
        name: fileName,
        size: file.size,
        url: uploadResult.webUrl,
        downloadUrl: uploadResult['@microsoft.graph.downloadUrl'],
        path: `${ONEDRIVE_FOLDER_PATH}/${fileName}`,
        uploadTime: new Date().toISOString(),
        verified: fileExists
      },
      metadata: {
        originalName: file.name,
        descripcion: descripcion,
        folderId: folderId,
        folderPath: ONEDRIVE_FOLDER_PATH
      },
      importacion: resumenImportacion
    });

  } catch (error) {
    console.error('❌ Error cargando archivo a OneDrive:', error);
    
    // Proporcionar información más detallada del error
    const errorMessage = (error as Error).message || 'Error desconocido';
    const isAuthError = errorMessage.includes('token') || errorMessage.includes('Unauthorized') || errorMessage.includes('403') || errorMessage.includes('401');
    const isPermissionError = errorMessage.includes('Permisos insuficientes') || errorMessage.includes('permission');
    
    return NextResponse.json(
      { 
        error: 'Error procesando archivo',
        message: isAuthError 
          ? 'Error de autenticación con Microsoft Azure' 
          : isPermissionError 
            ? 'Permisos insuficientes en Microsoft Azure' 
            : 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        troubleshooting: isAuthError || isPermissionError 
          ? [
              'Verificar que las credenciales de Azure sean correctas',
              'Confirmar que los permisos Files.ReadWrite.All estén configurados',
              'Revisar que la aplicación Azure esté aprobada por el administrador'
            ]
          : ['Contactar al administrador del sistema']
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API de carga de archivos a OneDrive activa',
    folder_path: ONEDRIVE_FOLDER_PATH,
    supported_formats: ['application/pdf'],
    max_file_size: '10MB',
    authentication: 'Microsoft Graph API con Client Credentials'
  });
}