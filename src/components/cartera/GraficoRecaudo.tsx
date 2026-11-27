'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoMensual } from '@/lib/cartera/analisis';
import { formatoCOP, formatoCOPCorto, formatoPorcentaje } from '@/lib/cartera/formato';
import { COLORES, TARJETA } from './estilos';

function TooltipRecaudo({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  const punto = payload?.[0]?.payload as PuntoMensual | undefined;
  if (!active || !punto) return null;
  return (
    <div className="min-w-52 rounded-lg border border-white/15 bg-slate-950/95 px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-slate-400">{punto.etiqueta}</p>
      <dl className="mt-1.5 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-0.5 w-3 rounded" style={{ backgroundColor: COLORES.recaudado }} />
            Recaudado
          </dt>
          <dd className="text-sm font-semibold text-slate-50">{formatoCOP(punto.recaudado)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="h-0.5 w-3 rounded" style={{ backgroundColor: COLORES.facturado }} />
            Facturado
          </dt>
          <dd className="text-sm font-semibold text-slate-50">{formatoCOP(punto.facturado)}</dd>
        </div>
      </dl>
      {punto.facturado > 0 && (
        <p className="mt-1.5 border-t border-white/10 pt-1.5 text-xs text-slate-400">
          Recaudo equivale al {formatoPorcentaje((punto.recaudado / punto.facturado) * 100)} de lo facturado
        </p>
      )}
    </div>
  );
}

export default function GraficoRecaudo({ serie }: { serie: PuntoMensual[] }) {
  const facturado = serie.reduce((s, p) => s + p.facturado, 0);
  const recaudado = serie.reduce((s, p) => s + p.recaudado, 0);

  return (
    <div className={`${TARJETA} p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-50">Facturado y recaudado por mes</h2>
          <p className="mt-1 text-sm text-slate-400">
            Últimos 12 meses: {formatoCOPCorto(facturado)} facturados, {formatoCOPCorto(recaudado)} recaudados.
            Facturado por fecha de emisión; recaudado por fecha del pago.
          </p>
        </div>
        <ul className="flex gap-4 text-xs text-slate-300">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES.facturado }} aria-hidden="true" />
            Facturado
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES.recaudado }} aria-hidden="true" />
            Recaudado
          </li>
        </ul>
      </div>

      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={serie} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={COLORES.grilla} />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={{ stroke: COLORES.eje }}
              tick={{ fill: COLORES.textoSecundario, fontSize: 11 }}
              minTickGap={4}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tick={{ fill: COLORES.textoSecundario, fontSize: 11 }}
              tickFormatter={(valor: number) => formatoCOPCorto(valor)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
              content={props => <TooltipRecaudo active={props.active} payload={props.payload} />}
            />
            <Bar dataKey="facturado" name="Facturado" fill={COLORES.facturado} maxBarSize={20} radius={[4, 4, 0, 0]} />
            <Bar dataKey="recaudado" name="Recaudado" fill={COLORES.recaudado} maxBarSize={20} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-slate-300 hover:text-slate-100">Ver datos del gráfico</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-right tabular-nums">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="py-1.5 text-left font-medium">Mes</th>
                <th className="py-1.5 font-medium">Facturado</th>
                <th className="py-1.5 font-medium">Recaudado</th>
                <th className="py-1.5 font-medium">Recaudo / facturado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {serie.map(p => (
                <tr key={p.mes}>
                  <td className="py-1.5 text-left">{p.etiqueta}</td>
                  <td className="py-1.5">{formatoCOP(p.facturado)}</td>
                  <td className="py-1.5">{formatoCOP(p.recaudado)}</td>
                  <td className="py-1.5">{p.facturado > 0 ? formatoPorcentaje((p.recaudado / p.facturado) * 100) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
