'use client';

import MovimientosBancarios from '@/components/MovimientosBancarios';
import RoleGuard from '@/components/RoleGuard';

export default function MovimientosBancariosPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <MovimientosBancarios />
    </RoleGuard>
  );
}
