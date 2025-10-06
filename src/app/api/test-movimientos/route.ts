import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Flujo de Caja
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

const MOVIMIENTOS_TABLE_ID = process.env.AIRTABLE_MOVIMIENTOS_TABLE_ID || '';

export async function GET(_request: NextRequest) {
  try {
    // Validar configuración
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !MOVIMIENTOS_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    console.log('🧪 TEST API - Verificando campos de movimientos...');
    console.log('🔑 API Key disponible:', !!AIRTABLE_API_KEY);
    console.log('🗄️ Base ID:', AIRTABLE_BASE_ID);
    console.log('📊 Table ID:', MOVIMIENTOS_TABLE_ID);

    const records: Record<string, unknown>[] = [];

    // SIN filtros, solo obtener algunos registros para ver los campos
    await base(MOVIMIENTOS_TABLE_ID)
      .select({
        maxRecords: 5,
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

    console.log('✅ Registros obtenidos:', records.length);
    
    if (records.length > 0) {
      console.log('📋 CAMPOS DISPONIBLES EN LA TABLA:');
      console.log(Object.keys(records[0]).join(', '));
      
      console.log('\n🔍 PRIMER REGISTRO COMPLETO:');
      console.log(JSON.stringify(records[0], null, 2));
    }
    
    return NextResponse.json({ 
      records,
      fieldsAvailable: records.length > 0 ? Object.keys(records[0]) : [],
      success: true 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500 }
    );
  }
}
