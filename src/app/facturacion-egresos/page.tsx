'use client';

import FacturacionEgresos from '@/components/FacturacionEgresos';
import RoleGuard from '@/components/RoleGuard';

export default function FacturacionEgresosPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <FacturacionEgresos />
    </RoleGuard>
  );
}
