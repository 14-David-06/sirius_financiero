'use client';

import { useState } from 'react';
import type { ResumenCliente } from '@/lib/cartera/analisis';
import { formatoCOP, formatoCOPCorto } from '@/lib/cartera/formato';
import { COLORES, TARJETA, plural } from './estilos';

const VISIBLES = 8;

export default function SaldoPorCliente({
  clientes,
  seleccionado,
  onSeleccionar,
}: {
  clientes: ResumenCliente[];
  seleccionado: string;
  onSeleccionar: (cliente: string) => void;
}) {
  const [enfocado, setEnfocado] = useState<string | null>(null);
  const visibles = clientes.slice(0, VISIBLES);
  const maximo = visibles[0]?.saldo || 1;

  return (
    <div className={`${TARJETA} h-full p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-50">Clientes con mayor saldo</h2>
          <p className="mt-1 text-sm text-slate-400">Clic en un cliente para ver solo sus facturas.</p>
        </div>
        <ul className="flex gap-4 text-xs text-slate-300">
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES.vencida }} aria-hidden="true" />
            Vencida
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORES.porVencer }} aria-hidden="true" />
            Por vencer
          </li>
        </ul>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400">No hay clientes con saldo pendiente para los filtros actuales.</p>
      ) : (
        <ol className="mt-4 space-y-0.5">
          {visibles.map(c => (
            <li key={c.clave} className="relative">
              <button
                type="button"
                onClick={() => onSeleccionar(c.cliente)}
                onMouseEnter={() => setEnfocado(c.clave)}
                onMouseLeave={() => setEnfocado(null)}
                onFocus={() => setEnfocado(c.clave)}
                onBlur={() => setEnfocado(null)}
                aria-pressed={seleccionado === c.cliente}
                aria-label={`${c.cliente}: saldo ${formatoCOP(c.saldo)}, vencida ${formatoCOP(c.vencida)}, por vencer ${formatoCOP(c.porVencer)}`}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] ${
                  seleccionado === c.cliente ? 'bg-white/10' : ''
                }`}
              >
                <span className="col-start-1 row-start-1 truncate text-sm text-slate-200">{c.cliente}</span>
                <span className="col-start-2 row-start-1 text-right text-sm font-semibold text-slate-50 sm:col-start-3">
                  {formatoCOPCorto(c.saldo)}
                </span>
                <span
                  className="col-span-2 col-start-1 row-start-2 flex h-3 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                  aria-hidden="true"
                >
                  <span className="flex h-full gap-0.5" style={{ width: `${(c.saldo / maximo) * 100}%` }}>
                    {c.vencida > 0 && (
                      <span
                        className="h-full last:rounded-r"
                        style={{ flex: `${c.vencida} 1 0`, backgroundColor: COLORES.vencida }}
                      />
                    )}
                    {c.porVencer > 0 && (
                      <span
                        className="h-full last:rounded-r"
                        style={{ flex: `${c.porVencer} 1 0`, backgroundColor: COLORES.porVencer }}
                      />
                    )}
                  </span>
                </span>
              </button>

              {enfocado === c.clave && (
                <div className="pointer-events-none absolute right-2 top-full z-20 -mt-1 w-64 rounded-lg border border-white/15 bg-slate-950/95 px-3 py-2 shadow-xl">
                  <p className="text-sm font-semibold text-slate-50">{formatoCOP(c.saldo)}</p>
                  <p className="text-xs text-slate-400">
                    {c.cliente}
                    {c.nit && ` · NIT ${c.nit}`}
                  </p>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-slate-400">
                        <span className="h-0.5 w-3 rounded" style={{ backgroundColor: COLORES.vencida }} />
                        Vencida
                      </dt>
                      <dd className="font-medium text-slate-100">{formatoCOP(c.vencida)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-slate-400">
                        <span className="h-0.5 w-3 rounded" style={{ backgroundColor: COLORES.porVencer }} />
                        Por vencer
                      </dt>
                      <dd className="font-medium text-slate-100">{formatoCOP(c.porVencer)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-400">
                    {plural(c.facturasPendientes, 'factura pendiente', 'facturas pendientes')}
                    {c.diasMaxVencida > 0 && ` · hasta ${c.diasMaxVencida} días de mora`}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {clientes.length > VISIBLES && (
        <p className="mt-3 px-2 text-xs text-slate-400">
          y {plural(clientes.length - VISIBLES, 'cliente más', 'clientes más')} en la pestaña Clientes de la tabla
        </p>
      )}
    </div>
  );
}
