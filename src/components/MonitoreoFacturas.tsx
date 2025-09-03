'use client';

import React, { useState, useMemo } from 'react';
import { 
  FileText,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Eye,
  Send,
  Phone,
  Mail,
  Building,
  User,
  CreditCard,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Receipt,
  CalendarDays,
  Banknote
} from 'lucide-react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';

interface Factura {
  id: string;
  numero: string;
  cliente: string;
  empresa: string;
  fechaEmision: string;
  fechaVencimiento: string;
  monto: number;
  montoOriginal: number;
  montoPagado: number;
  montoSaldo: number;
  estado: 'Pendiente' | 'Pagada' | 'Vencida' | 'Parcial' | 'Anulada';
  diasVencimiento: number;
  tipoFactura: 'Venta' | 'Servicio' | 'Producto' | 'Mixta';
  metodoPago: 'Efectivo' | 'Transferencia' | 'Cheque' | 'Tarjeta' | 'Crédito';
  vendedor: string;
  categoria: 'A' | 'B' | 'C';
  contacto: string;
  telefono: string;
  email: string;
  observaciones: string;
  fechaUltimoPago?: string;
  proximaAccion?: string;
}

const facturasEjemplo: Factura[] = [
  {
    id: '1',
    numero: 'FAC-2025-001',
    cliente: 'Carlos Mendoza',
    empresa: 'Constructora Mendoza SA',
    fechaEmision: '2025-08-15',
    fechaVencimiento: '2025-09-15',
    monto: 2500000,
    montoOriginal: 2500000,
    montoPagado: 2500000,
    montoSaldo: 0,
    estado: 'Pagada',
    diasVencimiento: 0,
    tipoFactura: 'Producto',
    metodoPago: 'Transferencia',
    vendedor: 'Ana García',
    categoria: 'A',
    contacto: 'carlos.mendoza@constructoramendoza.com',
    telefono: '+57 300 123 4567',
    email: 'carlos.mendoza@constructoramendoza.com',
    observaciones: 'Cliente preferencial, pago puntual',
    fechaUltimoPago: '2025-09-01',
    proximaAccion: 'Seguimiento comercial'
  },
  {
    id: '2',
    numero: 'FAC-2025-002',
    cliente: 'María González',
    empresa: 'Tech Solutions SAS',
    fechaEmision: '2025-08-20',
    fechaVencimiento: '2025-09-20',
    monto: 1800000,
    montoOriginal: 1800000,
    montoPagado: 0,
    montoSaldo: 1800000,
    estado: 'Pendiente',
    diasVencimiento: 0,
    tipoFactura: 'Servicio',
    metodoPago: 'Crédito',
    vendedor: 'Luis Herrera',
    categoria: 'B',
    contacto: 'maria.gonzalez@techsolutions.co',
    telefono: '+57 310 987 6543',
    email: 'maria.gonzalez@techsolutions.co',
    observaciones: 'Proyecto de desarrollo de software',
    proximaAccion: 'Confirmar recepción'
  },
  {
    id: '3',
    numero: 'FAC-2025-003',
    cliente: 'Roberto Silva',
    empresa: 'Comercial Silva Ltda',
    fechaEmision: '2025-07-15',
    fechaVencimiento: '2025-08-15',
    monto: 950000,
    montoOriginal: 950000,
    montoPagado: 0,
    montoSaldo: 950000,
    estado: 'Vencida',
    diasVencimiento: 18,
    tipoFactura: 'Mixta',
    metodoPago: 'Crédito',
    vendedor: 'Patricia López',
    categoria: 'C',
    contacto: 'roberto.silva@gmail.com',
    telefono: '+57 320 456 7890',
    email: 'roberto.silva@gmail.com',
    observaciones: 'Cliente con historial de pagos tardíos',
    proximaAccion: 'Llamada de cobranza urgente'
  },
  {
    id: '4',
    numero: 'FAC-2025-004',
    cliente: 'Ana Rodríguez',
    empresa: 'Distribuidora Rodríguez',
    fechaEmision: '2025-08-25',
    fechaVencimiento: '2025-09-25',
    monto: 3200000,
    montoOriginal: 3200000,
    montoPagado: 1600000,
    montoSaldo: 1600000,
    estado: 'Parcial',
    diasVencimiento: 0,
    tipoFactura: 'Producto',
    metodoPago: 'Transferencia',
    vendedor: 'Carlos Ruiz',
    categoria: 'A',
    contacto: 'ana.rodriguez@distribuidora.com',
    telefono: '+57 315 234 5678',
    email: 'ana.rodriguez@distribuidora.com',
    observaciones: 'Pago parcial recibido, pendiente saldo',
    fechaUltimoPago: '2025-08-28',
    proximaAccion: 'Seguimiento del saldo pendiente'
  },
  {
    id: '5',
    numero: 'FAC-2025-005',
    cliente: 'Luis Herrera',
    empresa: 'Inversiones Herrera SA',
    fechaEmision: '2025-06-10',
    fechaVencimiento: '2025-07-10',
    monto: 1500000,
    montoOriginal: 1500000,
    montoPagado: 0,
    montoSaldo: 1500000,
    estado: 'Vencida',
    diasVencimiento: 54,
    tipoFactura: 'Servicio',
    metodoPago: 'Crédito',
    vendedor: 'Diego Morales',
    categoria: 'B',
    contacto: 'luis.herrera@invherrera.com',
    telefono: '+57 305 678 9012',
    email: 'luis.herrera@invherrera.com',
    observaciones: 'Factura con más de 30 días de vencimiento',
    proximaAccion: 'Gestión jurídica'
  },
  {
    id: '6',
    numero: 'FAC-2025-006',
    cliente: 'Sandra Pérez',
    empresa: 'Consultores Pérez y Asociados',
    fechaEmision: '2025-08-30',
    fechaVencimiento: '2025-09-30',
    monto: 2800000,
    montoOriginal: 2800000,
    montoPagado: 0,
    montoSaldo: 0,
    estado: 'Anulada',
    diasVencimiento: 0,
    tipoFactura: 'Servicio',
    metodoPago: 'Transferencia',
    vendedor: 'Ana García',
    categoria: 'A',
    contacto: 'sandra.perez@consultores.com',
    telefono: '+57 312 345 6789',
    email: 'sandra.perez@consultores.com',
    observaciones: 'Factura anulada por error en servicios',
    proximaAccion: 'Generar nueva factura'
  }
];

