import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Rutas que requieren autenticación
const protectedRoutes = [
  '/solicitudes-compra',
  '/monitoreo-solicitudes',
  '/seguimiento-pedidos',
  '/caja-menor',
  '/movimientos-bancarios',
  '/indicadores-produccion',
  '/simulador-proyecciones',
  '/resumen-gerencial',
  '/mis-solicitudes',
  '/monitoreo-facturas',
  '/diagnostic',
  '/onedrive-diagnostic',
  '/test-facturacion',
];

// Rutas que requieren roles específicos
const adminRoutes = [
  '/monitoreo-solicitudes',
];

// Rutas exclusivas para colaboradores
const collaboratorOnlyRoutes = [
  '/solicitudes-compra',
];

// Rutas que requieren permisos elevados (no colaboradores)
const elevatedRoutes = [
  '/monitoreo-solicitudes',
  '/caja-menor',
  '/movimientos-bancarios',
  '/indicadores-produccion',
  '/simulador-proyecciones',
  '/resumen-gerencial',
  '/seguimiento-pedidos',
  '/mis-solicitudes',
  '/monitoreo-facturas',
  '/diagnostic',
  '/onedrive-diagnostic',
  '/test-facturacion',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('Middleware ejecutándose para:', pathname);

  // Verificar si la ruta necesita protección
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  console.log('Es ruta protegida:', isProtectedRoute);

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Obtener token de la cookie
  const token = request.cookies.get('auth-token')?.value;

  console.log('Token presente:', !!token);

  if (!token) {
    // Redirigir al login si no hay token
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Verificar token JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    console.log('Decoded categoria:', decoded.categoria);

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

    console.log('Es ruta admin:', isAdminRoute, 'Categoria:', decoded.categoria);

    if (isAdminRoute) {
      const allowedCategories = ['Administrador', 'Gerencia', 'Desarrollador'];
      if (!allowedCategories.includes(decoded.categoria)) {
        console.log('Redirigiendo porque no es admin');
        // Redirigir a solicitudes-compra si no tiene permisos
        return NextResponse.redirect(new URL('/solicitudes-compra', request.url));
      }
    }

    // Verificar restricciones para colaboradores
    if (decoded.categoria === 'Colaborador') {
      const isElevatedRoute = elevatedRoutes.some(route => 
        pathname.startsWith(route)
      );

      console.log('Es colaborador, ruta elevada:', isElevatedRoute);

      if (isElevatedRoute) {
        console.log('Redirigiendo colaborador de ruta elevada');
        // Los colaboradores solo pueden acceder a solicitudes-compra
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
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
