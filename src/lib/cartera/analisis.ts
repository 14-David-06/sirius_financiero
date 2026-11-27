import type { CarteraRecord } from '@/types/cartera';

export type RangoAntiguedad = 'por-vencer' | '1-30' | '31-60' | '61-90' | '91-180' | 'mas-180';

export const RANGOS_ANTIGUEDAD: { id: RangoAntiguedad; etiqueta: string; corta: string }[] = [
  { id: 'por-vencer', etiqueta: 'Por vencer', corta: 'Por vencer' },
  { id: '1-30', etiqueta: 'Vencida 1 a 30 días', corta: '1–30 días' },
  { id: '31-60', etiqueta: 'Vencida 31 a 60 días', corta: '31–60 días' },
  { id: '61-90', etiqueta: 'Vencida 61 a 90 días', corta: '61–90 días' },
  { id: '91-180', etiqueta: 'Vencida 91 a 180 días', corta: '91–180 días' },
  { id: 'mas-180', etiqueta: 'Vencida más de 180 días', corta: '+180 días' },
];

export type AlcanceInforme = 'pendiente' | 'vencida' | 'mas-90';

export const ALCANCES_INFORME: { id: AlcanceInforme; titulo: string; descripcion: string }[] = [
  { id: 'pendiente', titulo: 'Toda la cartera pendiente', descripcion: 'Facturas con saldo, vencidas o no' },
  { id: 'vencida', titulo: 'Cartera vencida', descripcion: 'Solo facturas que ya pasaron su fecha de vencimiento' },
  { id: 'mas-90', titulo: 'Vencida más de 90 días', descripcion: 'Cartera de difícil cobro para gestión prioritaria' },
];

export function cumpleAlcance(f: FacturaAnalizada, alcance: AlcanceInforme): boolean {
  if (f.saldoPendiente <= 0) return false;
  if (alcance === 'vencida') return f.vencida;
  if (alcance === 'mas-90') return f.diasVencida > 90;
  return true;
}

/** Clientes del alcance; las pagadas se incluyen solo para tomar la fecha del último pago. */
export const clientesDelAlcance = (facturas: FacturaAnalizada[], alcance: AlcanceInforme) =>
  agruparPorCliente(facturas.filter(f => f.saldoPendiente <= 0 || cumpleAlcance(f, alcance)));

export interface FacturaAnalizada extends CarteraRecord {
  diasVencida: number; // negativo = días que faltan para vencer
  rango: RangoAntiguedad;
  vencida: boolean;
}

export interface Monto {
  monto: number;
  facturas: number;
}

export interface ResumenCartera {
  facturado: number;
  recaudado: number;
  porcentajeRecaudado: number;
  saldo: number;
  facturasPendientes: number;
  clientesConSaldo: number;
  vencida: Monto;
  porVencer: Monto;
  mas90: Monto;
  porConciliar: Monto;
  diasCobro: { mediana: number; muestras: number } | null;
}

export interface ResumenCliente {
  clave: string;
  cliente: string;
  nit: string;
  saldo: number;
  vencida: number;
  porVencer: number;
  facturasPendientes: number;
  diasMaxVencida: number;
  ultimoPago: string | null;
  porRango: Record<RangoAntiguedad, number>;
}

export interface PuntoMensual {
  mes: string;
  etiqueta: string;
  facturado: number;
  recaudado: number;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function hoyBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}

export function rangoAntiguedad(dias: number): RangoAntiguedad {
  if (dias <= 0) return 'por-vencer';
  if (dias <= 30) return '1-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  if (dias <= 180) return '91-180';
  return 'mas-180';
}

export function analizarFacturas(registros: CarteraRecord[], hoy: string): FacturaAnalizada[] {
  return registros.map(r => {
    const dias = r.fechaVencimiento ? diasEntre(r.fechaVencimiento, hoy) : 0;
    return { ...r, diasVencida: dias, rango: rangoAntiguedad(dias), vencida: r.saldoPendiente > 0 && dias > 0 };
  });
}

const sumar = (facturas: FacturaAnalizada[]): Monto => ({
  monto: facturas.reduce((s, f) => s + f.saldoPendiente, 0),
  facturas: facturas.length,
});

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
}

