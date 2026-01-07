'use client';

import React, { useState } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  TrendingDown,
  FileText,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  RefreshCw
} from 'lucide-react';

export default function FacturacionEgresos() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [loading, setLoading] = useState(false);

  if (isLoading || loading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10">
          <div className="bg-white/25 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-center space-x-4">
              <RefreshCw className="w-8 h-8 animate-spin text-white" />
              <span className="text-white text-lg font-semibold">Cargando facturación de egresos...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10">
          <div className="bg-white/25 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl max-w-md mx-4">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white text-center mb-2">Acceso Restringido</h2>
            <p className="text-white/80 text-center">
              Debes iniciar sesión para acceder al módulo de facturación de egresos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/18032025-DSC_2933.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-slate-900/20 min-h-screen"></div>
      <div className="relative z-10 pt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
                  <TrendingDown className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                    Facturación de Egresos
                  </h1>
                  <p className="text-slate-200 text-lg mt-1">
                    Gestión y control de facturación de egresos
                  </p>
                </div>
              </div>

              {userData && (
                <div className="flex items-center space-x-3 bg-slate-700/40 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
                  <User className="w-5 h-5 text-red-400" />
                  <div className="text-sm">
                    <p className="font-semibold text-white">{userData.nombre}</p>
                    <p className="text-slate-300">{userData.categoria}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contenido Principal */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-12 border border-white/30">
            <div className="text-center max-w-3xl mx-auto">
              {/* Icono principal */}
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-red-500/20 to-orange-600/20 backdrop-blur-sm rounded-2xl mb-8 shadow-lg border border-red-400/30">
                <FileText className="w-12 h-12 text-red-400" />
              </div>

              {/* Título */}
              <h2 className="text-3xl font-bold text-white mb-4">
                Módulo de Facturación de Egresos
              </h2>

              {/* Descripción */}
              <p className="text-slate-200 text-lg mb-8 leading-relaxed">
                Este módulo está en desarrollo. Aquí podrás gestionar y controlar toda la facturación de egresos de la empresa, 
                incluyendo el registro de facturas de proveedores, seguimiento de pagos pendientes y análisis de gastos por período.
              </p>

              {/* Características futuras */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="p-6 bg-slate-700/30 backdrop-blur-sm rounded-xl border border-red-400/20">
                  <DollarSign className="w-8 h-8 text-red-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Control de Egresos</h3>
                  <p className="text-sm text-slate-300">Registro y seguimiento de todas las facturas de egreso</p>
                </div>

                <div className="p-6 bg-slate-700/30 backdrop-blur-sm rounded-xl border border-red-400/20">
                  <Calendar className="w-8 h-8 text-red-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Análisis Temporal</h3>
                  <p className="text-sm text-slate-300">Análisis de gastos por período y tendencias</p>
                </div>

                <div className="p-6 bg-slate-700/30 backdrop-blur-sm rounded-xl border border-red-400/20">
                  <TrendingDown className="w-8 h-8 text-red-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-white mb-2">Reportes</h3>
                  <p className="text-sm text-slate-300">Generación de reportes y estadísticas de egresos</p>
                </div>
              </div>

              {/* Badge de estado */}
              <div className="inline-flex items-center space-x-3 px-8 py-4 bg-red-500/20 backdrop-blur-sm text-red-300 rounded-xl border-2 border-red-400/30 shadow-md">
                <svg className="w-6 h-6 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-lg">Módulo en Desarrollo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
