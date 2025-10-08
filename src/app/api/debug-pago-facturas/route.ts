import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

export async function GET(request: NextRequest) {
  try {
    // Validar configuración básica
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      return NextResponse.json(
        { error: 'Configuración básica de Airtable no encontrada', success: false },
        { status: 500 }
      );
    }

    console.log('🔍 Buscando tabla PagoFacturas...');

    // Lista de posibles nombres de tabla para PagoFacturas
    const possibleTableNames = [
      'PagoFacturas',
      'Pago Facturas', 
      'pagoFacturas',
      'Facturas',
      'Pagos',
      'InvoicePayments',
      'Facturacion',
      'Cartera'
    ];

    const results = [];

    for (const tableName of possibleTableNames) {
      try {
        console.log(`📋 Probando tabla: ${tableName}`);
        
        const records = await base(tableName)
          .select({
            maxRecords: 3,
            view: "Grid view"
          })
          .firstPage();

        if (records && records.length > 0) {
          const firstRecord = records[0];
          const fields = Object.keys(firstRecord.fields);
          
          console.log(`✅ Tabla encontrada: ${tableName}`);
          console.log(`📊 Campos disponibles:`, fields);
          
          // Verificar si tiene los campos esperados de PagoFacturas
          const expectedFields = ['Estado_Factura', 'Factura No', 'Total_recibir', 'Nombre del Comprador'];
          const hasExpectedFields = expectedFields.some(field => 
            fields.some(f => f.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(f.toLowerCase()))
          );

          results.push({
            tableName,
            tableId: `Tabla: ${tableName}`, // No exponemos IDs reales en logs
            recordCount: records.length,
            fields: fields,
            hasFacturaFields: hasExpectedFields,
            sampleRecord: {
              id: firstRecord.id,
              fields: Object.keys(firstRecord.fields).reduce((acc, key) => {
                acc[key] = typeof firstRecord.fields[key];
                return acc;
              }, {} as Record<string, string>)
            }
          });
        }
      } catch (error) {
        console.log(`❌ Error probando tabla ${tableName}:`, error instanceof Error ? error.message : 'Error desconocido');
      }
    }

    console.log(`📊 Tablas encontradas: ${results.length}`);

    return NextResponse.json({
      success: true,
      message: 'Búsqueda de tabla PagoFacturas completada',
      tablesFound: results.length,
      tables: results,
      instructions: {
        step1: "Revisa las tablas encontradas arriba",
        step2: "Busca la tabla que contenga campos como 'Estado_Factura', 'Factura No', etc.",
        step3: "Usa el nombre de esa tabla para actualizar AIRTABLE_PAGO_FACTURAS_TABLE_ID",
        step4: "Si no encuentras la tabla, verifica que esté en la misma base de Airtable"
      }
    });

  } catch (error) {
    console.error('❌ Error en debug tabla PagoFacturas:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false,
        message: 'No se pudo buscar las tablas de PagoFacturas'
      },
      { status: 500 }
    );
  }
}