import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
// Tabla PagoFacturas
const CARTERA_TABLE_ID = 'tbloCva8TDQNdv0Gn';

// GET: Listar registros de cartera con filtros
export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const cliente = searchParams.get('cliente');

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // Construir filtro
    const filters = [];
    if (estado) filters.push(`{Estado_Factura} = '${estado}'`);
    if (cliente) filters.push(`FIND('${cliente}', {Nombre del Comprador (from id_factura)}) > 0`);

    const filterFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : '';

    const records = await base(CARTERA_TABLE_ID)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Ultima Modificación ', direction: 'desc' }]
      })
      .all();

    const data = records.map(record => {
      const nombreComprador = record.get('Nombre del Comprador (from id_factura)');
      const nitComprador = record.get('NIT Comprador (from id_factura)');
      const facturaNo = record.get('Factura No');
      const totalRecibir = record.get('Total_recibir');
      const totalMovimientos = record.get('Total Movimientos');
      const estadoFactura = record.get('Estado_Factura');

      return {
        id: record.id,
        cliente: Array.isArray(nombreComprador) && nombreComprador.length > 0
          ? nombreComprador[0]
          : (typeof nombreComprador === 'string' ? nombreComprador : ''),
        clienteNIT: Array.isArray(nitComprador) && nitComprador.length > 0
          ? String(nitComprador[0] || '')
          : (typeof nitComprador === 'string' ? nitComprador : ''),
        facturaNo: Array.isArray(facturaNo) && facturaNo.length > 0
          ? String(facturaNo[0] || '')
          : (typeof facturaNo === 'string' ? facturaNo : ''),
        facturaId: Array.isArray(record.get('id_factura'))
          ? (record.get('id_factura') as unknown as { id: string }[])[0]?.id || ''
          : '',
        totalRecibir: Array.isArray(totalRecibir) && totalRecibir.length > 0
          ? Number(totalRecibir[0]) || 0
          : (typeof totalRecibir === 'number' ? totalRecibir : 0),
        saldoAnterior: Number(record.get('Saldo Anterior')) || 0,
        montoRestante: Number(record.get('Monto_restante')) || 0,
        estadoFactura: estadoFactura && typeof estadoFactura === 'object' && 'name' in estadoFactura
          ? (estadoFactura as { name: string }).name
          : (typeof estadoFactura === 'string' ? estadoFactura : 'Pendiente'),
        totalMovimientos: Array.isArray(totalMovimientos) && totalMovimientos.length > 0
          ? Number(totalMovimientos[0]) || 0
          : (typeof totalMovimientos === 'number' ? totalMovimientos : 0),
        movimientosBancarios: [],
        fechaCreacion: record.get('Fecha Creacion') as string || '',
        ultimaModificacion: record.get('Ultima Modificación ') as string || '',
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error al obtener cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
