export type EstadoFactura = 'Pagada' | 'Sin Pagar' | 'Parcial' | 'Pendiente';

export interface CarteraRecord {
  id: string;
  facturaId: string;
  cliente: string;
  clienteNIT: string;
  facturaNo: string;
  fechaEmision: string | null; // YYYY-MM-DD
  fechaVencimiento: string | null; // YYYY-MM-DD
  fechaUltimoPago: string | null; // fecha del movimiento bancario más reciente
  totalFactura: number;
  pagado: number; // valor aplicado a esta factura
  saldoPendiente: number;
  estadoFactura: EstadoFactura;
  porConciliar: boolean; // tiene movimiento bancario vinculado pero aún no se aplicó
}
