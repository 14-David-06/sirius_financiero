'use client';

import MisSolicitudes from '@/components/MisSolicitudes';
import RoleGuard from '@/components/RoleGuard';

export default function MisSolicitudesPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <MisSolicitudes />
    </RoleGuard>
  );
}
