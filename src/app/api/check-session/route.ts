import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { securityHeaders } from '@/lib/security/validation';

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
  const decodedUnknown = jwt.verify(token, JWT_SECRET) as unknown;

  // Narrow the type safely before using
  const decoded = typeof decodedUnknown === 'object' && decodedUnknown !== null ? decodedUnknown as Record<string, unknown> : {};

  // Verificar si el token no ha expirado
  const exp = typeof decoded.exp === 'number' ? decoded.exp : undefined;
  if (exp && exp < Math.floor(Date.now() / 1000)) {
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
          recordId: typeof decoded.recordId === 'string' ? decoded.recordId : undefined,
          cedula: typeof decoded.cedula === 'string' ? decoded.cedula : '',
          nombre: typeof decoded.nombre === 'string' ? decoded.nombre : '',
          cargo: typeof decoded.categoria === 'string' ? decoded.categoria : '',
          categoria: typeof decoded.categoria === 'string' ? decoded.categoria : '',
          idChat: typeof decoded.idChat === 'string' ? decoded.idChat : ''
        }
      }),
      {
        status: 200,
        headers: securityHeaders
      }
    );

  } catch {
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
