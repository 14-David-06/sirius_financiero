'use client';

import React, { useState, useMemo } from 'react';
import { 
  DollarSign,
  AlertTriangle,
  Users,
  Search,
  Eye,
  Target,
  XCircle,
  Download
} from 'lucide-react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';

interface ClienteCartera {
  id: string;
  nombre: string;
  empresa: string;
  tipoCliente: 'Corporativo' | 'PYME' | 'Individual';
  saldoTotal: number;
  saldoVencido: number;
  diasVencimiento: number;
  ultimoPago: string;
  proximoVencimiento: string;
  score: number;
  estado: 'Al día' | 'Atrasado' | 'Crítico' | 'Moroso';
  contacto: string;
  telefono: string;
  email: string;
  montoCredito: number;
  utilizacionCredito: number;
  historialPagos: 'Excelente' | 'Bueno' | 'Regular' | 'Malo';
}

const clientesEjemplo: ClienteCartera[] = [
  {
    id: '1',
    nombre: 'Carlos Mendoza',
    empresa: 'Constructora Mendoza SA',
    tipoCliente: 'Corporativo',
    saldoTotal: 850000,
    saldoVencido: 0,
    diasVencimiento: 0,
    ultimoPago: '2025-08-28',
    proximoVencimiento: '2025-09-15',
    score: 95,
    estado: 'Al día',
    contacto: 'carlos.mendoza@constructoramendoza.com',
    telefono: '+57 300 123 4567',
    email: 'carlos.mendoza@constructoramendoza.com',
    montoCredito: 1000000,
    utilizacionCredito: 85,
    historialPagos: 'Excelente'
  },
  {
    id: '2',
    nombre: 'María González',
    empresa: 'Tech Solutions SAS',
    tipoCliente: 'PYME',
    saldoTotal: 450000,
    saldoVencido: 120000,
    diasVencimiento: 15,
    ultimoPago: '2025-08-10',
    proximoVencimiento: '2025-09-05',
    score: 72,
    estado: 'Atrasado',
    contacto: 'maria.gonzalez@techsolutions.co',
    telefono: '+57 310 987 6543',
    email: 'maria.gonzalez@techsolutions.co',
    montoCredito: 500000,
    utilizacionCredito: 90,
    historialPagos: 'Bueno'
  },
  {
    id: '3',
    nombre: 'Roberto Silva',
    empresa: 'Comercial Silva Ltda',
    tipoCliente: 'Individual',
    saldoTotal: 280000,
    saldoVencido: 280000,
    diasVencimiento: 45,
    ultimoPago: '2025-07-15',
    proximoVencimiento: '2025-08-20',
    score: 45,
    estado: 'Crítico',
    contacto: 'roberto.silva@gmail.com',
    telefono: '+57 320 456 7890',
    email: 'roberto.silva@gmail.com',
    montoCredito: 300000,
    utilizacionCredito: 93,
    historialPagos: 'Regular'
  },
  {
    id: '4',
    nombre: 'Ana Rodríguez',
    empresa: 'Distribuidora Rodríguez',
    tipoCliente: 'PYME',
    saldoTotal: 620000,
    saldoVencido: 620000,
    diasVencimiento: 75,
    ultimoPago: '2025-06-20',
    proximoVencimiento: '2025-07-25',
    score: 25,
    estado: 'Moroso',
    contacto: 'ana.rodriguez@distribuidora.com',
    telefono: '+57 315 234 5678',
    email: 'ana.rodriguez@distribuidora.com',
    montoCredito: 700000,
    utilizacionCredito: 89,
    historialPagos: 'Malo'
  },
  {
    id: '5',
    nombre: 'Luis Herrera',
    empresa: 'Inversiones Herrera SA',
    tipoCliente: 'Corporativo',
    saldoTotal: 1200000,
    saldoVencido: 0,
    diasVencimiento: 0,
    ultimoPago: '2025-08-30',
    proximoVencimiento: '2025-09-30',
    score: 88,
    estado: 'Al día',
    contacto: 'luis.herrera@invherrera.com',
    telefono: '+57 305 678 9012',
    email: 'luis.herrera@invherrera.com',
    montoCredito: 1500000,
    utilizacionCredito: 80,
    historialPagos: 'Excelente'
  }
];

