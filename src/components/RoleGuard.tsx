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

    const userRole = userData.categoria;

    // Si se especifica requiredRole, verificar exactamente ese rol
    if (requiredRole && userRole !== requiredRole) {
      router.push(redirectTo);
      return;
    }

    // Si se especifican allowedRoles, verificar que el rol esté en la lista
    if (allowedRoles.length > 0 && (!userRole || !allowedRoles.includes(userRole))) {
      router.push(redirectTo);
      return;
    }

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