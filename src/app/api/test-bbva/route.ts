import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para BBVA
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

// Movimientos_Bancarios_BBVA (CAPEX)
const BBVA_TABLE_ID = process.env.AIRTABLE_BBVA_TABLE_ID || '';
const BBVA_SALDO_FIELD_ID = process.env.AIRTABLE_BBVA_SALDO_FIELD_ID || '';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Test BBVA - Iniciando consulta...');
    
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      console.error('❌ Faltan variables de entorno requeridas');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const records: any[] = [];

    console.log('📊 Consultando tabla BBVA:', BBVA_TABLE_ID);

    await base(BBVA_TABLE_ID)
      .select({
        maxRecords: 5,
        sort: [{ field: 'Creada', direction: 'desc' }]
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          const fields = record.fields;
          
          console.log('🔍 Registro encontrado:');
          console.log('  - ID:', record.id);
          console.log('  - Campos disponibles:', Object.keys(fields));
          console.log('  - Saldo Bancario Actual:', fields['Saldo Bancario Actual']);
          console.log('  - Saldo con field ID:', fields[BBVA_SALDO_FIELD_ID]);
          console.log('  - Fecha:', fields['Fecha']);
          console.log('  - Creada:', fields['Creada']);
          console.log('  - Descripción:', fields['Descripción']);
          console.log('  - Valor:', fields['Valor']);
          console.log('  ---');
          
          records.push({
            id: record.id,
            fields: fields,
            saldoBancarioActual: fields['Saldo Bancario Actual'] || fields[BBVA_SALDO_FIELD_ID] || 0,
            fecha: fields['Fecha'],
            creada: fields['Creada'],
            descripcion: fields['Descripción'],
            valor: fields['Valor']
          });
        });
        fetchNextPage();
      });

    console.log(`✅ Total registros obtenidos: ${records.length}`);

    return NextResponse.json({
      success: true,
      data: records,
      total: records.length,
      debug: {
        tableId: BBVA_TABLE_ID,
        hasApiKey: !!process.env.AIRTABLE_API_KEY,
        hasBaseId: !!process.env.AIRTABLE_BASE_ID
      }
    });

  } catch (error) {
    console.error('❌ Error en test BBVA:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false 
      },
      { status: 500 }
    );
  }
}