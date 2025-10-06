import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Pirólisis
const PIROLISIS_API_KEY = process.env.PIROLISIS_AIRTABLE_API_KEY || '';
const PIROLISIS_BASE_ID = process.env.PIROLISIS_AIRTABLE_BASE_ID || '';

const base = new Airtable({ apiKey: PIROLISIS_API_KEY }).base(PIROLISIS_BASE_ID);

const BALANCES_MASA_TABLE_ID = process.env.PIROLISIS_BALANCES_MASA_TABLE_ID || '';

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!PIROLISIS_API_KEY || !PIROLISIS_BASE_ID || !BALANCES_MASA_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    console.log('🔄 API /balances-masa iniciando...');
    console.log('🔑 API Key disponible:', !!PIROLISIS_API_KEY);
    console.log('🗄️ Base ID:', PIROLISIS_BASE_ID);
    console.log('📊 Table ID:', BALANCES_MASA_TABLE_ID);
    
    const { searchParams } = new URL(request.url);
    // Aumentar límite a 10000 registros (sin límite prácticamente)
    const maxRecords = parseInt(searchParams.get('maxRecords') || '10000');
    const filterByFormula = searchParams.get('filterByFormula') || '';

    const records: Record<string, unknown>[] = [];

    console.log('📡 Consultando Airtable con límite de', maxRecords, 'registros...');
    
    await base(BALANCES_MASA_TABLE_ID)
      .select({
        maxRecords,
        filterByFormula,
        sort: [{ field: 'Fecha', direction: 'desc' }],
        pageSize: 100, // Airtable trae 100 registros por página
      })
      .eachPage((pageRecords, fetchNextPage) => {
        console.log('📄 Página recibida con', pageRecords.length, 'registros');
        pageRecords.forEach((record) => {
          records.push({
            id: record.id,
            ...record.fields,
          });
        });
        fetchNextPage();
      });

    console.log('✅ Total de registros obtenidos:', records.length);
    return NextResponse.json({ records, success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error fetching balances masa:', error);
    console.error('❌ Error details:', errorMessage);
    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500 }
    );
  }
}
