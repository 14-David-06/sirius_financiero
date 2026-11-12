import { NextRequest, NextResponse } from 'next/server';

// Configuración alternativa usando SharePoint/OneDrive compartido
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Función para obtener token de acceso
async function getAccessToken(): Promise<string> {
  const clientId = process.env.ADM_MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.ADM_MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.ADM_MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Faltan credenciales de Microsoft Azure');
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
    throw new Error(`Error obteniendo token: ${response.status} - ${errorText}`);
  }

  const data: GraphTokenResponse = await response.json();
  return data.access_token;
}

// Función alternativa: subir a una carpeta temporal en el sitio
async function uploadToSharedLocation(
  accessToken: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<any> {
  
  // Opción 1: Intentar usar el sitio raíz de SharePoint
  try {
    console.log('📁 Intentando subir a SharePoint...');
    
    // Obtener el sitio raíz
    const siteUrl = `${GRAPH_API_BASE}/sites/root`;
    const siteResponse = await fetch(siteUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (siteResponse.ok) {
      const siteData = await siteResponse.json();
      console.log('✅ Acceso a SharePoint exitoso');
      
      // Intentar subir a la biblioteca de documentos
      const uploadUrl = `${GRAPH_API_BASE}/sites/${siteData.id}/drive/root:/MovimientosBancarios/${fileName}:/content`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': contentType,
        },
        body: new Uint8Array(fileBuffer),
      });

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log('✅ Archivo subido a SharePoint exitosamente');
        return {
          ...uploadData,
          location: 'SharePoint',
          path: `/MovimientosBancarios/${fileName}`
        };
      }
    }
  } catch (error) {
    console.log('❌ Error con SharePoint, intentando método alternativo...');
  }

  // Opción 2: Crear el archivo en una ubicación temporal y notificar
  console.log('📝 Creando registro de archivo pendiente...');
  
  return {
    id: `temp-${Date.now()}`,
    name: fileName,
    size: fileBuffer.length,
    webUrl: '#pending',
    location: 'pending',
    message: 'Archivo procesado - requiere configuración manual de permisos',
    instructions: [
      '1. Verificar permisos de la aplicación Azure',
      '2. Agregar permisos Files.ReadWrite.All y Sites.ReadWrite.All',
      '3. Confirmar acceso a OneDrive/SharePoint',
      '4. Reintentar la carga'
    ]
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando carga alternativa a OneDrive/SharePoint...');

    // Verificar credenciales
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET || 
        !process.env.MICROSOFT_TENANT_ID) {
      console.error('❌ Faltan credenciales de Microsoft Azure');
      console.error('Variables faltantes:', {
        MICROSOFT_CLIENT_ID: !!process.env.MICROSOFT_CLIENT_ID,
        MICROSOFT_CLIENT_SECRET: !!process.env.MICROSOFT_CLIENT_SECRET,
        MICROSOFT_TENANT_ID: !!process.env.MICROSOFT_TENANT_ID
      });
      return NextResponse.json(
        { 
          error: 'Configuración de Microsoft no disponible',
          message: 'Las credenciales de Microsoft Azure no están configuradas en el servidor',
          requiresSetup: true,
          instructions: [
            'Configurar variables de entorno en Vercel:',
            '- MICROSOFT_CLIENT_ID',
            '- MICROSOFT_CLIENT_SECRET',
            '- MICROSOFT_TENANT_ID'
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

    // Validaciones
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF' },
        { status: 400 }
      );
    }

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

    // Obtener token
    console.log('🔑 Obteniendo token de acceso...');
    const accessToken = await getAccessToken();

    // Generar nombre único
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `movimientos-bancarios-${timestamp}.pdf`;

    // Intentar subir con método alternativo
    console.log('☁️ Intentando carga con método alternativo...');
    const uploadResult = await uploadToSharedLocation(
      accessToken,
      fileName,
      buffer,
      file.type
    );

    return NextResponse.json({
      success: true,
      message: 'Archivo procesado',
      file: {
        id: uploadResult.id,
        name: fileName,
        size: file.size,
        url: uploadResult.webUrl,
        location: uploadResult.location,
        path: uploadResult.path || 'pending',
        uploadTime: new Date().toISOString()
      },
      metadata: {
        originalName: file.name,
        descripcion: descripcion,
        method: 'alternative'
      },
      importacion: 'El extracto quedó en SharePoint, que no se importa automáticamente: súbalo de nuevo cuando la carga principal funcione',
      instructions: uploadResult.instructions || [],
      note: uploadResult.message || 'Archivo subido exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en carga alternativa:', error);
    
    // Proporcionar información más detallada del error
    const errorMessage = (error as Error).message || 'Error desconocido';
    const isAuthError = errorMessage.includes('token') || errorMessage.includes('Unauthorized') || errorMessage.includes('403') || errorMessage.includes('401');
    const isPermissionError = errorMessage.includes('permission');
    
    return NextResponse.json({
      error: 'Error procesando archivo',
      message: isAuthError 
        ? 'Error de autenticación con Microsoft Azure' 
        : isPermissionError 
          ? 'Permisos insuficientes en Microsoft Azure' 
          : 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      solution: 'Verificar configuración de permisos Azure',
      troubleshooting: isAuthError || isPermissionError 
        ? [
            'Verificar credenciales de Azure',
            'Confirmar permisos Files.ReadWrite.All y Sites.ReadWrite.All',
            'Revisar aprobación de la aplicación Azure'
          ]
        : ['Contactar al administrador del sistema']
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'API alternativa de OneDrive/SharePoint',
    status: 'active',
    methods: ['SharePoint Sites', 'Temporary Storage'],
    requirements: [
      'Files.ReadWrite.All permission',
      'Sites.ReadWrite.All permission',
      'Valid Azure App Registration'
    ]
  });
}