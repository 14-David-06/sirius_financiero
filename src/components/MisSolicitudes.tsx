'use client';

import React, { useState, useEffect } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { FileText, Calendar, AlertCircle, Eye } from 'lucide-react';

interface SolicitudCompra {
  id: string;
  nombreSolicitante: string;
  areaSolicitante: string;
  cargoSolicitante: string;
  prioridadSolicitud: 'Alta' | 'Media' | 'Baja';
  estado: string;
  fechaCreacion: string;
  valorTotal: number;
  items: Array<{
    objeto: string;
    cantidad: number;
    valorItem: number;
  }>;
  razonSocialProveedor?: string;
}

export default function MisSolicitudes() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [solicitudes, setSolicitudes] = useState<SolicitudCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCompra | null>(null);

  useEffect(() => {
    if (isAuthenticated && userData) {
      fetchMisSolicitudes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userData]);

  const fetchMisSolicitudes = async () => {
    try {
      setLoading(true);
      // Usar el nombre del usuario para filtrar las solicitudes
      const response = await fetch(`/api/compras?user=${encodeURIComponent(userData?.nombre || '')}`);
      
      if (response.ok) {
        const data = await response.json();
        setSolicitudes(data.solicitudes || []);
      } else {
        setError('Error al cargar las solicitudes');
      }
    } catch (error) {
      setError('Error de conexión');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado.toLowerCase()) {
      case 'pendiente':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'aprobado':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'rechazado':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'en proceso':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'Alta':
        return 'text-red-300';
      case 'Media':
        return 'text-yellow-300';
      case 'Baja':
        return 'text-green-300';
      default:
        return 'text-gray-300';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
            <p className="text-white/80">Debe iniciar sesión para ver sus solicitudes</p>
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
            <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg mb-2">
              Mis Solicitudes de Compra
            </h1>
            <p className="text-white/80">
              {userData?.nombre} • {userData?.categoria}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-4 mb-6 border border-red-500/30 text-center">
              <AlertCircle className="w-8 h-8 text-red-300 mx-auto mb-2" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Cargando solicitudes...</p>
              </div>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
                <FileText className="w-16 h-16 text-white/60 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No hay solicitudes</h3>
                <p className="text-white/80 mb-6">Aún no has creado ninguna solicitud de compra</p>
                <a
                  href="/solicitudes-compra"
                  className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 text-white font-semibold rounded-lg transition-all duration-300"
                >
                  Crear Primera Solicitud
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {solicitudes.map((solicitud) => (
                <div
                  key={solicitud.id}
                  className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl hover:bg-white/20 transition-all duration-300"
                >
                  {/* Header de la tarjeta */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        Solicitud #{solicitud.id.slice(-8)}
                      </h3>
                      <div className="flex items-center text-white/70 text-sm">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(solicitud.fechaCreacion)}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${getEstadoColor(solicitud.estado)}`}>
                      {solicitud.estado}
                    </span>
                  </div>

                  {/* Información de la solicitud */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-sm">Prioridad:</span>
                      <span className={`font-medium ${getPrioridadColor(solicitud.prioridadSolicitud)}`}>
                        {solicitud.prioridadSolicitud}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-sm">Valor Total:</span>
                      <span className="text-white font-semibold">
                        {formatCurrency(solicitud.valorTotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-sm">Items:</span>
                      <span className="text-white">
                        {solicitud.items.length} producto{solicitud.items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {solicitud.razonSocialProveedor && (
                      <div className="flex items-start justify-between">
                        <span className="text-white/70 text-sm">Proveedor:</span>
                        <span className="text-white text-sm text-right max-w-[150px] truncate">
                          {solicitud.razonSocialProveedor}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Botón de ver detalles */}
                  <button
                    onClick={() => setSelectedSolicitud(solicitud)}
                    className="w-full bg-gradient-to-r from-blue-600/70 to-purple-600/70 hover:from-blue-700/80 hover:to-purple-700/80 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalles
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles */}
      {selectedSolicitud && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-white">
                Solicitud #{selectedSolicitud.id.slice(-8)}
              </h2>
              <button
                onClick={() => setSelectedSolicitud(null)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Estado y fecha */}
              <div className="flex justify-between items-center">
                <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${getEstadoColor(selectedSolicitud.estado)}`}>
                  {selectedSolicitud.estado}
                </span>
                <span className="text-white/70">
                  {formatDate(selectedSolicitud.fechaCreacion)}
                </span>
              </div>

              {/* Información del solicitante */}
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Información del Solicitante</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-white/80">Área: {selectedSolicitud.areaSolicitante}</p>
                  <p className="text-white/80">Cargo: {selectedSolicitud.cargoSolicitante}</p>
                  <p className="text-white/80">Prioridad: 
                    <span className={`ml-1 font-medium ${getPrioridadColor(selectedSolicitud.prioridadSolicitud)}`}>
                      {selectedSolicitud.prioridadSolicitud}
                    </span>
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Items Solicitados</h3>
                <div className="space-y-3">
                  {selectedSolicitud.items.map((item, index) => (
                    <div key={index} className="bg-white/10 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium">{item.objeto}</h4>
                        <span className="text-white font-semibold">
                          {formatCurrency(item.valorItem)}
                        </span>
                      </div>
                      <div className="text-white/70 text-sm">
                        Cantidad: {item.cantidad}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Total:</span>
                    <span className="text-white font-bold text-lg">
                      {formatCurrency(selectedSolicitud.valorTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Proveedor */}
              {selectedSolicitud.razonSocialProveedor && (
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-white font-semibold mb-2">Proveedor</h3>
                  <p className="text-white/80">{selectedSolicitud.razonSocialProveedor}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
