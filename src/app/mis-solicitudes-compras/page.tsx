'use client';

import MisSolicitudesCompras from '@/components/MisSolicitudesCompras';
import RoleGuard from '@/components/RoleGuard';

export default function MisSolicitudesPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador', 'Colaborador']}>
      <MisSolicitudesCompras />
    </RoleGuard>
  );
}
