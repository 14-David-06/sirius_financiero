'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Package,
  BarChart3,
  PieChart,
  Activity,
  AlertCircle,
  Filter,
  RefreshCw,
  Banknote,
  Target,
  Briefcase,
  Factory
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart as RechartsePieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface CentralizacionData {
  id: string;
  fechaCreacion: string;
  año: number;
  mes: string;
  numeroMes: number;
  semana: number;
  
  // Productos UNB
  unb_purpureocillium: number;
  unb_metarhizium: number;
  unb_bacillus: number;
  unb_siriusbacter: number;
  unb_beauveria: number;
  unb_trichoderma: number;
  totalUNB: number;
  
  // Productos UNP
  unp_biocharPuro: number;
  unp_biocharFiltro: number;
  unp_biocharInoculado: number;
  unp_biocharBlend: number;
  totalUNP: number;
  
  // Ingresos
  ingresosTotalesUNB: number;
  ingresosTotalesUNP: number;
  ingresosOperacionales: number;
  ingresosNoOperacionales: number;
  totalIngresos: number;
  ingresosEstimados: number;
  
  // Egresos
  movimientoCostos: number;
  movimientoGastos: number;
  movimientoInversion: number;
  totalEgresos: number;
  egresosEstimados: number;
  totalCostosGastosPirolisis: number;
  
  // Saldos
  saldoInicialBancos: number;
  saldoFinalBancos: number;
  netoSemanalBancos: number;
  saldoInicioProyectado: number;
  saldoFinalProyectado: number;
  netoSemanalProyectado: number;
  
  // Metas
  cantidadLitrosDeberia: number;
  cantidadKilogramosDeberia: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ResumenGerencial() {
  const { isAuthenticated, isLoading: authLoading } = useAuthSession();
  const [data, setData] = useState<CentralizacionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'anual' | 'mensual' | 'semanal'>('anual');
  const [weekComparison, setWeekComparison] = useState<{
    previous: CentralizacionData | null;
    current: CentralizacionData | null;
    next: CentralizacionData | null;
  }>({ previous: null, current: null, next: null });
  
  // Estados para filtros del gráfico de flujo de caja
  const [showMinimoSaldo, setShowMinimoSaldo] = useState(true);
  const [showCajaCero, setShowCajaCero] = useState(true);
  const [rangoSemanas, setRangoSemanas] = useState<'todas' | 'trimestre' | 'semestre'>('todas');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/centralizacion-general?año=${selectedYear}`;
      if (selectedMonth) {
        url += `&mes=${selectedMonth}`;
      }
      if (selectedWeek) {
        url += `&semana=${selectedWeek}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, selectedWeek]);

  // Fetch data
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchData();
  }, [isAuthenticated, fetchData]);

  const fetchWeekComparison = useCallback(async () => {
    try {
      // Obtener la semana actual del año
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      
      const url = `/api/centralizacion-general?año=${selectedYear}&mode=triple&semana=${currentWeek}`;
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        const dataByWeek = result.data.reduce((acc: Record<number, CentralizacionData>, item: CentralizacionData) => {
          acc[item.semana] = item;
          return acc;
        }, {} as Record<number, CentralizacionData>);
        
        setWeekComparison({
          previous: dataByWeek[currentWeek - 1] || null,
          current: dataByWeek[currentWeek] || null,
          next: dataByWeek[currentWeek + 1] || null,
        });
      }
    } catch (error) {
      console.error('Error fetching week comparison:', error);
    }
  }, [selectedYear]);

  // Fetch three weeks comparison (previous, current, next)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchWeekComparison();
  }, [isAuthenticated, fetchWeekComparison]);

  // Datos de la semana seleccionada (para comportamiento semanal)
  const weekData = useMemo(() => {
    if (data.length === 0) return null;
    
    // Si hay una semana seleccionada, buscar ese registro específico
    if (selectedWeek) {
      return data.find(item => item.semana === selectedWeek) || data[0];
    }
    
    // Si no hay semana seleccionada, usar el registro más reciente
    return data[0];
  }, [data, selectedWeek]);

  // Cálculos agregados
  const metrics = useMemo(() => {
    if (data.length === 0) return null;

    const totalIngresosSum = data.reduce((sum, item) => sum + item.totalIngresos, 0);
    const totalEgresosSum = data.reduce((sum, item) => sum + Math.abs(item.totalEgresos), 0);
    const utilidadNeta = totalIngresosSum + totalEgresosSum; // Los egresos son negativos
    const margenNeto = totalIngresosSum > 0 ? (utilidadNeta / totalIngresosSum) * 100 : 0;

    const ingresosUNB = data.reduce((sum, item) => sum + item.ingresosTotalesUNB, 0);
    const ingresosUNP = data.reduce((sum, item) => sum + item.ingresosTotalesUNP, 0);
    
    const totalCostos = data.reduce((sum, item) => sum + Math.abs(item.movimientoCostos), 0);
    const totalGastos = data.reduce((sum, item) => sum + Math.abs(item.movimientoGastos), 0);
    const totalInversion = data.reduce((sum, item) => sum + Math.abs(item.movimientoInversion), 0);

    const saldoActual = data.length > 0 ? data[0].saldoFinalBancos : 0;
    const saldoProyectado = data.length > 0 ? data[0].saldoFinalProyectado : 0;

    return {
      totalIngresos: totalIngresosSum,
      totalEgresos: totalEgresosSum,
      utilidadNeta,
      margenNeto,
      ingresosUNB,
      ingresosUNP,
      totalCostos,
      totalGastos,
      totalInversion,
      saldoActual,
      saldoProyectado,
    };
  }, [data]);

  // Datos para gráficos
  const chartDataIngresos = useMemo(() => {
    if (viewMode === 'semanal') {
      return data.map(item => ({
        periodo: `Semana ${item.semana}`,
        Ingresos: item.totalIngresos,
        Egresos: Math.abs(item.totalEgresos),
        Utilidad: item.totalIngresos + item.totalEgresos,
      })).reverse();
    } else if (viewMode === 'mensual') {
      interface GroupedData {
        periodo: string;
        numeroMes: number;
        Ingresos: number;
        Egresos: number;
      }
      
      const grouped = data.reduce((acc, item) => {
        const key = item.mes;
        if (!acc[key]) {
          acc[key] = {
            periodo: item.mes,
            numeroMes: item.numeroMes,
            Ingresos: 0,
            Egresos: 0,
          };
        }
        acc[key].Ingresos += item.totalIngresos;
        acc[key].Egresos += Math.abs(item.totalEgresos);
        return acc;
      }, {} as Record<string, GroupedData>);

      return Object.values(grouped)
        .sort((a, b) => a.numeroMes - b.numeroMes)
        .map((item) => ({
          periodo: item.periodo,
          Ingresos: item.Ingresos,
          Egresos: item.Egresos,
          Utilidad: item.Ingresos - item.Egresos,
        }));
    }
    return [];
  }, [data, viewMode]);

  const chartDataProductos = useMemo(() => {
    const unbTotal = data.reduce((sum, item) => sum + item.ingresosTotalesUNB, 0);
    const unpTotal = data.reduce((sum, item) => sum + item.ingresosTotalesUNP, 0);

    return [
      { name: 'Productos UNB', value: unbTotal },
      { name: 'Productos UNP', value: unpTotal },
    ].filter(item => item.value > 0);
  }, [data]);

  const chartDataEgresos = useMemo(() => {
    const costosTotal = data.reduce((sum, item) => sum + Math.abs(item.movimientoCostos), 0);
    const gastosTotal = data.reduce((sum, item) => sum + Math.abs(item.movimientoGastos), 0);
    const inversionTotal = data.reduce((sum, item) => sum + Math.abs(item.movimientoInversion), 0);

    return [
      { name: 'Costos', value: costosTotal },
      { name: 'Gastos', value: gastosTotal },
      { name: 'Inversión', value: inversionTotal },
    ].filter(item => item.value > 0);
  }, [data]);

  const chartDataSaldos = useMemo(() => {
    if (viewMode === 'semanal') {
      return data.map(item => ({
        periodo: `Semana ${item.semana}`,
        'Saldo Real': item.saldoFinalBancos,
        'Saldo Proyectado': item.saldoFinalProyectado,
      })).reverse();
    }
    return [];
  }, [data, viewMode]);

  // Datos para el gráfico de flujo de caja proyectado (todas las semanas del año)
  const chartDataFlujoCajaProyectado = useMemo(() => {
    // Obtener todas las semanas del año seleccionado, ordenadas
    let semanasOrdenadas = data
      .filter(item => item.año === selectedYear)
      .sort((a, b) => a.semana - b.semana);

    // Aplicar filtro de rango de semanas
    if (rangoSemanas === 'trimestre') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      semanasOrdenadas = semanasOrdenadas.filter(item => item.semana <= currentWeek + 13);
    } else if (rangoSemanas === 'semestre') {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const currentWeek = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      semanasOrdenadas = semanasOrdenadas.filter(item => item.semana <= currentWeek + 26);
    }

    // Calcular el valor mínimo para la línea de "Mínimo Saldo" (puede ser un valor fijo o calculado)
    const minimoSaldo = 100000000; // $100M como ejemplo de saldo mínimo requerido

    return semanasOrdenadas.map(item => ({
      semana: item.semana,
      'Saldo Final Semana/Proyectado': item.saldoFinalProyectado,
      'Minimo Saldo': showMinimoSaldo ? minimoSaldo : null,
      'Caja Cero': showCajaCero ? 0 : null,
    }));
  }, [data, selectedYear, rangoSemanas, showMinimoSaldo, showCajaCero]);

  if (authLoading || loading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096889/DJI_0909_cmozhv.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10">
          <div className="bg-white/25 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-center space-x-4">
              <RefreshCw className="w-8 h-8 animate-spin text-white" />
              <span className="text-white text-lg font-semibold">Cargando dashboard gerencial...</span>
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
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096889/DJI_0909_cmozhv.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10">
          <div className="bg-white/25 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl max-w-md mx-4">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white text-center mb-2">Acceso Restringido</h2>
            <p className="text-white/80 text-center">
              Debes iniciar sesión para acceder al dashboard gerencial.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096889/DJI_0909_cmozhv.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-slate-900/95 min-h-screen"></div>
      <div className="relative z-10 pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Análisis Comparativo de 3 Semanas */}
        {(weekComparison.previous || weekComparison.current || weekComparison.next) && (
          <div className="mb-8">
            {/* Título centrado y separado */}
            <div className="flex justify-center mb-6">
              <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-2xl px-8 py-4 border border-white/40 inline-block">
                <h2 className="text-3xl font-bold text-white flex items-center gap-3 justify-center">
                  <TrendingUp className="w-8 h-8 text-slate-200" />
                  Análisis del Flujo de Caja Semanal
                </h2>
                <p className="text-white mt-1 text-center">
                  Comparativo: Semana Pasada, Actual y Futura (Proyecciones)
                </p>
              </div>
            </div>

            {/* Contenedor de las tablas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SEMANA PASADA - Datos Reales */}
              {weekComparison.previous && (
                <div className="bg-white/20 backdrop-blur-md rounded-xl p-5 border-2 border-white/40 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-slate-200" />
                          Semana Pasada
                        </h3>
                        <p className="text-sm text-slate-100">
                          Semana {weekComparison.previous.semana} - {weekComparison.previous.mes}
                        </p>
                      </div>
                      <div className="bg-white/30 px-3 py-1 rounded-full border border-white/40">
                        <span className="text-xs font-bold text-white">Histórico</span>
                      </div>
                    </div>

                    {/* 1. Saldo Inicial */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Inicial</h4>
                      <div className="bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Inicio:</span>
                          <span className="text-white font-bold text-lg">
                            {formatCurrency(weekComparison.previous.saldoInicialBancos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Ingresos */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Ingresos</h4>
                      <div className="space-y-2 bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Operacionales:</span>
                          <span className="text-green-400 font-medium">
                            {formatCurrency(weekComparison.previous.ingresosOperacionales)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">No Operacionales:</span>
                          <span className="text-green-400 font-medium">
                            {formatCurrency(weekComparison.previous.ingresosNoOperacionales)}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/30">
                          <div className="flex justify-between">
                            <span className="text-white/80 font-semibold text-sm">Total:</span>
                            <span className="text-green-400 font-bold">
                              {formatCurrency(weekComparison.previous.totalIngresos)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Egresos */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Egresos</h4>
                      <div className="space-y-2 bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Costos:</span>
                          <span className="text-red-400 font-medium">
                            {formatCurrency(Math.abs(weekComparison.previous.movimientoCostos))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Gastos:</span>
                          <span className="text-red-400 font-medium">
                            {formatCurrency(Math.abs(weekComparison.previous.movimientoGastos))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Inversiones:</span>
                          <span className="text-red-400 font-medium">
                            {formatCurrency(Math.abs(weekComparison.previous.movimientoInversion))}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/30">
                          <div className="flex justify-between">
                            <span className="text-white/80 font-semibold text-sm">Total:</span>
                            <span className="text-red-400 font-bold">
                              {formatCurrency(Math.abs(weekComparison.previous.totalEgresos))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Saldo Final */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Final</h4>
                      <div className="bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Final:</span>
                          <span className="text-white font-bold text-lg">
                            {formatCurrency(weekComparison.previous.saldoFinalBancos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Flujo Neto */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Flujo Neto</h4>
                      <div className="bg-gradient-to-r from-white/15 to-white/25 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 font-semibold">Neto Semanal:</span>
                          <span className={`font-bold text-xl ${weekComparison.previous.netoSemanalBancos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(weekComparison.previous.netoSemanalBancos)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SEMANA ACTUAL - Datos Reales/Prioritarios */}
                {weekComparison.current && (
                  <div className="bg-white/20 backdrop-blur-md rounded-xl p-5 border-2 border-white/50 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Activity className="w-5 h-5 text-slate-200" />
                          Semana Actual
                        </h3>
                        <p className="text-sm text-slate-100">
                          Semana {weekComparison.current.semana} - {weekComparison.current.mes}
                        </p>
                      </div>
                      <div className="bg-white/35 px-3 py-1 rounded-full border border-white/50">
                        <span className="text-xs font-bold text-white">En Curso</span>
                      </div>
                    </div>

                    {/* 1. Saldo Inicial */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Inicial</h4>
                      <div className="bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Inicio (Real):</span>
                          <span className="text-white font-bold text-lg">
                            {formatCurrency(weekComparison.previous ? weekComparison.previous.saldoFinalBancos : weekComparison.current.saldoInicialBancos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Ingresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Ingresos Estimados</h4>
                      <div className="space-y-2 bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-green-400 font-bold">
                            {formatCurrency(weekComparison.current.ingresosEstimados)}
                          </span>
                        </div>
                        {weekComparison.current.totalIngresos > 0 && (
                          <div className="pt-2 border-t border-white/30">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/50">Ingresos Reales:</span>
                              <span className="text-green-300">
                                {formatCurrency(weekComparison.current.totalIngresos)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Egresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Egresos Estimados</h4>
                      <div className="space-y-2 bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-red-400 font-bold">
                            {formatCurrency(Math.abs(weekComparison.current.egresosEstimados))}
                          </span>
                        </div>
                        {weekComparison.current.totalEgresos < 0 && (
                          <div className="pt-2 border-t border-white/30">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/50">Egresos Reales:</span>
                              <span className="text-red-300">
                                {formatCurrency(Math.abs(weekComparison.current.totalEgresos))}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. Saldo Final Estimado */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Final</h4>
                      <div className="bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Final Proyectado:</span>
                          <span className="text-white font-bold text-lg">
                            {formatCurrency(weekComparison.current.saldoFinalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Flujo Neto Proyectado */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Flujo Neto</h4>
                      <div className="bg-gradient-to-r from-white/15 to-white/25 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 font-semibold">Neto Proyectado:</span>
                          <span className={`font-bold text-xl ${weekComparison.current.netoSemanalProyectado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(weekComparison.current.netoSemanalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SEMANA FUTURA - Proyecciones */}
                {weekComparison.next && (
                  <div className="bg-white/20 backdrop-blur-md rounded-xl p-5 border-2 border-white/40 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Target className="w-5 h-5 text-slate-300" />
                          Semana Futura
                        </h3>
                        <p className="text-sm text-slate-200">
                          Semana {weekComparison.next.semana} - {weekComparison.next.mes}
                        </p>
                      </div>
                      <div className="bg-white/30 px-3 py-1 rounded-full border border-white/40">
                        <span className="text-xs font-bold text-white">Proyección</span>
                      </div>
                    </div>

                    {/* 1. Saldo Inicial Proyectado */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Inicial</h4>
                      <div className="bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Inicio Proyectado:</span>
                          <span className="text-white font-bold text-lg">
                            {formatCurrency(weekComparison.next.saldoInicioProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Ingresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Ingresos Estimados</h4>
                      <div className="space-y-2 bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-green-400 font-bold">
                            {formatCurrency(weekComparison.next.ingresosEstimados)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Egresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Egresos Estimados</h4>
                      <div className="space-y-2 bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-red-400 font-bold">
                            {formatCurrency(Math.abs(weekComparison.next.egresosEstimados))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Saldo Final Proyectado */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Final</h4>
                      <div className="bg-white/20 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Final Proyectado:</span>
                          <span className={`font-bold text-lg ${weekComparison.next.saldoFinalProyectado < 0 ? 'text-red-400' : 'text-white'}`}>
                            {formatCurrency(weekComparison.next.saldoFinalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Flujo Neto Proyectado */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Flujo Neto</h4>
                      <div className="bg-gradient-to-r from-white/15 to-white/25 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 font-semibold">Neto Proyectado:</span>
                          <span className={`font-bold text-xl ${weekComparison.next.netoSemanalProyectado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(weekComparison.next.netoSemanalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Alertas de Venta */}
                    {(weekComparison.next.cantidadLitrosDeberia > 0 || weekComparison.next.cantidadKilogramosDeberia > 0) && (
                      <div className="bg-red-500/20 rounded-lg p-3 border border-red-400/30">
                        <p className="text-xs font-semibold text-red-300 mb-2">⚠️ Acciones Requeridas:</p>
                        {weekComparison.next.cantidadLitrosDeberia > 0 && (
                          <p className="text-xs text-white/80">
                            • {weekComparison.next.cantidadLitrosDeberia.toLocaleString('es-CO', { maximumFractionDigits: 0 })} litros (Biológicos)
                          </p>
                        )}
                        {weekComparison.next.cantidadKilogramosDeberia > 0 && (
                          <p className="text-xs text-white/80">
                            • {weekComparison.next.cantidadKilogramosDeberia.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kg (Biochar)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Gráfico de Comportamiento Flujo de Caja Proyectado */}
        {chartDataFlujoCajaProyectado.length > 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-white/30 via-white/25 to-white/20 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/50 overflow-hidden">
              {/* Header del Gráfico */}
              <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 px-8 py-6 border-b border-white/30">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-3xl font-bold text-white flex items-center gap-3 drop-shadow-lg">
                      <Activity className="w-8 h-8 text-blue-300" />
                      Comportamiento Flujo de Caja Proyectado
                    </h3>
                    <p className="text-slate-200 text-sm mt-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Año {selectedYear} - Proyección Semanal
                    </p>
                  </div>
                  
                  {/* Estadísticas Rápidas */}
                  <div className="flex gap-4">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                      <p className="text-xs text-white/70">Promedio</p>
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(
                          chartDataFlujoCajaProyectado.reduce((sum, item) => sum + item['Saldo Final Semana/Proyectado'], 0) / chartDataFlujoCajaProyectado.length
                        )}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                      <p className="text-xs text-white/70">Máximo</p>
                      <p className="text-lg font-bold text-green-300">
                        {formatCurrency(
                          Math.max(...chartDataFlujoCajaProyectado.map(item => item['Saldo Final Semana/Proyectado']))
                        )}
                      </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                      <p className="text-xs text-white/70">Mínimo</p>
                      <p className="text-lg font-bold text-red-300">
                        {formatCurrency(
                          Math.min(...chartDataFlujoCajaProyectado.map(item => item['Saldo Final Semana/Proyectado']))
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros del Gráfico */}
              <div className="bg-white/10 backdrop-blur-sm px-8 py-4 border-b border-white/20">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-white font-semibold flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Visualización:
                    </span>
                    
                    {/* Filtro de Rango */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRangoSemanas('todas')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          rangoSemanas === 'todas'
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Todo el Año
                      </button>
                      <button
                        onClick={() => setRangoSemanas('trimestre')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          rangoSemanas === 'trimestre'
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Próximas 13 Semanas
                      </button>
                      <button
                        onClick={() => setRangoSemanas('semestre')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          rangoSemanas === 'semestre'
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        Próximas 26 Semanas
                      </button>
                    </div>
                  </div>

                  {/* Toggles de Líneas */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={showMinimoSaldo}
                        onChange={(e) => setShowMinimoSaldo(e.target.checked)}
                        className="w-4 h-4 rounded accent-orange-500"
                      />
                      <span className="text-white text-sm font-medium">Mínimo Saldo</span>
                      <div className="w-6 h-0.5 bg-orange-500"></div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={showCajaCero}
                        onChange={(e) => setShowCajaCero(e.target.checked)}
                        className="w-4 h-4 rounded accent-yellow-500"
                      />
                      <span className="text-white text-sm font-medium">Caja Cero</span>
                      <div className="w-6 h-0.5 bg-yellow-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Área del Gráfico */}
              <div className="p-8 bg-gradient-to-b from-slate-900/30 to-slate-900/50">
                <ResponsiveContainer width="100%" height={550}>
                <LineChart data={chartDataFlujoCajaProyectado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="semana" 
                    label={{ value: 'Semana', position: 'insideBottom', offset: -5, fill: '#fff' }}
                    stroke="#fff"
                    tick={{ fill: '#fff' }}
                  />
                  <YAxis 
                    label={{ value: 'COP', angle: -90, position: 'insideLeft', fill: '#fff' }}
                    tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`}
                    stroke="#fff"
                    tick={{ fill: '#fff' }}
                    tickCount={15}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ color: '#fff' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Saldo Final Semana/Proyectado" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Saldo Final Semana/Proyectado"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Minimo Saldo" 
                    stroke="#f97316" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Mínimo Saldo"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Caja Cero" 
                    stroke="#fbbf24" 
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Caja Cero"
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3 drop-shadow-lg">
            <BarChart3 className="w-10 h-10 text-slate-200" />
            Dashboard Gerencial
          </h1>
          <p className="text-white drop-shadow-md">Centralización General - Indicadores Financieros y Operativos</p>
        </div>

        {/* Filtros */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6 border border-white/30">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-white" />
              <span className="font-semibold text-white">Filtros:</span>
            </div>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-4 py-2 bg-white/25 border border-white/40 text-white rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent backdrop-blur-sm font-medium"
            >
              <option value={2024} className="text-gray-900">2024</option>
              <option value={2025} className="text-gray-900">2025</option>
              <option value={2026} className="text-gray-900">2026</option>
            </select>

            <select
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
              className="px-4 py-2 bg-white/25 border border-white/40 text-white rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent backdrop-blur-sm font-medium"
            >
              <option value="" className="text-gray-900">Todos los meses</option>
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

            <select
              value={selectedWeek || ''}
              onChange={(e) => setSelectedWeek(e.target.value ? Number(e.target.value) : null)}
              className="px-4 py-2 bg-white/25 border border-white/40 text-white rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-transparent backdrop-blur-sm font-medium"
            >
              <option value="" className="text-gray-900">Todas las semanas</option>
              {Array.from({ length: 53 }, (_, i) => i + 1).map((week) => (
                <option key={week} value={week} className="text-gray-900">Semana {week}</option>
              ))}
            </select>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setViewMode('anual')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'anual'
                    ? 'bg-slate-600 text-white shadow-lg border-2 border-white/50'
                    : 'bg-white/25 text-white hover:bg-white/35 backdrop-blur-sm border border-white/30'
                }`}
              >
                Anual
              </button>
              <button
                onClick={() => setViewMode('mensual')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'mensual'
                    ? 'bg-slate-600 text-white shadow-lg border-2 border-white/50'
                    : 'bg-white/25 text-white hover:bg-white/35 backdrop-blur-sm border border-white/30'
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setViewMode('semanal')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'semanal'
                    ? 'bg-slate-600 text-white shadow-lg border-2 border-white/50'
                    : 'bg-white/25 text-white hover:bg-white/35 backdrop-blur-sm border border-white/30'
                }`}
              >
                Semanal
              </button>
            </div>

            <button
              onClick={fetchData}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm rounded-lg flex items-center gap-2 transition-colors border border-white/30"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Comportamiento Semanal Detallado */}
        {weekData && selectedWeek && (
          <div className="mb-8">
            <div className="bg-white/25 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/30 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Calendar className="w-8 h-8 text-slate-200" />
                    Comportamiento Semanal
                  </h2>
                  <p className="text-white/90 mt-1">
                    Semana {weekData.semana} - Año {weekData.año} ({weekData.mes})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/70">Fecha de creación</p>
                  <p className="text-white font-medium">
                    {new Date(weekData.fechaCreacion).toLocaleDateString('es-CO', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SITUACIÓN BANCARIA REAL */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-green-400" />
                    Situación Bancaria Real
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Inicial:</span>
                      <span className="text-white font-bold text-lg">
                        {formatCurrency(weekData.saldoInicialBancos)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Final:</span>
                      <span className="text-white font-bold text-lg">
                        {formatCurrency(weekData.saldoFinalBancos)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Neto Semanal:</span>
                        <span className={`font-bold text-xl ${weekData.netoSemanalBancos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.netoSemanalBancos)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SITUACIÓN PROYECTADA */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-slate-300" />
                    Situación Proyectada
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Inicial:</span>
                      <span className="text-white font-bold text-lg">
                        {formatCurrency(weekData.saldoInicioProyectado)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Final:</span>
                      <span className={`font-bold text-lg ${weekData.saldoFinalProyectado < 0 ? 'text-red-400' : 'text-white'}`}>
                        {formatCurrency(weekData.saldoFinalProyectado)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Neto Semanal:</span>
                        <span className={`font-bold text-xl ${weekData.netoSemanalProyectado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.netoSemanalProyectado)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FLUJOS REALES */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Flujos Reales
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Total Ingresos:</span>
                      <span className="text-green-400 font-bold text-lg">
                        {formatCurrency(weekData.totalIngresos)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Total Egresos:</span>
                      <span className="text-red-400 font-bold text-lg">
                        {formatCurrency(Math.abs(weekData.totalEgresos))}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Resultado:</span>
                        <span className={`font-bold text-xl ${(weekData.totalIngresos + weekData.totalEgresos) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.totalIngresos + weekData.totalEgresos)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FLUJOS ESTIMADOS */}
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    Flujos Estimados
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Ingresos Estimados:</span>
                      <span className="text-green-400 font-bold text-lg">
                        {formatCurrency(weekData.ingresosEstimados)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Egresos Estimados:</span>
                      <span className="text-red-400 font-bold text-lg">
                        {formatCurrency(Math.abs(weekData.egresosEstimados))}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Resultado:</span>
                        <span className={`font-bold text-xl ${(weekData.ingresosEstimados + weekData.egresosEstimados) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.ingresosEstimados + weekData.egresosEstimados)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCIONES REQUERIDAS */}
              {(weekData.cantidadLitrosDeberia > 0 || weekData.cantidadKilogramosDeberia > 0) && (
                <div className="mt-6 bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm rounded-lg p-5 border-2 border-red-400/50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        Acciones Requeridas para Equilibrar Flujo
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {weekData.cantidadLitrosDeberia > 0 && (
                          <div className="bg-white/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-5 h-5 text-blue-400" />
                              <span className="text-white/80 text-sm">Productos Biológicos</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                              {weekData.cantidadLitrosDeberia.toLocaleString('es-CO', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                              })} litros
                            </p>
                            <p className="text-white/80 text-xs mt-1">
                              Valor unitario: {formatCurrency(38000)}
                            </p>
                          </div>
                        )}
                        {weekData.cantidadKilogramosDeberia > 0 && (
                          <div className="bg-white/20 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Factory className="w-5 h-5 text-green-400" />
                              <span className="text-white/80 text-sm">Biochar</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                              {weekData.cantidadKilogramosDeberia.toLocaleString('es-CO', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                              })} kg
                            </p>
                            <p className="text-white/80 text-xs mt-1">
                              Valor unitario: {formatCurrency(1190)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Comparación Real vs Proyectado */}
              {Math.abs(weekData.netoSemanalBancos - weekData.netoSemanalProyectado) > 1000 && (
                <div className="mt-4 bg-yellow-500/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-400/30">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    <span className="text-white font-semibold">Discrepancia detectada:</span>
                    <span className="text-yellow-400 font-bold">
                      {formatCurrency(Math.abs(weekData.netoSemanalBancos - weekData.netoSemanalProyectado))}
                    </span>
                    <span className="text-white/70">de diferencia entre real y proyectado</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPIs Principales */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Ingresos */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 opacity-80" />
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium opacity-90 mb-1">Total Ingresos</h3>
              <p className="text-3xl font-bold">{formatCurrency(metrics.totalIngresos)}</p>
              <div className="mt-2 text-sm opacity-80">
                UNB: {formatCurrency(metrics.ingresosUNB)} | UNP: {formatCurrency(metrics.ingresosUNP)}
              </div>
            </div>

            {/* Total Egresos */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <TrendingDown className="w-8 h-8 opacity-80" />
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium opacity-90 mb-1">Total Egresos</h3>
              <p className="text-3xl font-bold">{formatCurrency(metrics.totalEgresos)}</p>
              <div className="mt-2 text-sm opacity-80">
                Costos: {formatCurrency(metrics.totalCostos)}
              </div>
            </div>

            {/* Utilidad Neta */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 opacity-80" />
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium opacity-90 mb-1">Utilidad Neta</h3>
              <p className="text-3xl font-bold">{formatCurrency(metrics.utilidadNeta)}</p>
              <div className="mt-2 text-sm opacity-80">
                Margen: {formatPercent(metrics.margenNeto)}
              </div>
            </div>

            {/* Saldo Bancario */}
            <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg shadow-lg p-6 text-white border border-white/30">
              <div className="flex items-center justify-between mb-4">
                <Banknote className="w-8 h-8 opacity-80" />
                <Factory className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-white mb-1">Saldo Bancario Actual</h3>
              <p className="text-3xl font-bold text-white">{formatCurrency(metrics.saldoActual)}</p>
              <div className="mt-2 text-sm text-white/80">
                Proyectado: {formatCurrency(metrics.saldoProyectado)}
              </div>
            </div>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Gráfico de Ingresos vs Egresos */}
          <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Ingresos vs Egresos
            </h3>
            {chartDataIngresos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartDataIngresos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="Ingresos" fill="#10b981" />
                  <Bar dataKey="Egresos" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-white/70">
                No hay datos disponibles
              </div>
            )}
          </div>

          {/* Gráfico de Utilidad */}
          <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-400" />
              Utilidad por Período
            </h3>
            {chartDataIngresos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartDataIngresos}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" />
                  <YAxis tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="Utilidad" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-white/70">
                No hay datos disponibles
              </div>
            )}
          </div>

          {/* Distribución de Ingresos por Producto */}
          <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-6 h-6 text-blue-400" />
              Ingresos por Línea de Producto
            </h3>
            {chartDataProductos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsePieChart>
                  <Pie
                    data={chartDataProductos}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props) => {
                      const percent = Number(props.percent || 0);
                      const name = String(props.name || '');
                      return `${name}: ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartDataProductos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </RechartsePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-white/70">
                No hay datos disponibles
              </div>
            )}
          </div>

          {/* Distribución de Egresos */}
          <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-6 h-6 text-red-400" />
              Distribución de Egresos
            </h3>
            {chartDataEgresos.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsePieChart>
                  <Pie
                    data={chartDataEgresos}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props) => {
                      const percent = Number(props.percent || 0);
                      const name = String(props.name || '');
                      return `${name}: ${(percent * 100).toFixed(0)}%`;
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartDataEgresos.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </RechartsePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-white/70">
                No hay datos disponibles
              </div>
            )}
          </div>
        </div>

        {/* Saldos Bancarios */}
        {viewMode === 'semanal' && chartDataSaldos.length > 0 && (
          <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 mb-8 border border-white/30">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-slate-300" />
              Evolución de Saldos Bancarios
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartDataSaldos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="Saldo Real" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="Saldo Proyectado" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabla de Resumen */}
        <div className="bg-white/20 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-400" />
            Detalle por Período
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-white">Período</th>
                  <th className="px-4 py-3 text-right font-semibold text-white">Ingresos</th>
                  <th className="px-4 py-3 text-right font-semibold text-white">Egresos</th>
                  <th className="px-4 py-3 text-right font-semibold text-white">Utilidad</th>
                  <th className="px-4 py-3 text-right font-semibold text-white">Margen %</th>
                  <th className="px-4 py-3 text-right font-semibold text-white">Saldo Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.slice(0, 20).map((item) => {
                  const utilidad = item.totalIngresos + item.totalEgresos;
                  const margen = item.totalIngresos > 0 ? (utilidad / item.totalIngresos) * 100 : 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-white/5">
                      <td className="px-4 py-3 text-white">
                        {item.mes} - Semana {item.semana}
                      </td>
                      <td className="px-4 py-3 text-right text-green-400 font-medium">
                        {formatCurrency(item.totalIngresos)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400 font-medium">
                        {formatCurrency(Math.abs(item.totalEgresos))}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${utilidad >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatCurrency(utilidad)}
                      </td>
                      <td className={`px-4 py-3 text-right ${margen >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                        {formatPercent(margen)}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        {formatCurrency(item.saldoFinalBancos)}
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
  );
}
