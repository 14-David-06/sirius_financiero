'use client';

import SimuladorProyecciones from '@/components/SimuladorProyecciones';
import RoleGuard from '@/components/RoleGuard';

export default function SimuladorProyeccionesPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <SimuladorProyecciones />
    </RoleGuard>
  );
}
