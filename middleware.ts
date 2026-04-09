import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Mapeo de roles a categorías (para compatibilidad con tokens JWT antiguos)
function normalizarCategoria(categoria: string): string {
  const rolesToCategoria: Record<string, string> = {
    'INGENIERO DE DESARROLLO': 'Desarrollador',
    'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)': 'Desarrollador',
    'CTO (CHIEF TECHNOLOGY OFFICER)': 'Desarrollador',
    'COORDINADORA LIDER GERENCIA': 'Desarrollador',
    'DIRECTOR FINANCIERO': 'Gerencia',
    'JEFE DE PLANTA': 'Gerencia',
    'JEFE DE PRODUCCION': 'Gerencia',
    'SUPERVISOR DE PRODUCCION': 'Gerencia',
    'CONTADORA': 'Administrador',
    'ASISTENTE FINANCIERO Y CONTABLE': 'Administrador',
    'COORDINADOR DE COMPRAS': 'Administrador',
    'ASISTENTE ADMINISTRATIVO': 'Administrador',
  };
  return rolesToCategoria[categoria] || categoria;
}

// Rutas que requieren autenticación
const protectedRoutes = [
  '/solicitudes-compra',
  '/monitoreo-solicitudes',
  '/seguimiento-pedidos',
  '/caja-menor',
  '/inventario-central',
  '/movimientos-bancarios',
  '/indicadores-produccion',
  '/simulador-proyecciones',
  '/resumen-gerencial',
  '/mis-solicitudes',
  '/monitoreo-facturas',
  '/diagnostic',
  '/onedrive-diagnostic',
  '/test-facturacion',
  '/recepcion-almacen',
  '/warehouse',
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
  '/inventario-central',
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

// Rutas exclusivas para almacenistas y roles elevados
const warehouseRoutes = [
  '/recepcion-almacen',
  '/warehouse',
];

// Roles con acceso a warehouse (gerenciales/administrativos de Sirius Nomina Core)
const WAREHOUSE_ALLOWED_ROLES = [
  // Super Admin (nivel gerencial/directivo)
  'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)',
  'CTO (CHIEF TECHNOLOGY OFFICER)',
  'DIRECTOR FINANCIERO',
  'COORDINADORA LIDER GERENCIA',
  'INGENIERO DE DESARROLLO',

  // Admin Depto (jefes de área con gestión administrativa)
  'JEFE DE PLANTA',
  'JEFE DE PRODUCCION',
  'SUPERVISOR DE PRODUCCION',

  // Roles con nivel Avanzado que gestionan recursos/costos
  'CONTADORA',
  'ASISTENTE FINANCIERO Y CONTABLE',
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
      const categoriaNormalizada = normalizarCategoria(decoded.categoria);
      if (!allowedCategories.includes(categoriaNormalizada)) {
        console.log('Redirigiendo porque no es admin');
        // Redirigir a solicitudes-compra si no tiene permisos
        return NextResponse.redirect(new URL('/solicitudes-compra', request.url));
      }
    }

    // Verificar restricciones para colaboradores
    const categoriaNormalizada = normalizarCategoria(decoded.categoria);
    if (categoriaNormalizada === 'Colaborador') {
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

    // Verificar acceso a rutas de warehouse (roles gerenciales/administrativos)
    const isWarehouseRoute = warehouseRoutes.some(route =>
      pathname.startsWith(route)
    );

    if (isWarehouseRoute) {
      // Verificar tanto el rol original como la categoría mapeada
      const categoriaNormalizada = normalizarCategoria(decoded.categoria);
      const tieneAccesoWarehouse =
        WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria) ||
        categoriaNormalizada === 'Desarrollador' ||
        categoriaNormalizada === 'Gerencia' ||
        categoriaNormalizada === 'Administrador';

      if (!tieneAccesoWarehouse) {
        console.log('Redirigiendo porque no tiene acceso a warehouse. Rol:', decoded.categoria);
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
