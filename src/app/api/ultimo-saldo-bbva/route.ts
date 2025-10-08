import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BBVA_TABLE_ID = process.env.AIRTABLE_BBVA_TABLE_ID;
const BBVA_SALDO_FIELD_ID = process.env.AIRTABLE_BBVA_SALDO_FIELD_ID;

export async function GET(request: NextRequest) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !BBVA_TABLE_ID || !BBVA_SALDO_FIELD_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada', success: false },
        { status: 500 }
      );
    }

    console.log('🏦 Obteniendo último saldo BBVA...');

    // Construir URL para obtener el último registro
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BBVA_TABLE_ID}`;
    const params = new URLSearchParams({
      maxRecords: '5',
      sort: JSON.stringify([{ field: 'Creada', direction: 'desc' }])
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error de Airtable: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Registros obtenidos:', data.records?.length || 0);

    if (data.records && data.records.length > 0) {
      // Procesar registros y buscar el último con saldo válido
      const registros = data.records.map((record: any) => {
        const fields = record.fields;
        
        console.log('🔍 Procesando registro BBVA:', {
          id: record.id,
          creada: fields.Creada,
          fecha: fields.Fecha,
          saldoField1: fields['Saldo Bancario Actual'],
          saldoField2: fields[BBVA_SALDO_FIELD_ID!],
          descripcion: fields['Descripción']?.substring(0, 50)
        });

        return {
          id: record.id,
          saldoBancarioActual: fields['Saldo Bancario Actual'] || fields[BBVA_SALDO_FIELD_ID!] || 0,
          fecha: fields['Fecha'],
          creada: fields['Creada'],
          descripcion: fields['Descripción'],
          valor: fields['Valor']
        };
      });

      // Encontrar el último registro con saldo válido
      const ultimoConSaldo = registros
        .filter((r: any) => r.saldoBancarioActual && r.saldoBancarioActual !== 0)
        .sort((a: any, b: any) => {
          if (a.creada && b.creada) {
            return new Date(b.creada).getTime() - new Date(a.creada).getTime();
          }
          return 0;
        })[0];

      console.log('🎯 Último registro con saldo:', ultimoConSaldo);

      return NextResponse.json({
        success: true,
        ultimoSaldo: ultimoConSaldo?.saldoBancarioActual || 0,
        ultimoRegistro: ultimoConSaldo,
        todosLosRegistros: registros,
        total: registros.length
      });
    }

    return NextResponse.json({
      success: false,
      error: 'No se encontraron registros',
      ultimoSaldo: 0
    });

  } catch (error) {
    console.error('❌ Error obteniendo último saldo BBVA:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false,
        ultimoSaldo: 0
      },
      { status: 500 }
    );
  }
}