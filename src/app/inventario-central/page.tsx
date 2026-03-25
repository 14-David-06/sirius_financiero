'use client';

import RoleGuard from '@/components/RoleGuard';
import InventarioCentral from '@/components/InventarioCentral';

export default function InventarioCentralPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <InventarioCentral />
      </div>
    </RoleGuard>
  );
}
