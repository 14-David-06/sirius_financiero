'use client';

import React, { useState, useEffect } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  PieChart, 
  BarChart3, 
  AlertCircle, 
  Download,
  RefreshCw,
  Target,
  Percent
} from 'lucide-react';

interface ProyeccionData {
  mes: string;
  ingresos: number;
  gastos: number;
  utilidad: number;
  acumulado: number;
}

interface ScenarioConfig {
  nombre: string;
  crecimientoIngresos: number;
  crecimientoGastos: number;
  color: string;
}

export default function SimuladorProyecciones() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [ingresosIniciales, setIngresosIniciales] = useState<number>(0);
  const [gastosIniciales, setGastosIniciales] = useState<number>(0);
  const [mesesProyeccion, setMesesProyeccion] = useState<number>(12);
  const [crecimientoIngresos, setCrecimientoIngresos] = useState<number>(5);
  const [crecimientoGastos, setCrecimientoGastos] = useState<number>(3);
  const [proyecciones, setProyecciones] = useState<ProyeccionData[]>([]);
  const [scenarioActual, setScenarioActual] = useState<string>('conservador');

  const scenarios: Record<string, ScenarioConfig> = {
    conservador: {
      nombre: 'Conservador',
      crecimientoIngresos: 3,
      crecimientoGastos: 4,
      color: 'bg-blue-500'
    },
    moderado: {
      nombre: 'Moderado',
      crecimientoIngresos: 5,
      crecimientoGastos: 3,
      color: 'bg-green-500'
    },
    optimista: {
      nombre: 'Optimista',
      crecimientoIngresos: 8,
      crecimientoGastos: 2,
      color: 'bg-purple-500'
    }
  };

  useEffect(() => {
    if (ingresosIniciales > 0 || gastosIniciales > 0) {
      calcularProyecciones();
    }
  }, [ingresosIniciales, gastosIniciales, mesesProyeccion, crecimientoIngresos, crecimientoGastos]);

  const calcularProyecciones = () => {
    const datos: ProyeccionData[] = [];
    let acumuladoTotal = 0;

    for (let i = 0; i < mesesProyeccion; i++) {
      const factorCrecimientoIngresos = Math.pow(1 + crecimientoIngresos / 100, i / 12);
      const factorCrecimientoGastos = Math.pow(1 + crecimientoGastos / 100, i / 12);
      
      const ingresosMes = ingresosIniciales * factorCrecimientoIngresos;
      const gastosMes = gastosIniciales * factorCrecimientoGastos;
      const utilidadMes = ingresosMes - gastosMes;
      
      acumuladoTotal += utilidadMes;

      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() + i);
      
      datos.push({
        mes: fecha.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }),
        ingresos: ingresosMes,
        gastos: gastosMes,
        utilidad: utilidadMes,
        acumulado: acumuladoTotal
      });
    }

    setProyecciones(datos);
  };

  const aplicarScenario = (scenario: string) => {
    setScenarioActual(scenario);
    setCrecimientoIngresos(scenarios[scenario].crecimientoIngresos);
    setCrecimientoGastos(scenarios[scenario].crecimientoGastos);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  };

  const getUtilityColor = (utilidad: number) => {
    return utilidad >= 0 ? 'text-green-300' : 'text-red-300';
  };

  const exportarDatos = () => {
    const csvContent = [
      ['Mes', 'Ingresos', 'Gastos', 'Utilidad', 'Acumulado'],
      ...proyecciones.map(p => [
        p.mes,
        p.ingresos.toFixed(2),
        p.gastos.toFixed(2),
        p.utilidad.toFixed(2),
        p.acumulado.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `proyecciones_${scenarioActual}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
            <p className="text-white/80">Debe iniciar sesión para usar el simulador</p>
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
            <div className="flex items-center justify-center mb-4">
              <Calculator className="w-8 h-8 text-white mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                Simulador de Proyecciones
              </h1>
            </div>
            <p className="text-white/80">
              Herramienta para proyecciones financieras y análisis de escenarios
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel de Configuración */}
            <div className="lg:col-span-1">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Configuración
                </h2>

                <div className="space-y-6">
                  {/* Datos Iniciales */}
                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">
                      Ingresos Mensuales Iniciales
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        type="number"
                        value={ingresosIniciales}
                        onChange={(e) => setIngresosIniciales(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">
                      Gastos Mensuales Iniciales
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        type="number"
                        value={gastosIniciales}
                        onChange={(e) => setGastosIniciales(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">
                      Meses a Proyectar
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={mesesProyeccion}
                        onChange={(e) => setMesesProyeccion(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>

                  {/* Escenarios Predefinidos */}
                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-3">
                      Escenarios Predefinidos
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(scenarios).map(([key, scenario]) => (
                        <button
                          key={key}
                          onClick={() => aplicarScenario(key)}
                          className={`p-3 rounded-lg border transition-all duration-200 ${
                            scenarioActual === key
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{scenario.nombre}</span>
                            <div className={`w-3 h-3 rounded-full ${scenario.color}`}></div>
                          </div>
                          <div className="text-xs text-white/70 mt-1">
                            +{scenario.crecimientoIngresos}% ingresos, +{scenario.crecimientoGastos}% gastos
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Configuración Personalizada */}
                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">
                      Crecimiento Anual Ingresos (%)
                    </label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        type="number"
                        step="0.1"
                        value={crecimientoIngresos}
                        onChange={(e) => setCrecimientoIngresos(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/90 text-sm font-medium mb-2">
                      Crecimiento Anual Gastos (%)
                    </label>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
                      <input
                        type="number"
                        step="0.1"
                        value={crecimientoGastos}
                        onChange={(e) => setCrecimientoGastos(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      />
                    </div>
                  </div>

                  <button
                    onClick={exportarDatos}
                    disabled={proyecciones.length === 0}
                    className="w-full bg-gradient-to-r from-green-600/80 to-blue-600/80 hover:from-green-700/90 hover:to-blue-700/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Panel de Resultados */}
            <div className="lg:col-span-2">
              {proyecciones.length > 0 ? (
                <div className="space-y-6">
                  {/* Resumen Ejecutivo */}
                  <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Resumen Ejecutivo
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-300">
                          {formatCurrency(proyecciones[proyecciones.length - 1]?.acumulado || 0)}
                        </div>
                        <div className="text-white/70 text-sm">Utilidad Acumulada</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-300">
                          {formatCurrency(proyecciones[proyecciones.length - 1]?.ingresos || 0)}
                        </div>
                        <div className="text-white/70 text-sm">Ingresos Final</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-300">
                          {formatCurrency(proyecciones[proyecciones.length - 1]?.gastos || 0)}
                        </div>
                        <div className="text-white/70 text-sm">Gastos Final</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${getUtilityColor(proyecciones[proyecciones.length - 1]?.utilidad || 0)}`}>
                          {formatCurrency(proyecciones[proyecciones.length - 1]?.utilidad || 0)}
                        </div>
                        <div className="text-white/70 text-sm">Utilidad Final</div>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Proyecciones */}
                  <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Proyecciones Mensuales
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/20">
                            <th className="text-left py-2 px-3 text-white/90 font-semibold">Mes</th>
                            <th className="text-right py-2 px-3 text-white/90 font-semibold">Ingresos</th>
                            <th className="text-right py-2 px-3 text-white/90 font-semibold">Gastos</th>
                            <th className="text-right py-2 px-3 text-white/90 font-semibold">Utilidad</th>
                            <th className="text-right py-2 px-3 text-white/90 font-semibold">Acumulado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {proyecciones.map((proyeccion, index) => (
                            <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                              <td className="py-2 px-3 text-white/80">{proyeccion.mes}</td>
                              <td className="py-2 px-3 text-right text-green-300 font-medium">
                                {formatCurrency(proyeccion.ingresos)}
                              </td>
                              <td className="py-2 px-3 text-right text-red-300 font-medium">
                                {formatCurrency(proyeccion.gastos)}
                              </td>
                              <td className={`py-2 px-3 text-right font-medium ${getUtilityColor(proyeccion.utilidad)}`}>
                                {formatCurrency(proyeccion.utilidad)}
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${getUtilityColor(proyeccion.acumulado)}`}>
                                {formatCurrency(proyeccion.acumulado)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-12 border border-white/20 shadow-xl text-center">
                  <PieChart className="w-16 h-16 text-white/60 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Configure los Parámetros</h3>
                  <p className="text-white/80">
                    Ingrese los datos iniciales para comenzar a simular las proyecciones financieras
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
