'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Droplets,
  FileChartColumn,
  Info,
  RotateCcw,
  Sprout,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import type { InformeSimulacion, SemanaProyectada } from '@/lib/simulador/proyeccion';

export interface MetadataSimulacion {
  tipo_simulacion: 'normal' | 'prioridad';
  duracionSegundos: number;
  timestamp: string;
}

interface Props {
  informe: InformeSimulacion;
  metadata: MetadataSimulacion;
  onNuevaSimulacion: () => void;
}

interface PuntoGrafica extends SemanaProyectada {
  etiqueta: string;
}

const POSITIVO = '#34d399';
const NEGATIVO = '#f87171';
const SUPERFICIE = '#0f172a';

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const pesosConSigno = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});
const pesosCompactos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const cantidad = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const etiquetaSemana = (s: SemanaProyectada) => `S${s.semana}`;
const colorValor = (valor: number) => (valor < 0 ? 'text-red-300' : 'text-white');

function TooltipSemana({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: PuntoGrafica }>;
}) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="bg-slate-900/95 border border-white/20 rounded-xl px-4 py-3 shadow-2xl text-sm">
      <p className="text-white font-semibold mb-2">
        Semana {s.semana}
        {s.mes && <span className="text-white/60 font-normal"> · {s.mes}</span>}
      </p>
      <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1">
        <dt className="text-white/60">Saldo inicio</dt>
        <dd className={`text-right tabular-nums ${colorValor(s.saldoInicio)}`}>{pesos.format(s.saldoInicio)}</dd>
        <dt className="text-white/60">Neto semanal</dt>
        <dd className={`text-right tabular-nums ${colorValor(s.neto)}`}>{pesosConSigno.format(s.neto)}</dd>
        <dt className="text-white/60">Saldo final</dt>
        <dd className={`text-right tabular-nums font-semibold ${colorValor(s.saldoFinal)}`}>
          {pesos.format(s.saldoFinal)}
        </dd>
      </dl>
    </div>
  );
}

const TONOS = {
  neutral: { borde: 'border-l-blue-400', icono: 'text-blue-300' },
  positivo: { borde: 'border-l-emerald-400', icono: 'text-emerald-300' },
  negativo: { borde: 'border-l-red-400', icono: 'text-red-300' },
};

