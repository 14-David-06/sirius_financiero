'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, Download, RefreshCw, Search, X } from 'lucide-react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import type { CarteraRecord, EstadoFactura } from '@/types/cartera';
import {
  agruparPorAntiguedad,
  agruparPorCliente,
  analizarFacturas,
  calcularResumen,
  hoyBogota,
  RANGOS_ANTIGUEDAD,
  serieMensual,
  type FacturaAnalizada,
  type RangoAntiguedad,
} from '@/lib/cartera/analisis';
import IndicadoresCartera from './cartera/IndicadoresCartera';
import GraficoAntiguedad from './cartera/GraficoAntiguedad';
import SaldoPorCliente from './cartera/SaldoPorCliente';
import GraficoRecaudo from './cartera/GraficoRecaudo';
import TablaCartera from './cartera/TablaCartera';
import ModalInforme from './cartera/ModalInforme';
import { TARJETA } from './cartera/estilos';

type FiltroRango = '' | 'vencida' | 'mas-90' | RangoAntiguedad;

const ESTADOS: EstadoFactura[] = ['Sin Pagar', 'Parcial', 'Pendiente', 'Pagada'];
const FONDO = { backgroundImage: 'url(/18032025-DSC_2933.jpg)' };
const CAMPO =
  'w-full rounded-lg border border-white/15 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800';

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function cumpleRango(rango: FiltroRango, id: RangoAntiguedad): boolean {
  if (!rango) return true;
  if (rango === 'vencida') return id !== 'por-vencer';
  if (rango === 'mas-90') return id === '91-180' || id === 'mas-180';
  return rango === id;
}

const facturaEnRango = (f: FacturaAnalizada, rango: FiltroRango) =>
  !rango || (f.saldoPendiente > 0 && cumpleRango(rango, f.rango));

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cover bg-fixed bg-center bg-no-repeat" style={FONDO}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 mx-4 max-w-md rounded-3xl border border-white/30 bg-white/25 p-8 shadow-2xl backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}

