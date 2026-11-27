'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { MovimientoBancario } from '@/types/movimientos-bancarios';
import { formatoCOP, formatoFecha } from '@/lib/cartera/formato';
import { ESTILO_SOPORTE, colorMonto, montoConSigno } from './formato';

export default function DetalleMovimiento({
  movimiento,
  banco,
  onCerrar,
}: {
  movimiento: MovimientoBancario;
  banco: string;
  onCerrar: () => void;
}) {
  const cerrar = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onCerrar);
  alCerrar.current = onCerrar;

  useEffect(() => {
    cerrar.current?.focus();
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar.current();
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle"
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {banco} · {formatoFecha(movimiento.fecha)}
            </p>
            <h2 id="titulo-detalle" className="mt-1 text-lg font-semibold text-slate-50">
              {movimiento.descripcion}
            </h2>
            {movimiento.detalle && <p className="mt-0.5 text-sm text-slate-400">{movimiento.detalle}</p>}
          </div>
          <button
            ref={cerrar}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-slate-800/60 p-4">
          <p className="text-sm text-slate-400">{movimiento.valor >= 0 ? 'Entrada' : 'Salida'}</p>
          <p className={`text-3xl font-semibold ${colorMonto(movimiento.valor)}`}>{montoConSigno(movimiento.valor)}</p>
          {movimiento.saldo !== null && (
            <p className="mt-2 text-sm text-slate-400">
              Saldo de la cuenta:{' '}
              {movimiento.saldoAnterior !== null && <>{formatoCOP(movimiento.saldoAnterior)} → </>}
              <span className="text-slate-200">{formatoCOP(movimiento.saldo)}</span>
            </p>
          )}
          {movimiento.soporte && (
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ESTILO_SOPORTE[movimiento.soporte.tono]}`}
            >
              {movimiento.soporte.texto}
            </span>
          )}
        </div>

        {movimiento.datos.length > 0 && (
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {movimiento.datos.map(({ etiqueta, valor }) => (
              <div key={etiqueta}>
                <dt className="text-slate-400">{etiqueta}</dt>
                <dd className="text-slate-100">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
