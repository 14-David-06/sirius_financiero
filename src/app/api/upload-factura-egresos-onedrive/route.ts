import { NextRequest, NextResponse } from 'next/server';
import { sendStreamEvent } from '@/lib/stream-manager';

// Configuración de Microsoft Graph API
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const ONEDRIVE_FOLDER_PATH = 'General/Documentos Soporte/2026/Egresos/Automatizacion Egresos';

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
}

// Función para obtener ID de carpeta usando ruta directa
async function getFolderId(accessToken: string, folderPath: string): Promise<string> {
  const email = process.env.ADM_MICROSOFT_EMAIL;
  if (!email) {
    throw new Error('Email de ADM Microsoft no configurado');
  }

  console.log('📁 Accediendo a carpeta de destino...');

  // Usar ruta directa para evitar recorrido recursivo
  const url = `${GRAPH_API_BASE}/users/${email}/drive/root:/${folderPath}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`La carpeta "${folderPath}" no existe. Por favor créala manualmente en OneDrive.`);
    }
    throw new Error(`Error al acceder a la carpeta: ${response.statusText}`);
  }

  const folder = await response.json();
  console.log('✅ Carpeta de destino localizada');
  return folder.id;
}

// Función para subir archivo
async function uploadFileToOneDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBuffer: ArrayBuffer,
  contentType: string
): Promise<any> {
  const email = process.env.ADM_MICROSOFT_EMAIL;
  
  const uploadUrl = `${GRAPH_API_BASE}/users/${email}/drive/items/${folderId}:/${fileName}:/content`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error subiendo archivo:', errorText);
    throw new Error(`Error subiendo archivo: ${response.status}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  // Generar ID único para esta transacción
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`📤 Iniciando carga de factura de EGRESO [${transactionId}]`);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    console.log(`📄 Archivo recibido: ${file.name}, Tamaño: ${file.size} bytes`);

    // Enviar evento: Iniciando subida
    sendStreamEvent(transactionId, {
      type: 'progress',
      step: 'uploading',
      message: '☁️ Subiendo archivo a OneDrive...',
      timestamp: new Date().toISOString()
    });

    // Convertir archivo a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Obtener token de acceso
    console.log('🔑 Obteniendo token de acceso...');
    const accessToken = await getAccessToken();

    // Obtener ID de carpeta de destino
    const folderId = await getFolderId(accessToken, ONEDRIVE_FOLDER_PATH);

    // Subir archivo con nombre original
    console.log(`☁️ Subiendo archivo: ${file.name}`);
    const uploadResult = await uploadFileToOneDrive(
      accessToken, 
      folderId, 
      file.name, 
      arrayBuffer, 
      file.type
    );

    console.log('✅ Archivo subido exitosamente a OneDrive');

    // Enviar evento: OneDrive completado
    sendStreamEvent(transactionId, {
      type: 'progress',
      step: 'onedrive_complete',
      message: '✅ Archivo guardado en OneDrive',
      timestamp: new Date().toISOString()
    });

    // Enviar evento: Activando webhook
    sendStreamEvent(transactionId, {
      type: 'progress',
      step: 'activating_webhook',
      message: '🔔 Activando automatización...',
      timestamp: new Date().toISOString()
    });

    // Paso 2: Activar webhook de n8n para EGRESOS
    try {
      console.log('🔔 Activando webhook de n8n (EGRESOS)...');
      const webhookUrl = process.env.N8N_WEBHOOK_FACTURACION_EGRESOS_URL;
      
      if (!webhookUrl) {
        throw new Error('N8N_WEBHOOK_FACTURACION_EGRESOS_URL no está configurada en las variables de entorno');
      }
      
      const webhookPayload = {
        transactionId, // Incluir ID de transacción
        fileName: file.name,
        fileSize: file.size,
        oneDriveFileId: uploadResult.id, // ID del documento en OneDrive
        driveId: uploadResult.parentReference?.driveId || null, // ID del drive
        itemId: uploadResult.id, // ID del item (mismo que fileId)
        webUrl: uploadResult.webUrl, // URL web del archivo
        downloadUrl: uploadResult['@microsoft.graph.downloadUrl'] || null, // URL de descarga directa
        timestamp: new Date().toISOString(),
        type: 'factura_egreso',
        mode: 'One', // Modo One: procesar solo esta factura
        callbackUrl: `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/facturacion-egresos-callback`
      };

      console.log('📤 Payload webhook (EGRESOS):', JSON.stringify(webhookPayload, null, 2));
      
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      console.log('📥 Webhook status:', webhookResponse.status, webhookResponse.statusText);

      if (webhookResponse.ok) {
        const webhookResult = await webhookResponse.text();
        console.log('✅ Webhook activado exitosamente (EGRESOS)');
        console.log('📄 Respuesta webhook:', webhookResult || '(sin contenido)');
        
        // Enviar evento: Esperando procesamiento
        sendStreamEvent(transactionId, {
          type: 'progress',
          step: 'processing',
          message: '⏳ Esperando respuesta de la automatización...',
          timestamp: new Date().toISOString()
        });
        
      } else {
        const errorBody = await webhookResponse.text();
        console.error('❌ ERROR WEBHOOK (EGRESOS):');
        console.error('   Status:', webhookResponse.status);
        console.error('   Status Text:', webhookResponse.statusText);
        console.error('   Body:', errorBody);
        console.error('   URL:', webhookUrl);
        
        // Enviar evento de error
        sendStreamEvent(transactionId, {
          type: 'error',
          message: 'Error al activar la automatización',
          error: errorBody,
          timestamp: new Date().toISOString()
        });
      }
    } catch (webhookError) {
      // No lanzamos error porque el archivo ya se subió exitosamente
      console.error('❌ EXCEPCIÓN AL LLAMAR WEBHOOK (EGRESOS):');
      console.error('   Error:', webhookError);
      console.error('   Mensaje:', webhookError instanceof Error ? webhookError.message : 'Error desconocido');
      
      sendStreamEvent(transactionId, {
        type: 'error',
        message: 'Error de conexión con la automatización',
        error: webhookError instanceof Error ? webhookError.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      transactionId, // Devolver ID para que el cliente pueda conectarse al stream
      data: {
        fileName: file.name,
        fileId: uploadResult.id,
        webUrl: uploadResult.webUrl,
        size: uploadResult.size,
      },
    });

  } catch (error) {
    console.error(`❌ Error en upload-factura-egresos-onedrive [${transactionId}]:`, error);
    
    sendStreamEvent(transactionId, {
      type: 'error',
      message: 'Error al procesar el archivo',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error al subir el archivo a OneDrive' 
      },
      { status: 500 }
    );
  }
}