export default function MonitoreoCartera() {
  const { isAuthenticated } = useAuthSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteCartera | null>(null);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    return clientesEjemplo.filter(cliente => {
      const coincideSearch = cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cliente.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           cliente.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const coincideEstado = filtroEstado === 'todos' || cliente.estado === filtroEstado;
      const coincideTipo = filtroTipo === 'todos' || cliente.tipoCliente === filtroTipo;
      
      return coincideSearch && coincideEstado && coincideTipo;
    });
  }, [searchTerm, filtroEstado, filtroTipo]);

  // Calcular métricas
  const metricas = useMemo(() => {
    const totalCartera = clientesEjemplo.reduce((sum, cliente) => sum + cliente.saldoTotal, 0);
    const totalVencido = clientesEjemplo.reduce((sum, cliente) => sum + cliente.saldoVencido, 0);
    const clientesAtrasados = clientesEjemplo.filter(c => c.estado !== 'Al día').length;
    const scorePromedio = clientesEjemplo.reduce((sum, cliente) => sum + cliente.score, 0) / clientesEjemplo.length;
    
    return {
      totalCartera,
      totalVencido,
      clientesAtrasados,
      scorePromedio,
      porcentajeVencido: (totalVencido / totalCartera) * 100
    };
  }, []);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Al día': return 'text-green-700 bg-green-100';
      case 'Atrasado': return 'text-yellow-700 bg-yellow-100';
      case 'Crítico': return 'text-orange-700 bg-orange-100';
      case 'Moroso': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Requerido</h2>
          <p className="text-gray-600">Debes iniciar sesión para acceder al monitoreo de cartera.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Monitoreo de Cartera</h1>
          <p className="text-gray-600">Gestión y seguimiento de la cartera de clientes</p>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cartera Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metricas.totalCartera)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Saldo Vencido</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(metricas.totalVencido)}</p>
                <p className="text-xs text-gray-500">{metricas.porcentajeVencido.toFixed(1)}% del total</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Clientes Atrasados</p>
                <p className="text-2xl font-bold text-orange-600">{metricas.clientesAtrasados}</p>
                <p className="text-xs text-gray-500">de {clientesEjemplo.length} clientes</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Users className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Score Promedio</p>
                <p className={`text-2xl font-bold ${getScoreColor(metricas.scorePromedio)}`}>
                  {metricas.scorePromedio.toFixed(0)}
                </p>
                <p className="text-xs text-gray-500">Calificación crediticia</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar cliente o empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-80"
                />
              </div>

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos los estados</option>
                <option value="Al día">Al día</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Crítico">Crítico</option>
                <option value="Moroso">Moroso</option>
              </select>

              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos los tipos</option>
                <option value="Corporativo">Corporativo</option>
                <option value="PYME">PYME</option>
                <option value="Individual">Individual</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Download className="h-4 w-4" />
                Exportar
              </button>
            </div>
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Vencido</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Días Venc.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-200">
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cliente.nombre}</div>
                        <div className="text-sm text-gray-500">{cliente.empresa}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{cliente.tipoCliente}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(cliente.saldoTotal)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${cliente.saldoVencido > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(cliente.saldoVencido)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${cliente.diasVencimiento > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {cliente.diasVencimiento || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getScoreColor(cliente.score)}`}>
                        {cliente.score}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(cliente.estado)}`}>
                        {cliente.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setClienteSeleccionado(cliente);
                          setMostrarDetalles(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal de detalles */}
        {mostrarDetalles && clienteSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{clienteSeleccionado.nombre}</h3>
                    <p className="text-gray-600">{clienteSeleccionado.empresa}</p>
                  </div>
                  <button
                    onClick={() => setMostrarDetalles(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="h-6 w-6" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900">Información General</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Tipo de Cliente:</span>
                        <p className="text-sm text-gray-900">{clienteSeleccionado.tipoCliente}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Email:</span>
                        <p className="text-sm text-gray-900">{clienteSeleccionado.email}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Teléfono:</span>
                        <p className="text-sm text-gray-900">{clienteSeleccionado.telefono}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Historial de Pagos:</span>
                        <p className="text-sm text-gray-900">{clienteSeleccionado.historialPagos}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900">Información Financiera</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Saldo Total:</span>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(clienteSeleccionado.saldoTotal)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Saldo Vencido:</span>
                        <p className={`text-sm font-bold ${clienteSeleccionado.saldoVencido > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(clienteSeleccionado.saldoVencido)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Límite de Crédito:</span>
                        <p className="text-sm text-gray-900">{formatCurrency(clienteSeleccionado.montoCredito)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Utilización de Crédito:</span>
                        <p className="text-sm text-gray-900">{clienteSeleccionado.utilizacionCredito}%</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Score Crediticio:</span>
                        <p className={`text-sm font-bold ${getScoreColor(clienteSeleccionado.score)}`}>
                          {clienteSeleccionado.score}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Fechas Importantes</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Último Pago:</span>
                      <p className="text-sm text-gray-900">{formatDate(clienteSeleccionado.ultimoPago)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Próximo Vencimiento:</span>
                      <p className="text-sm text-gray-900">{formatDate(clienteSeleccionado.proximoVencimiento)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setMostrarDetalles(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Gestionar Cliente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
