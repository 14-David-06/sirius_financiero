import { NextRequest, NextResponse } from 'next/server';
import { securityHeaders, secureLog } from '@/lib/security/validation';

export async function GET(request: NextRequest) {
  try {
    // Solo permitir en desarrollo o con parámetro específico
    const { searchParams } = new URL(request.url);
    const debugKey = searchParams.get('key');
    
    if (process.env.NODE_ENV === 'production' && debugKey !== process.env.DEBUG_KEY) {
      return new NextResponse(
        JSON.stringify({ error: 'No autorizado' }),
        { 
          status: 401,
          headers: securityHeaders
        }
      );
    }

    const envStatus = {
      NODE_ENV: process.env.NODE_ENV,
      AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? '✅ Configurado' : '❌ No configurado',
      AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? '✅ Configurado' : '❌ No configurado',
      COMPRAS_TABLE_ID: process.env.AIRTABLE_COMPRAS_TABLE_ID ? '✅ Configurado' : '❌ No configurado',
      ITEMS_TABLE_ID: process.env.AIRTABLE_ITEMS_TABLE_ID ? '✅ Configurado' : '❌ No configurado',
      timestamp: new Date().toISOString()
    };

    secureLog('🔍 Verificación de variables de entorno', envStatus);

    return new NextResponse(
      JSON.stringify(envStatus),
      { 
        status: 200,
        headers: securityHeaders
      }
    );

  } catch (error) {
    console.error('Error en env-check:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
