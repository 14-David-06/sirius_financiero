'use client';

import React from 'react';
import {
  CalendarRange,
  Check,
  CircleAlert,
  Database,
  ListFilter,
  LoaderCircle,
  Play,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';

export type Prioridad = 'Alta' | 'Media' | 'Baja';

export interface SimulacionConfig {
  tipo: 'normal' | 'prioridad';
  incluirIngresos: 'con_ingresos' | 'sin_ingresos' | '';
  prioridadesSeleccionadas: Prioridad[];
}

interface Props {
  config: SimulacionConfig;
  onChange: (config: SimulacionConfig) => void;
  enviando: boolean;
  segundos: number;
  error: string | null;
  onSimular: () => void;
}

const PRIORIDADES: { valor: Prioridad; punto: string }[] = [
  { valor: 'Alta', punto: 'bg-red-400' },
  { valor: 'Media', punto: 'bg-amber-400' },
  { valor: 'Baja', punto: 'bg-emerald-400' },
];

function resumenConfig(c: SimulacionConfig): string {
  if (c.tipo === 'normal') return 'Simulación normal · todas las semanas futuras';
  const partes = ['Con prioridades'];
  if (c.incluirIngresos) partes.push(c.incluirIngresos === 'con_ingresos' ? 'con ingresos' : 'sin ingresos');
  if (c.prioridadesSeleccionadas.length > 0) partes.push(c.prioridadesSeleccionadas.join(', '));
  return partes.join(' · ');
}

function faltante(c: SimulacionConfig): string | null {
  if (c.tipo === 'normal') return null;
  const sinIngresos = c.incluirIngresos === '';
  const sinPrioridades = c.prioridadesSeleccionadas.length === 0;
  if (sinIngresos && sinPrioridades) return 'Elige si incluir los ingresos y al menos una prioridad.';
  if (sinIngresos) return 'Elige si incluir los ingresos.';
  if (sinPrioridades) return 'Elige al menos una prioridad.';
  return null;
}

const formatoTiempo = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Paso({ numero, titulo, descripcion }: { numero: number; titulo: string; descripcion?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 border border-white/25 text-white text-sm font-semibold shrink-0">
        {numero}
      </span>
      <div>
        <h2 className="text-white font-semibold leading-7">{titulo}</h2>
        {descripcion && <p className="text-white/60 text-sm">{descripcion}</p>}
      </div>
    </div>
  );
}

function Opcion({
  activo,
  onClick,
  icono: Icono,
  titulo,
  descripcion,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ComponentType<{ className?: string }>;
  titulo: string;
  descripcion: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={`relative w-full text-left p-5 rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
        activo
          ? 'bg-white/20 border-blue-300/60 ring-2 ring-blue-400/40'
          : 'bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/30'
      }`}
    >
      <span
        className={`absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full border ${
          activo ? 'bg-blue-500 border-blue-400' : 'border-white/30'
        }`}
      >
        {activo && <Check className="w-3 h-3 text-white" />}
      </span>
      <span
        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${
          activo ? 'bg-blue-500/30 text-blue-100' : 'bg-white/10 text-white/80'
        }`}
      >
        <Icono className="w-5 h-5" />
      </span>
      <span className="block font-semibold text-white pr-6">{titulo}</span>
      <span className="block text-sm text-white/65 mt-1">{descripcion}</span>
    </button>
  );
}

function PanelProcesando({ segundos, resumen }: { segundos: number; resumen: string }) {
  return (
    <div
      className="bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="w-12 h-12 text-blue-200 animate-spin mx-auto" />
      <h2 className="mt-5 text-xl font-semibold text-white">Simulando la proyección…</h2>
      <p className="mt-2 text-white/70 text-sm max-w-md mx-auto">
        Se están recalculando los saldos semana a semana en Airtable. Suele tardar menos de un minuto; no cierres
        esta página.
      </p>
      <p className="mt-6 text-3xl font-bold text-white tabular-nums">{formatoTiempo(segundos)}</p>
      <p className="text-white/50 text-xs">tiempo transcurrido</p>
      <p className="mt-6 inline-block px-3 py-1 rounded-full text-xs bg-white/10 border border-white/20 text-white/80">
        {resumen}
      </p>
    </div>
  );
}

export default function ConfiguracionSimulacion({ config, onChange, enviando, segundos, error, onSimular }: Props) {
  const resumen = resumenConfig(config);

  if (enviando) return <PanelProcesando segundos={segundos} resumen={resumen} />;

  const pendiente = faltante(config);
  const togglePrioridad = (p: Prioridad) => {
    const activa = config.prioridadesSeleccionadas.includes(p);
    onChange({
      ...config,
      prioridadesSeleccionadas: PRIORIDADES.map((x) => x.valor).filter((x) =>
        x === p ? !activa : config.prioridadesSeleccionadas.includes(x)
      ),
    });
  };

  return (
    <div className="bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
      {error && (
        <div className="mx-6 mt-6 md:mx-8 md:mt-8 flex items-start gap-3 p-4 rounded-xl bg-red-500/20 border border-red-400/40">
          <CircleAlert className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-white">No se pudo completar la simulación</p>
            <p className="text-sm text-red-100/90 break-words">{error}</p>
          </div>
        </div>
      )}

      <section className="p-6 md:p-8">
        <Paso numero={1} titulo="Tipo de simulación" />
        <div role="radiogroup" aria-label="Tipo de simulación" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Opcion
            activo={config.tipo === 'normal'}
            onClick={() => onChange({ ...config, tipo: 'normal' })}
            icono={CalendarRange}
            titulo="Simulación normal"
            descripcion="Proyecta todas las semanas futuras con los ingresos y egresos estimados."
          />
          <Opcion
            activo={config.tipo === 'prioridad'}
            onClick={() => onChange({ ...config, tipo: 'prioridad' })}
            icono={SlidersHorizontal}
            titulo="Con prioridades"
            descripcion="Ajusta la semana actual según la prioridad de los egresos y si se cuentan los ingresos."
          />
        </div>
      </section>

      {config.tipo === 'prioridad' && (
        <>
          <section className="px-6 md:px-8 py-6 border-t border-white/10">
            <Paso
              numero={2}
              titulo="Ingresos de la semana actual"
              descripcion="Sin ingresos proyecta un escenario conservador con solo egresos."
            />
            <div role="radiogroup" aria-label="Ingresos" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Opcion
                activo={config.incluirIngresos === 'con_ingresos'}
                onClick={() => onChange({ ...config, incluirIngresos: 'con_ingresos' })}
                icono={Wallet}
                titulo="Con ingresos"
                descripcion="Suma los ingresos proyectados de la semana."
              />
              <Opcion
                activo={config.incluirIngresos === 'sin_ingresos'}
                onClick={() => onChange({ ...config, incluirIngresos: 'sin_ingresos' })}
                icono={ListFilter}
                titulo="Sin ingresos"
                descripcion="Solo descuenta los egresos de la semana."
              />
            </div>
          </section>

          <section className="px-6 md:px-8 py-6 border-t border-white/10">
            <Paso
              numero={3}
              titulo="Prioridades de egresos"
              descripcion="Solo se tienen en cuenta los egresos de la semana actual con estas prioridades."
            />
            <div className="flex flex-wrap gap-3">
              {PRIORIDADES.map(({ valor, punto }) => {
                const activa = config.prioridadesSeleccionadas.includes(valor);
                return (
                  <button
                    key={valor}
                    type="button"
                    role="checkbox"
                    aria-checked={activa}
                    onClick={() => togglePrioridad(valor)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                      activa
                        ? 'bg-white/20 border-white/50 text-white'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${punto}`} />
                    {valor}
                    {activa && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      <footer className="px-6 md:px-8 py-5 border-t border-white/10 bg-black/15 rounded-b-2xl flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {pendiente ? (
            <p className="text-sm text-amber-200 flex items-center gap-2">
              <CircleAlert className="w-4 h-4 shrink-0" />
              {pendiente}
            </p>
          ) : (
            <p className="text-sm text-white font-medium">{resumen}</p>
          )}
          <p className="mt-1 text-xs text-white/55 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 shrink-0" />
            Al iniciar se actualizan los saldos proyectados en Centralización General.
          </p>
        </div>
        <button
          type="button"
          onClick={onSimular}
          disabled={pendiente !== null}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600/90 to-purple-600/90 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg transition-all shrink-0"
        >
          <Play className="w-4 h-4" />
          Iniciar simulación
        </button>
      </footer>
    </div>
  );
}
