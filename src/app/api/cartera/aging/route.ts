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

    // Inicializar contadores por estado
    const estados = {
      'Sin Pagar': { monto: 0, cantidad: 0 },
      'Parcial': { monto: 0, cantidad: 0 },
      'Pendiente': { monto: 0, cantidad: 0 },
      'Pagada': { monto: 0, cantidad: 0 },
    };

    records.forEach(record => {
      const estadoFactura = record.get('Estado_Factura');
      const estadoNombre = estadoFactura && typeof estadoFactura === 'object' && 'name' in estadoFactura
        ? (estadoFactura as { name: string }).name
        : (typeof estadoFactura === 'string' ? estadoFactura : 'Pendiente');

      const montoRestante = Number(record.get('Monto_restante')) || 0;

      if (estadoNombre in estados) {
        estados[estadoNombre as keyof typeof estados].monto += montoRestante;
        estados[estadoNombre as keyof typeof estados].cantidad += 1;
      }
    });

    // Convertir a array
    const data = Object.entries(estados).map(([estado, { monto, cantidad }]) => ({
      estado,
      monto: Math.round(monto),
      cantidad
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error al obtener distribución de cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
