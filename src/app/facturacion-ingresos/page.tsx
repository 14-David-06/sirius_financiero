'use client';

import FacturacionIngresos from '@/components/FacturacionIngresos';
import RoleGuard from '@/components/RoleGuard';

export default function FacturacionIngresosPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <FacturacionIngresos />
    </RoleGuard>
  );
}
