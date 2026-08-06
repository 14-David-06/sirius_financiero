'use client';

import MovimientosDian from '@/components/MovimientosDian';
import RoleGuard from '@/components/RoleGuard';

export default function MovimientosDianPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <MovimientosDian />
    </RoleGuard>
  );
}
