import { NextRequest, NextResponse } from 'next/server';
import base from '@/lib/airtable';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filterByFormula = searchParams.get('filterByFormula') || '';
  const maxRecords = searchParams.get('maxRecords') || '100';
  const sort = searchParams.get('sort') || '';

  const tableId = process.env.AIRTABLE_FACTURACION_INGRESOS_TABLE_ID;
  if (!tableId) {
    return NextResponse.json({ error: 'Missing Airtable table ID configuration' }, { status: 500 });
  }

  try {
    const records = await base(tableId).select({
      filterByFormula: filterByFormula || '',
      maxRecords: parseInt(maxRecords),
      sort: sort ? [{ field: sort, direction: 'desc' }] : [],
    }).all();

    const data = records.map(record => ({
      id: record.id,
      ...record.fields,
    }));

    return NextResponse.json({ records: data });
  } catch (error) {
    console.error('Error fetching Facturacion Ingresos:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
