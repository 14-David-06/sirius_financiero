import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Obtener token de la cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return new NextResponse(
        JSON.stringify({ authenticated: false }),
        {
          status: 200,
          headers: securityHeaders
        }
      );
    }

    // Verificar token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verificar si el token no ha expirado
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      // Token expirado
      const response = new NextResponse(
        JSON.stringify({ authenticated: false, message: 'Token expirado' }),
        {
          status: 200,
          headers: securityHeaders
        }
      );
      response.cookies.delete('auth-token');
      return response;
    }

    // Token válido
    return new NextResponse(
      JSON.stringify({
        authenticated: true,
        user: {
          cedula: decoded.cedula,
          nombre: decoded.nombre,
          categoria: decoded.categoria
        }
      }),
      {
        status: 200,
        headers: securityHeaders
      }
    );

  } catch (error) {
    // Token inválido
    const response = new NextResponse(
      JSON.stringify({ authenticated: false, message: 'Token inválido' }),
      {
        status: 200,
        headers: securityHeaders
      }
    );
    response.cookies.delete('auth-token');
    return response;
  }
}
