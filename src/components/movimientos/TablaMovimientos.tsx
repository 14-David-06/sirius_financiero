'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MovimientoBancario } from '@/types/movimientos-bancarios';
import { formatoCOP, formatoFecha } from '@/lib/cartera/formato';
import { TARJETA, plural } from '@/components/cartera/estilos';
import { ESTILO_SOPORTE, colorMonto, montoConSigno } from './formato';

const POR_PAGINA = 100;

export default function TablaMovimientos({
  movimientos,
  total,
  onSeleccionar,
}: {
  movimientos: MovimientoBancario[];
  /** Movimientos del periodo antes de aplicar filtros */
  total: number;
  onSeleccionar: (movimiento: MovimientoBancario) => void;
}) {
  const [visibles, setVisibles] = useState(POR_PAGINA);
  useEffect(() => setVisibles(POR_PAGINA), [movimientos]);

  const filtrado = movimientos.length !== total;
  const sumas = useMemo(() => {
    let entradas = 0;
    let salidas = 0;
    for (const m of movimientos) {
      if (m.valor > 0) entradas += m.valor;
      else salidas -= m.valor;
    }
    return { entradas, salidas };
  }, [movimientos]);

  return (
    <section aria-label="Movimientos" className={`${TARJETA} overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-5 py-3 text-sm">
        <p className="text-slate-200">
          {filtrado
            ? `${plural(movimientos.length, 'movimiento', 'movimientos')} de ${total.toLocaleString('es-CO')}`
            : plural(movimientos.length, 'movimiento', 'movimientos')}
        </p>
        {filtrado && movimientos.length > 0 && (
          <p className="text-slate-400">
            Entradas <span className="text-emerald-300">{formatoCOP(sumas.entradas)}</span> · Salidas{' '}
            <span className="text-rose-300">{formatoCOP(sumas.salidas)}</span>
          </p>
        )}
      </div>

      {movimientos.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-400">Ningún movimiento coincide con los filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Fecha</th>
                <th scope="col" className="px-4 py-3 font-medium">Movimiento</th>
                <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Tipo de flujo</th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Soporte</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Valor</th>
                <th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {movimientos.slice(0, visibles).map(m => (
                <tr key={m.id} onClick={() => onSeleccionar(m)} className="cursor-pointer hover:bg-white/5">
                  <td className="hidden whitespace-nowrap px-4 py-3 text-slate-300 sm:table-cell">{formatoFecha(m.fecha)}</td>
                  <td className="max-w-[12rem] px-4 py-3 sm:max-w-xs lg:max-w-md">
                    <p className="text-xs text-slate-400 sm:hidden">{formatoFecha(m.fecha)}</p>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onSeleccionar(m);
                      }}
                      className="block max-w-full truncate text-left text-slate-100 hover:underline focus:outline-none focus-visible:underline"
                      title={m.descripcion}
                    >
                      {m.descripcion}
                    </button>
                    {(m.detalle || m.centroCostos) && (
                      <p className="truncate text-xs text-slate-400">
                        {[m.detalle, m.centroCostos].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-slate-300 lg:table-cell">{m.tipoFlujo || '—'}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {m.soporte ? (
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${ESTILO_SOPORTE[m.soporte.tono]}`}
                      >
                        {m.soporte.texto}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${colorMonto(m.valor)}`}>
                    {montoConSigno(m.valor)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-400 sm:table-cell">
                    {m.saldo !== null ? formatoCOP(m.saldo) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {movimientos.length > visibles && (
        <div className="border-t border-white/10 p-3 text-center">
          <button
            type="button"
            onClick={() => setVisibles(v => v + POR_PAGINA)}
            className="rounded-lg px-4 py-2 text-sm text-blue-300 hover:bg-white/5"
          >
            Mostrar {Math.min(POR_PAGINA, movimientos.length - visibles)} más ·{' '}
            {(movimientos.length - visibles).toLocaleString('es-CO')} restantes
          </button>
        </div>
      )}
    </section>
  );
}
