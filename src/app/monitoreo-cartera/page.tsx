'use client';

import Navbar from '@/components/layout/Navbar';
import MonitoreoCartera from '@/components/MonitoreoCartera';

export default function MonitoreoCarteraPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/80 via-purple-50/60 to-cyan-50/80">
      <Navbar />
      <MonitoreoCartera />
    </div>
  );
}
