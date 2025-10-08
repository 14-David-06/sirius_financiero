'use client';

import MonitoreoFacturas from '@/components/MonitoreoFacturas';

export default function MonitoreoFacturasPage() {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096889/DJI_0909_cmozhv.jpg)'
      }}
    >
      <div className="min-h-screen flex flex-col justify-center py-24 px-4">
        <MonitoreoFacturas />
      </div>
    </div>
  );
}
