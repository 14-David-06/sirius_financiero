import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
// Tabla: Facturacion Egresos
const TABLE_ID = process.env.AIRTABLE_FACTURACION_EGRESOS_TABLE_ID;

const CUENTAS_ADMINISTRACION = [
  'Gasto de Personal',
  'Honorarios',
  'Impuestos',
  'Arrendamientos',
  'Servicios',
  'Gastos Legales',
  'Mantenimiento',
  'Gastos de Viaje',
  'DEPRECIACIÓN',
  'Diversos',
];

export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !TABLE_ID) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const año = searchParams.get('año') || String(new Date().getFullYear());
    const mesDesde = searchParams.get('mesDesde');
    const mesHasta = searchParams.get('mesHasta');

    // Filtro OR para las cuentas permitidas
    const cuentasFormula = `OR(${CUENTAS_ADMINISTRACION.map(c => `{CUENTA} = "${c}"`).join(', ')})`;

    const conditions = [
      `{Año formulado} = ${año}`,
      `{GRUPO} = "Gasto"`,
      `{CLASE} = "Administración"`,
      cuentasFormula,
    ];
    if (mesDesde) conditions.push(`{Numero Mes formulado} >= ${mesDesde}`);
    if (mesHasta) conditions.push(`{Numero Mes formulado} <= ${mesHasta}`);

    const filterFormula = `AND(${conditions.join(', ')})`;

    let totalGastosAdministracion = 0;
    let totalRegistros = 0;
    let offset: string | null = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`);
      url.searchParams.set('filterByFormula', filterFormula);
      url.searchParams.append('fields[]', 'subtotal');
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Airtable error:', response.status, errorText);
        throw new Error(`Airtable API error: ${response.status}`);
      }

      const result = await response.json();

      for (const record of result.records) {
        const subtotal = (record.fields['subtotal'] as number) || 0;
        totalGastosAdministracion += subtotal;
        totalRegistros++;
      }

      offset = result.offset ?? null;
    } while (offset);

    console.log(`API gastos-administracion: ${totalRegistros} registros, total $${totalGastosAdministracion.toLocaleString('es-CO')}`);

    return NextResponse.json({
      success: true,
      total: totalGastosAdministracion,
      count: totalRegistros,
      año: Number(año),
      mesDesde: mesDesde ? Number(mesDesde) : null,
      mesHasta: mesHasta ? Number(mesHasta) : null,
    });
  } catch (error) {
    console.error('Error en /api/gastos-administracion:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener gastos de administración' },
      { status: 500 }
    );
  }
}
