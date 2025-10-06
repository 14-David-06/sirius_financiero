import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Flujo de Caja
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

// Movimientos_Bancarios_Bancolombia (Capital de Trabajo)
const MOVIMIENTOS_TABLE_ID = process.env.AIRTABLE_MOVIMIENTOS_TABLE_ID || '';

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !MOVIMIENTOS_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const maxRecords = parseInt(searchParams.get('maxRecords') || '1000');
    const filterByFormula = searchParams.get('filterByFormula') || '';

    const records: Record<string, unknown>[] = [];

    await base(MOVIMIENTOS_TABLE_ID)
      .select({
        maxRecords,
        filterByFormula,
        sort: [{ field: 'Fecha', direction: 'desc' }],
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            ...record.fields,
          });
        });
        fetchNextPage();
      });

    return NextResponse.json({ records, success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error fetching movimientos bancarios:', error);
    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500 }
    );
  }
}
