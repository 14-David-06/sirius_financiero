'use client';

import React from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  Calculator, 
  AlertCircle
} from 'lucide-react';

export default function SimuladorProyecciones() {
  const { isAuthenticated, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-24"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 text-center">
          <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-24"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 text-center">
          <div className="bg-red-500/20 backdrop-blur-md rounded-3xl p-8 border border-red-500/30 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Acceso Denegado</h2>
            <p className="text-white/80">Debe iniciar sesión para usar el simulador</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-center mb-4">
              <Calculator className="w-8 h-8 text-white mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                Simulador de Proyecciones
              </h1>
            </div>
            <p className="text-white/80">
              Módulo en desarrollo - Próximamente disponible
            </p>
          </div>

          {/* Content Placeholder */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-12 border border-white/20 shadow-xl text-center">
            <Calculator className="w-16 h-16 text-white/60 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Función en Desarrollo</h3>
            <p className="text-white/80">
              Esta funcionalidad estará disponible próximamente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
