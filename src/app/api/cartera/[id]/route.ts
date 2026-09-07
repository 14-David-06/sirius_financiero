import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const CARTERA_TABLE_ID = process.env.AIRTABLE_CARTERA_TABLE_ID;

// GET: Obtener un registro específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !CARTERA_TABLE_ID) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const record = await base(CARTERA_TABLE_ID).find(id);

    const clienteRaw = record.get('Cliente');
    const facturaRaw = record.get('Factura');
    const responsableRaw = record.get('Responsable Cobro');

    const data = {
      id: record.id,
      cliente: Array.isArray(clienteRaw) && clienteRaw.length > 0
        ? clienteRaw[0]
        : (clienteRaw || ''),
      clienteNIT: record.get('NIT Cliente') || '',
      facturaNo: record.get('Factura No.') || '',
      facturaId: Array.isArray(facturaRaw) && facturaRaw.length > 0
        ? facturaRaw[0]
        : (facturaRaw || ''),
      montoFactura: record.get('Monto Factura') || 0,
      fechaVencimiento: record.get('Fecha Vencimiento') || '',
      diasVencidos: record.get('Días Vencidos') || 0,
      estadoCartera: record.get('Estado Cartera') || 'Al Día',
      saldoPendiente: record.get('Saldo Pendiente') || 0,
      pagosRealizados: record.get('Pagos Realizados') || [],
      notasCobro: record.get('Notas Cobro') || '',
      responsableCobro: Array.isArray(responsableRaw) && responsableRaw.length > 0
        ? responsableRaw[0]
        : (responsableRaw || ''),
      categoriaRiesgo: record.get('Categoría Riesgo') || 'Bajo',
      fechaCreacion: record.get('Fecha Creación') || '',
      ultimaActualizacion: record.get('Última Actualización') || '',
    };

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error('Error al obtener registro de cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

// PATCH: Actualizar un registro específico
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !CARTERA_TABLE_ID) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const updateFields: Record<string, string | string[]> = {};

    if (body.notasCobro !== undefined) updateFields['Notas Cobro'] = body.notasCobro;
    if (body.categoriaRiesgo !== undefined) updateFields['Categoría Riesgo'] = body.categoriaRiesgo;
    if (body.responsableCobroId !== undefined) {
      updateFields['Responsable Cobro'] = [body.responsableCobroId];
    }

    const updatedRecord = await base(CARTERA_TABLE_ID).update(id, updateFields as any);

    return NextResponse.json({ success: true, data: updatedRecord });
  } catch (error: unknown) {
    console.error('Error al actualizar registro de cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar un registro (solo para Desarrollador)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !CARTERA_TABLE_ID) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const { id } = await params;
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    await base(CARTERA_TABLE_ID).destroy(id);

    return NextResponse.json({ success: true, message: 'Registro eliminado' });
  } catch (error: unknown) {
    console.error('Error al eliminar registro de cartera:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
