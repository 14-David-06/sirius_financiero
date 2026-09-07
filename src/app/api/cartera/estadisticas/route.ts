import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const CARTERA_TABLE_ID = 'tbloCva8TDQNdv0Gn'; // PagoFacturas

export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const records = await base(CARTERA_TABLE_ID).select().all();

    let saldoTotal = 0;
    let carteraSinPagar = 0;
    let carteraParcial = 0;
    let carteraPendiente = 0;
    let totalFacturado = 0;
    let totalRecaudado = 0;

    records.forEach(record => {
      const estadoFactura = record.get('Estado_Factura');
      const estadoNombre = estadoFactura && typeof estadoFactura === 'object' && 'name' in estadoFactura
        ? (estadoFactura as { name: string }).name
        : (typeof estadoFactura === 'string' ? estadoFactura : '');

      const montoRestante = Number(record.get('Monto_restante')) || 0;
      const totalRecibir = record.get('Total_recibir');
      const totalMovimientos = record.get('Total Movimientos');

      const totalRecibirNum = Array.isArray(totalRecibir) && totalRecibir.length > 0
        ? Number(totalRecibir[0]) || 0
        : (typeof totalRecibir === 'number' ? totalRecibir : 0);

      const totalMovimientosNum = Array.isArray(totalMovimientos) && totalMovimientos.length > 0
        ? Number(totalMovimientos[0]) || 0
        : (typeof totalMovimientos === 'number' ? totalMovimientos : 0);

      totalFacturado += totalRecibirNum;
      totalRecaudado += totalMovimientosNum;

      // Excluir pagadas del saldo total
      if (estadoNombre !== 'Pagada') {
        saldoTotal += montoRestante;

        if (estadoNombre === 'Sin Pagar') {
          carteraSinPagar += montoRestante;
        } else if (estadoNombre === 'Parcial') {
          carteraParcial += montoRestante;
        } else if (estadoNombre === 'Pendiente') {
          carteraPendiente += montoRestante;
        }
      }
    });

    const porcentajeRecaudado = totalFacturado > 0
      ? (totalRecaudado / totalFacturado) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        saldoTotal: Math.round(saldoTotal),
        carteraSinPagar: Math.round(carteraSinPagar),
        carteraParcial: Math.round(carteraParcial),
        carteraPendiente: Math.round(carteraPendiente),
        totalFacturado: Math.round(totalFacturado),
        totalRecaudado: Math.round(totalRecaudado),
        porcentajeRecaudado: Math.round(porcentajeRecaudado * 100) / 100,
      }
    });
  } catch (error: unknown) {
    console.error('Error al obtener estadísticas de cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
