'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DatoAntiguedad, RangoAntiguedad } from '@/lib/cartera/analisis';
import { formatoCOP, formatoCOPCorto } from '@/lib/cartera/formato';
import { COLORES, TARJETA, plural } from './estilos';

function TooltipAntiguedad({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  const dato = payload?.[0]?.payload as DatoAntiguedad | undefined;
  if (!active || !dato) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-slate-950/95 px-3 py-2 shadow-xl">
      <p className="text-sm font-semibold text-slate-50">{formatoCOP(dato.monto)}</p>
      <p className="mt-0.5 text-xs text-slate-400">
        {dato.etiqueta} · {plural(dato.facturas, 'factura', 'facturas')}
      </p>
    </div>
  );
}

// Dos líneas ("1–30" / "días") para que las seis etiquetas quepan en pantallas angostas
function EtiquetaEje({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
  const [primera, ...resto] = String(payload?.value ?? '').split(' ');
  return (
    <text x={x} y={y} textAnchor="middle" fill={COLORES.textoSecundario} fontSize={11}>
      <tspan x={x} dy={12}>{primera}</tspan>
      {resto.length > 0 && <tspan x={x} dy={13}>{resto.join(' ')}</tspan>}
    </text>
  );
}

export default function GraficoAntiguedad({
  datos,
  esActivo,
  onSeleccionar,
}: {
  datos: DatoAntiguedad[];
  esActivo: (id: RangoAntiguedad) => boolean;
  onSeleccionar: (id: RangoAntiguedad) => void;
}) {
  return (
    <div className={`${TARJETA} flex h-full flex-col p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-50">Antigüedad de la cartera</h2>
          <p className="mt-1 text-sm text-slate-400">Saldo por días desde el vencimiento. Clic en una barra para filtrar.</p>
        </div>
        <ul className="flex gap-4 text-xs text-slate-300">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES.porVencer }} aria-hidden="true" />
            Por vencer
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES.vencida }} aria-hidden="true" />
            Vencida
          </li>
        </ul>
      </div>

      <div className="mt-4 min-h-64 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 22, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COLORES.grilla} />
            <XAxis
              dataKey="corta"
              interval={0}
              height={36}
              tickLine={false}
              axisLine={{ stroke: COLORES.eje }}
              tick={props => <EtiquetaEje x={props.x} y={props.y} payload={props.payload} />}
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
              content={props => <TooltipAntiguedad active={props.active} payload={props.payload} />}
            />
            <Bar
              dataKey="monto"
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(_, indice) => onSeleccionar(datos[indice].id)}
            >
              {datos.map(dato => (
                <Cell
                  key={dato.id}
                  fill={dato.id === 'por-vencer' ? COLORES.porVencer : COLORES.vencida}
                  fillOpacity={esActivo(dato.id) ? 1 : 0.3}
                />
              ))}
              <LabelList
                dataKey="monto"
                content={({ x, y, width, value }) =>
                  typeof value === 'number' && value > 0 ? (
                    <text
                      x={Number(x) + Number(width) / 2}
                      y={Number(y) - 6}
                      textAnchor="middle"
                      fill={COLORES.etiqueta}
                      fontSize={11}
                    >
                      {formatoCOPCorto(value)}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
