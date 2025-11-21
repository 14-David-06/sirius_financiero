'use client';

import ResumenGerencial from '@/components/ResumenGerencial';
import RoleGuard from '@/components/RoleGuard';

export default function ResumenGerencialPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <ResumenGerencial />
    </RoleGuard>
  );
}
