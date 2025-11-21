'use client';

import SolicitudesCompra from '@/components/SolicitudesCompra';
import RoleGuard from '@/components/RoleGuard';

export default function SolicitudesCompraPage() {
  return (
    <RoleGuard allowedRoles={['Colaborador', 'Administrador', 'Gerencia', 'Desarrollador']}>
      <SolicitudesCompra />
    </RoleGuard>
  );
}