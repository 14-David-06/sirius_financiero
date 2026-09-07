export interface CarteraRecord {
  id: string;
  cliente: string;
  clienteNIT: string;
  facturaNo: string;
  facturaId: string;
  totalRecibir: number; // Monto de la factura
  saldoAnterior: number;
  montoRestante: number; // Saldo pendiente
  estadoFactura: 'Pagada' | 'Sin Pagar' | 'Parcial' | 'Pendiente';
  totalMovimientos: number; // Total de pagos realizados
  movimientosBancarios: string[]; // IDs de movimientos
  fechaCreacion: string;
  ultimaModificacion: string;
}

export interface CarteraKPIs {
  saldoTotal: number; // Total de Monto_restante (sin pagadas)
  carteraSinPagar: number; // Estado = Sin Pagar
  carteraParcial: number; // Estado = Parcial
  carteraPendiente: number; // Estado = Pendiente
  totalFacturado: number; // Suma de Total_recibir
  totalRecaudado: number; // Suma de Total Movimientos
  porcentajeRecaudado: number; // (Total Recaudado / Total Facturado) * 100
}

export interface EstadoCarteraData {
  estado: string;
  monto: number;
  cantidad: number;
}

export interface PagoCartera {
  id: string;
  carteraId: string;
  monto: number;
  fecha: string;
  metodoPago: string;
  referencia: string;
  notas: string;
}
