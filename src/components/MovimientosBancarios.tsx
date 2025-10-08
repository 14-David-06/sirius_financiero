'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Search, 
  Eye,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Filter,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

interface MovimientoBancario {
  id: string;
  'Fecha': string;
  'Descripción': string;
  'Valor': number;
  'Clasificacion': string;
  'Unidad de Negocio': string;
  'Centro de Resultados (Solo Ingresos)': string;
  'Centro de Costos': string;
  'GRUPO PRUEBA': string;
  'CLASE PRUEBA': string;
  'CUENTA PRUEBA': string;
  'Tipo de Movimiento (Apoyo)': string;
  'Año formulado': number;
  'Mes formulado': string;
  'Numero Mes formulado': number;
  'Numero semana formulado': number;
  'Saldo_Bancario_Actual': number;
  'Legalización': string;
  'Fijo o Variable': string;
  'Centralizada': boolean;
}

interface FiltrosMovimientos {
  año: number;
  mes: number | null;
  unidadNegocio: string;
  clasificacion: string;
  tipoMovimiento: string;
  centroCostos: string;
  grupoPrueba: string;
  clasePrueba: string;
  busqueda: string;
  soloIngresos: boolean;
  soloEgresos: boolean;
}

const COLORES_GRAFICOS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export default function MovimientosBancarios() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [movimientos, setMovimientos] = useState<MovimientoBancario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMovimiento, setSelectedMovimiento] = useState<MovimientoBancario | null>(null);
  const [vistaActual, setVistaActual] = useState<'tabla' | 'graficos'>('tabla');
  
  const [filtros, setFiltros] = useState<FiltrosMovimientos>({
    año: 2025,
    mes: null,
    unidadNegocio: '',
    clasificacion: '',
    tipoMovimiento: '',
    centroCostos: '',
    grupoPrueba: '',
    clasePrueba: '',
    busqueda: '',
    soloIngresos: false,
    soloEgresos: false
  });

  // Función para transformar y limpiar datos de Airtable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformarDatosAirtable = (records: any[]): MovimientoBancario[] => {
    return records.map(record => {
      // Transformar valor a número
      let valor = 0;
      if (record['Valor'] !== undefined && record['Valor'] !== null) {
        if (typeof record['Valor'] === 'string') {
          // Limpiar el string y convertir a número
          const valorLimpio = record['Valor'].replace(/[^\d.-]/g, '');
          valor = parseFloat(valorLimpio) || 0;
        } else {
          valor = Number(record['Valor']) || 0;
        }
      }

      // Transformar fecha
      let fecha = record['Fecha'];
      if (fecha) {
        // Si la fecha es un string, intentar parsearlo
        if (typeof fecha === 'string') {
          // Airtable a veces devuelve fechas en formato ISO o YYYY-MM-DD
          const fechaParseada = new Date(fecha);
          if (!isNaN(fechaParseada.getTime())) {
            fecha = fechaParseada.toISOString().split('T')[0]; // Formato YYYY-MM-DD
          }
        }
      }

      return {
        id: record.id || '',
        'Fecha': fecha || '',
        'Descripción': record['Descripción'] || record['Descripcion'] || '',
        'Valor': valor,
        'Clasificacion': record['Clasificacion'] || '',
        'Unidad de Negocio': record['Unidad de Negocio'] || '',
        'Centro de Resultados (Solo Ingresos)': record['Centro de Resultados (Solo Ingresos)'] || '',
        'Centro de Costos': record['Centro de Costos'] || '',
        'GRUPO PRUEBA': record['GRUPO PRUEBA'] || '',
        'CLASE PRUEBA': record['CLASE PRUEBA'] || '',
        'CUENTA PRUEBA': record['CUENTA PRUEBA'] || '',
        'Tipo de Movimiento (Apoyo)': record['Tipo de Movimiento (Apoyo)'] || '',
        'Año formulado': Number(record['Año formulado']) || new Date().getFullYear(),
        'Mes formulado': record['Mes formulado'] || '',
        'Numero Mes formulado': Number(record['Numero Mes formulado']) || 0,
        'Numero semana formulado': Number(record['Numero semana formulado']) || 0,
        'Saldo_Bancario_Actual': Number(record['Saldo_Bancario_Actual']) || 0,
        'Legalización': record['Legalización'] || record['Legalizacion'] || '',
        'Fijo o Variable': record['Fijo o Variable'] || '',
        'Centralizada': Boolean(record['Centralizada'])
      };
    });
  };

  useEffect(() => {
    console.log('MovimientosBancarios useEffect - isAuthenticated:', isAuthenticated, 'userData:', userData, 'isLoading:', isLoading);
    if (isAuthenticated && userData) {
      console.log('Calling fetchMovimientos...');
      fetchMovimientos();
    }
  }, [isAuthenticated, userData, filtros.año, filtros.mes]);

  const fetchMovimientos = async () => {
    try {
      console.log('fetchMovimientos started...');
      setLoading(true);
      setError('');
      
      let url = `/api/movimientos-bancarios?maxRecords=3000`;
      
      // Agregar filtros de fecha si están definidos
      const filtrosFecha = [];
      if (filtros.año) {
        filtrosFecha.push(`YEAR({Fecha}) = ${filtros.año}`);
      }
      if (filtros.mes) {
        filtrosFecha.push(`MONTH({Fecha}) = ${filtros.mes}`);
      }
      
      if (filtrosFecha.length > 0) {
        const formula = `AND(${filtrosFecha.join(', ')})`;
        url += `&filterByFormula=${encodeURIComponent(formula)}`;
      }
      
      console.log('Fetching movimientos from:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('Movimientos API response:', result);
      
      if (result.success) {
        console.log('Records received:', result.records?.length);
        console.log('First 3 records sample:', result.records?.slice(0, 3));
        
        // Transformar datos antes de guardarlos
        const datosTransformados = transformarDatosAirtable(result.records || []);
        console.log('First 3 transformed records:', datosTransformados.slice(0, 3));
        
        setMovimientos(datosTransformados);
        console.log(`Movimientos cargados: ${datosTransformados.length}`);
      } else {
        console.error('API error:', result.error);
        setError(result.error || 'Error al cargar movimientos');
      }
    } catch (error) {
      console.error('Error fetching movimientos:', error);
      setError('Error de conexión al cargar movimientos');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar movimientos según criterios
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(movimiento => {
      // Filtro por búsqueda
      const matchBusqueda = filtros.busqueda === '' || 
        movimiento['Descripción']?.toLowerCase().includes(filtros.busqueda.toLowerCase());

      // Filtro por tipo (ingreso/egreso)
      const valor = typeof movimiento['Valor'] === 'string' ? parseFloat(movimiento['Valor']) : Number(movimiento['Valor']);
      const esIngreso = !isNaN(valor) && valor > 0;
      const esEgreso = !isNaN(valor) && valor < 0;
      const matchTipo = (!filtros.soloIngresos && !filtros.soloEgresos) ||
        (filtros.soloIngresos && esIngreso) ||
        (filtros.soloEgresos && esEgreso);

      // Filtros específicos
      const matchUnidad = !filtros.unidadNegocio || 
        movimiento['Unidad de Negocio'] === filtros.unidadNegocio;
      
      const matchClasificacion = !filtros.clasificacion || 
        movimiento['Clasificacion'] === filtros.clasificacion;
      
      const matchTipoMov = !filtros.tipoMovimiento || 
        movimiento['Tipo de Movimiento (Apoyo)'] === filtros.tipoMovimiento;
      
      const matchCentroCostos = !filtros.centroCostos || 
        movimiento['Centro de Costos'] === filtros.centroCostos;
      
      const matchGrupo = !filtros.grupoPrueba || 
        (Array.isArray(movimiento['GRUPO PRUEBA']) ? 
          movimiento['GRUPO PRUEBA'].includes(filtros.grupoPrueba) : 
          movimiento['GRUPO PRUEBA'] === filtros.grupoPrueba);
      
      const matchClase = !filtros.clasePrueba || 
        (Array.isArray(movimiento['CLASE PRUEBA']) ? 
          movimiento['CLASE PRUEBA'].includes(filtros.clasePrueba) : 
          movimiento['CLASE PRUEBA'] === filtros.clasePrueba);

      return matchBusqueda && matchTipo && matchUnidad && matchClasificacion && 
             matchTipoMov && matchCentroCostos && matchGrupo && matchClase;
    });
  }, [movimientos, filtros]);

  // Calcular métricas
  const metricas = useMemo(() => {
    const totalIngresos = movimientosFiltrados
      .filter(m => {
        const valor = typeof m['Valor'] === 'string' ? parseFloat(m['Valor']) : Number(m['Valor']);
        return !isNaN(valor) && valor > 0;
      })
      .reduce((sum, m) => {
        const valor = typeof m['Valor'] === 'string' ? parseFloat(m['Valor']) : Number(m['Valor']);
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0);
    
    const totalEgresos = Math.abs(movimientosFiltrados
      .filter(m => {
        const valor = typeof m['Valor'] === 'string' ? parseFloat(m['Valor']) : Number(m['Valor']);
        return !isNaN(valor) && valor < 0;
      })
      .reduce((sum, m) => {
        const valor = typeof m['Valor'] === 'string' ? parseFloat(m['Valor']) : Number(m['Valor']);
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0));
    
    const balance = totalIngresos - totalEgresos;
    const cantidadMovimientos = movimientosFiltrados.length;

    return { totalIngresos, totalEgresos, balance, cantidadMovimientos };
  }, [movimientosFiltrados]);

  // Datos para gráficos
  const datosGraficos = useMemo(() => {
    // Gráfico por Unidad de Negocio
    const porUnidad = movimientosFiltrados.reduce((acc, mov) => {
      const unidad = mov['Unidad de Negocio'] || 'Sin clasificar';
      const valor = typeof mov['Valor'] === 'string' ? parseFloat(mov['Valor']) : Number(mov['Valor']);
      
      if (!acc[unidad]) {
        acc[unidad] = { ingresos: 0, egresos: 0 };
      }
      
      if (!isNaN(valor)) {
        if (valor > 0) {
          acc[unidad].ingresos += valor;
        } else {
          acc[unidad].egresos += Math.abs(valor);
        }
      }
      return acc;
    }, {} as Record<string, { ingresos: number; egresos: number }>);

    const datosUnidad = Object.entries(porUnidad).map(([unidad, datos]) => ({
      unidad,
      ingresos: datos.ingresos,
      egresos: datos.egresos,
      balance: datos.ingresos - datos.egresos
    }));

    // Gráfico por Centro de Costos
    const porCentro = movimientosFiltrados.reduce((acc, mov) => {
      const centro = mov['Centro de Costos'] || 'Sin centro';
      const valor = typeof mov['Valor'] === 'string' ? parseFloat(mov['Valor']) : Number(mov['Valor']);
      const valorAbsoluto = isNaN(valor) ? 0 : Math.abs(valor);
      
      if (!acc[centro]) {
        acc[centro] = 0;
      }
      acc[centro] += valorAbsoluto;
      return acc;
    }, {} as Record<string, number>);

    const datosCentros = Object.entries(porCentro)
      .map(([centro, valor]) => ({ centro, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8); // Top 8 centros

    // Gráfico por Clasificación
    const porClasificacion = movimientosFiltrados.reduce((acc, mov) => {
      const clasificacion = mov['Clasificacion'] || 'Sin clasificar';
      const valor = typeof mov['Valor'] === 'string' ? parseFloat(mov['Valor']) : Number(mov['Valor']);
      const valorAbsoluto = isNaN(valor) ? 0 : Math.abs(valor);
      
      if (!acc[clasificacion]) {
        acc[clasificacion] = 0;
      }
      acc[clasificacion] += valorAbsoluto;
      return acc;
    }, {} as Record<string, number>);

    const datosClasificacion = Object.entries(porClasificacion)
      .map(([clasificacion, valor]) => ({ clasificacion, valor }))
      .sort((a, b) => b.valor - a.valor);

    return { datosUnidad, datosCentros, datosClasificacion };
  }, [movimientosFiltrados]);

  // Obtener valores únicos para filtros
  const valoresUnicos = useMemo(() => {
    const unidades = [...new Set(movimientos.map(m => m['Unidad de Negocio']).filter(Boolean))];
    const clasificaciones = [...new Set(movimientos.map(m => m['Clasificacion']).filter(Boolean))];
    const tiposMovimiento = [...new Set(movimientos.map(m => m['Tipo de Movimiento (Apoyo)']).filter(Boolean))];
    const centrosCostos = [...new Set(movimientos.map(m => m['Centro de Costos']).filter(Boolean))];
    const grupos = [...new Set(movimientos.flatMap(m => Array.isArray(m['GRUPO PRUEBA']) ? m['GRUPO PRUEBA'] : [m['GRUPO PRUEBA']]).filter(Boolean))];
    const clases = [...new Set(movimientos.flatMap(m => Array.isArray(m['CLASE PRUEBA']) ? m['CLASE PRUEBA'] : [m['CLASE PRUEBA']]).filter(Boolean))];

    return { unidades, clasificaciones, tiposMovimiento, centrosCostos, grupos, clases };
  }, [movimientos]);

  const formatCurrency = (value: number | string | null | undefined) => {
    // Validar y convertir el valor a número
    const numericValue = typeof value === 'string' ? parseFloat(value) : Number(value);
    
    // Si no es un número válido, retornar $ 0
    if (isNaN(numericValue) || value === null || value === undefined) {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(0);
    }
    
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numericValue);
  };

  const formatDate = (dateString: string | null | undefined) => {
    // Validar que existe la fecha
    if (!dateString) {
      return 'Sin fecha';
    }
    
    // Intentar crear la fecha
    const date = new Date(dateString);
    
    // Verificar si la fecha es válida
    if (isNaN(date.getTime())) {
      return 'Fecha inválida';
    }
    
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTipoIcon = (valor: number | string | null | undefined) => {
    const numericValue = typeof valor === 'string' ? parseFloat(valor) : Number(valor);
    if (isNaN(numericValue) || valor === null || valor === undefined) {
      return <MinusCircle className="w-4 h-4 text-gray-400" />;
    }
    return numericValue > 0 ? 
      <PlusCircle className="w-4 h-4 text-green-400" /> : 
      <MinusCircle className="w-4 h-4 text-red-400" />;
  };

  const getTipoColor = (valor: number | string | null | undefined) => {
    const numericValue = typeof valor === 'string' ? parseFloat(valor) : Number(valor);
    if (isNaN(numericValue) || valor === null || valor === undefined) {
      return 'text-gray-400';
    }
    return numericValue > 0 ? 'text-green-400' : 'text-red-400';
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
            <p className="text-white/80">Debe iniciar sesión para ver los movimientos bancarios</p>
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
              Movimientos Bancarios
            </h1>
            <p className="text-white/80">
              {userData?.nombre} • {userData?.categoria}
            </p>
          </div>

          {/* Botones de vista */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-2 border border-white/20">
              <button
                onClick={() => setVistaActual('tabla')}
                className={`px-6 py-2 rounded-lg transition-all ${
                  vistaActual === 'tabla' 
                    ? 'bg-blue-600/70 text-white' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Tabla
              </button>
              <button
                onClick={() => setVistaActual('graficos')}
                className={`px-6 py-2 rounded-lg transition-all ${
                  vistaActual === 'graficos' 
                    ? 'bg-blue-600/70 text-white' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <BarChart3 className="w-4 h-4 inline mr-2" />
                Gráficos
              </button>
            </div>
          </div>

          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-green-500/20 backdrop-blur-md rounded-2xl p-6 border border-green-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-300 text-sm font-medium">Total Ingresos</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(metricas.totalIngresos)}</p>
                </div>
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
            
            <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-6 border border-red-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-300 text-sm font-medium">Total Egresos</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(metricas.totalEgresos)}</p>
                </div>
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
            </div>
            
            <div className={`backdrop-blur-md rounded-2xl p-6 border ${metricas.balance >= 0 ? 'bg-blue-500/20 border-blue-500/30' : 'bg-orange-500/20 border-orange-500/30'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${metricas.balance >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>Balance</p>
                  <p className="text-white text-xl font-bold">{formatCurrency(metricas.balance)}</p>
                </div>
                <DollarSign className={`w-6 h-6 ${metricas.balance >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
              </div>
            </div>

            <div className="bg-purple-500/20 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm font-medium">Movimientos</p>
                  <p className="text-white text-xl font-bold">{metricas.cantidadMovimientos}</p>
                </div>
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Filtros</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Búsqueda */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    value={filtros.busqueda}
                    onChange={(e) => setFiltros({...filtros, busqueda: e.target.value})}
                    placeholder="Descripción..."
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              {/* Año */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Año</label>
                <select
                  value={filtros.año}
                  onChange={(e) => setFiltros({...filtros, año: Number(e.target.value)})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value={2024} className="text-gray-900">2024</option>
                  <option value={2025} className="text-gray-900">2025</option>
                  <option value={2026} className="text-gray-900">2026</option>
                </select>
              </div>

              {/* Mes */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Mes</label>
                <select
                  value={filtros.mes || ''}
                  onChange={(e) => setFiltros({...filtros, mes: e.target.value ? Number(e.target.value) : null})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="" className="text-gray-900">Todos</option>
                  <option value={1} className="text-gray-900">Enero</option>
                  <option value={2} className="text-gray-900">Febrero</option>
                  <option value={3} className="text-gray-900">Marzo</option>
                  <option value={4} className="text-gray-900">Abril</option>
                  <option value={5} className="text-gray-900">Mayo</option>
                  <option value={6} className="text-gray-900">Junio</option>
                  <option value={7} className="text-gray-900">Julio</option>
                  <option value={8} className="text-gray-900">Agosto</option>
                  <option value={9} className="text-gray-900">Septiembre</option>
                  <option value={10} className="text-gray-900">Octubre</option>
                  <option value={11} className="text-gray-900">Noviembre</option>
                  <option value={12} className="text-gray-900">Diciembre</option>
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Tipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFiltros({...filtros, soloIngresos: !filtros.soloIngresos, soloEgresos: false})}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all ${
                      filtros.soloIngresos 
                        ? 'bg-green-600/70 text-white' 
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    Ingresos
                  </button>
                  <button
                    onClick={() => setFiltros({...filtros, soloEgresos: !filtros.soloEgresos, soloIngresos: false})}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all ${
                      filtros.soloEgresos 
                        ? 'bg-red-600/70 text-white' 
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    Egresos
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Unidad de Negocio */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Unidad de Negocio</label>
                <select
                  value={filtros.unidadNegocio}
                  onChange={(e) => setFiltros({...filtros, unidadNegocio: e.target.value})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="" className="text-gray-900">Todas</option>
                  {valoresUnicos.unidades.map(unidad => (
                    <option key={unidad} value={unidad} className="text-gray-900">{unidad}</option>
                  ))}
                </select>
              </div>

              {/* Clasificación */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Clasificación</label>
                <select
                  value={filtros.clasificacion}
                  onChange={(e) => setFiltros({...filtros, clasificacion: e.target.value})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="" className="text-gray-900">Todas</option>
                  {valoresUnicos.clasificaciones.map(clasificacion => (
                    <option key={clasificacion} value={clasificacion} className="text-gray-900">{clasificacion}</option>
                  ))}
                </select>
              </div>

              {/* Centro de Costos */}
              <div>
                <label className="block text-white/90 text-sm font-medium mb-2">Centro de Costos</label>
                <select
                  value={filtros.centroCostos}
                  onChange={(e) => setFiltros({...filtros, centroCostos: e.target.value})}
                  className="w-full py-2 px-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="" className="text-gray-900">Todos</option>
                  {valoresUnicos.centrosCostos.map(centro => (
                    <option key={centro} value={centro} className="text-gray-900">{centro}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={fetchMovimientos}
                className="bg-blue-600/70 hover:bg-blue-700/80 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 backdrop-blur-md rounded-2xl p-4 mb-6 border border-red-500/30 text-center">
              <AlertCircle className="w-8 h-8 text-red-300 mx-auto mb-2" />
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Contenido según vista */}
          {vistaActual === 'tabla' ? (
            /* Vista de Tabla */
            loading ? (
              <div className="text-center py-12">
                <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl inline-block">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white">Cargando movimientos...</p>
                </div>
              </div>
            ) : movimientosFiltrados.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
                  <Activity className="w-16 h-16 text-white/60 mx-auto mb-4" />
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Descripción</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Unidad</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Valor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Legalización</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/90 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/20">
                      {movimientosFiltrados.slice(0, 50).map((movimiento) => (
                        <tr key={movimiento.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                            {formatDate(movimiento['Fecha'])}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              {getTipoIcon(movimiento['Valor'])}
                              <span className={`ml-2 text-xs font-medium ${getTipoColor(movimiento['Valor'])}`}>
                                {movimiento['Valor'] > 0 ? 'Ingreso' : 'Egreso'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-white max-w-xs">
                            <div className="truncate" title={movimiento['Descripción']}>
                              {movimiento['Descripción']}
                            </div>
                            <div className="text-white/60 text-xs">
                              {movimiento['Clasificacion']}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-white">
                            <div className="text-xs">
                              {movimiento['Unidad de Negocio']}
                            </div>
                            <div className="text-white/60 text-xs">
                              {movimiento['Centro de Costos']}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <span className={getTipoColor(movimiento['Valor'])}>
                              {formatCurrency(movimiento['Valor'])}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-white">
                            {movimiento['Legalización']}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
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
                {movimientosFiltrados.length > 50 && (
                  <div className="p-4 text-center text-white/70 text-sm">
                    Mostrando los primeros 50 de {movimientosFiltrados.length} movimientos
                  </div>
                )}
              </div>
            )
          ) : (
            /* Vista de Gráficos */
            <div className="space-y-8">
              {/* Gráfico por Unidad de Negocio */}
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Movimientos por Unidad de Negocio
                </h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={datosGraficos.datosUnidad}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis 
                        dataKey="unidad" 
                        tick={{ fill: '#ffffff', fontSize: 12 }}
                        axisLine={{ stroke: '#ffffff40' }}
                      />
                      <YAxis 
                        tick={{ fill: '#ffffff', fontSize: 12 }}
                        axisLine={{ stroke: '#ffffff40' }}
                        tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0,0,0,0.8)', 
                          border: '1px solid rgba(255,255,255,0.2)', 
                          borderRadius: '8px',
                          color: '#ffffff'
                        }}
                        formatter={(value: any) => [formatCurrency(value), '']}
                      />
                      <Legend />
                      <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                      <Bar dataKey="egresos" fill="#ef4444" name="Egresos" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráficos en Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico por Centro de Costos */}
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-green-400" />
                    Top Centros de Costos
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0,0,0,0.8)', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            borderRadius: '8px',
                            color: '#ffffff'
                          }}
                          formatter={(value: any) => [formatCurrency(value), 'Valor']}
                        />
                        <Pie 
                          data={datosGraficos.datosCentros} 
                          dataKey="valor" 
                          nameKey="centro" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={100}
                          label={(entry: any) => `${entry.centro}: ${(entry.percent * 100).toFixed(1)}%`}
                        >
                          {datosGraficos.datosCentros.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORES_GRAFICOS[index % COLORES_GRAFICOS.length]} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico por Clasificación */}
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    Movimientos por Clasificación
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datosGraficos.datosClasificacion.slice(0, 8)} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                        <XAxis 
                          type="number"
                          tick={{ fill: '#ffffff', fontSize: 12 }}
                          axisLine={{ stroke: '#ffffff40' }}
                          tickFormatter={(value) => `$${(value/1000000).toFixed(1)}M`}
                        />
                        <YAxis 
                          type="category"
                          dataKey="clasificacion" 
                          tick={{ fill: '#ffffff', fontSize: 10 }}
                          axisLine={{ stroke: '#ffffff40' }}
                          width={100}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0,0,0,0.8)', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            borderRadius: '8px',
                            color: '#ffffff'
                          }}
                          formatter={(value: any) => [formatCurrency(value), 'Valor']}
                        />
                        <Bar dataKey="valor" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de detalles */}
          {selectedMovimiento && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                      <p className="text-white font-medium">{formatDate(selectedMovimiento['Fecha'])}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-sm">Tipo</p>
                      <div className="flex items-center">
                        {getTipoIcon(selectedMovimiento['Valor'])}
                        <span className={`ml-2 font-medium ${getTipoColor(selectedMovimiento['Valor'])}`}>
                          {selectedMovimiento['Valor'] > 0 ? 'Ingreso' : 'Egreso'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-white/70 text-sm">Descripción</p>
                    <p className="text-white font-medium">{selectedMovimiento['Descripción']}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/70 text-sm">Unidad de Negocio</p>
                      <p className="text-white font-medium">{selectedMovimiento['Unidad de Negocio']}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-sm">Clasificación</p>
                      <p className="text-white font-medium">{selectedMovimiento['Clasificacion']}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-white/70 text-sm">Valor</p>
                    <p className={`text-2xl font-bold ${getTipoColor(selectedMovimiento['Valor'])}`}>
                      {formatCurrency(selectedMovimiento['Valor'])}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-white/70 text-sm">Centro de Costos</p>
                      <p className="text-white font-medium">{selectedMovimiento['Centro de Costos'] || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-white/70 text-sm">Tipo de Movimiento</p>
                      <p className="text-white font-medium">{selectedMovimiento['Tipo de Movimiento (Apoyo)'] || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-white/70 text-sm">Legalización</p>
                    <p className="text-white font-medium">{selectedMovimiento['Legalización']}</p>
                  </div>

                  {(selectedMovimiento['GRUPO PRUEBA'] || selectedMovimiento['CLASE PRUEBA'] || selectedMovimiento['CUENTA PRUEBA']) && (
                    <div className="bg-white/10 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-2">Clasificación Contable</h3>
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        {selectedMovimiento['GRUPO PRUEBA'] && (
                          <div>
                            <span className="text-white/70">Grupo: </span>
                            <span className="text-white font-medium">
                              {Array.isArray(selectedMovimiento['GRUPO PRUEBA']) 
                                ? selectedMovimiento['GRUPO PRUEBA'].join(', ') 
                                : selectedMovimiento['GRUPO PRUEBA']}
                            </span>
                          </div>
                        )}
                        {selectedMovimiento['CLASE PRUEBA'] && (
                          <div>
                            <span className="text-white/70">Clase: </span>
                            <span className="text-white font-medium">
                              {Array.isArray(selectedMovimiento['CLASE PRUEBA']) 
                                ? selectedMovimiento['CLASE PRUEBA'].join(', ') 
                                : selectedMovimiento['CLASE PRUEBA']}
                            </span>
                          </div>
                        )}
                        {selectedMovimiento['CUENTA PRUEBA'] && (
                          <div>
                            <span className="text-white/70">Cuenta: </span>
                            <span className="text-white font-medium">
                              {Array.isArray(selectedMovimiento['CUENTA PRUEBA']) 
                                ? selectedMovimiento['CUENTA PRUEBA'].join(', ') 
                                : selectedMovimiento['CUENTA PRUEBA']}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