export default function MonitoreoFacturas() {
  const { isAuthenticated, userData } = useAuthSession();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<Factura | null>(null);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  // Filtrar facturas
  const facturasFiltradas = useMemo(() => {
    return facturasEjemplo.filter(factura => {
      const coincideSearch = factura.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           factura.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           factura.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           factura.vendedor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const coincideEstado = filtroEstado === 'todos' || factura.estado === filtroEstado;
      const coincideTipo = filtroTipo === 'todos' || factura.tipoFactura === filtroTipo;
      const coincideCategoria = filtroCategoria === 'todos' || factura.categoria === filtroCategoria;
      
      return coincideSearch && coincideEstado && coincideTipo && coincideCategoria;
    });
  }, [searchTerm, filtroEstado, filtroTipo, filtroCategoria]);

  // Calcular métricas
  const metricas = useMemo(() => {
    const totalFacturado = facturasEjemplo.reduce((sum, factura) => sum + factura.montoOriginal, 0);
    const totalCobrado = facturasEjemplo.reduce((sum, factura) => sum + factura.montoPagado, 0);
    const totalPendiente = facturasEjemplo.reduce((sum, factura) => sum + factura.montoSaldo, 0);
    const facturasVencidas = facturasEjemplo.filter(f => f.estado === 'Vencida').length;
    const facturasPendientes = facturasEjemplo.filter(f => f.estado === 'Pendiente').length;
    
    return {
      totalFacturado,
      totalCobrado,
      totalPendiente,
      facturasVencidas,
      facturasPendientes,
      porcentajeCobrado: (totalCobrado / totalFacturado) * 100,
      porcentajePendiente: (totalPendiente / totalFacturado) * 100
    };
  }, []);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Pagada': return 'text-green-700 bg-green-100';
      case 'Pendiente': return 'text-blue-700 bg-blue-100';
      case 'Vencida': return 'text-red-700 bg-red-100';
      case 'Parcial': return 'text-yellow-700 bg-yellow-100';
      case 'Anulada': return 'text-gray-700 bg-gray-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'A': return 'text-green-700 bg-green-100';
      case 'B': return 'text-yellow-700 bg-yellow-100';
      case 'C': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
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
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acceso Requerido</h2>
          <p className="text-gray-600">Debes iniciar sesión para acceder al monitoreo de facturas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Monitoreo de Facturas</h1>
          <p className="text-gray-600">Gestión y seguimiento de facturas de ventas y servicios</p>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Facturado</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metricas.totalFacturado)}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cobrado</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(metricas.totalCobrado)}</p>
                <p className="text-xs text-gray-500">{metricas.porcentajeCobrado.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pendiente</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(metricas.totalPendiente)}</p>
                <p className="text-xs text-gray-500">{metricas.porcentajePendiente.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Facturas Vencidas</p>
                <p className="text-2xl font-bold text-red-600">{metricas.facturasVencidas}</p>
                <p className="text-xs text-gray-500">Requieren atención</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200/50 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Facturas Pendientes</p>
                <p className="text-2xl font-bold text-blue-600">{metricas.facturasPendientes}</p>
                <p className="text-xs text-gray-500">En proceso</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
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
                  placeholder="Buscar factura, cliente o vendedor..."
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
                <option value="Pendiente">Pendiente</option>
                <option value="Pagada">Pagada</option>
                <option value="Vencida">Vencida</option>
                <option value="Parcial">Parcial</option>
                <option value="Anulada">Anulada</option>
              </select>

              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos los tipos</option>
                <option value="Venta">Venta</option>
                <option value="Servicio">Servicio</option>
                <option value="Producto">Producto</option>
                <option value="Mixta">Mixta</option>
              </select>

              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todas las categorías</option>
                <option value="A">Categoría A</option>
                <option value="B">Categoría B</option>
                <option value="C">Categoría C</option>
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

        {/* Tabla de facturas */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/50 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factura</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimiento</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cat.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-200">
                {facturasFiltradas.map((factura) => (
                  <tr key={factura.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{factura.numero}</div>
                        <div className="text-sm text-gray-500">{formatDate(factura.fechaEmision)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{factura.cliente}</div>
                        <div className="text-sm text-gray-500">{factura.empresa}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{factura.tipoFactura}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(factura.monto)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${factura.montoSaldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(factura.montoSaldo)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{formatDate(factura.fechaVencimiento)}</div>
                        {factura.diasVencimiento > 0 && (
                          <div className="text-sm text-red-600">{factura.diasVencimiento} días</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(factura.estado)}`}>
                        {factura.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoriaColor(factura.categoria)}`}>
                        {factura.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setFacturaSeleccionada(factura);
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
        {mostrarDetalles && facturaSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{facturaSeleccionada.numero}</h3>
                    <p className="text-gray-600">{facturaSeleccionada.cliente} - {facturaSeleccionada.empresa}</p>
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
                    <h4 className="text-lg font-semibold text-gray-900">Información de la Factura</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Fecha de Emisión:</span>
                        <p className="text-sm text-gray-900">{formatDate(facturaSeleccionada.fechaEmision)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Fecha de Vencimiento:</span>
                        <p className="text-sm text-gray-900">{formatDate(facturaSeleccionada.fechaVencimiento)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Tipo de Factura:</span>
                        <p className="text-sm text-gray-900">{facturaSeleccionada.tipoFactura}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Método de Pago:</span>
                        <p className="text-sm text-gray-900">{facturaSeleccionada.metodoPago}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Vendedor:</span>
                        <p className="text-sm text-gray-900">{facturaSeleccionada.vendedor}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Categoría:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoriaColor(facturaSeleccionada.categoria)}`}>
                          {facturaSeleccionada.categoria}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold text-gray-900">Información Financiera</h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Monto Original:</span>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(facturaSeleccionada.montoOriginal)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Monto Pagado:</span>
                        <p className="text-sm font-bold text-green-600">{formatCurrency(facturaSeleccionada.montoPagado)}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Saldo Pendiente:</span>
                        <p className={`text-sm font-bold ${facturaSeleccionada.montoSaldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(facturaSeleccionada.montoSaldo)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Estado:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(facturaSeleccionada.estado)}`}>
                          {facturaSeleccionada.estado}
                        </span>
                      </div>
                      {facturaSeleccionada.diasVencimiento > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Días de Vencimiento:</span>
                          <p className="text-sm font-bold text-red-600">{facturaSeleccionada.diasVencimiento} días</p>
                        </div>
                      )}
                      {facturaSeleccionada.fechaUltimoPago && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Último Pago:</span>
                          <p className="text-sm text-gray-900">{formatDate(facturaSeleccionada.fechaUltimoPago)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Información de Contacto</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-500">Email:</span>
                      <p className="text-sm text-gray-900">{facturaSeleccionada.email}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500">Teléfono:</span>
                      <p className="text-sm text-gray-900">{facturaSeleccionada.telefono}</p>
                    </div>
                  </div>
                </div>

                {facturaSeleccionada.observaciones && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Observaciones</h4>
                    <p className="text-sm text-gray-700">{facturaSeleccionada.observaciones}</p>
                  </div>
                )}

                {facturaSeleccionada.proximaAccion && (
                  <div className="mt-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Próxima Acción</h4>
                    <p className="text-sm text-blue-700 font-medium">{facturaSeleccionada.proximaAccion}</p>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setMostrarDetalles(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Gestionar Factura
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
