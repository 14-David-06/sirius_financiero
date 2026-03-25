'use client';

import RoleGuard from '@/components/RoleGuard';
import InventarioCentral from '@/components/InventarioCentral';

export default function InventarioCentralPage() {
  return (
    <RoleGuard allowedRoles={['Administrador', 'Gerencia', 'Desarrollador']}>
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096889/DJI_0909_cmozhv.jpg)'
        }}
      >
        <InventarioCentral />
      </div>
    </RoleGuard>
  );
}
