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
        <div className="mt-16 mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-4 sm:p-6 border border-white/20 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xl">
                  {userData.nombre.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                  Bienvenido, {userData.nombre}
                </h1>
                <p className="text-white/70 text-sm mt-1">
                  {userData.cargo} - {userData.area}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-500/20 text-red-300 border border-red-400/30 px-4 sm:px-6 py-2 rounded-xl font-semibold hover:bg-red-500/30 transition-all duration-300 text-sm w-full sm:w-auto"
            >
              🔐 Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Estadísticas principales */}
        {estadisticas && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">{estadisticas.totalCompras}</div>
                <p className="text-white/80 font-medium text-xs sm:text-sm">Total Compras</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">{estadisticas.totalItems}</div>
                <p className="text-white/80 font-medium text-xs sm:text-sm">Total Items</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 leading-tight">{formatCurrency(estadisticas.montoTotal)}</div>
                <p className="text-white/80 font-medium text-xs sm:text-sm">Monto Total</p>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2 leading-tight">{formatCurrency(estadisticas.montoTotalNeto)}</div>
                <p className="text-white/80 font-medium text-xs sm:text-sm">Monto Neto</p>
              </div>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="mb-6 bg-white/15 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-white/20 shadow-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2 text-sm sm:text-base">Filtrar por Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 text-sm sm:text-base"
              >
                <option value="todos" className="text-gray-900 bg-white">Todos los Estados</option>
                <option value="Aprobado" className="text-gray-900 bg-white">Aprobado</option>
                <option value="Pendiente" className="text-gray-900 bg-white">Pendiente</option>
                <option value="Rechazado" className="text-gray-900 bg-white">Rechazado</option>
                <option value="Comprado" className="text-gray-900 bg-white">Comprado</option>
              </select>
            </div>
            <div>
              <label className="block text-white font-semibold mb-2 text-sm sm:text-base">Filtrar por Área</label>
              <select
                value={filtroArea}
                onChange={(e) => setFiltroArea(e.target.value)}
                className="w-full p-3 bg-white/15 border border-white/30 rounded-xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:border-blue-400 text-sm sm:text-base"
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
          <div className="px-4 sm:px-6 py-4 border-b border-white/20">
            <h2 className="text-lg sm:text-xl font-bold text-white">
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
                <div key={compra.id} className="p-4 sm:p-6 hover:bg-white/5 transition-colors duration-200">
                  
                  {/* Header de la solicitud */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-white/80 text-sm font-medium bg-white/10 px-2 py-1 rounded-lg flex-shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                          {compra.nombreSolicitante}
                        </h3>
                        <p className="text-white/70 text-sm">
                          {compra.areaCorrespondiente} • {formatDate(compra.fechaSolicitud)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Estados y badges - Stack en móvil */}
                    <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(compra.estadoSolicitud)}`}>
                        {compra.estadoSolicitud || 'Sin estado'}
                      </span>
                      {compra.prioridadSolicitud && (
                        <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium border ${getPriorityColor(compra.prioridadSolicitud)}`}>
                          {getPriorityIcon(compra.prioridadSolicitud)} {compra.prioridadSolicitud}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Información principal en grid responsive */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/70 text-xs sm:text-sm">Valor Total:</p>
                      <p className="text-white font-semibold text-sm sm:text-base">{formatCurrency(compra.valorTotal || 0)}</p>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <p className="text-white/70 text-xs sm:text-sm">Items:</p>
                      <p className="text-white font-semibold text-sm sm:text-base">{compra.items.length} items</p>
                    </div>
                    {compra.prioridadSolicitud && (
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-white/70 text-xs sm:text-sm">🎯 Prioridad:</p>
                        <p className={`font-semibold text-sm sm:text-base ${
                          compra.prioridadSolicitud.toLowerCase() === 'alta' ? 'text-red-300' : 
                          compra.prioridadSolicitud.toLowerCase() === 'media' ? 'text-yellow-300' : 
                          'text-green-300'
                        }`}>
                          {getPriorityIcon(compra.prioridadSolicitud)} {compra.prioridadSolicitud}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Proveedor si existe */}
                  {compra.razonSocialProveedor && (
                    <div className="bg-white/10 rounded-lg p-3 mb-3">
                      <p className="text-white/70 text-xs sm:text-sm">Proveedor:</p>
                      <p className="text-white font-medium text-sm sm:text-base">{compra.razonSocialProveedor}</p>
                    </div>
                  )}
                  
                  {/* Descripción si existe */}
                  {compra.descripcionSolicitud && (
                    <div className="bg-white/10 rounded-lg p-3 mb-3">
                      <p className="text-white/70 text-xs sm:text-sm mb-1">Descripción:</p>
                      <p className="text-white text-xs sm:text-sm line-clamp-2">
                        {compra.descripcionSolicitud}
                      </p>
                    </div>
                  )}
                  
                  {/* Admin info si existe */}
                  {compra.nombresAdmin && (
                    <div className="bg-white/5 rounded-lg p-3 mb-4">
                      <p className="text-white/70 text-xs sm:text-sm">Aprobado/Rechazado por:</p>
                      <p className="text-white font-medium text-sm sm:text-base">{compra.nombresAdmin}</p>
                    </div>
                  )}
                  
                  {/* Sección de acciones */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-4 border-t border-white/10">
                    {/* Selector de estado */}
                    <div className="flex items-center gap-2">
                      <label className="text-white/70 text-xs sm:text-sm whitespace-nowrap">Cambiar estado:</label>
                      <select
                        value={compra.estadoSolicitud || ''}
                        onChange={(e) => updateEstado(compra.id, e.target.value)}
                        disabled={updatingStates.has(compra.id)}
                        className="text-xs sm:text-sm px-3 py-1.5 bg-white/10 border border-white/30 rounded-lg text-white focus:outline-none focus:border-blue-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
                      >
                        <option value="Pendiente" className="text-gray-900 bg-white">Pendiente</option>
                        <option value="Aprobado" className="text-gray-900 bg-white">Aprobado</option>
                        <option value="Rechazado" className="text-gray-900 bg-white">Rechazado</option>
                        <option value="Comprado" className="text-gray-900 bg-white">Comprado</option>
                      </select>
                      {updatingStates.has(compra.id) && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b border-white"></div>
                      )}
                    </div>
                    
                    {/* Botón ver detalle */}
                    <button
                      onClick={() => {
                        setSelectedCompra(compra);
                        setShowDetalleCompleto(true);
                      }}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      📋 Ver Detalle Completo
                    </button>
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
