import type { BancoId } from '@/lib/bancos/cuentas';

export type TonoSoporte = 'ok' | 'pendiente' | 'neutro';

export interface MovimientoBancario {
  id: string;
  /** YYYY-MM-DD */
  fecha: string;
  descripcion: string;
  /** Texto secundario: clasificación (Bancolombia) o concepto del banco (BBVA) */
  detalle: string;
  /** Positivo = entrada, negativo = salida */
  valor: number;
  saldoAnterior: number | null;
  /** Saldo de la cuenta después del movimiento */
  saldo: number | null;
  tipoFlujo: string;
  centroCostos: string;
  /** Legalización (Bancolombia) o factura vinculada (BBVA) */
  soporte: { texto: string; tono: TonoSoporte } | null;
  /** Campos propios de cada tabla, para el detalle */
  datos: { etiqueta: string; valor: string }[];
}

export interface ResumenCuenta {
  /** Saldo después del último movimiento registrado (orden de carga) */
  saldoActual: number | null;
  fechaUltimoMovimiento: string | null;
}

export interface PeriodoMovimientos {
  año: number;
  /** 1-12; null = todo el año */
  mes: number | null;
}

export interface RespuestaMovimientos {
  success: true;
  banco: BancoId;
  periodo: PeriodoMovimientos;
  cuentas: Record<BancoId, ResumenCuenta>;
  movimientos: MovimientoBancario[];
}
