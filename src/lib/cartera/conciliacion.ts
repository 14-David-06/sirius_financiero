import Airtable, { type FieldSet, type Record as AirtableRecord, type Table } from 'airtable';
import { actualizarEnLotes } from '@/lib/importacion/archivos-pendientes';

function tablaPagoFacturas(): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_PAGO_FACTURAS_TABLE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_PAGO_FACTURAS_TABLE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o AIRTABLE_PAGO_FACTURAS_TABLE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(AIRTABLE_PAGO_FACTURAS_TABLE_ID);
}

function tablaMovimientosBancarios(): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_MOVIMIENTOS_TABLE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_MOVIMIENTOS_TABLE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o AIRTABLE_MOVIMIENTOS_TABLE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(AIRTABLE_MOVIMIENTOS_TABLE_ID);
}

interface FacturaParaConciliar {
  id: string;
  facturaNo: string;
  totalRecibir: number;
  movimientosBancarios: string[]; // IDs de movimientos vinculados
}

interface MovimientoBancario {
  id: string;
  valor: number;
}

interface ResultadoConciliacion {
  id: string;
  facturaNo: string;
  totalRecibir: number;
  saldoAnterior: number;
  montoRestante: number;
  estadoFactura: 'Pagada' | 'Parcial' | 'Pendiente';
}

/**
 * Determina el estado de una factura según los saldos
 */
function determinarEstado(
  totalRecibir: number,
  saldoAnterior: number,
  montoRestante: number
): 'Pagada' | 'Parcial' | 'Pendiente' {
  if (montoRestante <= 0) {
    return 'Pagada';
  }
  if (saldoAnterior > 0 && montoRestante < totalRecibir) {
    return 'Parcial';
  }
  return 'Pendiente';
}

/**
 * Concilia facturas aplicando el saldo del movimiento bancario en cascada.
 * Replica la lógica del workflow n8n AUTOMA_Actualizar_Cartera.
 *
 * @returns Estadísticas de la conciliación
 */
export async function conciliarCartera(): Promise<{
  facturasActualizadas: number;
  movimientosProcesados: number;
  detalles: ResultadoConciliacion[];
}> {
  const tablaFacturas = tablaPagoFacturas();
  const tablaMovimientos = tablaMovimientosBancarios();

  // 1. Buscar facturas con estado "Sin Pagar" o "Parcial" que tengan movimiento bancario
  const facturasPendientes = await tablaFacturas
    .select({
      filterByFormula: "AND(OR({Estado_Factura} = 'Sin Pagar', {Estado_Factura} = 'Parcial'), {Movimientos_Bancarios (from id_factura)} != '')",
      fields: ['Factura No', 'Total_recibir', 'Movimientos_Bancarios (from id_factura)', 'id_factura'],
      sort: [{ field: 'Factura No', direction: 'asc' }],
    })
    .all();

  if (facturasPendientes.length === 0) {
    return { facturasActualizadas: 0, movimientosProcesados: 0, detalles: [] };
  }

  // 2. Obtener IDs únicos de movimientos bancarios
  const movimientoIds = new Set<string>();
  for (const factura of facturasPendientes) {
    const movimientos = factura.get('Movimientos_Bancarios (from id_factura)');
    if (Array.isArray(movimientos)) {
      movimientos.forEach(id => movimientoIds.add(id as string));
    }
  }

  // 3. Leer movimientos bancarios y obtener sus valores
  const movimientosMap = new Map<string, number>();

  for (const movimientoId of movimientoIds) {
    try {
      const movimiento = await tablaMovimientos.find(movimientoId);
      const valor = Number(movimiento.get('Valor')) || 0;
      movimientosMap.set(movimientoId, valor);
    } catch (error) {
      console.warn(`⚠️ No se pudo leer movimiento ${movimientoId}:`, error);
    }
  }

  // 4. Agrupar facturas por movimiento bancario
  const facturasPorMovimiento = new Map<string, FacturaParaConciliar[]>();

  for (const factura of facturasPendientes) {
    const movimientos = factura.get('Movimientos_Bancarios (from id_factura)');
    const movimientosList = Array.isArray(movimientos) ? movimientos : [];

    const facturaData: FacturaParaConciliar = {
      id: factura.id,
      facturaNo: String(factura.get('Factura No') || ''),
      totalRecibir: Number(factura.get('Total_recibir')) || 0,
      movimientosBancarios: movimientosList as string[],
    };

    // Agregar factura a cada uno de sus movimientos
    for (const movimientoId of facturaData.movimientosBancarios) {
      if (!facturasPorMovimiento.has(movimientoId)) {
        facturasPorMovimiento.set(movimientoId, []);
      }
      facturasPorMovimiento.get(movimientoId)!.push(facturaData);
    }
  }

  // 5. Aplicar conciliación por movimiento en cascada
  const resultados: ResultadoConciliacion[] = [];
  const actualizaciones: { id: string; fields: FieldSet }[] = [];

  for (const [movimientoId, facturas] of facturasPorMovimiento) {
    let saldoDisponible = movimientosMap.get(movimientoId) || 0;

    // Ordenar facturas por Factura No (ya vienen ordenadas del select)
    facturas.sort((a, b) => a.facturaNo.localeCompare(b.facturaNo));

    for (const factura of facturas) {
      const saldoAnterior = saldoDisponible;

      // Aplicar pago
      saldoDisponible -= factura.totalRecibir;

      const montoRestante = Math.max(0, factura.totalRecibir - saldoAnterior);
      const estadoFactura = determinarEstado(factura.totalRecibir, saldoAnterior, montoRestante);

      const resultado: ResultadoConciliacion = {
        id: factura.id,
        facturaNo: factura.facturaNo,
        totalRecibir: factura.totalRecibir,
        saldoAnterior,
        montoRestante,
        estadoFactura,
      };

      resultados.push(resultado);

      // Preparar actualización
      actualizaciones.push({
        id: factura.id,
        fields: {
          'Saldo Anterior': saldoAnterior,
          Monto_restante: montoRestante,
          Estado_Factura: estadoFactura,
        },
      });
    }
  }

  // 6. Actualizar en lotes
  await actualizarEnLotes(tablaFacturas, actualizaciones);

  return {
    facturasActualizadas: actualizaciones.length,
    movimientosProcesados: movimientoIds.size,
    detalles: resultados,
  };
}

/**
 * Obtiene estadísticas actuales de la cartera sin modificarla
 */
export async function obtenerEstadisticasCartera(): Promise<{
  totalFacturas: number;
  sinPagar: number;
  parcial: number;
  pagada: number;
  totalPendiente: number;
}> {
  const tabla = tablaPagoFacturas();

  const facturas = await tabla
    .select({
      fields: ['Estado_Factura', 'Monto_restante'],
    })
    .all();

  const estadisticas = {
    totalFacturas: facturas.length,
    sinPagar: 0,
    parcial: 0,
    pagada: 0,
    totalPendiente: 0,
  };

  for (const factura of facturas) {
    const estado = factura.get('Estado_Factura') as string;
    const monto = Number(factura.get('Monto_restante')) || 0;

    if (estado === 'Sin Pagar') estadisticas.sinPagar++;
    else if (estado === 'Parcial') estadisticas.parcial++;
    else if (estado === 'Pagada') estadisticas.pagada++;

    estadisticas.totalPendiente += monto;
  }

  return estadisticas;
}
