import { NextResponse } from 'next/server';
import { securityHeaders, secureLog } from '@/lib/security/validation';

export async function POST() {
  try {
    secureLog('✅ Usuario cerró sesión');
    
    const response = new NextResponse(
      JSON.stringify({ success: true, message: 'Sesión cerrada exitosamente' }),
      {
        status: 200,
        headers: securityHeaders
      }
    );

    // Eliminar la cookie de autenticación
    response.cookies.delete('auth-token');

    return response;

  } catch (error) {
    secureLog('🚨 Error en logout', { 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
    
    return new NextResponse(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
