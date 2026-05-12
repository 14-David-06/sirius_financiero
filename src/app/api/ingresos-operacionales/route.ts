import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
// Tabla: Item Facturacion Ingresos
const TABLE_ID = process.env.AIRTABLE_ITEMS_INGRESOS_TABLE_ID;

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

    // Filtro base: año, sin flete ni transporte
    const baseConditions = [
      `{Año} = ${año}`,
      `FIND("Flete", {Item}) = 0`,
      `FIND("Trans", {Item}) = 0`,
    ];
    if (mesDesde) baseConditions.push(`{Numero Mes} >= ${mesDesde}`);
    if (mesHasta) baseConditions.push(`{Numero Mes} <= ${mesHasta}`);

    const filterFormula = `AND(${baseConditions.join(', ')})`;

    let totalIngresosOperacionales = 0;
    let totalRegistros = 0;
    let offset: string | null = null;

    // Paginar todos los registros (Airtable devuelve máx. 100 por página)
    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TABLE_ID}`);
      url.searchParams.set('filterByFormula', filterFormula);
      // Solo traer el campo necesario para la sumatoria
      url.searchParams.append('fields[]', 'Vr. Total Flow');
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
        const vrTotalFlow = (record.fields['Vr. Total Flow'] as number) || 0;
        totalIngresosOperacionales += vrTotalFlow;
        totalRegistros++;
      }

      offset = result.offset ?? null;
    } while (offset);

    return NextResponse.json({
      success: true,
      total: totalIngresosOperacionales,
      count: totalRegistros,
      año: Number(año),
      mesDesde: mesDesde ? Number(mesDesde) : null,
      mesHasta: mesHasta ? Number(mesHasta) : null,
    });
  } catch (error) {
    console.error('Error en /api/ingresos-operacionales:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener ingresos operacionales' },
      { status: 500 }
    );
  }
}
