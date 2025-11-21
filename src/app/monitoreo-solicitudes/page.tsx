'use client';

import MonitoreoSolicitudes from '@/components/MonitoreoSolicitudes';
import RoleGuard from '@/components/RoleGuard';

export default function MonitoreoSolicitudesPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <MonitoreoSolicitudes />
    </RoleGuard>
  );
}
