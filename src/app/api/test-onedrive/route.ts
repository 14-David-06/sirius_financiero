import { NextRequest, NextResponse } from 'next/server';

// Endpoint de prueba para verificar conectividad con Microsoft Graph
export async function GET() {
  try {
    const clientId = process.env.ADM_MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.ADM_MICROSOFT_CLIENT_SECRET;
    const tenantId = process.env.ADM_MICROSOFT_TENANT_ID;
    const email = process.env.ADM_MICROSOFT_EMAIL;

    if (!clientId || !clientSecret || !tenantId || !email) {
      return NextResponse.json({
        error: 'Credenciales de Microsoft faltantes',
        missing: {
          clientId: !clientId,
          clientSecret: !clientSecret,
          tenantId: !tenantId,
          email: !email
        }
      }, { status: 500 });
    }

    // Obtener token de acceso
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    console.log('🔑 Solicitando token de acceso...');
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Error obteniendo token:', errorText);
      return NextResponse.json({
        error: 'Error obteniendo token de acceso',
        details: errorText,
        status: tokenResponse.status
      }, { status: 401 });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token obtenido exitosamente');

    // Probar acceso básico al usuario
    const userUrl = `https://graph.microsoft.com/v1.0/users/${email}`;
    const userResponse = await fetch(userUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ Error accediendo al usuario:', errorText);
      return NextResponse.json({
        error: 'Error accediendo al usuario',
        details: errorText,
        status: userResponse.status,
        suggestion: 'Verificar permisos de la aplicación Azure'
      }, { status: 403 });
    }

    const userData = await userResponse.json();
    console.log('✅ Acceso al usuario exitoso');

    // Probar acceso a OneDrive
    const driveUrl = `https://graph.microsoft.com/v1.0/users/${email}/drive`;
    const driveResponse = await fetch(driveUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      console.error('❌ Error accediendo a OneDrive:', errorText);
      return NextResponse.json({
        error: 'Error accediendo a OneDrive',
        details: errorText,
        status: driveResponse.status,
        suggestion: 'Verificar que la aplicación tenga permisos Files.ReadWrite.All'
      }, { status: 403 });
    }

    const driveData = await driveResponse.json();
    console.log('✅ Acceso a OneDrive exitoso');

    // Probar acceso a la carpeta raíz
    const rootUrl = `https://graph.microsoft.com/v1.0/users/${email}/drive/root/children`;
    const rootResponse = await fetch(rootUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!rootResponse.ok) {
      const errorText = await rootResponse.text();
      console.error('❌ Error accediendo a carpeta raíz:', errorText);
      return NextResponse.json({
        error: 'Error accediendo a carpeta raíz de OneDrive',
        details: errorText,
        status: rootResponse.status
      }, { status: 403 });
    }

    const rootData = await rootResponse.json();
    console.log('✅ Acceso a carpeta raíz exitoso');

    return NextResponse.json({
      success: true,
      message: 'Conectividad con Microsoft Graph verificada exitosamente',
      tests: {
        token: '✅ Token obtenido',
        user: '✅ Acceso al usuario',
        drive: '✅ Acceso a OneDrive',
        root: '✅ Acceso a carpeta raíz'
      },
      userInfo: {
        displayName: userData.displayName,
        mail: userData.mail,
        id: userData.id
      },
      driveInfo: {
        id: driveData.id,
        driveType: driveData.driveType,
        quota: driveData.quota
      },
      rootFolders: rootData.value?.slice(0, 5).map((item: any) => ({
        name: item.name,
        type: item.folder ? 'folder' : 'file',
        id: item.id
      })) || []
    });

  } catch (error) {
    console.error('❌ Error en test de conectividad:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}