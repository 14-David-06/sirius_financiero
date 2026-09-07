'use client';

import MonitoreoCartera from '@/components/MonitoreoCartera';
import RoleGuard from '@/components/RoleGuard';

export default function MonitoreoCarteraPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador', 'Colaborador']}>
      <MonitoreoCartera />
    </RoleGuard>
  );
}
