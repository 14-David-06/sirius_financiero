'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/hooks/useAuthSession';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredRole?: string;
  redirectTo?: string;
}

// Mapeo de roles a categorías (mismo que middleware.ts)
function normalizarCategoria(categoria: string | undefined): string {
  if (!categoria) return 'Colaborador';

  // Si ya es una categoría normalizada, retornarla
  if (['Desarrollador', 'Gerencia', 'Administrador', 'Colaborador'].includes(categoria)) {
    return categoria;
  }

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

  // Buscar coincidencia case-insensitive
  const categoriaUpper = categoria.toUpperCase();
  for (const [rol, cat] of Object.entries(rolesToCategoria)) {
    if (rol.toUpperCase() === categoriaUpper) {
      return cat;
    }
  }

  // Por defecto, si no encuentra mapeo, tratarlo como Colaborador
  return 'Colaborador';
}

export default function RoleGuard({
  children,
  allowedRoles = [],
  requiredRole,
  redirectTo = '/solicitudes-compra'
}: RoleGuardProps) {
  const { userData, isLoading } = useAuthSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!userData) {
      router.push('/');
      return;
    }

    const userRole = normalizarCategoria(userData.categoria);

    console.log('🔐 RoleGuard verificando acceso:', {
      categoriaOriginal: userData.categoria,
      categoriaNormalizada: userRole,
      allowedRoles,
      requiredRole,
    });

    // Si se especifica requiredRole, verificar exactamente ese rol
    if (requiredRole && userRole !== requiredRole) {
      console.log('❌ Acceso denegado: rol requerido no coincide');
      router.push(redirectTo);
      return;
    }

    // Si se especifican allowedRoles, verificar que el rol esté en la lista
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      console.log('❌ Acceso denegado: rol no está en allowedRoles');
      router.push(redirectTo);
      return;
    }

    console.log('✅ Acceso autorizado');
    setIsAuthorized(true);
  }, [userData, isLoading, requiredRole, allowedRoles, router, redirectTo]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // O un mensaje de "No autorizado"
  }

  return <>{children}</>;
}