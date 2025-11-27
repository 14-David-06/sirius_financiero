'use client';

import React, { useState, useEffect } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { FileText, Calendar, AlertCircle, Eye } from 'lucide-react';
import { CompraCompleta } from '@/types/compras';

export default function MisSolicitudes() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [solicitudes, setSolicitudes] = useState<CompraCompleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSolicitud, setSelectedSolicitud] = useState<CompraCompleta | null>(null);

  useEffect(() => {
    if (isAuthenticated && userData) {
      fetchMisSolicitudes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userData]);

  const fetchMisSolicitudes = async () => {
    try {
      setLoading(true);
      
      // Validar que tenemos los datos necesarios del usuario
      if (!userData?.nombre) {
        throw new Error('Nombre de usuario no disponible');
      }
      
      if (!userData?.categoria) {
        throw new Error('Categoría de usuario no disponible');
      }
      
      // Filtrar por nombre del usuario Y área para evitar duplicados
      const params = new URLSearchParams({
        user: userData.nombre,
        area: userData.categoria,
        // Nota: La cédula se valida en autenticación pero no se usa para filtrado de compras
        // ya que la tabla de compras no tiene campo de cédula directamente
      });
      
      const response = await fetch(`/api/consultamiscompras?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        const compras = data.compras || [];
        
        // Validación adicional: detectar posibles duplicados en el frontend
        const userAreaCombinations = new Map<string, number>();
        compras.forEach((compra: CompraCompleta) => {
          const key = `${compra.nombreSolicitante}||${compra.areaCorrespondiente}`;
          userAreaCombinations.set(key, (userAreaCombinations.get(key) || 0) + 1);
        });
        
        // Log para debugging (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
          console.log('📊 Estadísticas de solicitudes:', {
            total: compras.length,
            combinacionesUsuarioArea: userAreaCombinations.size,
            posiblesDuplicados: Array.from(userAreaCombinations.entries())
              .filter(([, count]) => count > 1)
              .map(([key, count]) => `${key}: ${count}`)
          });
        }
        
        setSolicitudes(compras);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al cargar las solicitudes');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
      setError(errorMessage);
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    // Configuración centralizada de colores de estado
    const estadoConfig: Record<string, { bg: string; text: string; border: string }> = {
      'pendiente': {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-300',
        border: 'border-yellow-500/30'
      },
      'aprobado': {
        bg: 'bg-green-500/20',
        text: 'text-green-300',
        border: 'border-green-500/30'
      },
      'rechazado': {
        bg: 'bg-red-500/20',
        text: 'text-red-300',
        border: 'border-red-500/30'
      },
      'en proceso': {
        bg: 'bg-blue-500/20',
        text: 'text-blue-300',
        border: 'border-blue-500/30'
      },
      'cancelado': {
        bg: 'bg-gray-500/20',
        text: 'text-gray-300',
        border: 'border-gray-500/30'
      },
      'completado': {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-300',
        border: 'border-emerald-500/30'
      }
    };

    const config = estadoConfig[estado.toLowerCase()] || estadoConfig['pendiente'];
    return `${config.bg} ${config.text} ${config.border}`;
  };

  const getPrioridadColor = (prioridad: string) => {
    // Configuración centralizada de colores de prioridad
    const prioridadConfig: Record<string, string> = {
      'Alta': 'text-red-300',
      'Media': 'text-yellow-300',
      'Baja': 'text-green-300',
      'Crítica': 'text-red-400',
      'Urgente': 'text-orange-300'
    };

    return prioridadConfig[prioridad] || 'text-gray-300';
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
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-32"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
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
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-32"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
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
        backgroundImage: 'url(/18032025-DSC_2933.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-black/40"></div>
      
      <div className="relative z-10 pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg mb-2">
              Mis Solicitudes de Compras
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
                        Solicitud de {solicitud.nombreSolicitante}
                      </h3>
                      <div className="flex items-center text-white/70 text-sm">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(solicitud.fechaSolicitud)}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${getEstadoColor(solicitud.estadoSolicitud)}`}>
                      {solicitud.estadoSolicitud}
                    </span>
                  </div>

                  {/* Información de la solicitud */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-sm">Prioridad:</span>
                      <span className={`font-medium ${getPrioridadColor(solicitud.prioridadSolicitud || 'Media')}`}>
                        {solicitud.prioridadSolicitud || 'Media'}
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
                Solicitud de {selectedSolicitud.nombreSolicitante}
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
                <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${getEstadoColor(selectedSolicitud.estadoSolicitud)}`}>
                  {selectedSolicitud.estadoSolicitud}
                </span>
                <span className="text-white/70">
                  {formatDate(selectedSolicitud.fechaSolicitud)}
                </span>
              </div>

              {/* Información del solicitante */}
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Información del Solicitante</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-white/80">Área: {selectedSolicitud.areaCorrespondiente}</p>
                  <p className="text-white/80">Cargo: {selectedSolicitud.cargoSolicitante}</p>
                  <p className="text-white/80">Prioridad: 
                    <span className={`ml-1 font-medium ${getPrioridadColor(selectedSolicitud.prioridadSolicitud || 'Media')}`}>
                      {selectedSolicitud.prioridadSolicitud || 'Media'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Descripción de la Solicitud */}
              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-3">Descripción de la Solicitud</h3>
                <div className="text-white/80 whitespace-pre-wrap">
                  {selectedSolicitud.descripcionSolicitud && typeof selectedSolicitud.descripcionSolicitud === 'object' && 'value' in selectedSolicitud.descripcionSolicitud
                    ? (selectedSolicitud.descripcionSolicitud as any).value
                    : selectedSolicitud.descripcionSolicitud}
                </div>
                {selectedSolicitud.descripcionIA && (
                  <div className="mt-4">
                    <h4 className="text-white font-semibold mb-2">Interpretación IA</h4>
                    <div className="text-white/80 whitespace-pre-wrap">
                      {selectedSolicitud.descripcionIA && typeof selectedSolicitud.descripcionIA === 'object' && 'value' in selectedSolicitud.descripcionIA
                        ? (selectedSolicitud.descripcionIA as any).value
                        : selectedSolicitud.descripcionIA}
                    </div>
                  </div>
                )}
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