function TarjetaSemana({
  titulo,
  icono: Icono,
  tono,
  semana,
  mensajeVacio,
}: {
  titulo: string;
  icono: React.ComponentType<{ className?: string }>;
  tono: keyof typeof TONOS;
  semana: SemanaProyectada | null;
  mensajeVacio: string;
}) {
  const estilo = TONOS[tono];
  return (
    <div className={`bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-white/20 border-l-4 ${estilo.borde} shadow-xl`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
          <Icono className={`w-4 h-4 ${estilo.icono}`} />
          {titulo}
        </span>
        {semana && (
          <span className="text-xs text-white/60">
            Semana <span className="text-white font-semibold">{semana.semana}</span>
            {semana.mes && ` · ${semana.mes}`}
          </span>
        )}
      </div>

      {semana ? (
        <>
          <p className="text-white/60 text-xs">Saldo final</p>
          <p className={`text-2xl font-bold ${colorValor(semana.saldoFinal)}`}>{pesos.format(semana.saldoFinal)}</p>
          <dl className="mt-4 pt-3 border-t border-white/10 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-white/60">Saldo inicio</dt>
              <dd className={`tabular-nums ${colorValor(semana.saldoInicio)}`}>{pesos.format(semana.saldoInicio)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/60">Neto semanal</dt>
              <dd className={`tabular-nums ${colorValor(semana.neto)}`}>{pesosConSigno.format(semana.neto)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="text-white/70 text-sm">{mensajeVacio}</p>
      )}
    </div>
  );
}

export default function InformeSimulador({ informe, metadata, onNuevaSimulacion }: Props) {
  const { semanaActual, semanaPositiva, semanaNegativa, proyeccion } = informe;

  const datos: PuntoGrafica[] = proyeccion.map((s) => ({ ...s, etiqueta: etiquetaSemana(s) }));
  const saldos = datos.map((d) => d.saldoFinal);
  const maximo = Math.max(...saldos);
  const minimo = Math.min(...saldos);
  // Punto del degradado donde el saldo cruza cero (proporción desde arriba del trazo)
  const corte = maximo <= 0 ? 0 : minimo >= 0 ? 1 : maximo / (maximo - minimo);

  const primeraEnNegativo = proyeccion.find((s) => s.saldoFinal < 0) ?? null;
  const ultima = proyeccion[proyeccion.length - 1];
  const hayRecomendacion =
    semanaNegativa !== null && (informe.litrosParaEvitarNegativo > 0 || informe.kilosParaEvitarNegativo > 0);

  const fecha = new Date(metadata.timestamp).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileChartColumn className="w-6 h-6" />
              Informe de simulación
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {fecha} · procesado en {metadata.duracionSegundos.toLocaleString('es-CO')} s
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-3 py-1 rounded-full text-xs bg-white/10 border border-white/20 text-white/90">
                {metadata.tipo_simulacion === 'normal' ? 'Simulación normal' : 'Con prioridades'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs bg-white/10 border border-white/20 text-white/90">
                {informe.incluirIngresos === 'con_ingresos' ? 'Con ingresos' : 'Sin ingresos'}
              </span>
              {informe.prioridades.length > 0 && (
                <span className="px-3 py-1 rounded-full text-xs bg-white/10 border border-white/20 text-white/90">
                  Prioridades: {informe.prioridades.join(', ')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onNuevaSimulacion}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-700/90 hover:to-purple-700/90 text-white font-semibold transition-all shadow-lg shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Nueva simulación
          </button>
        </div>
      </div>

      {/* Veredicto */}
      {proyeccion.length === 0 ? (
        <div className="flex items-start gap-3 p-5 rounded-2xl border bg-blue-500/20 border-blue-400/30">
          <Info className="w-6 h-6 text-blue-300 shrink-0" />
          <p className="text-white">No hay semanas registradas para proyectar.</p>
        </div>
      ) : primeraEnNegativo ? (
        <div className="flex items-start gap-3 p-5 rounded-2xl border bg-red-500/20 border-red-400/40">
          <TriangleAlert className="w-6 h-6 text-red-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-semibold text-white">
              La caja se agota en la semana {primeraEnNegativo.semana}
            </p>
            <p className="text-white/80 text-sm mt-1">
              Es la primera semana de la proyección que cierra con saldo negativo:{' '}
              <span className="font-semibold text-red-200">{pesos.format(primeraEnNegativo.saldoFinal)}</span>.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-5 rounded-2xl border bg-emerald-500/20 border-emerald-400/40">
          <CircleCheck className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-semibold text-white">La caja se mantiene positiva en toda la proyección</p>
            <p className="text-white/80 text-sm mt-1">
              Al cierre de la semana {ultima.semana} el saldo proyectado es{' '}
              <span className="font-semibold text-emerald-200">{pesos.format(ultima.saldoFinal)}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Semanas clave */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TarjetaSemana
          titulo="Semana actual"
          icono={CalendarDays}
          tono="neutral"
          semana={semanaActual}
          mensajeVacio="No se encontró una semana con saldo bancario registrado."
        />
        <TarjetaSemana
          titulo="Alcanza hasta"
          icono={TrendingUp}
          tono="positivo"
          semana={semanaPositiva}
          mensajeVacio="Ninguna semana proyectada cierra con saldo positivo."
        />
        <TarjetaSemana
          titulo="Sin dinero"
          icono={TrendingDown}
          tono="negativo"
          semana={semanaNegativa}
          mensajeVacio="Ninguna semana pasa de saldo positivo a negativo."
        />
      </div>

      {/* Gráfica */}
      {datos.length >= 2 && (
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
          <h3 className="text-lg font-semibold text-white">Saldo final proyectado por semana</h3>
          <p className="text-white/60 text-sm mb-4">
            Por encima de la línea de cero hay caja disponible; por debajo, faltante.
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={datos} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="saldo-linea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={corte} stopColor={POSITIVO} />
                  <stop offset={corte} stopColor={NEGATIVO} />
                </linearGradient>
                <linearGradient id="saldo-relleno" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor={POSITIVO} stopOpacity={0.3} />
                  <stop offset={corte} stopColor={POSITIVO} stopOpacity={0.04} />
                  <stop offset={corte} stopColor={NEGATIVO} stopOpacity={0.04} />
                  <stop offset={1} stopColor={NEGATIVO} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="etiqueta"
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tickFormatter={(v: number) => pesosCompactos.format(v)}
                tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={84}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.45)" />
              <Tooltip content={<TooltipSemana />} cursor={{ stroke: 'rgba(255,255,255,0.3)' }} />
              <Area
                type="monotone"
                dataKey="saldoFinal"
                stroke="url(#saldo-linea)"
                strokeWidth={2}
                fill="url(#saldo-relleno)"
                dot={false}
                activeDot={{ r: 5, stroke: SUPERFICIE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {semanaPositiva && (
                <ReferenceDot
                  x={etiquetaSemana(semanaPositiva)}
                  y={semanaPositiva.saldoFinal}
                  r={5}
                  fill={POSITIVO}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                  label={{ value: 'Alcanza', position: 'top', fill: 'rgba(255,255,255,0.85)', fontSize: 11 }}
                />
              )}
              {semanaNegativa && (
                <ReferenceDot
                  x={etiquetaSemana(semanaNegativa)}
                  y={semanaNegativa.saldoFinal}
                  r={5}
                  fill={NEGATIVO}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                  label={{ value: 'Sin dinero', position: 'bottom', fill: 'rgba(255,255,255,0.85)', fontSize: 11 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recomendación */}
      {hayRecomendacion && semanaNegativa && (
        <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
          <h3 className="text-lg font-semibold text-white">Para no cerrar la semana {semanaNegativa.semana} en negativo</h3>
          <p className="text-white/60 text-sm mb-4">Habría que vender cualquiera de estas cantidades:</p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/15">
              <Droplets className="w-8 h-8 text-sky-300 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {cantidad.format(Math.ceil(informe.litrosParaEvitarNegativo))} L
                </p>
                <p className="text-white/60 text-sm">de biológicos</p>
              </div>
            </div>
            <span className="text-center text-white/50 text-sm font-medium">o</span>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/15">
              <Sprout className="w-8 h-8 text-lime-300 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {cantidad.format(Math.ceil(informe.kilosParaEvitarNegativo))} kg
                </p>
                <p className="text-white/60 text-sm">de biochar</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nota técnica */}
      {informe.notaTecnica && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/10 border border-white/15">
          <Info className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
          <p className="text-white/75 text-sm">{informe.notaTecnica}</p>
        </div>
      )}

      {/* Detalle semana a semana */}
      {proyeccion.length > 0 && (
        <details className="group bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-6 py-4 flex items-center justify-between text-white font-semibold">
            Detalle semana a semana ({proyeccion.length})
            <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60 text-left border-b border-white/15">
                  <th className="py-2 px-2 font-medium">Semana</th>
                  <th className="py-2 px-2 font-medium">Mes</th>
                  <th className="py-2 px-2 font-medium text-right">Saldo inicio</th>
                  <th className="py-2 px-2 font-medium text-right">Neto</th>
                  <th className="py-2 px-2 font-medium text-right">Saldo final</th>
                </tr>
              </thead>
              <tbody>
                {proyeccion.map((s) => {
                  const marca =
                    s.id === semanaActual?.id
                      ? { texto: 'Actual', clase: 'bg-blue-500/25 text-blue-200' }
                      : s.id === semanaNegativa?.id
                        ? { texto: 'Sin dinero', clase: 'bg-red-500/25 text-red-200' }
                        : s.id === semanaPositiva?.id
                          ? { texto: 'Alcanza', clase: 'bg-emerald-500/25 text-emerald-200' }
                          : null;
                  return (
                    <tr key={s.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2 px-2 text-white whitespace-nowrap">
                        {s.semana}
                        {marca && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] ${marca.clase}`}>{marca.texto}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-white/70">{s.mes || '—'}</td>
                      <td className={`py-2 px-2 text-right tabular-nums whitespace-nowrap ${colorValor(s.saldoInicio)}`}>
                        {pesos.format(s.saldoInicio)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums whitespace-nowrap ${colorValor(s.neto)}`}>
                        {pesosConSigno.format(s.neto)}
                      </td>
                      <td className={`py-2 px-2 text-right tabular-nums whitespace-nowrap font-medium ${colorValor(s.saldoFinal)}`}>
                        {pesos.format(s.saldoFinal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
