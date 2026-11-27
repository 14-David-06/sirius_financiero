// Mismos tonos de estado que "Mis solicitudes de compra"
export const ESTADOS_SOLICITUD = ['Pendiente', 'Aprobado', 'Comprado', 'Rechazado'] as const;

export const ESTILO_ESTADO: Record<string, { pildora: string; punto: string }> = {
  Pendiente: { pildora: 'bg-amber-500/15 text-amber-200 ring-amber-400/40', punto: 'bg-amber-400' },
  Aprobado: { pildora: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/40', punto: 'bg-emerald-400' },
  Comprado: { pildora: 'bg-cyan-500/15 text-cyan-200 ring-cyan-400/40', punto: 'bg-cyan-400' },
  Rechazado: { pildora: 'bg-rose-500/15 text-rose-200 ring-rose-400/40', punto: 'bg-rose-400' },
};

export const ESTILO_ESTADO_DESCONOCIDO = { pildora: 'bg-slate-500/20 text-slate-200 ring-slate-400/40', punto: 'bg-slate-400' };

export const ESTILO_PRIORIDAD: Record<string, { texto: string; punto: string }> = {
  Alta: { texto: 'text-rose-200', punto: 'bg-rose-400' },
  Media: { texto: 'text-amber-200', punto: 'bg-amber-400' },
  Baja: { texto: 'text-slate-300', punto: 'bg-slate-400' },
};

export const PESO_ESTADO: Record<string, number> = { Pendiente: 4, Aprobado: 3, Rechazado: 2, Comprado: 1 };
export const PESO_PRIORIDAD: Record<string, number> = { Alta: 3, Media: 2, Baja: 1 };

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();

/** "alta" → "Alta": en Airtable conviven variantes de mayúsculas. */
export const normalizarValor = (texto: string | undefined) => (texto ? capitalizar(texto.trim()) : '');
