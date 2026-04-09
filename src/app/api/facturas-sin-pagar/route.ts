import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { PAGO_FACTURAS_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable para PagoFacturas
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

const PAGO_FACTURAS_TABLE_ID = process.env.AIRTABLE_PAGO_FACTURAS_TABLE_ID;

// Helper function para convertir valores a números de forma segura
function parseNumber(value: any): number {
  if (Array.isArray(value)) {
    return parseNumber(value[0]);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    // Validar configuración
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID || !PAGO_FACTURAS_TABLE_ID) {
      console.error('❌ Faltan variables de entorno requeridas para facturas sin pagar');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const maxRecords = parseInt(searchParams.get('maxRecords') || '100');

    const records: Record<string, unknown>[] = [];

    await base(PAGO_FACTURAS_TABLE_ID!)
      .select({
        maxRecords,
        filterByFormula: `{${PAGO_FACTURAS_FIELDS.ESTADO_FACTURA}} = 'Sin Pagar'`,
        sort: [{ field: PAGO_FACTURAS_FIELDS.FECHA_CREACION, direction: 'desc' }],
        view: "Grid view"
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          const fields = record.fields;
          
          console.log(`📄 Factura sin pagar encontrada: ${record.id}`);
          console.log('🔍 Campos:', Object.keys(fields));
          
          const processedRecord: Record<string, unknown> = {
            id: record.id,
            // Información básica de la factura
            facturaNo: fields[PAGO_FACTURAS_FIELDS.FACTURA_NO] || `F-${record.id.slice(-6)}`,
            nombreComprador: fields[PAGO_FACTURAS_FIELDS.NOMBRE_COMPRADOR] || 'Cliente no especificado',
            nitComprador: fields[PAGO_FACTURAS_FIELDS.NIT_COMPRADOR] || null,
            
            // Montos
            totalRecibir: parseNumber(fields[PAGO_FACTURAS_FIELDS.TOTAL_RECIBIR] || 0),
            saldoAnterior: parseNumber(fields[PAGO_FACTURAS_FIELDS.SALDO_ANTERIOR] || 0),
            montoRestante: parseNumber(fields[PAGO_FACTURAS_FIELDS.MONTO_RESTANTE] || 0),
            totalMovimientos: parseNumber(fields[PAGO_FACTURAS_FIELDS.TOTAL_MOVIMIENTOS] || 0),
            
            // Estado y fechas
            estadoFactura: fields[PAGO_FACTURAS_FIELDS.ESTADO_FACTURA] || 'Sin Pagar',
            fechaCreacion: fields[PAGO_FACTURAS_FIELDS.FECHA_CREACION] || null,
            ultimaModificacion: fields[PAGO_FACTURAS_FIELDS.ULTIMA_MODIFICACION] || null,
            
            // IDs relacionados - manejo de arrays
            idFactura: Array.isArray(fields[PAGO_FACTURAS_FIELDS.ID_FACTURA]) ? (fields[PAGO_FACTURAS_FIELDS.ID_FACTURA] as string[])[0] : fields[PAGO_FACTURAS_FIELDS.ID_FACTURA],
            movimientosBancarios: fields[PAGO_FACTURAS_FIELDS.MOVIMIENTOS_BANCARIOS] || []
          };

          console.log('📋 Factura sin pagar procesada:', {
            id: processedRecord.id,
            facturaNo: processedRecord.facturaNo,
            comprador: processedRecord.nombreComprador,
            total: processedRecord.totalRecibir,
            restante: processedRecord.montoRestante
          });

          records.push(processedRecord);
        });
        fetchNextPage();
      });

    console.log(`✅ Total facturas sin pagar obtenidas: ${records.length}`);

    return NextResponse.json({
      success: true,
      data: records,
      total: records.length,
      filtros: {
        estado: 'Sin Pagar',
        maxRecords
      }
    });

  } catch (error) {
    console.error('❌ Error en API facturas sin pagar:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error desconocido',
        success: false 
      },
      { status: 500 }
    );
  }
}