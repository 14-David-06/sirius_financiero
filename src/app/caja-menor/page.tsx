'use client';

import CajaMenor from '@/components/CajaMenor';
import RoleGuard from '@/components/RoleGuard';

export default function CajaMenorPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <CajaMenor />
    </RoleGuard>
  );
}