export function calcularResumen(facturas: FacturaAnalizada[], hoy: string): ResumenCartera {
  const pendientes = facturas.filter(f => f.saldoPendiente > 0);
  const facturado = facturas.reduce((s, f) => s + f.totalFactura, 0);
  const recaudado = facturas.reduce((s, f) => s + f.pagado, 0);

  const tiemposCobro = facturas
    .filter(
      f =>
        f.estadoFactura === 'Pagada' &&
        f.fechaEmision &&
        f.fechaUltimoPago &&
        diasEntre(f.fechaUltimoPago, hoy) <= 180
    )
    .map(f => Math.max(0, diasEntre(f.fechaEmision!, f.fechaUltimoPago!)));

  return {
    facturado,
    recaudado,
    porcentajeRecaudado: facturado > 0 ? (recaudado / facturado) * 100 : 0,
    saldo: pendientes.reduce((s, f) => s + f.saldoPendiente, 0),
    facturasPendientes: pendientes.length,
    clientesConSaldo: new Set(pendientes.map(claveCliente)).size,
    vencida: sumar(pendientes.filter(f => f.vencida)),
    porVencer: sumar(pendientes.filter(f => !f.vencida)),
    mas90: sumar(pendientes.filter(f => f.diasVencida > 90)),
    porConciliar: sumar(pendientes.filter(f => f.porConciliar)),
    diasCobro: tiemposCobro.length ? { mediana: mediana(tiemposCobro), muestras: tiemposCobro.length } : null,
  };
}

export interface DatoAntiguedad extends Monto {
  id: RangoAntiguedad;
  etiqueta: string;
  corta: string;
}

export function agruparPorAntiguedad(facturas: FacturaAnalizada[]): DatoAntiguedad[] {
  return RANGOS_ANTIGUEDAD.map(rango => {
    const delRango = facturas.filter(f => f.saldoPendiente > 0 && f.rango === rango.id);
    return { ...rango, ...sumar(delRango) };
  });
}

const claveCliente = (f: CarteraRecord) => f.clienteNIT || f.cliente.toUpperCase();

const rangosEnCero = () =>
  Object.fromEntries(RANGOS_ANTIGUEDAD.map(r => [r.id, 0])) as Record<RangoAntiguedad, number>;

/** Clientes con saldo, de mayor a menor. Las facturas pagadas solo aportan la fecha del último pago. */
export function agruparPorCliente(facturas: FacturaAnalizada[]): ResumenCliente[] {
  const clientes = new Map<string, ResumenCliente>();

  for (const f of facturas) {
    const clave = claveCliente(f);
    let c = clientes.get(clave);
    if (!c) {
      c = {
        clave,
        cliente: f.cliente,
        nit: f.clienteNIT,
        saldo: 0,
        vencida: 0,
        porVencer: 0,
        facturasPendientes: 0,
        diasMaxVencida: 0,
        ultimoPago: null,
        porRango: rangosEnCero(),
      };
      clientes.set(clave, c);
    }

    if (f.pagado > 0 && f.fechaUltimoPago && (!c.ultimoPago || f.fechaUltimoPago > c.ultimoPago)) {
      c.ultimoPago = f.fechaUltimoPago;
    }
    if (f.saldoPendiente <= 0) continue;

    c.saldo += f.saldoPendiente;
    c.facturasPendientes += 1;
    c.porRango[f.rango] += f.saldoPendiente;
    if (f.vencida) {
      c.vencida += f.saldoPendiente;
      c.diasMaxVencida = Math.max(c.diasMaxVencida, f.diasVencida);
    } else {
      c.porVencer += f.saldoPendiente;
    }
  }

  return [...clientes.values()].filter(c => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
}

/** Facturado por mes de emisión y recaudado por mes del pago, últimos `meses` meses. */
export function serieMensual(facturas: FacturaAnalizada[], hoy: string, meses = 12): PuntoMensual[] {
  const [anio, mes] = hoy.split('-').map(Number);
  const puntos = new Map<string, PuntoMensual>();

  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anio, mes - 1 - i, 1));
    const clave = d.toISOString().slice(0, 7);
    puntos.set(clave, {
      mes: clave,
      etiqueta: `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      facturado: 0,
      recaudado: 0,
    });
  }

  for (const f of facturas) {
    const emitida = f.fechaEmision && puntos.get(f.fechaEmision.slice(0, 7));
    if (emitida) emitida.facturado += f.totalFactura;
    const cobrada = f.pagado > 0 && f.fechaUltimoPago && puntos.get(f.fechaUltimoPago.slice(0, 7));
    if (cobrada) cobrada.recaudado += f.pagado;
  }

  return [...puntos.values()];
}