export default function MonitoreoCartera() {
  const { isAuthenticated, isLoading: authLoading } = useAuthSession();

  const [registros, setRegistros] = useState<CarteraRecord[]>([]);
  const [hoy, setHoy] = useState(hoyBogota);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoFactura | ''>('');
  const [rango, setRango] = useState<FiltroRango>('');
  const [mostrarInforme, setMostrarInforme] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/cartera', { cache: 'no-store' });
      const resultado = await respuesta.json();
      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || `Error ${respuesta.status}`);
      }
      setRegistros(resultado.data);
      setHoy(hoyBogota());
      setActualizado(new Date());
    } catch (e) {
      console.error('Error al cargar cartera:', e);
      setError(e instanceof Error ? e.message : 'No se pudo cargar la cartera');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) cargar();
  }, [isAuthenticated, cargar]);

  const facturas = useMemo(() => analizarFacturas(registros, hoy), [registros, hoy]);

  // El gráfico de antigüedad se calcula sin el filtro de antigüedad para poder resaltar la selección
  const sinFiltroRango = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return facturas.filter(
      f =>
        (!estado || f.estadoFactura === estado) &&
        (!termino || normalizar(`${f.cliente} ${f.facturaNo} ${f.clienteNIT}`).includes(termino))
    );
  }, [facturas, busqueda, estado]);

  const filtradas = useMemo(() => sinFiltroRango.filter(f => facturaEnRango(f, rango)), [sinFiltroRango, rango]);
  const resumen = useMemo(() => calcularResumen(filtradas, hoy), [filtradas, hoy]);
  const antiguedad = useMemo(() => agruparPorAntiguedad(sinFiltroRango), [sinFiltroRango]);
  const clientes = useMemo(() => agruparPorCliente(filtradas), [filtradas]);
  const serie = useMemo(() => serieMensual(filtradas, hoy), [filtradas, hoy]);

  const hayFiltros = Boolean(busqueda || estado || rango);
  const limpiarFiltros = () => {
    setBusqueda('');
    setEstado('');
    setRango('');
  };

  if (authLoading) {
    return (
      <Pantalla>
        <div className="flex items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-white" />
          <span className="text-lg font-semibold text-white">Cargando...</span>
        </div>
      </Pantalla>
    );
  }

  if (!isAuthenticated) {
    return (
      <Pantalla>
        <CircleAlert className="mx-auto mb-4 h-16 w-16 text-red-400" />
        <h2 className="mb-2 text-center text-2xl font-bold text-white">Acceso restringido</h2>
        <p className="text-center text-white/80">Debes iniciar sesión para acceder al módulo de cartera.</p>
      </Pantalla>
    );
  }

  return (
    <div className="relative min-h-screen bg-cover bg-fixed bg-center bg-no-repeat" style={FONDO}>
      <div className="absolute inset-0 bg-slate-950/40" />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6">
        <header className={`${TARJETA} mb-4 flex flex-wrap items-center justify-between gap-4 p-6`}>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Cartera · Cuentas por cobrar</h1>
            <p className="mt-1 text-sm text-slate-400">
              Saldos calculados con la conciliación de pagos bancarios
              {actualizado &&
                ` · Actualizado ${actualizado.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-800/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700/70 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setMostrarInforme(true)}
              disabled={facturas.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Informe de cartera
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-400/40 bg-red-950/70 p-4 text-sm text-red-100 backdrop-blur-md">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div>
              <p className="font-medium">No se pudo cargar la cartera</p>
              <p className="text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        <div className={`${TARJETA} mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-end`}>
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Cliente, NIT o número de factura"
                className={`${CAMPO} pl-9 placeholder:text-slate-500`}
              />
            </span>
          </label>
          <label className="md:w-48">
            <span className="mb-1 block text-xs font-medium text-slate-400">Estado</span>
            <select value={estado} onChange={e => setEstado(e.target.value as EstadoFactura | '')} className={CAMPO}>
              <option value="">Todos los estados</option>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </label>
          <label className="md:w-60">
            <span className="mb-1 block text-xs font-medium text-slate-400">Antigüedad</span>
            <select value={rango} onChange={e => setRango(e.target.value as FiltroRango)} className={CAMPO}>
              <option value="">Toda la cartera</option>
              <option value="vencida">Solo vencida</option>
              <option value="mas-90">Vencida más de 90 días</option>
              {RANGOS_ANTIGUEDAD.map(r => (
                <option key={r.id} value={r.id}>{r.etiqueta}</option>
              ))}
            </select>
          </label>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-slate-50"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          )}
        </div>

        {cargando && registros.length === 0 ? (
          <div className={`${TARJETA} flex items-center justify-center gap-3 p-16 text-slate-300`}>
            <RefreshCw className="h-6 w-6 animate-spin" />
            Cargando cartera...
          </div>
        ) : (
          registros.length > 0 && (
            <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
              <IndicadoresCartera resumen={resumen} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <GraficoAntiguedad
                    datos={antiguedad}
                    esActivo={id => cumpleRango(rango, id)}
                    onSeleccionar={id => setRango(actual => (actual === id ? '' : id))}
                  />
                </div>
                <div className="lg:col-span-3">
                  <SaldoPorCliente
                    clientes={clientes}
                    seleccionado={busqueda}
                    onSeleccionar={cliente => setBusqueda(actual => (actual === cliente ? '' : cliente))}
                  />
                </div>
              </div>
              <GraficoRecaudo serie={serie} />
              <TablaCartera facturas={filtradas} clientes={clientes} onSeleccionarCliente={setBusqueda} />
            </div>
          )
        )}
      </main>

      {mostrarInforme && <ModalInforme facturas={facturas} hoy={hoy} onCerrar={() => setMostrarInforme(false)} />}
    </div>
  );
}
