const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const numero = (valor: number, decimales: number) =>
  valor.toLocaleString('es-CO', { maximumFractionDigits: decimales, minimumFractionDigits: 0 });

export const formatoCOP = (valor: number) => cop.format(Math.round(valor));

/** $103,8 M · $3.095 M · $750 mil */
export function formatoCOPCorto(valor: number): string {
  const abs = Math.abs(valor);
  const signo = valor < 0 ? '-' : '';
  if (abs >= 1e6) {
    const millones = abs / 1e6;
    return `${signo}$${numero(millones, millones >= 1000 ? 0 : 1)} M`;
  }
  if (abs >= 1e3) return `${signo}$${numero(abs / 1e3, 0)} mil`;
  return `${signo}$${numero(abs, 0)}`;
}

export const formatoPorcentaje = (valor: number) => `${numero(valor, 1)} %`;

export function formatoFecha(fechaISO: string | null): string {
  if (!fechaISO) return '—';
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

export function formatoDias(diasVencida: number): string {
  if (diasVencida > 0) return `Vencida hace ${diasVencida} ${diasVencida === 1 ? 'día' : 'días'}`;
  if (diasVencida === 0) return 'Vence hoy';
  const faltan = -diasVencida;
  return `Vence en ${faltan} ${faltan === 1 ? 'día' : 'días'}`;
}
