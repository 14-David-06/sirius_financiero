'use client';

import IndicadoresProduccion from '@/components/IndicadoresProduccion';
import RoleGuard from '@/components/RoleGuard';

export default function IndicadoresProduccionPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <IndicadoresProduccion />
    </RoleGuard>
  );
}
