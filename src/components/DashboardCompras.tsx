'use client';

import { useState, useEffect } from 'react';
import DetalleCompraCompleto from './DetalleCompraCompleto';
import { CompraCompleta, EstadisticasData, UserData, ApiResponse } from '@/types/compras';

interface DashboardComprasProps {
  userData: UserData;
  onLogout: () => void;
}

export default function DashboardCompras({ userData, onLogout }: DashboardComprasProps) {
  const [comprasData, setComprasData] = useState<CompraCompleta[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroArea, setFiltroArea] = useState('todas');
  const [updatingStates, setUpdatingStates] = useState<Set<string>>(new Set());
  const [selectedCompra, setSelectedCompra] = useState<CompraCompleta | null>(null);
  const [showDetalleCompleto, setShowDetalleCompleto] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/compras');
      
      if (!response.ok) {
        throw new Error('Error al cargar los datos');
      }

      const data: ApiResponse = await response.json();
      setComprasData(data.compras);
      setEstadisticas(data.estadisticas);
    } catch (error) {
      setError('Error al cargar los datos de compras');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado?.toLowerCase()) {
      case 'aprobado':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      case 'rechazado':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'pendiente':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'comprado':
        return 'bg-blue-500/20 text-blue-300 border-blue-400/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
    }
  };

  const getPriorityColor = (prioridad: string) => {
    switch (prioridad?.toLowerCase()) {
      case 'alta':
        return 'bg-red-500/20 text-red-300 border-red-400/30';
      case 'media':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
      case 'baja':
        return 'bg-green-500/20 text-green-300 border-green-400/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-400/30';
    }
  };

  const getPriorityIcon = (prioridad: string) => {
    switch (prioridad?.toLowerCase()) {
      case 'alta':
        return '🔴';
      case 'media':
        return '🟡';
      case 'baja':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const updateEstado = async (compraId: string, nuevoEstado: string) => {
    try {
      // Agregar el ID a los estados que se están actualizando
      setUpdatingStates(prev => new Set([...prev, compraId]));
      
      const response = await fetch('/api/compras/update-estado', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compraId,
          nuevoEstado,
          nombresAdmin: userData.nombre
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        throw new Error(errorData.error || 'Error al actualizar el estado');
      }

      const result = await response.json();
      console.log('Estado actualizado exitosamente:', result);
      
      // Recargar los datos para mostrar el cambio
      await cargarDatos();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al actualizar el estado: ${errorMessage}`);
    } finally {
      // Remover el ID de los estados que se están actualizando
      setUpdatingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(compraId);
        return newSet;
      });
    }
  };

  const comprasFiltradas = comprasData
    .filter(compra => {
      const cumpleFiltroEstado = filtroEstado === 'todos' || compra.estadoSolicitud === filtroEstado;
      const cumpleFiltroArea = filtroArea === 'todas' || compra.areaCorrespondiente === filtroArea;
      return cumpleFiltroEstado && cumpleFiltroArea;
    })
    .sort((a, b) => {
      // Función para obtener el peso del estado (Pendiente tiene máxima prioridad)
      const getEstadoWeight = (estado: string) => {
        switch (estado?.toLowerCase()) {
          case 'pendiente': return 4; // Máxima prioridad
          case 'aprobado': return 3;
          case 'rechazado': return 2;
          case 'comprado': return 1;
          default: return 0;
        }
      };

      // Función para obtener el peso de la prioridad
      const getPrioridadWeight = (prioridad: string) => {
        switch (prioridad?.toLowerCase()) {
          case 'alta': return 3;   // Alta prioridad
          case 'media': return 2;  // Media prioridad
          case 'baja': return 1;   // Baja prioridad
          default: return 0;       // Sin prioridad definida
        }
      };

      // Comparar primero por estado (Pendiente primero)
      const estadoComparison = getEstadoWeight(b.estadoSolicitud) - getEstadoWeight(a.estadoSolicitud);
      if (estadoComparison !== 0) {
        return estadoComparison;
      }

      // Si ambos tienen el mismo estado, ordenar por prioridad (Alta → Media → Baja)
      const prioridadComparison = getPrioridadWeight(b.prioridadSolicitud || '') - getPrioridadWeight(a.prioridadSolicitud || '');
      if (prioridadComparison !== 0) {
        return prioridadComparison;
      }

      // Si estado y prioridad son iguales, ordenar por fecha (más reciente primero)
      return new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime();
    });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mr-4"></div>
            <span className="text-white text-xl font-semibold">Cargando datos...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl max-w-md">
          <div className="text-center">
            <div className="text-red-400 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
            <p className="text-white/90 mb-6">{error}</p>
            <button
              onClick={cargarDatos}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header con información del usuario */}
        <div className="mt-16 mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {userData.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Bienvenido, {userData.nombre}
                </h1>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-500/20 text-red-300 border border-red-400/30 px-6 py-2 rounded-xl font-semibold hover:bg-red-500/30 transition-all duration-300"
            >
              🔐 Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Estadísticas principales */}
        {estadisticas && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{estadisticas.totalCompras}</div>
                <p className="text-white/80 font-medium">Total Compras</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{estadisticas.totalItems}</div>
                <p className="text-white/80 font-medium">Total Items</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">{formatCurrency(estadisticas.montoTotal)}</div>
                <p className="text-white/80 font-medium">Monto Total</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-2xl font-bold text-white mb-2">{formatCurrency(estadisticas.montoTotalNeto)}</div>
                <p className="text-white/80 font-medium">Monto Neto</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2">Filtrar por Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400"
              >
                <option value="todos" className="text-gray-900 bg-white">Todos los Estados</option>
                <option value="Aprobado" className="text-gray-900 bg-white">Aprobado</option>
                <option value="Pendiente" className="text-gray-900 bg-white">Pendiente</option>
                <option value="Rechazado" className="text-gray-900 bg-white">Rechazado</option>
                <option value="Comprado" className="text-gray-900 bg-white">Comprado</option>
              </select>
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">Filtrar por Área</label>
              <select
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
                className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400"
              >
                <option value="todas" className="text-gray-900 bg-white">Todas las Áreas</option>
                {estadisticas && Object.keys(estadisticas.distribucionAreas).map(area => (
                  <option key={area} value={area} className="text-gray-900 bg-white">{area}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lista de compras */}
        <div className="bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/20">
            <h2 className="text-xl font-bold text-white">
              Solicitudes de Compra ({comprasFiltradas.length})
            </h2>
          </div>
          
          {comprasFiltradas.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-white/70">No se encontraron solicitudes con los filtros aplicados</p>
            </div>
          ) : (
            <div className="divide-y divide-white/20">
              {comprasFiltradas.map((compra, index) => (
                <div key={compra.id} className="p-6 hover:bg-white/5 transition-colors duration-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                          <div className="flex items-center gap-4 mb-2">
                            <span className="text-white/80 text-sm">#{index + 1}</span>
                            <h3 className="text-lg font-semibold text-white">
                              {compra.nombreSolicitante}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(compra.estadoSolicitud)}`}>
                                {compra.estadoSolicitud || 'Sin estado'}
                              </span>
                              {compra.prioridadSolicitud && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(compra.prioridadSolicitud)}`}>
                                  {getPriorityIcon(compra.prioridadSolicitud)} {compra.prioridadSolicitud}
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                <select
                                  value={compra.estadoSolicitud || ''}
                                  onChange={(e) => updateEstado(compra.id, e.target.value)}
                                  disabled={updatingStates.has(compra.id)}
                                  className="text-xs px-2 py-1 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:border-blue-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="Pendiente" className="text-gray-900 bg-white">Pendiente</option>
                                  <option value="Aprobado" className="text-gray-900 bg-white">Aprobado</option>
                                  <option value="Rechazado" className="text-gray-900 bg-white">Rechazado</option>
                                  <option value="Comprado" className="text-gray-900 bg-white">Comprado</option>
                                </select>
                                {updatingStates.has(compra.id) && (
                                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-white/70 text-sm">Área:</p>
                              <p className="text-white font-medium">{compra.areaCorrespondiente}</p>
                            </div>
                            <div>
                              <p className="text-white/70 text-sm">Fecha:</p>
                              <p className="text-white font-medium">{formatDate(compra.fechaSolicitud)}</p>
                            </div>
                            {compra.prioridadSolicitud && (
                              <div>
                                <p className="text-white/70 text-sm">🎯 Prioridad:</p>
                                <p className={`font-medium ${
                                  compra.prioridadSolicitud.toLowerCase() === 'alta' ? 'text-red-300' : 
                                  compra.prioridadSolicitud.toLowerCase() === 'media' ? 'text-yellow-300' : 
                                  'text-green-300'
                                }`}>
                                  {getPriorityIcon(compra.prioridadSolicitud)} {compra.prioridadSolicitud}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-white/70 text-sm">Valor Total:</p>
                              <p className="text-white font-medium">{formatCurrency(compra.valorTotal || 0)}</p>
                            </div>
                            <div>
                              <p className="text-white/70 text-sm">Items:</p>
                              <p className="text-white font-medium">{compra.items.length} items</p>
                            </div>
                          </div>
                          
                          {compra.razonSocialProveedor && (
                            <div className="mb-2">
                              <p className="text-white/70 text-sm">Proveedor:</p>
                              <p className="text-white font-medium">{compra.razonSocialProveedor}</p>
                            </div>
                          )}
                      
                      {compra.descripcionSolicitud && (
                        <div className="bg-white/10 rounded-xl p-3 mt-3">
                          <p className="text-white/70 text-sm mb-1">Descripción:</p>
                          <p className="text-white text-sm line-clamp-2">
                            {compra.descripcionSolicitud}
                          </p>
                        </div>
                      )}
                      
                      {compra.nombresAdmin && (
                        <div className="mt-2">
                          <p className="text-white/70 text-sm">Aprobado/Rechazado por:</p>
                          <p className="text-white font-medium">{compra.nombresAdmin}</p>
                        </div>
                      )}
                      
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => {
                            setSelectedCompra(compra);
                            setShowDetalleCompleto(true);
                          }}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 text-sm"
                        >
                          📋 Ver Detalle Completo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Modal de Detalle Completo */}
      {showDetalleCompleto && selectedCompra && (
        <DetalleCompraCompleto
          compra={selectedCompra}
          onClose={() => {
            setShowDetalleCompleto(false);
            setSelectedCompra(null);
          }}
        />
      )}
    </div>
  );
}
