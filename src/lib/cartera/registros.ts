import Airtable from 'airtable';
import type { CarteraRecord, EstadoFactura } from '@/types/cartera';

const ESTADOS: EstadoFactura[] = ['Pagada', 'Sin Pagar', 'Parcial', 'Pendiente'];

const primero = (valor: unknown): unknown => (Array.isArray(valor) ? valor[0] : valor);

const texto = (valor: unknown): string => {
  const v = primero(valor);
  return v == null ? '' : String(v).trim();
};

const numero = (valor: unknown): number | null => {
  const v = primero(valor);
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fecha = (valor: unknown): string | null => {
  const v = texto(valor);
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
};

const redondear = (valor: number) => Math.round(valor * 100) / 100;

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// La conciliación aplica cada movimiento bancario en cascada: "Saldo Anterior" es lo que
// quedaba del movimiento al llegar a esta factura. "Monto_restante" es el sobrante del
// movimiento (puede ser negativo), no el saldo de la factura.
function calcularSaldo(estado: EstadoFactura, total: number, saldoAnterior: number | null): number {
  if (estado === 'Pagada') return 0;
  if (estado === 'Sin Pagar' || saldoAnterior === null) return total;
  const saldo = Math.min(total, Math.max(0, total - saldoAnterior));
  return saldo < 1 ? 0 : saldo;
}

export async function obtenerRegistrosCartera(): Promise<CarteraRecord[]> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  const tablaPagos = process.env.AIRTABLE_PAGO_FACTURAS_TABLE_ID || 'tbloCva8TDQNdv0Gn';
  const tablaFacturas = process.env.AIRTABLE__INGRESOS_TABLE_ID || process.env.AIRTABLE_INGRESOS_TABLE_ID;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !tablaFacturas) {
    throw new Error('Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o AIRTABLE__INGRESOS_TABLE_ID');
  }

  const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

  const [pagos, facturas] = await Promise.all([
    base(tablaPagos)
      .select({
        fields: [
          'id_factura',
          'Nombre del Comprador (from id_factura)',
          'NIT Comprador (from id_factura)',
          'Factura No',
          'Total_recibir',
          'Saldo Anterior',
          'Estado_Factura',
          'Movimientos_Bancarios (from id_factura)',
        ],
      })
      .all(),
    base(tablaFacturas)
      .select({
        fields: ['Fecha Emision', 'Fecha de Vencimiento', 'Plazo para pagar', 'Fecha (from Movimientos_Bancarios)'],
      })
      .all(),
  ]);

  const fechasPorFactura = new Map(
    facturas.map(f => {
      const emision = fecha(f.get('Fecha Emision'));
      const plazo = numero(f.get('Plazo para pagar'));
      const vencimiento =
        fecha(f.get('Fecha de Vencimiento')) ?? (emision ? sumarDias(emision, plazo ?? 0) : null);
      const pagos = f.get('Fecha (from Movimientos_Bancarios)');
      const ultimoPago = Array.isArray(pagos)
        ? pagos.map(fecha).filter((p): p is string => p !== null).sort().at(-1) ?? null
        : fecha(pagos);
      return [f.id, { emision, vencimiento, ultimoPago }];
    })
  );

  const registros: CarteraRecord[] = [];

  for (const pago of pagos) {
    const facturaId = texto(pago.get('id_factura'));
    const total = numero(pago.get('Total_recibir')) ?? 0;
    // Registros sin factura vinculada son filas vacías creadas por la automatización
    if (!facturaId || total <= 0) continue;

    const estadoCrudo = texto(pago.get('Estado_Factura'));
    const estado = (ESTADOS as string[]).includes(estadoCrudo) ? (estadoCrudo as EstadoFactura) : 'Sin Pagar';
    const saldo = redondear(calcularSaldo(estado, total, numero(pago.get('Saldo Anterior'))));
    const movimientos = pago.get('Movimientos_Bancarios (from id_factura)');
    const fechas = fechasPorFactura.get(facturaId);

    registros.push({
      id: pago.id,
      facturaId,
      cliente: texto(pago.get('Nombre del Comprador (from id_factura)')) || 'Sin nombre',
      clienteNIT: texto(pago.get('NIT Comprador (from id_factura)')),
      facturaNo: texto(pago.get('Factura No')),
      fechaEmision: fechas?.emision ?? null,
      fechaVencimiento: fechas?.vencimiento ?? null,
      fechaUltimoPago: fechas?.ultimoPago ?? null,
      totalFactura: redondear(total),
      pagado: redondear(total - saldo),
      saldoPendiente: saldo,
      estadoFactura: estado,
      porConciliar: estado === 'Sin Pagar' && Array.isArray(movimientos) && movimientos.length > 0,
    });
  }

  return registros.sort(
    (a, b) =>
      (b.fechaEmision ?? '').localeCompare(a.fechaEmision ?? '') || b.facturaNo.localeCompare(a.facturaNo)
  );
}
