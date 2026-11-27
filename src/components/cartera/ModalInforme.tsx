'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, RefreshCw, X } from 'lucide-react';
import {
  ALCANCES_INFORME,
  cumpleAlcance,
  type AlcanceInforme,
  type FacturaAnalizada,
} from '@/lib/cartera/analisis';
import { formatoCOPCorto } from '@/lib/cartera/formato';
import { descargarInformeCartera, descargarInformePdf } from '@/lib/cartera/informe';
import { plural } from './estilos';

type Formato = 'pdf' | 'excel';

const FORMATOS: { id: Formato; nombre: string; icono: typeof FileText; descripcion: string }[] = [
  {
    id: 'pdf',
    nombre: 'PDF',
    icono: FileText,
    descripcion:
      'Documento listo para imprimir o enviar: resumen, antigüedad del saldo, resumen por cliente y detalle de facturas por cliente.',
  },
  {
    id: 'excel',
    nombre: 'Excel',
    icono: FileSpreadsheet,
    descripcion:
      'Una hoja por cliente (saldo por antigüedad, días de mora y último pago) y otra con el detalle de cada factura.',
  },
];

export default function ModalInforme({
  facturas,
  hoy,
  onCerrar,
}: {
  facturas: FacturaAnalizada[];
  hoy: string;
  onCerrar: () => void;
}) {
  const [alcance, setAlcance] = useState<AlcanceInforme>('pendiente');
  const [formato, setFormato] = useState<Formato>('pdf');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generando) onCerrar();
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [generando, onCerrar]);

  const opciones = useMemo(
    () =>
      ALCANCES_INFORME.map(opcion => {
        const seleccion = facturas.filter(f => cumpleAlcance(f, opcion.id));
        return {
          ...opcion,
          facturas: seleccion.length,
          clientes: new Set(seleccion.map(f => f.clienteNIT || f.cliente.toUpperCase())).size,
          monto: seleccion.reduce((s, f) => s + f.saldoPendiente, 0),
        };
      }),
    [facturas]
  );
  const elegida = opciones.find(o => o.id === alcance)!;
  const formatoElegido = FORMATOS.find(f => f.id === formato)!;

  const descargar = async () => {
    setGenerando(true);
    setError(null);
    try {
      if (formato === 'pdf') await descargarInformePdf(alcance);
      else await descargarInformeCartera(facturas, hoy, alcance);
      onCerrar();
    } catch (e) {
      console.error('Error al generar informe de cartera:', e);
      setError(`No se pudo generar el informe en ${formatoElegido.nombre}. Intenta de nuevo.`);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => !generando && onCerrar()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-informe-cartera"
        className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div className="flex items-start gap-3">
            <formatoElegido.icono className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
            <div>
              <h2 id="titulo-informe-cartera" className="text-lg font-semibold text-slate-50">
                Informe de clientes con pagos pendientes
              </h2>
              <p className="mt-1 text-sm text-slate-400">{formatoElegido.descripcion}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={generando}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
        <div>
          <p id="formato-informe" className="mb-3 text-sm font-medium text-slate-300">Formato</p>
          <div role="radiogroup" aria-labelledby="formato-informe" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-950/50 p-1">
            {FORMATOS.map(f => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={formato === f.id}
                onClick={() => setFormato(f.id)}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  formato === f.id ? 'bg-white/10 font-medium text-slate-50' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <f.icono className="h-4 w-4" aria-hidden="true" />
                {f.nombre}
              </button>
            ))}
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-3 text-sm font-medium text-slate-300">¿Qué cartera incluir?</legend>
          {opciones.map(opcion => (
            <label
              key={opcion.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                alcance === opcion.id ? 'border-blue-400/60 bg-blue-500/10' : 'border-white/10 hover:bg-white/5'
              }`}
            >
              <input
                type="radio"
                name="alcance-informe"
                value={opcion.id}
                checked={alcance === opcion.id}
                onChange={() => setAlcance(opcion.id)}
                className="mt-1 accent-blue-500"
              />
              <span className="flex-1">
                <span className="block font-medium text-slate-100">{opcion.titulo}</span>
                <span className="block text-sm text-slate-400">{opcion.descripcion}</span>
                <span className="mt-1 block text-sm text-slate-300">
                  {formatoCOPCorto(opcion.monto)} · {plural(opcion.clientes, 'cliente', 'clientes')} ·{' '}
                  {plural(opcion.facturas, 'factura', 'facturas')}
                </span>
              </span>
            </label>
          ))}
          <p className="pt-1 text-xs text-slate-400">El informe incluye toda la cartera, sin los filtros de la pantalla.</p>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </fieldset>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 p-6">
          <button
            type="button"
            onClick={onCerrar}
            disabled={generando}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={descargar}
            disabled={generando || elegida.facturas === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generando ? 'Generando…' : `Descargar ${formatoElegido.nombre}`}
          </button>
        </div>
      </div>
    </div>
  );
}
