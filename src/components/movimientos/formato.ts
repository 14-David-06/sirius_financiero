import type { TonoSoporte } from '@/types/movimientos-bancarios';
import { formatoCOP } from '@/lib/cartera/formato';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Monto con signo explícito: el color no es la única pista de entrada/salida. */
export const montoConSigno = (valor: number) =>
  valor > 0 ? `+${formatoCOP(valor)}` : valor < 0 ? `−${formatoCOP(-valor)}` : formatoCOP(0);

export const colorMonto = (valor: number) =>
  valor > 0 ? 'text-emerald-300' : valor < 0 ? 'text-rose-300' : 'text-slate-300';

export const ESTILO_SOPORTE: Record<TonoSoporte, string> = {
  ok: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30',
  pendiente: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
  neutro: 'bg-slate-500/20 text-slate-200 ring-slate-400/30',
};
