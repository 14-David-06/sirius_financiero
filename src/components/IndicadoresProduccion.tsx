'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  Factory, 
  Calendar,
  Search,
  Eye,
  X,
  Activity,
  AlertTriangle,
  Filter,
  ChevronDown,
  TrendingUp,
  BarChart3,
  Beaker
} from 'lucide-react';

interface BalanceMasa {
  id: string;
  fecha: string;
  pesoBiocharKg: number;
  temperaturaR1: number;
  temperaturaR2: number;
  temperaturaR3: number;
  temperaturaH1: number;
  temperaturaH2: number;
  temperaturaH3: number;
  temperaturaH4: number;
  semanaFormulada: number;
}

interface ProduccionSemanal {
  semana: number;
  año: number;
  totalBiochar: number;
  fechaInicio: string;
  fechaFin: string;
  detalles: BalanceMasa[];
  costoTotal?: number;
  costoPorKg?: number;
  costosIndirectos?: number;
  costosIndirectosPorKg?: number;
}

interface TotalesMovimientos {
  totalRegistros: number;
  totalGeneral: number;
  promedioMovimiento: number;
  semanasUnicas: number;
  registrosConSemana: number;
}

export default function IndicadoresProduccion() {
  const { isAuthenticated, userData, isLoading: authLoading } = useAuthSession();
  const [balances, setBalances] = useState<BalanceMasa[]>([]);
  const [costosPorSemana, setCostosPorSemana] = useState<Record<number, number>>({});
  const [costosIndirectosPorSemana, setCostosIndirectosPorSemana] = useState<Record<number, number>>({});
  const [totalesMovimientos, setTotalesMovimientos] = useState<TotalesMovimientos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [registroSeleccionado, setRegistroSeleccionado] = useState<BalanceMasa | null>(null);
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<ProduccionSemanal | null>(null);
  
  // Filtros
  const [filtroAño, setFiltroAño] = useState<string>('todos');

  const [filtroTipoGasto, setFiltroTipoGasto] = useState<string>('completo'); // completo, produccion, costos
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [filtroMes, setFiltroMes] = useState<string>('todos');
  const [ordenamiento, setOrdenamiento] = useState<'asc' | 'desc'>('desc');
  const [fechaInicio] = useState<string>('');
  const [fechaFin] = useState<string>('');
  const [categoriaActiva, setCategoriaActiva] = useState<'pirolisis' | 'laboratorio' | 'mezclas'>('pirolisis');

  useEffect(() => {
    console.log('🔍 useEffect ejecutado - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated, 'userData:', userData);
    
    if (authLoading) {
      console.log('⏳ Esperando autenticación...');
      return;
    }
    
    if (isAuthenticated && userData) {
      console.log('✅ Usuario autenticado, cargando datos...', userData);
      cargarDatos();
    } else {
      console.log('⚠️ Usuario no autenticado, deteniendo carga');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userData, authLoading, filtroTipoGasto]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando datos de Balances Masa y Costos de Facturación Egresos...');
      
      // Calcular el mes anterior
      const now = new Date();
      const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nombreMesAnterior = mesAnterior.toLocaleDateString('es-ES', { month: 'long' });
      const nombreMesFormateado = nombreMesAnterior.charAt(0).toUpperCase() + nombreMesAnterior.slice(1);
      
      console.log('📅 Mes actual:', now.toLocaleDateString('es-ES', { month: 'long' }));
      console.log('📅 Consultando costos del mes anterior:', nombreMesFormateado);
      
      // Cargar producción, costos directos y costos indirectos en paralelo
      const [responseBalances, responseCostos, responseCostosIndirectos] = await Promise.all([
        fetch('/api/balances-masa', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        fetch(`/api/facturacion-egresos-pirolisis?mesAnterior=${encodeURIComponent(nombreMesFormateado)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        fetch(`/api/gastos-indirectos-pirolisis?mesAnterior=${encodeURIComponent(nombreMesFormateado)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      ]);

      console.log('📡 Response status balances:', responseBalances.status);
      console.log('📡 Response status costos:', responseCostos.status);
      console.log('📡 Response status costos indirectos:', responseCostosIndirectos.status);

      if (!responseBalances.ok) {
        const errorText = await responseBalances.text();
        console.error('❌ Error response balances:', errorText);
        throw new Error('Error al cargar los datos de producción');
      }

      const dataBalances = await responseBalances.json();
      console.log('✅ Datos de producción recibidos:', dataBalances);
      
      // Transformar los datos de Airtable al formato del componente
      const balancesTransformados = dataBalances.records.map((record: Record<string, unknown>) => ({
        id: record.id,
        fecha: record.Fecha || record.createdTime,
        pesoBiocharKg: record['Peso Biochar (KG)'] || 0,
        temperaturaR1: record['Temperatura Reactor (R1)'] || 0,
        temperaturaR2: record['Temperatura Reactor (R2)'] || 0,
        temperaturaR3: record['Temperatura Reactor (R3)'] || 0,
        temperaturaH1: record['Temperatura Horno (H1)'] || 0,
        temperaturaH2: record['Temperatura Horno (H2)'] || 0,
        temperaturaH3: record['Temperatura Horno (H3)'] || 0,
        temperaturaH4: record['Temperatura Horno (H4)'] || 0,
        semanaFormulada: record['Semana Formulada'] || 0,
      }));

      console.log('📊 Balances transformados:', balancesTransformados.length, 'registros');
      setBalances(balancesTransformados);

      // Cargar costos de facturación egresos si la respuesta fue exitosa
      if (responseCostos.ok) {
        const dataCostos = await responseCostos.json();
        console.log('💰 Datos de costos de Facturación Egresos recibidos:', dataCostos);
        console.log('💰 Mes consultado:', dataCostos.mesConsultado);
        console.log('💰 Costos por semana:', dataCostos.costosPorSemana);
        console.log('💰 Totales:', dataCostos.totales);
        console.log('💰 Número de semanas con costos:', Object.keys(dataCostos.costosPorSemana || {}).length);
        setCostosPorSemana(dataCostos.costosPorSemana || {});
        setTotalesMovimientos(dataCostos.totales || null);
      } else {
        const errorText = await responseCostos.text();
        console.error('⚠️ Error al cargar costos de Facturación Egresos:', errorText);
        console.warn('⚠️ No se pudieron cargar los costos del mes anterior, continuando sin ellos');
        setCostosPorSemana({});
        setTotalesMovimientos(null);
      }

      // Cargar costos indirectos (gastos) si la respuesta fue exitosa
      if (responseCostosIndirectos.ok) {
        const dataCostosIndirectos = await responseCostosIndirectos.json();
        console.log('💸 Datos de gastos indirectos recibidos:', dataCostosIndirectos);
        console.log('💸 Mes consultado:', dataCostosIndirectos.mesConsultado);
        console.log('💸 Costos indirectos por semana:', dataCostosIndirectos.costosPorSemana);
        console.log('💸 Número de semanas con costos indirectos:', Object.keys(dataCostosIndirectos.costosPorSemana || {}).length);
        setCostosIndirectosPorSemana(dataCostosIndirectos.costosPorSemana || {});
      } else {
        const errorText = await responseCostosIndirectos.text();
        console.error('⚠️ Error al cargar costos indirectos:', errorText);
        console.warn('⚠️ No se pudieron cargar los costos indirectos del mes anterior, continuando sin ellos');
        setCostosIndirectosPorSemana({});
      }
    } catch (error) {
      console.error('❌ Error al cargar datos:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para calcular promedio de temperaturas
  const calcularPromedioTemperaturas = (balance: BalanceMasa) => {
    const temps = [
      balance.temperaturaR1,
      balance.temperaturaR2,
      balance.temperaturaR3
    ].filter(t => t > 0);
    
    if (temps.length === 0) return 0;
    return Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  };

  // Función auxiliar para formatear fechas
  const formatearFecha = (fecha: string) => {
    try {
      return new Date(fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  };

  // Calcular años disponibles
  const añosDisponibles = [...new Set(balances.map(b => new Date(b.fecha).getFullYear()))].sort((a, b) => b - a);

  // Calcular semanas disponibles
  const semanasDisponibles = [...new Set(balances.map(b => b.semanaFormulada))].filter(s => s > 0).sort((a, b) => a - b);

  // Calcular meses disponibles
  const mesesDisponibles = [...new Set(balances.map(b => {
    const fecha = new Date(b.fecha);
    return fecha.getMonth() + 1; // +1 porque getMonth() devuelve 0-11
  }))].sort((a, b) => a - b);

  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Agrupar balances por semana E INCLUIR semanas solo con costos
  const produccionPorSemana = useMemo(() => {
    // 1. Agrupar balances de producción por semana
    const gruposProduccion: { [key: string]: BalanceMasa[] } = {};
    
    balances.forEach(balance => {
      const fecha = new Date(balance.fecha);
      const año = fecha.getFullYear();
      const semana = balance.semanaFormulada;
      const clave = `${año}-S${semana}`;
      
      if (!gruposProduccion[clave]) {
        gruposProduccion[clave] = [];
      }
      gruposProduccion[clave].push(balance);
    });

    // 2. Obtener TODAS las semanas únicas (producción + costos)
    const todasLasSemanas = new Set<string>();
    
    // Agregar semanas con producción
    Object.keys(gruposProduccion).forEach(clave => todasLasSemanas.add(clave));
    
    // Agregar semanas con costos directos (aunque no tengan producción)
    Object.keys(costosPorSemana).forEach(semanaNum => {
      // Intentar determinar el año de la semana basado en balances cercanos
      // o usar el año actual si no hay datos
      const años = balances.length > 0 
        ? [...new Set(balances.map(b => new Date(b.fecha).getFullYear()))]
        : [new Date().getFullYear()];
      
      años.forEach(año => {
        const clave = `${año}-S${semanaNum}`;
        todasLasSemanas.add(clave);
      });
    });

    // Agregar semanas con costos indirectos (aunque no tengan producción ni costos directos)
    Object.keys(costosIndirectosPorSemana).forEach(semanaNum => {
      // Usar la misma lógica para determinar el año
      const años = balances.length > 0 
        ? [...new Set(balances.map(b => new Date(b.fecha).getFullYear()))]
        : [new Date().getFullYear()];
      
      años.forEach(año => {
        const clave = `${año}-S${semanaNum}`;
        todasLasSemanas.add(clave);
      });
    });

    // 3. Crear objetos ProduccionSemanal para TODAS las semanas
    const semanales: ProduccionSemanal[] = Array.from(todasLasSemanas).map(clave => {
      const [añoStr, semanaStr] = clave.split('-S');
      const año = parseInt(añoStr);
      const semana = parseInt(semanaStr);
      
      const registros = gruposProduccion[clave] || [];
      const totalBiochar = registros.reduce((sum, r) => sum + r.pesoBiocharKg, 0);
      
      // Fechas de producción (si existen)
      let fechaInicio = new Date().toISOString();
      let fechaFin = new Date().toISOString();
      
      if (registros.length > 0) {
        const fechas = registros.map(r => new Date(r.fecha)).sort((a, b) => a.getTime() - b.getTime());
        fechaInicio = fechas[0].toISOString();
        fechaFin = fechas[fechas.length - 1].toISOString();
      } else {
        // Si no hay producción, estimar fecha basada en número de semana
        const fechaEstimada = new Date(año, 0, 1 + (semana - 1) * 7);
        fechaInicio = fechaEstimada.toISOString();
        fechaFin = fechaEstimada.toISOString();
      }
      
      // Obtener costos de esta semana
      const costoTotal = costosPorSemana[semana] || 0;
      const costoIndirecto = costosIndirectosPorSemana[semana] || 0;
      const costoPorKg = totalBiochar > 0 ? Math.abs(costoTotal) / totalBiochar : 0;
      const costosIndirectosPorKg = totalBiochar > 0 ? Math.abs(costoIndirecto) / totalBiochar : 0;
      
      return {
        semana,
        año,
        totalBiochar,
        fechaInicio,
        fechaFin,
        detalles: registros.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
        costoTotal: Math.abs(costoTotal),
        costoPorKg,
        costosIndirectos: Math.abs(costoIndirecto),
        costosIndirectosPorKg
      };
    });

    // Filtrar semanas que tengan producción O costos directos O costos indirectos (no vacías)
    return semanales.filter(s => s.totalBiochar > 0 || (s.costoTotal && s.costoTotal > 0) || (s.costosIndirectos && s.costosIndirectos > 0));
  }, [balances, costosPorSemana, costosIndirectosPorSemana]);

  // Filtrar producción semanal
  const produccionFiltrada = useMemo(() => {
    let resultado = [...produccionPorSemana];

    // FILTRO PRINCIPAL: Siempre mostrar solo el mes anterior
    const fechaActual = new Date();
    const mesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1);
    const añoMesAnterior = mesAnterior.getFullYear();
    const numeroMesAnterior = mesAnterior.getMonth() + 1; // +1 porque getMonth() devuelve 0-11

    console.log(`📅 Filtrando datos para el mes anterior: ${numeroMesAnterior}/${añoMesAnterior}`);

    // Filtrar por el año y mes anterior
    resultado = resultado.filter(p => {
      // Verificar que el año coincida con el año del mes anterior
      if (p.año !== añoMesAnterior) return false;
      
      // Verificar que la semana esté dentro del mes anterior
      const fechaInicio = new Date(p.fechaInicio);
      const fechaFin = new Date(p.fechaFin);
      const mesInicio = fechaInicio.getMonth() + 1;
      const mesFin = fechaFin.getMonth() + 1;
      
      // La semana pertenece al mes anterior si el inicio o el fin está en ese mes
      return mesInicio === numeroMesAnterior || mesFin === numeroMesAnterior;
    });

    // Filtro por búsqueda (aplicado después del filtro principal)
    if (busqueda) {
      const busquedaLower = busqueda.toLowerCase();
      resultado = resultado.filter(p => 
        p.semana.toString().includes(busquedaLower) ||
        p.año.toString().includes(busquedaLower) ||
        p.totalBiochar.toString().includes(busquedaLower)
      );
    }



    // Ordenamiento por semana
    resultado.sort((a, b) => {
      const comparacion = a.semana - b.semana;
      return ordenamiento === 'desc' ? -comparacion : comparacion;
    });

    console.log(`📊 Semanas encontradas para ${numeroMesAnterior}/${añoMesAnterior}:`, resultado.length);
    
    return resultado;
  }, [produccionPorSemana, busqueda, ordenamiento]);

  if (authLoading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="text-white text-lg font-semibold">Cargando indicadores de producción...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !userData) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl max-w-md mx-4">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white text-center mb-2">Acceso Restringido</h2>
            <p className="text-white/80 text-center">
              Debes iniciar sesión para ver los indicadores de producción.
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
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/20 min-h-screen"></div>
      
      {/* Contenido principal */}
      <div className="relative z-10 pt-24">
        <div className="max-w-full mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-center mb-6">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-2xl px-8 py-4 border border-white/30 inline-block">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3 justify-center">
                  <BarChart3 className="w-8 h-8 text-slate-200" />
                  Análisis de Costos y Precios de Referencia
                </h1>
                <p className="text-white mt-1 text-center">
                  Análisis financiero por categorías de producción
                </p>
              </div>
            </div>

            {/* Pestañas de Categorías */}
            <div className="flex justify-center mb-6">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-2 border border-white/30 shadow-xl">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCategoriaActiva('pirolisis')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      categoriaActiva === 'pirolisis'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Factory className="w-4 h-4" />
                      Pirólisis
                    </div>
                  </button>
                  <button
                    onClick={() => setCategoriaActiva('laboratorio')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      categoriaActiva === 'laboratorio'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Beaker className="w-4 h-4" />
                      Laboratorio
                    </div>
                  </button>
                  <button
                    onClick={() => setCategoriaActiva('mezclas')}
                    className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                      categoriaActiva === 'mezclas'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Mezclas
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

        {/* Contenido según la categoría */}
        {categoriaActiva === 'pirolisis' && (
          <>
            {/* Barra de búsqueda y filtros */}
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Búsqueda */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar semana o año..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/30 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>



            {/* Filtro de Análisis */}
            <div className="relative">
              <BarChart3 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
              <select
                value={filtroTipoGasto}
                onChange={(e) => setFiltroTipoGasto(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-slate-700/30 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                <option value="completo" className="bg-slate-800">Análisis Completo</option>
                <option value="produccion" className="bg-slate-800">Solo Producción</option>
                <option value="costos" className="bg-slate-800">Solo Costos</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
            </div>
          </div>

          {/* Botón de ordenamiento */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-white/80">
              <Filter className="inline w-4 h-4 mr-1" />
              {produccionFiltrada.length} semana{produccionFiltrada.length !== 1 ? 's' : ''} del mes anterior
            </p>
            <button
              onClick={() => setOrdenamiento(ordenamiento === 'desc' ? 'asc' : 'desc')}
              className="w-full sm:w-auto px-4 py-2 bg-slate-700/30 hover:bg-slate-700/50 border border-white/20 rounded-lg text-xs sm:text-sm text-white transition-colors flex items-center justify-center gap-2"
            >
              <TrendingUp className={`w-4 h-4 transition-transform ${ordenamiento === 'asc' ? 'rotate-180' : ''}`} />
              <span className="hidden sm:inline">{ordenamiento === 'desc' ? 'Más reciente primero' : 'Más antigua primero'}</span>
              <span className="sm:hidden">{ordenamiento === 'desc' ? 'Reciente' : 'Antigua'}</span>
            </button>
          </div>
        </div>

        {/* Tabla de Producción */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl border border-white/30 overflow-hidden shadow-xl mb-6">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <span className="ml-3 text-white">Cargando datos...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
                <p className="text-white text-lg font-semibold mb-2">Error al cargar datos</p>
                <p className="text-white/80 mb-4">{error}</p>
                <button
                  onClick={cargarDatos}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : produccionFiltrada.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Activity className="w-12 h-12 text-white/50 mb-4" />
                <p className="text-white text-lg font-semibold mb-2">
                  {busqueda ? 'No se encontraron semanas' : 'No hay datos de producción'}
                </p>
                <p className="text-white/70">
                  {busqueda ? 'Intenta con otros términos de búsqueda o ajusta los filtros' : 'Los registros aparecerán aquí cuando estén disponibles'}
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/30 bg-slate-800/40">
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Periodo
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      Biochar
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      Costo Directo
                    </th>
                    <th className="hidden sm:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      Costo/KG
                    </th>
                    <th className="hidden lg:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      Costos Indirectos
                    </th>
                    <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                      <span className="hidden sm:inline">Acciones</span>
                      <span className="sm:hidden">...</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {produccionFiltrada.map((semana) => {
                    return (
                      <tr 
                        key={`${semana.año}-${semana.semana}`}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                              <span className="text-xs sm:text-sm font-semibold text-white">
                                S{semana.semana} - {semana.año}
                              </span>
                            </div>
                            <span className="text-xs text-white/60 ml-5 sm:ml-6 hidden sm:block">
                              {formatearFecha(semana.fechaInicio)} - {formatearFecha(semana.fechaFin)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end">
                            {semana.totalBiochar > 0 ? (
                              <>
                                <span className="text-sm sm:text-base lg:text-lg font-bold text-white">
                                  {semana.totalBiochar.toLocaleString('es-CO')}
                                </span>
                                <span className="text-xs text-white/60">kg</span>
                              </>
                            ) : (
                              <span className="text-xs sm:text-sm text-white/50 italic">Sin prod.</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end">
                            {semana.costoTotal ? (
                              <span className="text-sm sm:text-base lg:text-lg font-bold text-red-400">
                                ${Math.round(semana.costoTotal).toLocaleString('es-CO')}
                              </span>
                            ) : (
                              <span className="text-xs sm:text-sm text-white/50">-</span>
                            )}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          {semana.costoPorKg ? (
                            <span className="text-sm font-semibold text-orange-400">
                              ${Math.round(semana.costoPorKg).toLocaleString('es-CO')}
                            </span>
                          ) : (
                            <span className="text-sm text-white/50">-</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end">
                            {semana.costosIndirectos ? (
                              <>
                                <span className="text-sm font-semibold text-purple-400">
                                  ${Math.round(semana.costosIndirectos).toLocaleString('es-CO')}
                                </span>
                                {semana.costosIndirectosPorKg && (
                                  <span className="text-xs text-white/60">
                                    ${Math.round(semana.costosIndirectosPorKg).toLocaleString('es-CO')}/kg
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-white/50">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                          {semana.detalles.length > 0 ? (
                            <button
                              onClick={() => setSemanaSeleccionada(semana)}
                              className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-colors text-xs sm:text-sm border border-blue-400/30"
                            >
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Ver Registros</span>
                              <span className="sm:hidden">Ver</span>
                            </button>
                          ) : (
                            <span className="text-xs text-white/50 italic">Costos</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Resumen */}
        {produccionFiltrada.length > 0 && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-6 border border-white/30 shadow-xl mb-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Resumen de Producción
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Total Semanas</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  {produccionFiltrada.length}
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Total Biochar</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  {produccionFiltrada.reduce((sum, s) => sum + s.totalBiochar, 0).toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-white/60">kg</p>
              </div>              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Promedio Semanal</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
                  {Math.round(produccionFiltrada.reduce((sum, s) => sum + s.totalBiochar, 0) / produccionFiltrada.length).toLocaleString('es-CO')}
                </p>
                <p className="text-xs text-white/60">kg</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Costos Directos</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-400">
                  ${Math.round(produccionFiltrada.reduce((sum, s) => sum + (s.costoTotal || 0), 0)).toLocaleString('es-CO')}
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Costos Indirectos</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-400">
                  ${Math.round(produccionFiltrada.reduce((sum, s) => sum + (s.costosIndirectos || 0), 0)).toLocaleString('es-CO')}
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Costo Directo/kg</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-400">
                  ${Math.round(
                    produccionFiltrada.reduce((sum, s) => sum + (s.costoTotal || 0), 0) /
                    produccionFiltrada.reduce((sum, s) => sum + s.totalBiochar, 0)
                  ).toLocaleString('es-CO')}
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Costo Indirecto/kg</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-300">
                  ${Math.round(
                    produccionFiltrada.reduce((sum, s) => sum + (s.costosIndirectos || 0), 0) /
                    produccionFiltrada.reduce((sum, s) => sum + s.totalBiochar, 0)
                  ).toLocaleString('es-CO')}
                </p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                <p className="text-white/80 text-xs sm:text-sm mb-1">Costo Total/kg</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-400">
                  ${Math.round(
                    (produccionFiltrada.reduce((sum, s) => sum + (s.costoTotal || 0), 0) + 
                     produccionFiltrada.reduce((sum, s) => sum + (s.costosIndirectos || 0), 0)) /
                    produccionFiltrada.reduce((sum, s) => sum + s.totalBiochar, 0)
                  ).toLocaleString('es-CO')}
                </p>
              </div>
            </div>
          </div>
        )}
        </>
        )}

      {/* Modal de Detalles */}
      {registroSeleccionado && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/30 shadow-2xl">
            <div className="sticky top-0 bg-slate-800/98 backdrop-blur-md px-6 py-4 border-b border-white/30 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Detalles del Registro</h3>
              <button
                onClick={() => setRegistroSeleccionado(null)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors border border-white/20"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Información General */}
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Información General</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/30 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Fecha de Registro</p>
                    <p className="text-sm font-semibold text-white">
                      {formatearFecha(registroSeleccionado.fecha)}
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Semana</p>
                    <p className="text-sm font-semibold text-white">
                      Semana {registroSeleccionado.semanaFormulada}
                    </p>
                  </div>
                </div>
              </div>

              {/* Producción */}
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Producción</h4>
                <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80">Peso Biochar</span>
                    <span className="text-2xl font-bold text-white">
                      {registroSeleccionado.pesoBiocharKg.toLocaleString('es-CO')} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Temperaturas de Reactores */}
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Temperaturas de Reactores</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Reactor 1</p>
                    <p className="text-lg font-bold text-white">{registroSeleccionado.temperaturaR1}°C</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Reactor 2</p>
                    <p className="text-lg font-bold text-white">{registroSeleccionado.temperaturaR2}°C</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Reactor 3</p>
                    <p className="text-lg font-bold text-white">{registroSeleccionado.temperaturaR3}°C</p>
                  </div>
                </div>
              </div>

              {/* Temperaturas de Hornos */}
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Temperaturas de Hornos</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Horno 1</p>
                    <p className="text-sm font-bold text-white">{registroSeleccionado.temperaturaH1}°C</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Horno 2</p>
                    <p className="text-sm font-bold text-white">{registroSeleccionado.temperaturaH2}°C</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Horno 3</p>
                    <p className="text-sm font-bold text-white">{registroSeleccionado.temperaturaH3}°C</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Horno 4</p>
                    <p className="text-sm font-bold text-white">{registroSeleccionado.temperaturaH4}°C</p>
                  </div>
                </div>
              </div>

              {/* Temperatura Promedio */}
              <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span className="text-white/80">Temperatura Promedio Reactores</span>
                  </div>
                  <span className="text-xl font-bold text-white">
                    {calcularPromedioTemperaturas(registroSeleccionado)}°C
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles de Semana */}
      {semanaSeleccionada && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto border border-white/30 shadow-2xl">
            <div className="sticky top-0 bg-slate-800/98 backdrop-blur-md px-6 py-4 border-b border-white/30 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Semana {semanaSeleccionada.semana} - {semanaSeleccionada.año}</h3>
                <p className="text-sm text-white/70 mt-1">
                  {formatearFecha(semanaSeleccionada.fechaInicio)} - {formatearFecha(semanaSeleccionada.fechaFin)}
                </p>
              </div>
              <button
                onClick={() => setSemanaSeleccionada(null)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors border border-white/20"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Resumen de la Semana */}
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Resumen de Producción</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Total Producido</p>
                    <p className="text-2xl font-bold text-white">{semanaSeleccionada.totalBiochar.toLocaleString('es-CO')}</p>
                    <p className="text-xs text-white/60">kg</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Registros</p>
                    <p className="text-2xl font-bold text-white">{semanaSeleccionada.detalles.length}</p>
                    <p className="text-xs text-white/60">lotes</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Costos Directos</p>
                    {semanaSeleccionada.costoTotal ? (
                      <>
                        <p className="text-2xl font-bold text-red-400">${Math.round(semanaSeleccionada.costoTotal).toLocaleString('es-CO')}</p>
                        <p className="text-xs text-white/60">COP</p>
                      </>
                    ) : (
                      <p className="text-sm text-white/50">Sin datos</p>
                    )}
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Costos Indirectos</p>
                    {semanaSeleccionada.costosIndirectos ? (
                      <>
                        <p className="text-2xl font-bold text-purple-400">${Math.round(semanaSeleccionada.costosIndirectos).toLocaleString('es-CO')}</p>
                        <p className="text-xs text-white/60">COP</p>
                      </>
                    ) : (
                      <p className="text-sm text-white/50">Sin datos</p>
                    )}
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-4 text-center border border-white/10">
                    <p className="text-xs text-white/60 mb-1">Costo por KG</p>
                    {semanaSeleccionada.costoPorKg ? (
                      <>
                        <p className="text-2xl font-bold text-orange-400">${Math.round(semanaSeleccionada.costoPorKg).toLocaleString('es-CO')}</p>
                        <p className="text-xs text-white/60">COP/kg</p>
                      </>
                    ) : (
                      <p className="text-sm text-white/50">-</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla de Registros Detallados */}
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-3">Registros Detallados ({semanaSeleccionada.detalles.length})</h4>
                <div className="overflow-x-auto rounded-lg border border-white/30">
                  <table className="w-full">
                    <thead className="bg-slate-800/40">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-white border-b border-white/20">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-white border-b border-white/20">Biochar (kg)</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-white border-b border-white/20">Temp. R1</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-white border-b border-white/20">Temp. R2</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-white border-b border-white/20">Temp. R3</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-white border-b border-white/20">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {semanaSeleccionada.detalles.map((registro) => {
                        return (
                          <tr key={registro.id} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                              {formatearFecha(registro.fecha)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white text-right font-semibold">
                              {registro.pesoBiocharKg.toLocaleString('es-CO')}
                            </td>
                            <td className="px-4 py-3 text-sm text-white text-right">
                              {registro.temperaturaR1}°C
                            </td>
                            <td className="px-4 py-3 text-sm text-white text-right">
                              {registro.temperaturaR2}°C
                            </td>
                            <td className="px-4 py-3 text-sm text-white text-right">
                              {registro.temperaturaR3}°C
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setRegistroSeleccionado(registro);
                                  setSemanaSeleccionada(null);
                                }}
                                className="text-xs px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded transition-colors border border-blue-400/30"
                              >
                                Ver Todo
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Contenido de Laboratorio */}
        {categoriaActiva === 'laboratorio' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-8 border border-white/30 shadow-xl text-center">
            <Beaker className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Análisis de Laboratorio</h3>
            <p className="text-white/80 mb-6">
              Análisis de costos y precios de referencia para servicios y procesos de laboratorio.
            </p>
            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
              <p className="text-yellow-200 font-medium">
                🚧 Sección en desarrollo
              </p>
              <p className="text-yellow-200/80 text-sm mt-2">
                Esta funcionalidad estará disponible próximamente con análisis detallado de costos de laboratorio, 
                pruebas de calidad y precios de referencia para servicios analíticos.
              </p>
            </div>
          </div>
        )}

        {/* Contenido de Mezclas */}
        {categoriaActiva === 'mezclas' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-8 border border-white/30 shadow-xl text-center">
            <Activity className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Análisis de Mezclas</h3>
            <p className="text-white/80 mb-6">
              Análisis de costos y precios de referencia para procesos de mezcla y formulación de productos.
            </p>
            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
              <p className="text-yellow-200 font-medium">
                🚧 Sección en desarrollo
              </p>
              <p className="text-yellow-200/80 text-sm mt-2">
                Esta funcionalidad estará disponible próximamente con análisis detallado de costos de mezclas, 
                formulaciones personalizadas y precios de referencia para productos combinados.
              </p>
            </div>
          </div>
        )}

        {/* Contenido de Mezclas */}
        {categoriaActiva === 'mezclas' && (
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-8 border border-white/30 shadow-xl text-center">
            <Activity className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-4">Análisis de Mezclas</h3>
            <p className="text-white/80 mb-6">
              Análisis de costos y precios de referencia para procesos de mezcla y formulación de productos.
            </p>
            <div className="bg-yellow-500/20 rounded-lg p-4 border border-yellow-400/30">
              <p className="text-yellow-200 font-medium">
                🚧 Sección en desarrollo
              </p>
              <p className="text-yellow-200/80 text-sm mt-2">
                Esta funcionalidad estará disponible próximamente con análisis detallado de costos de mezclas, 
                formulaciones personalizadas y precios de referencia para productos combinados.
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
