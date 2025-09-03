'use client';

import Navbar from '@/components/layout/Navbar';
import MonitoreoFacturas from '@/components/MonitoreoFacturas';

export default function MonitoreoFacturasPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/80 via-purple-50/60 to-cyan-50/80">
      <Navbar />
      <MonitoreoFacturas />
    </div>
  );
}
