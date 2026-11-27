import type { EstadoFactura } from '@/types/cartera';

// Validado para daltonismo sobre la superficie de las tarjetas (#172033): azul, naranja y aqua
// pasan todas las combinaciones; no agregar un cuarto tono de serie en esta página.
export const COLORES = {
  porVencer: '#338ced',
  vencida: '#e76624',
  recaudado: '#00a888',
  facturado: '#64748b',
  grilla: '#334155',
  eje: '#475569',
  texto: '#f1f5f9',
  textoSecundario: '#94a3b8',
  etiqueta: '#cbd5e1',
} as const;

export const ESTADO_SEMAFORO = {
  bien: '#0aac23',
  alerta: '#fbb315',
  serio: '#f18a59',
  critico: '#dc3c3d',
} as const;

export const COLOR_ESTADO: Record<EstadoFactura, string> = {
  Pagada: ESTADO_SEMAFORO.bien,
  Parcial: ESTADO_SEMAFORO.alerta,
  Pendiente: ESTADO_SEMAFORO.serio,
  'Sin Pagar': ESTADO_SEMAFORO.critico,
};

export const TARJETA = 'rounded-2xl border border-white/15 bg-slate-900/75 shadow-xl backdrop-blur-md';

export const plural = (n: number, uno: string, varios: string) =>
  `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;
