import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para BBVA
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

// Movimientos_Bancarios_BBVA (CAPEX)
const BBVA_TABLE_ID = process.env.AIRTABLE_BBVA_TABLE_ID;
const BBVA_SALDO_FIELD_ID = process.env.AIRTABLE_BBVA_SALDO_FIELD_ID;

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !BBVA_TABLE_ID || !BBVA_SALDO_FIELD_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const maxRecords = parseInt(searchParams.get('maxRecords') || '1000');
    const sortField = searchParams.get('sort[0][field]') || 'Creada';
    const sortDirection = searchParams.get('sort[0][direction]') || 'desc';

    const records: Record<string, unknown>[] = [];

    await base(BBVA_TABLE_ID)
      .select({
        maxRecords,
        sort: [{ field: sortField, direction: sortDirection as 'asc' | 'desc' }],
        // Ordenar primero por fecha de creación para obtener el más reciente
        view: "Grid view" // Vista por defecto
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          const fields = record.fields;
          
          console.log(`BBVA Record ID: ${record.id}`);
          console.log('BBVA Fields disponibles:', Object.keys(fields));
          console.log('BBVA Saldo Bancario Actual:', fields['Saldo Bancario Actual']);
          console.log('BBVA Field con ID:', fields[BBVA_SALDO_FIELD_ID!]);
          console.log('BBVA Creada:', fields['Creada']);
          console.log('BBVA Fecha:', fields['Fecha']);
          
          // Procesar los campos del registro - intentar múltiples nombres de campo
          const saldoActual = fields['Saldo Bancario Actual'] || 
                             fields[BBVA_SALDO_FIELD_ID!] || 
                             fields['Saldo_Bancario_Actual'] ||
                             fields['SALDO_BANCARIO_ACTUAL'] || 0;
          
          const processedRecord: Record<string, unknown> = {
            id: record.id,
            'Saldo Bancario Actual': saldoActual,
            'Fecha': fields['Fecha'] || '',
            'Descripción': fields['Descripción'] || '',
            'Valor': fields['Valor'] || 0,
            'Creada': fields['Creada'] || '',
          };

          console.log('BBVA Processed record:', processedRecord);
          records.push(processedRecord);
        });
        fetchNextPage();
      });

    console.log(`API BBVA - Total registros obtenidos: ${records.length}`);

    return NextResponse.json({
      success: true,
      data: records,
      total: records.length
    });

  } catch (error) {
    console.error('❌ Error en API movimientos BBVA:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false 
      },
      { status: 500 }
    );
  }
}