'use client';

import DiagnosticPanel from '@/components/DiagnosticPanel';
import RoleGuard from '@/components/RoleGuard';

export default function DiagnosticPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <DiagnosticPanel />
    </RoleGuard>
  );
}
