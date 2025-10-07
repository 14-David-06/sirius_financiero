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

interface MovimientoBancarioData {
  id: string;
  fecha: string;
  descripcion: string;
  clasificacion: string;
  valor: number;
  saldoBancarioAnterior: number;
  saldoBancarioActual: number;
  tipoMovimiento: string;
  centroResultados: string;
  centroCostos: string;
  unidadNegocio: string;
  fijoVariable: string;
  naturalezaContable: string;
  legalizada: string;
  afecta: string;
  grupo: string;
  clase: string;
  grupoPrueba: string;
  clasePrueba: string;
  cuenta: string;
  subCuenta: string;
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
  
  // Estados para movimientos bancarios Bancolombia
  const [movimientosBancarios, setMovimientosBancarios] = useState<MovimientoBancarioData[]>([]);
  const [loadingMovimientos, setLoadingMovimientos] = useState(true);
  
  // Estados para facturación de ingresos
  const [facturacionIngresos, setFacturacionIngresos] = useState<any[]>([]);
  const [loadingFacturacion, setLoadingFacturacion] = useState(true);
  
  // Estados para filtros del gráfico de flujo de caja
  const [showMinimoSaldo, setShowMinimoSaldo] = useState(true);
  const [showCajaCero, setShowCajaCero] = useState(true);
  const [showTendencia, _setShowTendencia] = useState(false);
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

