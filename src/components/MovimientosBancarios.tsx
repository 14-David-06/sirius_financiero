'use client';

import React, { useState, useEffect } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Building, 
  Search, 
  Filter,
  Download,
  Eye,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

interface MovimientoBancario {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  banco: string;
  numeroCuenta: string;
  categoria: string;
  referencia?: string;
  saldoAnterior: number;
  saldoActual: number;
  estado: 'confirmado' | 'pendiente' | 'rechazado';
}

interface FiltrosMovimientos {
  fechaInicio: string;
  fechaFin: string;
  tipo: 'todos' | 'ingreso' | 'egreso';
  banco: string;
  categoria: string;
  estado: 'todos' | 'confirmado' | 'pendiente' | 'rechazado';
}

export default function MovimientosBancarios() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtros, setFiltros] = useState<FiltrosMovimientos>({
    fechaInicio: '',
    fechaFin: '',
    tipo: 'todos',
    banco: '',
    categoria: '',
    estado: 'todos'
  });
  const [busqueda, setBusqueda] = useState('');
  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoBancario | null>(null);

  // Datos de ejemplo para demostración
  const movimientosEjemplo: MovimientoBancario[] = [
    {
      id: '1',
      fecha: '2025-02-01',
      tipo: 'ingreso',
      monto: 5000000,
      descripcion: 'Pago cliente ABC Corp',
      banco: 'Banco de Bogotá',
      numeroCuenta: '****-1234',
      categoria: 'Ventas',
      referencia: 'REF001',
      saldoAnterior: 10000000,
      saldoActual: 15000000,
      estado: 'confirmado'
    },
    {
      id: '2',
      fecha: '2025-01-31',
      tipo: 'egreso',
      monto: 2500000,
      descripcion: 'Pago proveedores materiales',
      banco: 'Bancolombia',
      numeroCuenta: '****-5678',
      categoria: 'Compras',
      referencia: 'REF002',
      saldoAnterior: 12500000,
      saldoActual: 10000000,
      estado: 'confirmado'
    },
    {
      id: '3',
      fecha: '2025-01-30',
      tipo: 'egreso',
      monto: 1200000,
      descripcion: 'Pago nómina enero',
      banco: 'Banco de Bogotá',
      numeroCuenta: '****-1234',
      categoria: 'Nómina',
      saldoAnterior: 13700000,
      saldoActual: 12500000,
      estado: 'confirmado'
    },
    {
      id: '4',
      fecha: '2025-01-29',
      tipo: 'ingreso',
      monto: 3200000,
      descripcion: 'Facturación servicios',
      banco: 'Davivienda',
      numeroCuenta: '****-9999',
      categoria: 'Servicios',
      referencia: 'REF003',
      saldoAnterior: 10500000,
      saldoActual: 13700000,
      estado: 'pendiente'
    }
  ];

  useEffect(() => {
    if (isAuthenticated && userData) {
      fetchMovimientos();
    }
  }, [isAuthenticated, userData]);

  const fetchMovimientos = async () => {
    try {
      setLoading(true);
      // Simular llamada a API - aquí se conectaría con el backend real
      setTimeout(() => {
        setMovimientos(movimientosEjemplo);
        setLoading(false);
      }, 1000);
    } catch (error) {
      setError('Error al cargar los movimientos');
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const filtrarMovimientos = () => {
    return movimientos.filter(movimiento => {
      const matchBusqueda = busqueda === '' || 
        movimiento.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        movimiento.referencia?.toLowerCase().includes(busqueda.toLowerCase()) ||
        movimiento.banco.toLowerCase().includes(busqueda.toLowerCase());

      const matchTipo = filtros.tipo === 'todos' || movimiento.tipo === filtros.tipo;
      const matchBanco = filtros.banco === '' || movimiento.banco.includes(filtros.banco);
      const matchCategoria = filtros.categoria === '' || movimiento.categoria.includes(filtros.categoria);
      const matchEstado = filtros.estado === 'todos' || movimiento.estado === filtros.estado;

      let matchFecha = true;
      if (filtros.fechaInicio && filtros.fechaFin) {
        const fechaMovimiento = new Date(movimiento.fecha);
        const fechaInicio = new Date(filtros.fechaInicio);
        const fechaFin = new Date(filtros.fechaFin);
        matchFecha = fechaMovimiento >= fechaInicio && fechaMovimiento <= fechaFin;
      }

      return matchBusqueda && matchTipo && matchBanco && matchCategoria && matchEstado && matchFecha;
    });
  };

  const getTipoIcon = (tipo: string) => {
    return tipo === 'ingreso' ? 
      <PlusCircle className="w-5 h-5 text-green-400" /> : 
      <MinusCircle className="w-5 h-5 text-red-400" />;
  };

  const getTipoColor = (tipo: string) => {
    return tipo === 'ingreso' ? 'text-green-400' : 'text-red-400';
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'pendiente':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'rechazado':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
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
      month: 'short',
      day: 'numeric'
    });
  };

  const calcularTotales = () => {
    const movimientosFiltrados = filtrarMovimientos();
    const totalIngresos = movimientosFiltrados
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0);
    const totalEgresos = movimientosFiltrados
      .filter(m => m.tipo === 'egreso')
      .reduce((sum, m) => sum + m.monto, 0);
    const balance = totalIngresos - totalEgresos;

    return { totalIngresos, totalEgresos, balance };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-20"
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
      <div className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-20"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752167682/20032025-DSC_3429_1_1_kudfki.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 text-center">
          <div className="bg-red-500/20 backdrop-blur-md rounded-3xl p-8 border border-red-500/30 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Acceso Denegado</h2>
            <p className="text-white/80">Debe iniciar sesión para ver los movimientos bancarios</p>
          </div>
        </div>
      </div>
    );
  }

  const totales = calcularTotales();
  const movimientosFiltrados = filtrarMovimientos();

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
              Movimientos Bancarios
            </h1>
            <p className="text-white/80">
              {userData?.nombre} • {userData?.categoria}
            </p>
          </div>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-green-500/20 backdrop-blur-md rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-300 text-sm font-medium">Total Ingresos</p>
                  <p className="text-white text-2xl font-bold">{formatCurrency(totales.totalIngresos)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </div>
            
            <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-6 border border-red-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-300 text-sm font-medium">Total Egresos</p>
                  <p className="text-white text-2xl font-bold">{formatCurrency(totales.totalEgresos)}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-400" />
              </div>
            </div>
            
            <div className={`backdrop-blur-md rounded-2xl p-6 border ${totales.balance >= 0 ? 'bg-blue-500/20 border-blue-500/30' : 'bg-orange-500/20 border-orange-500/30'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${totales.balance >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>Balance</p>
                  <p className={`text-2xl font-bold ${totales.balance >= 0 ? 'text-white' : 'text-white'}`}>
                    {formatCurrency(totales.balance)}
                  </p>
                </div>
                <DollarSign className={`w-8 h-8 ${totales.balance >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
              </div>
            </div>
          </div>

          {/* Filtros y búsqueda */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Descripción, referencia..."
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Tipo</label>
                <select
                  value={filtros.tipo}
                  onChange={(e) => setFiltros({...filtros, tipo: e.target.value as any})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="todos">Todos</option>
                  <option value="ingreso">Ingresos</option>
                  <option value="egreso">Egresos</option>
                </select>
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Estado</label>
                <select
                  value={filtros.estado}
                  onChange={(e) => setFiltros({...filtros, estado: e.target.value as any})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="todos">Todos</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="rechazado">Rechazado</option>
                </select>
              </div>

              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Acciones</label>
                <div className="flex space-x-2">
                  <button
                    onClick={fetchMovimientos}
                    className="flex-1 bg-blue-600/70 hover:bg-blue-700/80 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Actualizar
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Fecha Inicio</label>
                <input
                  type="date"
                  value={filtros.fechaInicio}
                  onChange={(e) => setFiltros({...filtros, fechaInicio: e.target.value})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Fecha Fin</label>
                <input
                  type="date"
                  value={filtros.fechaFin}
                  onChange={(e) => setFiltros({...filtros, fechaFin: e.target.value})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-4 mb-6 border border-red-500/30 text-center">
              <AlertCircle className="w-8 h-8 text-red-300 mx-auto mb-2" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Lista de movimientos */}
          {loading ? (
            <div className="text-center py-12">
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white">Cargando movimientos...</p>
              </div>
            </div>
          ) : movimientosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
                <CreditCard className="w-16 h-16 text-white/60 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No hay movimientos</h3>
                <p className="text-white/80">No se encontraron movimientos con los filtros aplicados</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Tipo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Descripción</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Banco</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Monto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20">
                    {movimientosFiltrados.map((movimiento) => (
                      <tr key={movimiento.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatDate(movimiento.fecha)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getTipoIcon(movimiento.tipo)}
                            <span className={`ml-2 text-sm font-medium ${getTipoColor(movimiento.tipo)}`}>
                              {movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          <div>
                            <div className="font-medium">{movimiento.descripcion}</div>
                            <div className="text-white/60 text-xs">{movimiento.categoria}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          <div>
                            <div className="font-medium">{movimiento.banco}</div>
                            <div className="text-white/60 text-xs">{movimiento.numeroCuenta}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <span className={getTipoColor(movimiento.tipo)}>
                            {movimiento.tipo === 'egreso' ? '-' : '+'}{formatCurrency(movimiento.monto)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getEstadoColor(movimiento.estado)}`}>
                            {movimiento.estado}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedMovimiento(movimiento)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalles */}
      {selectedMovimiento && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl max-w-lg w-full">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-white">
                Detalle del Movimiento
              </h2>
              <button
                onClick={() => setSelectedMovimiento(null)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/70 text-sm">Fecha</p>
                  <p className="text-white font-medium">{formatDate(selectedMovimiento.fecha)}</p>
                </div>
                <div>
                  <p className="text-white/70 text-sm">Tipo</p>
                  <div className="flex items-center">
                    {getTipoIcon(selectedMovimiento.tipo)}
                    <span className={`ml-2 font-medium ${getTipoColor(selectedMovimiento.tipo)}`}>
                      {selectedMovimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-white/70 text-sm">Descripción</p>
                <p className="text-white font-medium">{selectedMovimiento.descripcion}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/70 text-sm">Banco</p>
                  <p className="text-white font-medium">{selectedMovimiento.banco}</p>
                </div>
                <div>
                  <p className="text-white/70 text-sm">Cuenta</p>
                  <p className="text-white font-medium">{selectedMovimiento.numeroCuenta}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/70 text-sm">Categoría</p>
                  <p className="text-white font-medium">{selectedMovimiento.categoria}</p>
                </div>
                <div>
                  <p className="text-white/70 text-sm">Estado</p>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getEstadoColor(selectedMovimiento.estado)}`}>
                    {selectedMovimiento.estado}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-white/70 text-sm">Monto</p>
                <p className={`text-2xl font-bold ${getTipoColor(selectedMovimiento.tipo)}`}>
                  {selectedMovimiento.tipo === 'egreso' ? '-' : '+'}{formatCurrency(selectedMovimiento.monto)}
                </p>
              </div>

              {selectedMovimiento.referencia && (
                <div>
                  <p className="text-white/70 text-sm">Referencia</p>
                  <p className="text-white font-medium">{selectedMovimiento.referencia}</p>
                </div>
              )}

              <div className="bg-white/10 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Saldos</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/70">Saldo Anterior</p>
                    <p className="text-white font-medium">{formatCurrency(selectedMovimiento.saldoAnterior)}</p>
                  </div>
                  <div>
                    <p className="text-white/70">Saldo Actual</p>
                    <p className="text-white font-medium">{formatCurrency(selectedMovimiento.saldoActual)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
