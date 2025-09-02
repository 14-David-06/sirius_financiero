import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Rutas que requieren autenticación
const protectedRoutes = [
  '/solicitudes-compra',
  '/monitoreo-solicitudes',
  '/seguimiento-pedidos',
];

// Rutas que requieren roles específicos
const adminRoutes = [
  '/monitoreo-solicitudes',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Verificar si la ruta necesita protección
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Obtener token de la cookie
  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // Redirigir al login si no hay token
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Verificar token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verificar si el token no ha expirado
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      // Token expirado
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    // Verificar roles para rutas administrativas
    const isAdminRoute = adminRoutes.some(route => 
      pathname.startsWith(route)
    );

    if (isAdminRoute) {
      const allowedCategories = ['Administrador', 'Gerencia', 'Desarrollador'];
      if (!allowedCategories.includes(decoded.categoria)) {
        // Redirigir a solicitudes-compra si no tiene permisos
        return NextResponse.redirect(new URL('/solicitudes-compra', request.url));
      }
    }

    // Agregar datos del usuario a los headers para que estén disponibles en las páginas
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-cedula', decoded.cedula);
    requestHeaders.set('x-user-nombre', decoded.nombre);
    requestHeaders.set('x-user-categoria', decoded.categoria);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    // Token inválido
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('auth-token');
    return response;
  }
}

export const config = {
  matcher: [
    '/solicitudes-compra/:path*',
    '/monitoreo-solicitudes/:path*',
    '/seguimiento-pedidos/:path*',
  ],
};