  const fetchMovimientosBancarios = useCallback(async () => {
    try {
      setLoadingMovimientos(true);
      let url = `/api/movimientos-bancarios-bancolombia?año=${selectedYear}`;
      if (selectedMonth) {
        url += `&mes=${selectedMonth}`;
      }
      
      console.log('Fetching movimientos bancarios from:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('Respuesta API movimientos bancarios:', result);
      
      if (result.success) {
        setMovimientosBancarios(result.data);
        console.log(`Frontend - Total movimientos recibidos: ${result.data.length}`);
        
        // Debugging adicional de los primeros registros
        if (result.data.length > 0) {
          console.log('Primeros 3 movimientos:', result.data.slice(0, 3));
        }
      } else {
        console.error('Error en respuesta API:', result.error);
      }
    } catch (error) {
      console.error('Error fetching movimientos bancarios:', error);
    } finally {
      setLoadingMovimientos(false);
    }
  }, [selectedYear, selectedMonth]);

  const fetchFacturacionIngresos = useCallback(async () => {
    try {
      setLoadingFacturacion(true);
      let url = `/api/facturacion-ingresos?año=${selectedYear}`;
      if (selectedMonth) {
        url += `&mes=${selectedMonth}`;
      }
      
      console.log('Fetching facturación ingresos from:', url);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('Respuesta API facturación ingresos:', result);
      
      if (result.success) {
        setFacturacionIngresos(result.data);
        console.log(`Frontend - Total items facturación recibidos: ${result.data.length}`);
      } else {
        console.error('Error en respuesta API facturación:', result.error);
      }
    } catch (error) {
      console.error('Error fetching facturación ingresos:', error);
    } finally {
      setLoadingFacturacion(false);
    }
  }, [selectedYear, selectedMonth]);

  // Fetch data
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchData();
    fetchMovimientosBancarios();
    fetchFacturacionIngresos();
  }, [isAuthenticated, fetchData, fetchMovimientosBancarios, fetchFacturacionIngresos]);

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

  // Cálculos de movimientos bancarios
  const movimientosMetrics = useMemo(() => {
    console.log('=== INICIANDO CÁLCULO DE MÉTRICAS ===');
    console.log(`Total movimientos bancarios disponibles: ${movimientosBancarios.length}`);
    
    if (movimientosBancarios.length === 0) {
      console.log('No hay movimientos bancarios para procesar');
      return null;
    }

    // Debugging: ver todos los valores únicos de GRUPO y CLASE
    const gruposUnicos = [...new Set(movimientosBancarios.map(mov => mov.grupo))];
    const clasesUnicas = [...new Set(movimientosBancarios.map(mov => mov.clase))];
    
    console.log('Grupos únicos encontrados:', gruposUnicos);
    console.log('Clases únicas encontradas:', clasesUnicas);

    // Totalizador de ingresos operacionales (GRUPO = "Ingreso" y CLASE = "Operacional")
    // CAPTURA TODOS ABSOLUTAMENTE TODOS LOS REGISTROS QUE CUMPLAN ESTA CONDICIÓN
    const registrosIngresosOperacionales = movimientosBancarios.filter(mov => {
      // Verificación exhaustiva de la condición
      const grupoEsIngreso = mov.grupo === 'Ingreso';
      const claseEsOperacional = mov.clase === 'Operacional';
      
      // Debugging detallado para cada registro
      if (grupoEsIngreso || claseEsOperacional) {
        console.log(`Evaluando registro ${mov.id}:`, {
          grupo: mov.grupo,
          clase: mov.clase,
          grupoEsIngreso,
          claseEsOperacional,
          cumpleCondicion: grupoEsIngreso && claseEsOperacional,
          valor: mov.valor,
          descripcion: mov.descripcion.substring(0, 50)
        });
      }
      
      return grupoEsIngreso && claseEsOperacional;
    });

    const ingresosOperacionales = registrosIngresosOperacionales
      .reduce((sum, mov) => sum + Math.abs(mov.valor), 0);

    // Totalizador de costos operacionales (GRUPO PRUEBA = "Costo" y CLASE PRUEBA = "Operacional")
    const registrosCostosOperacionales = movimientosBancarios.filter(mov => {
      const grupoLimpio = mov.grupoPrueba?.toString().trim();
      const claseLimpia = mov.clasePrueba?.toString().trim();
      
      const grupoEsCosto = grupoLimpio === 'Costo';
      const claseEsOperacional = claseLimpia === 'Operacional';
      
      // Debugging detallado para costos operacionales
      if (grupoEsCosto || claseEsOperacional) {
        console.log(`Evaluando costo operacional ${mov.id}:`, {
          grupoPrueba: mov.grupoPrueba,
          clasePrueba: mov.clasePrueba,
          grupoPruebaLimpio: grupoLimpio,
          clasePruebaLimpia: claseLimpia,
          grupoEsCosto,
          claseEsOperacional,
          cumpleCondicion: grupoEsCosto && claseEsOperacional,
          valor: mov.valor,
          descripcion: mov.descripcion.substring(0, 50)
        });
      }
      
      return grupoEsCosto && claseEsOperacional;
    });

    const costosOperacionales = registrosCostosOperacionales
      .reduce((sum, mov) => sum + Math.abs(mov.valor), 0);

    // Totalizador de gastos de administración (GRUPO PRUEBA = "Gasto" y CLASE PRUEBA = "Administración")
    const registrosGastosAdministracion = movimientosBancarios.filter(mov => {
      const grupoLimpio = mov.grupoPrueba?.toString().trim();
      const claseLimpia = mov.clasePrueba?.toString().trim();
      
      // Filtro EXACTO: solo "Gasto" y "Administración", sin palabras adicionales
      return grupoLimpio === 'Gasto' && claseLimpia === 'Administración';
    }).filter((mov, index, arr) => 
      // Eliminar duplicados por ID para coincidir exactamente con Airtable
      arr.findIndex(m => m.id === mov.id) === index
    );

    const gastosAdministracion = registrosGastosAdministracion
      .reduce((sum, mov) => sum + Math.abs(mov.valor), 0);

    // Totalizador de gastos de ventas (GRUPO PRUEBA = "Gasto" y CLASE PRUEBA = "Ventas")
    const registrosGastosVentas = movimientosBancarios.filter(mov => {
      const grupoLimpio = mov.grupoPrueba?.toString().trim();
      const claseLimpia = mov.clasePrueba?.toString().trim();
      
      // Filtro EXACTO: solo "Gasto" y "Ventas", sin palabras adicionales
      return grupoLimpio === 'Gasto' && claseLimpia === 'Ventas';
    }).filter((mov, index, arr) => 
      // Eliminar duplicados por ID para coincidir exactamente con Airtable
      arr.findIndex(m => m.id === mov.id) === index
    );

    const gastosVentas = registrosGastosVentas
      .reduce((sum, mov) => sum + Math.abs(mov.valor), 0);

    // Totalizador de gastos no operacionales (GRUPO PRUEBA = "Gasto" y CLASE PRUEBA = "No Operacional")
    const registrosGastosNoOperacionales = movimientosBancarios.filter(mov => {
      const grupoLimpio = mov.grupoPrueba?.toString().trim();
      const claseLimpia = mov.clasePrueba?.toString().trim();
      
      // Filtro EXACTO: solo "Gasto" y "No Operacional", sin palabras adicionales
      return grupoLimpio === 'Gasto' && claseLimpia === 'No Operacional';
    }).filter((mov, index, arr) => 
      // Eliminar duplicados por ID para coincidir exactamente con Airtable
      arr.findIndex(m => m.id === mov.id) === index
    );

    const gastosNoOperacionales = registrosGastosNoOperacionales
      .reduce((sum, mov) => sum + Math.abs(mov.valor), 0);

    // Log para debugging - ver exactamente cuántos registros se están capturando
    console.log(`=== RESULTADO INGRESOS OPERACIONALES ===`);
    console.log(`Total registros encontrados: ${registrosIngresosOperacionales.length}`);
    console.log(`Valor total: $${ingresosOperacionales.toLocaleString('es-CO')}`);
    
    console.log(`=== RESULTADO COSTOS OPERACIONALES ===`);
    console.log(`Total registros encontrados: ${registrosCostosOperacionales.length}`);
    console.log(`Valor total: $${costosOperacionales.toLocaleString('es-CO')}`);
    
    console.log(`=== RESULTADO GASTOS ADMINISTRACIÓN ===`);
    console.log(`Total registros encontrados: ${registrosGastosAdministracion.length}`);
    console.log(`Valor total: $${gastosAdministracion.toLocaleString('es-CO')}`);
    console.log(`🎯 OBJETIVO AIRTABLE: 702 registros`);
    console.log(`📊 DIFERENCIA: ${registrosGastosAdministracion.length - 702} registros`);
    
    console.log(`=== RESULTADO GASTOS DE VENTAS ===`);
    console.log(`Total registros encontrados: ${registrosGastosVentas.length}`);
    console.log(`Valor total: $${gastosVentas.toLocaleString('es-CO')}`);
    console.log(`📊 GRUPO PRUEBA: Gasto | CLASE PRUEBA: Ventas`);
    
    console.log(`=== RESULTADO GASTOS NO OPERACIONALES ===`);
    console.log(`Total registros encontrados: ${registrosGastosNoOperacionales.length}`);
    console.log(`Valor total: $${gastosNoOperacionales.toLocaleString('es-CO')}`);
    console.log(`📊 GRUPO PRUEBA: Gasto | CLASE PRUEBA: No Operacional`);
    
    console.log('Registros de ingresos capturados:', registrosIngresosOperacionales.map(r => ({
      id: r.id,
      fecha: r.fecha,
      descripcion: r.descripcion,
      valor: r.valor,
      grupo: r.grupo,
      clase: r.clase
    })));
    
    console.log('Registros de costos capturados:', registrosCostosOperacionales.map(r => ({
      id: r.id,
      fecha: r.fecha,
      descripcion: r.descripcion,
      valor: r.valor,
      grupoPrueba: r.grupoPrueba,
      clasePrueba: r.clasePrueba
    })));
    
    console.log('Registros de gastos administración capturados:', registrosGastosAdministracion.map(r => ({
      id: r.id,
      fecha: r.fecha,
      descripcion: r.descripcion,
      valor: r.valor,
      grupoPrueba: r.grupoPrueba,
      clasePrueba: r.clasePrueba
    })));
    
    console.log('Registros de gastos de ventas capturados:', registrosGastosVentas.map(r => ({
      id: r.id,
      fecha: r.fecha,
      descripcion: r.descripcion,
      valor: r.valor,
      grupoPrueba: r.grupoPrueba,
      clasePrueba: r.clasePrueba
    })));
    
    console.log('Registros de gastos no operacionales capturados:', registrosGastosNoOperacionales.map(r => ({
      id: r.id,
      fecha: r.fecha,
      descripcion: r.descripcion,
      valor: r.valor,
      grupoPrueba: r.grupoPrueba,
      clasePrueba: r.clasePrueba
    })));

    // Otros cálculos por clasificación
    const movimientoPorClasificacion = movimientosBancarios.reduce((acc, mov) => {
      if (!acc[mov.clasificacion]) {
        acc[mov.clasificacion] = 0;
      }
      acc[mov.clasificacion] += mov.valor;
      return acc;
    }, {} as Record<string, number>);

    // Movimientos por unidad de negocio
    const movimientoPorUnidad = movimientosBancarios.reduce((acc, mov) => {
      if (!acc[mov.unidadNegocio]) {
        acc[mov.unidadNegocio] = 0;
      }
      acc[mov.unidadNegocio] += mov.valor;
      return acc;
    }, {} as Record<string, number>);

    return {
      ingresosOperacionales,
      registrosIngresosOperacionales: registrosIngresosOperacionales.length,
      costosOperacionales,
      registrosCostosOperacionales: registrosCostosOperacionales.length,
      gastosAdministracion,
      registrosGastosAdministracion: registrosGastosAdministracion.length,
      gastosVentas,
      registrosGastosVentas: registrosGastosVentas.length,
      gastosNoOperacionales,
      registrosGastosNoOperacionales: registrosGastosNoOperacionales.length,
      movimientoPorClasificacion,
      movimientoPorUnidad,
      totalMovimientos: movimientosBancarios.length
    };
  }, [movimientosBancarios]);

  // Cálculos de facturación de ingresos
  const facturacionMetrics = useMemo(() => {
    console.log('=== INICIANDO CÁLCULO DE MÉTRICAS FACTURACIÓN ===');
    console.log(`Total items facturación disponibles: ${facturacionIngresos.length}`);
    
    if (facturacionIngresos.length === 0) {
      console.log('No hay datos de facturación para procesar');
      return null;
    }

    // Agrupar por Centro de Resultados (replicar configuración del gráfico Airtable)
    const ingresosPorLinea = facturacionIngresos.reduce((acc, item) => {
      const centro = item['Centro de Resultados (Solo Ingresos)'] || 'Otro';
      if (!acc[centro]) {
        acc[centro] = 0;
      }
      acc[centro] += Number(item['Valor']) || 0;
      return acc;
    }, {} as Record<string, number>);

    // Agrupar por semana y centro
    const ingresosPorSemana = facturacionIngresos.reduce((acc, item) => {
      const semana = item['Numero semana formulado'] || 'S/D';
      const centro = item['Centro de Resultados (Solo Ingresos)'] || 'Otro';
      
      if (!acc[semana]) {
        acc[semana] = {};
      }
      if (!acc[semana][centro]) {
        acc[semana][centro] = 0;
      }
      acc[semana][centro] += Number(item['Valor']) || 0;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    console.log('Ingresos por línea de producto:', ingresosPorLinea);
    console.log('Ingresos por semana:', ingresosPorSemana);

    return {
      ingresosPorLinea,
      ingresosPorSemana,
      totalFacturacion: facturacionIngresos.reduce((sum, item) => sum + (Number(item['Valor']) || 0), 0),
      totalItems: facturacionIngresos.length
    };
  }, [facturacionIngresos]);

  // Cálculo de datos mensuales para la tabla
  const datosFacturacionMensual = useMemo(() => {
    if (!facturacionIngresos.length) return [];

    // Agrupar por mes y centro de resultados
    const agrupacionMensual = facturacionIngresos.reduce((acc, item) => {
      const mes = item['Mes formulado'] || 'Sin mes';
      const centro = item['Centro de Resultados (Solo Ingresos)'] || 'Otro';
      const valor = Number(item['Valor']) || 0;

      if (!acc[mes]) {
        acc[mes] = {};
      }
      if (!acc[mes][centro]) {
        acc[mes][centro] = 0;
      }
      acc[mes][centro] += valor;

      return acc;
    }, {} as Record<string, Record<string, number>>);

    // Convertir a formato de tabla
    const meses = Object.keys(agrupacionMensual).sort((a, b) => Number(a) - Number(b));
    const centros = ['Biológicos General', 'Biochar Blend', 'Biochar Puro', 'Biochar Como Filtro'];
    
    const resultado: Array<{
      mes: string;
      productos: Record<string, number>;
      totalMes: number;
    }> = [];

    meses.forEach(mes => {
      const datosMes = agrupacionMensual[mes];
      const productos: Record<string, number> = {};
      let totalMes = 0;

      centros.forEach(centro => {
        productos[centro] = datosMes[centro] || 0;
        totalMes += productos[centro];
      });

      const nombreMes = [
        '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ][Number(mes)] || `Mes ${mes}`;

      resultado.push({
        mes: nombreMes,
        productos,
        totalMes
      });
    });

    return resultado;
  }, [facturacionIngresos]);

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

  // Datos para gráfico de facturación por línea de producto
  const chartDataFacturacion = useMemo(() => {
    if (!facturacionMetrics) return [];
    
    return Object.entries(facturacionMetrics.ingresosPorLinea)
      .map(([linea, valor]) => ({
        linea,
        valor,
        valorFormatted: valor.toLocaleString('es-CO', { maximumFractionDigits: 0 })
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [facturacionMetrics]);

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

    // Calcular línea de tendencia (regresión lineal simple)
    let tendenciaData: number[] = [];
    if (showTendencia && semanasOrdenadas.length > 1) {
      const n = semanasOrdenadas.length;
      const sumX = semanasOrdenadas.reduce((sum, item, idx) => sum + idx, 0);
      const sumY = semanasOrdenadas.reduce((sum, item) => sum + item.saldoFinalProyectado, 0);
      const sumXY = semanasOrdenadas.reduce((sum, item, idx) => sum + (idx * item.saldoFinalProyectado), 0);
      const sumX2 = semanasOrdenadas.reduce((sum, item, idx) => sum + (idx * idx), 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      tendenciaData = semanasOrdenadas.map((_, idx) => slope * idx + intercept);
    }

    return semanasOrdenadas.map((item, idx) => ({
      semana: item.semana,
      'Saldo Final Semana/Proyectado': item.saldoFinalProyectado,
      'Minimo Saldo': showMinimoSaldo ? minimoSaldo : null,
      'Caja Cero': showCajaCero ? 0 : null,
      'Tendencia': showTendencia ? tendenciaData[idx] : null,
    }));
  }, [data, selectedYear, rangoSemanas, showMinimoSaldo, showCajaCero, showTendencia]);

  // Alertas inteligentes del flujo de caja
  const alertasFlujoCaja = useMemo(() => {
    const alertas: Array<{
      tipo: 'warning' | 'danger' | 'success';
      mensaje: string;
      icono: string;
    }> = [];
    const minimoSaldo = 100000000; // $100M
    
    if (chartDataFlujoCajaProyectado.length === 0) return alertas;

    // Alerta: Saldo por debajo del mínimo
    const saldosBajos = chartDataFlujoCajaProyectado.filter(
      item => item['Saldo Final Semana/Proyectado'] < minimoSaldo
    );
    if (saldosBajos.length > 0) {
      alertas.push({
        tipo: 'warning',
        mensaje: `${saldosBajos.length} semanas con saldo inferior a $100M`,
        icono: ''
      });
    }

    // Alerta: Flujo negativo
    const flujoNegativo = chartDataFlujoCajaProyectado.filter(
      item => item['Saldo Final Semana/Proyectado'] < 0
    );
    if (flujoNegativo.length > 0) {
      alertas.push({
        tipo: 'danger',
        mensaje: `${flujoNegativo.length} semanas con saldo negativo`,
        icono: ''
      });
    }

    // Alerta positiva: Buen desempeño
    if (alertas.length === 0) {
      alertas.push({
        tipo: 'success',
        mensaje: 'Todas las proyecciones mantienen saldos positivos',
        icono: '✅'
      });
    }

    return alertas;
  }, [chartDataFlujoCajaProyectado]);

  // Función para exportar a Excel (preparada para uso futuro)
  const _exportarAExcel = () => {
    // Datos de flujo de caja
    const csvContentFlujoCaja = [
      ['Semana', 'Saldo Final Proyectado', 'Minimo Saldo', 'Caja Cero'],
      ...chartDataFlujoCajaProyectado.map(item => [
        item.semana,
        item['Saldo Final Semana/Proyectado'],
        item['Minimo Saldo'] || '',
        item['Caja Cero'] || ''
      ])
    ].map(row => row.join(',')).join('\n');

    // Datos de movimientos bancarios
    const csvContentMovimientos = [
      [
        'ID', 'Fecha', 'Descripción', 'Clasificación', 'Valor', 
        'Saldo Anterior', 'Saldo Actual', 'Tipo Movimiento', 'Centro Resultados',
        'Centro Costos', 'Unidad Negocio', 'Fijo/Variable', 'Naturaleza Contable',
        'Legalizada', 'Afecta', 'Grupo', 'Clase', 'Cuenta', 'Sub-Cuenta'
      ],
      ...movimientosBancarios.map(mov => [
        mov.id, mov.fecha, mov.descripcion, mov.clasificacion, mov.valor,
        mov.saldoBancarioAnterior, mov.saldoBancarioActual, mov.tipoMovimiento,
        mov.centroResultados, mov.centroCostos, mov.unidadNegocio, mov.fijoVariable,
        mov.naturalezaContable, mov.legalizada, mov.afecta, mov.grupo, mov.clase,
        mov.cuenta, mov.subCuenta
      ])
    ].map(row => row.join(',')).join('\n');

    // Crear archivos separados
    const blobFlujoCaja = new Blob([csvContentFlujoCaja], { type: 'text/csv;charset=utf-8;' });
    const blobMovimientos = new Blob([csvContentMovimientos], { type: 'text/csv;charset=utf-8;' });
    
    // Descargar flujo de caja
    const linkFlujoCaja = document.createElement('a');
    const urlFlujoCaja = URL.createObjectURL(blobFlujoCaja);
    linkFlujoCaja.setAttribute('href', urlFlujoCaja);
    linkFlujoCaja.setAttribute('download', `flujo_caja_proyectado_${selectedYear}.csv`);
    linkFlujoCaja.style.visibility = 'hidden';
    document.body.appendChild(linkFlujoCaja);
    linkFlujoCaja.click();
    document.body.removeChild(linkFlujoCaja);

    // Descargar movimientos bancarios
    const linkMovimientos = document.createElement('a');
    const urlMovimientos = URL.createObjectURL(blobMovimientos);
    linkMovimientos.setAttribute('href', urlMovimientos);
    linkMovimientos.setAttribute('download', `movimientos_bancarios_${selectedYear}_${selectedMonth || 'todos'}.csv`);
    linkMovimientos.style.visibility = 'hidden';
    document.body.appendChild(linkMovimientos);
    linkMovimientos.click();
    document.body.removeChild(linkMovimientos);
  };

  if (authLoading || loading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096901/DSC_4015_aikkb6.jpg)'
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
          backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096901/DSC_4015_aikkb6.jpg)'
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
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752096901/DSC_4015_aikkb6.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-slate-900/20 min-h-screen"></div>
      <div className="relative z-10 pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Análisis Comparativo de 3 Semanas */}
        {(weekComparison.previous || weekComparison.current || weekComparison.next) && (
          <div className="mb-8">
            {/* Título centrado y separado */}
            <div className="flex justify-center mb-6">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-2xl px-8 py-4 border border-white/30 inline-block">
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
                <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-white/30 shadow-xl">
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
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Inicio:</span>
                          <span className="text-white font-bold text-3xl">
                            {formatCurrency(weekComparison.previous.saldoInicialBancos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Ingresos */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Ingresos</h4>
                      <div className="space-y-2 bg-slate-800/40 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Operacionales:</span>
                          <span className="text-green-400 font-medium text-3xl">
                            {formatCurrency(weekComparison.previous.ingresosOperacionales)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">No Operacionales:</span>
                          <span className="text-green-400 font-medium text-3xl">
                            {formatCurrency(weekComparison.previous.ingresosNoOperacionales)}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/30">
                          <div className="flex justify-between">
                            <span className="text-white/80 font-semibold text-sm">Total:</span>
                            <span className="text-green-400 font-bold text-3xl">
                              {formatCurrency(weekComparison.previous.totalIngresos)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Egresos */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Egresos</h4>
                      <div className="space-y-2 bg-slate-800/40 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Costos:</span>
                          <span className="text-red-400 font-medium text-3xl">
                            {formatCurrency(Math.abs(weekComparison.previous.movimientoCostos))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Gastos:</span>
                          <span className="text-red-400 font-medium text-3xl">
                            {formatCurrency(Math.abs(weekComparison.previous.movimientoGastos))}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-white/80">Inversiones:</span>
                          <span className="text-red-400 font-medium text-3xl">
                            {formatCurrency(Math.abs(weekComparison.previous.movimientoInversion))}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/30">
                          <div className="flex justify-between">
                            <span className="text-white/80 font-semibold text-sm">Total:</span>
                            <span className="text-red-400 font-bold text-3xl">
                              {formatCurrency(Math.abs(weekComparison.previous.totalEgresos))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Saldo Final */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Final</h4>
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Final:</span>
                          <span className="text-white font-bold text-3xl">
                            {formatCurrency(weekComparison.previous.saldoFinalBancos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Flujo Neto */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Flujo Neto</h4>
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 font-semibold">Neto Semanal:</span>
                          <span className={`font-bold text-3xl ${weekComparison.previous.netoSemanalBancos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(weekComparison.previous.netoSemanalBancos)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SEMANA ACTUAL - Datos Reales/Prioritarios */}
                {weekComparison.current && (
                  <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-white/30 shadow-xl">
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
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Inicio (Real):</span>
                          <span className="text-white font-bold text-3xl">
                            {formatCurrency(weekComparison.previous ? weekComparison.previous.saldoFinalBancos : weekComparison.current.saldoInicialBancos)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Ingresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Ingresos Estimados</h4>
                      <div className="space-y-2 bg-slate-800/40 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-green-400 font-bold text-3xl">
                            {formatCurrency(weekComparison.current.ingresosEstimados)}
                          </span>
                        </div>
                        {weekComparison.current.totalIngresos > 0 && (
                          <div className="pt-2 border-t border-white/30">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/50">Ingresos Reales:</span>
                              <span className="text-green-300 text-3xl">
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
                      <div className="space-y-2 bg-slate-800/40 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-red-400 font-bold text-3xl">
                            {formatCurrency(Math.abs(weekComparison.current.egresosEstimados))}
                          </span>
                        </div>
                        {weekComparison.current.totalEgresos < 0 && (
                          <div className="pt-2 border-t border-white/30">
                            <div className="flex justify-between text-xs">
                              <span className="text-white/50">Egresos Reales:</span>
                              <span className="text-red-300 text-3xl">
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
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/100 text-sm">Final Proyectado:</span>
                          <span className="text-white font-bold text-3xl">
                            {formatCurrency(weekComparison.current.saldoFinalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Flujo Neto Proyectado */}
                    <div>
                      <h4 className="text-sm font-semibold text-white mb-2">Flujo Neto</h4>
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 font-semibold">Neto Proyectado:</span>
                          <span className={`font-bold text-3xl ${weekComparison.current.netoSemanalProyectado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {formatCurrency(weekComparison.current.netoSemanalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SEMANA FUTURA - Proyecciones */}
                {weekComparison.next && (
                  <div className="bg-slate-800/40 backdrop-blur-md rounded-xl p-5 border border-white/30 shadow-xl">
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
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Inicio Proyectado:</span>
                          <span className="text-white font-bold text-3xl">
                            {formatCurrency(weekComparison.current ? weekComparison.current.saldoFinalProyectado : weekComparison.next.saldoInicioProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Ingresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Ingresos Estimados</h4>
                      <div className="space-y-2 bg-slate-800/40 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-green-400 font-bold text-3xl">
                            {formatCurrency(weekComparison.next.ingresosEstimados)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Egresos Estimados */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Egresos Estimados</h4>
                      <div className="space-y-2 bg-slate-800/40 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between">
                          <span className="text-white/80 font-semibold text-sm">Total Estimado:</span>
                          <span className="text-red-400 font-bold text-3xl">
                            {formatCurrency(Math.abs(weekComparison.next.egresosEstimados))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Saldo Final Proyectado */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Saldo Final</h4>
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 text-sm">Final Proyectado:</span>
                          <span className={`font-bold text-3xl ${weekComparison.next.saldoFinalProyectado < 0 ? 'text-red-400' : 'text-white'}`}>
                            {formatCurrency(weekComparison.next.saldoFinalProyectado)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. Flujo Neto Proyectado */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-white mb-2">Flujo Neto</h4>
                      <div className="bg-slate-800/30 rounded-lg p-3 border border-white/30">
                        <div className="flex justify-between items-center">
                          <span className="text-white/80 font-semibold">Neto Proyectado:</span>
                          <span className={`font-bold text-3xl ${weekComparison.next.netoSemanalProyectado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
          <div className="mb-8 animate-fade-in">
            <div className="bg-slate-800/40 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/50 overflow-hidden transition-all duration-500 hover:shadow-3xl hover:scale-[1.01]">
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
                  <div className="flex gap-4 flex-wrap">
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                      <p className="text-xs text-white/70">Promedio</p>
                      <p className="text-3xl font-bold text-white">
                        {formatCurrency(
                          chartDataFlujoCajaProyectado.reduce((sum, item) => sum + item['Saldo Final Semana/Proyectado'], 0) / chartDataFlujoCajaProyectado.length
                        )}
                      </p>
                    </div>
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                      <p className="text-xs text-white/70">Máximo</p>
                      <p className="text-3xl font-bold text-green-300">
                        {formatCurrency(
                          Math.max(...chartDataFlujoCajaProyectado.map(item => item['Saldo Final Semana/Proyectado']))
                        )}
                      </p>
                    </div>
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/30">
                      <p className="text-xs text-white/70">Mínimo</p>
                      <p className="text-3xl font-bold text-red-300">
                        {formatCurrency(
                          Math.min(...chartDataFlujoCajaProyectado.map(item => item['Saldo Final Semana/Proyectado']))
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Alertas Inteligentes */}
                {alertasFlujoCaja.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {alertasFlujoCaja.map((alerta, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-300 hover:scale-105 ${
                          alerta.tipo === 'danger'
                            ? 'bg-orange-500/15 border-orange-400/30 text-orange-100 hover:bg-orange-500/20'
                            : alerta.tipo === 'warning'
                            ? 'bg-amber-500/15 border-amber-400/30 text-amber-100 hover:bg-amber-500/20'
                            : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/20'
                        }`}
                      >
                        <span className="text-2xl">{alerta.icono}</span>
                        <p className="text-sm font-medium">{alerta.mensaje}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filtros del Gráfico */}
              <div className="bg-slate-800/30 backdrop-blur-sm px-8 py-4 border-b border-white/30">
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
                            : 'bg-slate-800/40 text-white hover:bg-slate-800/50'
                        }`}
                      >
                        Todo el Año
                      </button>
                      <button
                        onClick={() => setRangoSemanas('trimestre')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          rangoSemanas === 'trimestre'
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-slate-800/40 text-white hover:bg-slate-800/50'
                        }`}
                      >
                        Próximas 13 Semanas
                      </button>
                      <button
                        onClick={() => setRangoSemanas('semestre')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          rangoSemanas === 'semestre'
                            ? 'bg-blue-500 text-white shadow-lg scale-105'
                            : 'bg-slate-800/40 text-white hover:bg-slate-800/50'
                        }`}
                      >
                        Próximas 26 Semanas
                      </button>
                    </div>
                  </div>

                  {/* Toggles de Líneas */}
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-800/40 hover:bg-slate-800/50 px-3 py-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={showMinimoSaldo}
                        onChange={(e) => setShowMinimoSaldo(e.target.checked)}
                        className="w-4 h-4 rounded accent-orange-500"
                      />
                      <span className="text-white text-sm font-medium">Mínimo Saldo</span>
                      <div className="w-6 h-0.5 bg-orange-500"></div>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-800/40 hover:bg-slate-800/50 px-3 py-2 rounded-lg transition-colors">
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
                    stroke="#fff"
                    tick={{ fill: '#fff' }}
                  />
                  <YAxis 
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

        {/* Movimientos Bancarios Bancolombia - Capital de Trabajo */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6 border border-white/30">
          <div className="flex items-center justify-between mb-4">
          </div>

          {loadingMovimientos ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="ml-2 text-white">Cargando movimientos bancarios...</span>
            </div>
          ) : movimientosMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Totalizador de Ingresos Operacionales */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">
                    Ingresos Operacionales
                  </p>
                  <p className="text-white text-3xl font-bold">
                    ${movimientosMetrics.ingresosOperacionales.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Totalizador de Costos Operacionales */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">
                    Costo Operacional
                  </p>
                  <p className="text-white text-3xl font-bold">
                    ${movimientosMetrics.costosOperacionales.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Totalizador de Gastos Administración */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">
                    Gasto Administración
                  </p>
                  <p className="text-white text-3xl font-bold">
                    ${movimientosMetrics.gastosAdministracion.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Totalizador de Gastos de Ventas */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">
                    Gasto de ventas
                  </p>
                  <p className="text-white text-3xl font-bold">
                    ${movimientosMetrics.gastosVentas.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Totalizador de Gastos No Operacionales */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <div>
                  <p className="text-white/80 text-sm font-medium mb-1">
                    Gasto No Operacional
                  </p>
                  <p className="text-white text-3xl font-bold">
                    ${movimientosMetrics.gastosNoOperacionales.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-white/50 mx-auto mb-2" />
              <p className="text-white/70">No hay datos de movimientos bancarios disponibles</p>
            </div>
          )}
        </div>

        {/* Facturación de Ingresos por Línea de Producto */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6 border border-white/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">
              Facturación de Ingresos por Línea de Producto
            </h2>
          </div>

          {loadingFacturacion ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="ml-2 text-white">Cargando datos de facturación...</span>
            </div>
          ) : facturacionMetrics ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Barras */}
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  Ingresos por Línea de Producto
                </h3>
                {chartDataFacturacion.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartDataFacturacion}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="linea" 
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis 
                        tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`}
                        stroke="#fff"
                        tick={{ fill: '#fff', fontSize: 12 }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString('es-CO')}`, 'Valor']}
                        contentStyle={{ 
                          backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                          border: '1px solid rgba(255,255,255,0.3)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="valor" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-white/70">
                    No hay datos de facturación disponibles
                  </div>
                )}
              </div>

              {/* Tabla de Valores Mensuales */}
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-white/30">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-400" />
                  Detalle Mensual - Recaudo Facturas de Venta por Línea de Producto
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/40">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-white">Mes</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">Biológicos General</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">Biochar Blend</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">Biochar Puro</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">Biochar Como Filtro</th>
                        <th className="px-3 py-2 text-right font-semibold text-white">Total Mes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {datosFacturacionMensual.map((fila, index) => (
                        <tr key={fila.mes} className="hover:bg-white/5">
                          <td className="px-3 py-2 text-white font-medium">
                            {fila.mes}
                          </td>
                          <td className="px-3 py-2 text-right text-white">
                            ${(fila.productos['Biológicos General'] || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right text-white">
                            ${(fila.productos['Biochar Blend'] || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right text-white">
                            ${(fila.productos['Biochar Puro'] || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right text-white">
                            ${(fila.productos['Biochar Como Filtro'] || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right text-green-400 font-bold">
                            ${fila.totalMes.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-800/40">
                      <tr>
                        <td className="px-3 py-2 text-white font-bold">Total General</td>
                        <td className="px-3 py-2 text-right text-white font-bold">
                          ${datosFacturacionMensual.reduce((sum, fila) => sum + (fila.productos['Biológicos General'] || 0), 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-right text-white font-bold">
                          ${datosFacturacionMensual.reduce((sum, fila) => sum + (fila.productos['Biochar Blend'] || 0), 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-right text-white font-bold">
                          ${datosFacturacionMensual.reduce((sum, fila) => sum + (fila.productos['Biochar Puro'] || 0), 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-right text-white font-bold">
                          ${datosFacturacionMensual.reduce((sum, fila) => sum + (fila.productos['Biochar Como Filtro'] || 0), 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2 text-right text-green-400 font-bold">
                          ${facturacionMetrics.totalFacturacion.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                {/* Resumen adicional */}
                <div className="mt-4 pt-4 border-t border-white/20">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-white/70">Total Items:</p>
                      <p className="text-white font-bold">{facturacionMetrics.totalItems}</p>
                    </div>
                    <div>
                      <p className="text-white/70">Líneas Activas:</p>
                      <p className="text-white font-bold">{Object.keys(facturacionMetrics.ingresosPorLinea).length}</p>
                    </div>
                    <div>
                      <p className="text-white/70">Meses con Datos:</p>
                      <p className="text-white font-bold">{datosFacturacionMensual.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-white/50 mx-auto mb-2" />
              <p className="text-white/70">No hay datos de facturación disponibles</p>
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 mb-6 border border-white/30">
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
              onClick={() => {
                fetchData();
                fetchMovimientosBancarios();
                fetchFacturacionIngresos();
              }}
              className="px-4 py-2 bg-slate-800/40 hover:bg-slate-800/50 text-white backdrop-blur-sm rounded-lg flex items-center gap-2 transition-colors border border-white/30"
            >
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Comportamiento Semanal Detallado */}
        {weekData && selectedWeek && (
          <div className="mb-8">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-2xl p-6 border border-white/30 mb-6">
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
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-green-400" />
                    Situación Bancaria Real
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Inicial:</span>
                      <span className="text-white font-bold text-3xl">
                        {formatCurrency(weekData.saldoInicialBancos)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Final:</span>
                      <span className="text-white font-bold text-3xl">
                        {formatCurrency(weekData.saldoFinalBancos)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Neto Semanal:</span>
                        <span className={`font-bold text-3xl ${weekData.netoSemanalBancos >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.netoSemanalBancos)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SITUACIÓN PROYECTADA */}
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-slate-300" />
                    Situación Proyectada
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Inicial:</span>
                      <span className="text-white font-bold text-3xl">
                        {formatCurrency(weekData.saldoInicioProyectado)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Saldo Final:</span>
                      <span className={`font-bold text-3xl ${weekData.saldoFinalProyectado < 0 ? 'text-red-400' : 'text-white'}`}>
                        {formatCurrency(weekData.saldoFinalProyectado)}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Neto Semanal:</span>
                        <span className={`font-bold text-3xl ${weekData.netoSemanalProyectado >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.netoSemanalProyectado)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FLUJOS REALES */}
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    Flujos Reales
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Total Ingresos:</span>
                      <span className="text-green-400 font-bold text-3xl">
                        {formatCurrency(weekData.totalIngresos)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Total Egresos:</span>
                      <span className="text-red-400 font-bold text-3xl">
                        {formatCurrency(Math.abs(weekData.totalEgresos))}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Resultado:</span>
                        <span className={`font-bold text-3xl ${(weekData.totalIngresos + weekData.totalEgresos) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(weekData.totalIngresos + weekData.totalEgresos)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FLUJOS ESTIMADOS */}
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-5 border border-white/30">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-400" />
                    Flujos Estimados
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Ingresos Estimados:</span>
                      <span className="text-green-400 font-bold text-3xl">
                        {formatCurrency(weekData.ingresosEstimados)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Egresos Estimados:</span>
                      <span className="text-red-400 font-bold text-3xl">
                        {formatCurrency(Math.abs(weekData.egresosEstimados))}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-white/20">
                      <div className="flex justify-between items-center">
                        <span className="text-white/90 font-semibold">Resultado:</span>
                        <span className={`font-bold text-3xl ${(weekData.ingresosEstimados + weekData.egresosEstimados) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                          <div className="bg-slate-800/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Package className="w-5 h-5 text-blue-400" />
                              <span className="text-white/80 text-sm">Productos Biológicos</span>
                            </div>
                            <p className="text-3xl font-bold text-white">
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
                          <div className="bg-slate-800/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Factory className="w-5 h-5 text-green-400" />
                              <span className="text-white/80 text-sm">Biochar</span>
                            </div>
                            <p className="text-3xl font-bold text-white">
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
            <div className="bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-md rounded-xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-emerald-300" />
                <TrendingUp className="w-6 h-6 text-emerald-300" />
              </div>
              <h3 className="text-sm font-medium text-emerald-100 mb-1">Total Ingresos</h3>
              <p className="text-4xl font-bold text-white">{formatCurrency(metrics.totalIngresos)}</p>
              <div className="mt-2 text-sm text-emerald-200">
                UNB: {formatCurrency(metrics.ingresosUNB)} | UNP: {formatCurrency(metrics.ingresosUNP)}
              </div>
            </div>

            {/* Total Egresos */}
            <div className="backdrop-blur-md rounded-xl shadow-xl p-6 text-white border" style={{ backgroundColor: '#FF9500' + '33', borderColor: '#FF9500' + '4D' }}>
              <div className="flex items-center justify-between mb-4">
                <TrendingDown className="w-8 h-8" style={{ color: '#FF9500' }} />
                <Briefcase className="w-6 h-6" style={{ color: '#FF9500' }} />
              </div>
              <h3 className="text-sm font-medium text-white/90 mb-1">Total Egresos</h3>
              <p className="text-4xl font-bold text-white">{formatCurrency(metrics.totalEgresos)}</p>
              <div className="mt-2 text-sm text-white/80">
                Costos: {formatCurrency(metrics.totalCostos)}
              </div>
            </div>

            {/* Utilidad Neta */}
            <div className="bg-blue-500/20 border border-blue-400/30 backdrop-blur-md rounded-xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 text-blue-300" />
                <Target className="w-6 h-6 text-blue-300" />
              </div>
              <h3 className="text-sm font-medium text-blue-100 mb-1">Utilidad Neta</h3>
              <p className="text-4xl font-bold text-white">{formatCurrency(metrics.utilidadNeta)}</p>
              <div className="mt-2 text-sm text-blue-200">
                Margen: {formatPercent(metrics.margenNeto)}
              </div>
            </div>

            {/* Saldo Bancario */}
            <div className="bg-slate-500/20 border border-slate-400/30 backdrop-blur-md rounded-xl shadow-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <Banknote className="w-8 h-8 text-slate-300" />
                <Factory className="w-6 h-6 text-slate-300" />
              </div>
              <h3 className="text-sm font-medium text-slate-100 mb-1">Saldo Bancario Actual</h3>
              <p className="text-4xl font-bold text-white">{formatCurrency(metrics.saldoActual)}</p>
              <div className="mt-2 text-sm text-slate-200">
                Proyectado: {formatCurrency(metrics.saldoProyectado)}
              </div>
            </div>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Gráfico de Ingresos vs Egresos */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
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
          <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 mb-8 border border-white/30">
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
        <div className="bg-slate-800/40 backdrop-blur-md rounded-xl shadow-xl p-6 border border-white/30">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-400" />
            Detalle por Período
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/30">
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
