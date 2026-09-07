'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Filter,
  RefreshCw,
  FileText,
  XCircle,
  Search,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import type { CarteraRecord, CarteraKPIs, EstadoCarteraData } from '@/types/cartera';

const ESTADO_COLORS = {
  'Sin Pagar': '#ef4444',
  'Parcial': '#f59e0b',
  'Pendiente': '#3b82f6',
  'Pagada': '#10b981'
};

export default function MonitoreoCartera() {
  const { isAuthenticated, isLoading: authLoading } = useAuthSession();

  const [data, setData] = useState<CarteraRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<CarteraKPIs | null>(null);
  const [estadoData, setEstadoData] = useState<EstadoCarteraData[]>([]);

  const [filters, setFilters] = useState({
    estado: '',
    cliente: '',
    searchTerm: ''
  });

  const [selectedRecord, setSelectedRecord] = useState<CarteraRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sortField, setSortField] = useState<keyof CarteraRecord>('ultimaModificacion');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchCartera = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.estado) params.append('estado', filters.estado);
      if (filters.cliente) params.append('cliente', filters.cliente);

      const response = await fetch(`/api/cartera?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error al cargar cartera:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchKPIs = useCallback(async () => {
    try {
      const response = await fetch('/api/cartera/estadisticas');
      const result = await response.json();
      if (result.success) {
        setKpis(result.data);
      }
    } catch (error) {
      console.error('Error al cargar KPIs:', error);
    }
  }, []);

  const fetchEstadoData = useCallback(async () => {
    try {
      const response = await fetch('/api/cartera/aging');
      const result = await response.json();
      if (result.success) {
        setEstadoData(result.data);
      }
    } catch (error) {
      console.error('Error al cargar distribución por estado:', error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCartera();
      fetchKPIs();
      fetchEstadoData();
    }
  }, [isAuthenticated, fetchCartera, fetchKPIs, fetchEstadoData]);

  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(
        item =>
          item.cliente.toLowerCase().includes(term) ||
          item.facturaNo.toLowerCase().includes(term) ||
          item.clienteNIT.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return filtered;
  }, [data, filters.searchTerm, sortField, sortDirection]);

  const estadoDistribution = useMemo(() => {
    return estadoData.map(item => ({
      name: item.estado,
      value: item.monto
    }));
  }, [estadoData]);

  const topClientes = useMemo(() => {
    const clientesMap = new Map<string, number>();
    data.forEach(item => {
      if (item.estadoFactura !== 'Pagada') {
        const current = clientesMap.get(item.cliente) || 0;
        clientesMap.set(item.cliente, current + item.montoRestante);
      }
    });
    return Array.from(clientesMap.entries())
      .map(([cliente, saldo]) => ({ cliente, saldo }))
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 10);
  }, [data]);

  const handleSort = (field: keyof CarteraRecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
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
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEstadoBadgeColor = (estado: string) => {
    return ESTADO_COLORS[estado as keyof typeof ESTADO_COLORS] || '#6b7280';
  };

  if (authLoading) {
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
              <span className="text-white text-lg font-semibold">Cargando...</span>
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
              Debes iniciar sesión para acceder al módulo de cartera.
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
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                    Cartera - Cuentas por Cobrar
                  </h1>
                  <p className="text-slate-200 text-lg mt-1">
                    Gestión y seguimiento de facturación pendiente
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    fetchCartera();
                    fetchKPIs();
                    fetchEstadoData();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700/60 hover:bg-slate-700/80 text-white border border-white/30 rounded-lg transition-all shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </button>
              </div>
            </div>
          </div>

          {/* KPIs Cards */}
          {kpis && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Saldo Pendiente */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-1">Saldo Pendiente Total</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(kpis.saldoTotal)}
                </p>
              </div>

              {/* Total Facturado */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-1">Total Facturado</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(kpis.totalFacturado)}
                </p>
              </div>

              {/* Total Recaudado */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-emerald-500/30 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-medium text-emerald-300 bg-emerald-900/40 px-2 py-1 rounded-full border border-emerald-500/30">
                    {kpis.porcentajeRecaudado.toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-1">Total Recaudado</p>
                <p className="text-2xl font-bold text-emerald-300">
                  {formatCurrency(kpis.totalRecaudado)}
                </p>
              </div>

              {/* Sin Pagar */}
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-red-500/30 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-sm text-slate-300 mb-1">Sin Pagar</p>
                <p className="text-2xl font-bold text-red-300">
                  {formatCurrency(kpis.carteraSinPagar)}
                </p>
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-white" />
              <h2 className="text-lg font-semibold text-white">Filtros</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Búsqueda */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.searchTerm}
                    onChange={e => setFilters({ ...filters, searchTerm: e.target.value })}
                    placeholder="Cliente, factura, NIT..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-700/60 border border-white/20 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Estado
                </label>
                <select
                  value={filters.estado}
                  onChange={e => setFilters({ ...filters, estado: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700/60 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="Sin Pagar">Sin Pagar</option>
                  <option value="Parcial">Parcial</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Pagada">Pagada</option>
                </select>
              </div>

              {/* Limpiar */}
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ estado: '', cliente: '', searchTerm: '' })}
                  className="w-full px-4 py-2 bg-slate-700/40 hover:bg-slate-700/60 text-white rounded-lg transition-colors border border-white/20"
                >
                  Limpiar Filtros
                </button>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Distribución por Estado */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Distribución por Estado
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={estadoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis
                    dataKey="estado"
                    tick={{ fill: '#cbd5e1', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => typeof value === 'number' ? formatCurrency(value) : ''}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 41, 59, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="monto"
                    fill="#3b82f6"
                    name="Monto"
                    radius={[8, 8, 0, 0]}
                  >
                    {estadoData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getEstadoBadgeColor(entry.estado)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Composición Pie Chart */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">
                Composición de Cartera
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={estadoDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {estadoDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getEstadoBadgeColor(entry.name)}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => typeof value === 'number' ? formatCurrency(value) : ''}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 41, 59, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top 10 Clientes */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl lg:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4">
                Top 10 Clientes por Saldo Pendiente
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topClientes} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis type="number" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="cliente"
                    tick={{ fill: '#cbd5e1', fontSize: 11 }}
                    width={150}
                  />
                  <Tooltip
                    formatter={(value) => typeof value === 'number' ? formatCurrency(value) : ''}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 41, 59, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="saldo" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabla de Cartera */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/30 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-white/20">
              <h3 className="text-lg font-semibold text-white">
                Registros de Cartera ({filteredData.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/40">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-slate-200 uppercase tracking-wider cursor-pointer hover:bg-slate-700/60"
                      onClick={() => handleSort('cliente')}
                    >
                      Cliente
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-slate-200 uppercase tracking-wider cursor-pointer hover:bg-slate-700/60"
                      onClick={() => handleSort('facturaNo')}
                    >
                      Factura
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-slate-200 uppercase tracking-wider cursor-pointer hover:bg-slate-700/60"
                      onClick={() => handleSort('totalRecibir')}
                    >
                      Total Factura
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-slate-200 uppercase tracking-wider cursor-pointer hover:bg-slate-700/60"
                      onClick={() => handleSort('montoRestante')}
                    >
                      Saldo Pendiente
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-200 uppercase tracking-wider">
                      Pagado
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-200 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-200 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
                        <p className="text-slate-300">Cargando datos...</p>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-300">No hay registros para mostrar</p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">{record.cliente}</div>
                          <div className="text-xs text-slate-400">{record.clienteNIT}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-200">
                          {record.facturaNo}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-right text-slate-200">
                          {formatCurrency(record.totalRecibir)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-right text-white">
                          {formatCurrency(record.montoRestante)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-emerald-300">
                          {formatCurrency(record.totalMovimientos)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: getEstadoBadgeColor(record.estadoFactura) }}
                          >
                            {record.estadoFactura}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedRecord(record);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 text-blue-400 hover:bg-slate-700/40 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal de Detalle */}
          {showDetailModal && selectedRecord && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/30">
                <div className="p-6 border-b border-white/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                      Detalle de Factura
                    </h3>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="p-2 hover:bg-slate-700/40 rounded-lg transition-colors"
                    >
                      <XCircle className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-400">Cliente</label>
                      <p className="text-white font-semibold">{selectedRecord.cliente}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">NIT</label>
                      <p className="text-slate-200">{selectedRecord.clienteNIT}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Factura No.</label>
                      <p className="text-white font-semibold">{selectedRecord.facturaNo}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Total Factura</label>
                      <p className="text-slate-200">{formatCurrency(selectedRecord.totalRecibir)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Total Pagado</label>
                      <p className="text-emerald-300 font-semibold">
                        {formatCurrency(selectedRecord.totalMovimientos)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Saldo Pendiente</label>
                      <p className="text-lg font-bold text-blue-300">
                        {formatCurrency(selectedRecord.montoRestante)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Fecha Creación</label>
                      <p className="text-slate-200">{formatDate(selectedRecord.fechaCreacion)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-400">Estado</label>
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white mt-1"
                        style={{ backgroundColor: getEstadoBadgeColor(selectedRecord.estadoFactura) }}
                      >
                        {selectedRecord.estadoFactura}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-white/20">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="w-full px-4 py-2 bg-slate-700/60 hover:bg-slate-700/80 text-white rounded-lg transition-all border border-white/20"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
