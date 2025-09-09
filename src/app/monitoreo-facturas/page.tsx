'use client';

import Navbar from '@/components/layout/Navbar';
import MonitoreoFacturas from '@/components/MonitoreoFacturas';

export default function MonitoreoFacturasPage() {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
      }}
    >
      <div className="min-h-screen flex flex-col justify-center py-20 px-4">
        <Navbar />
        <MonitoreoFacturas />
      </div>
    </div>
  );
}
