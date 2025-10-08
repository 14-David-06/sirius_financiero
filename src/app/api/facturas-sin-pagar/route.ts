import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

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
        filterByFormula: "{Estado_Factura} = 'Sin Pagar'",
        sort: [{ field: 'Fecha Creacion', direction: 'desc' }],
        view: "Grid view"
      })
      .eachPage((pageRecords, fetchNextPage) => {
        pageRecords.forEach((record) => {
          const fields = record.fields;
          
          console.log(`📄 Factura sin pagar encontrada: ${record.id}`);
          console.log('🔍 Campos:', Object.keys(fields));
          
          const processedRecord: Record<string, unknown> = {
            id: record.id,
            // Información básica de la factura - con fallbacks
            facturaNo: fields['Factura No'] || fields['FacturaNo'] || fields['Numero Factura'] || `F-${record.id.slice(-6)}`,
            nombreComprador: fields['Nombre del Comprador (from id_factura)'] || 
                           fields['Nombre del Comprador'] || 
                           fields['Cliente'] || 
                           fields['Comprador'] || 'Cliente no especificado',
            nitComprador: fields['NIT Comprador (from id_factura)'] || 
                         fields['NIT Comprador'] || 
                         fields['NIT'] || null,
            
            // Montos - con fallbacks y conversión segura
            totalRecibir: parseNumber(fields['Total_recibir'] || fields['Total Recibir'] || fields['Monto'] || 0),
            saldoAnterior: parseNumber(fields['Saldo Anterior'] || 0),
            montoRestante: parseNumber(fields['Monto_restante'] || fields['Monto Restante'] || fields['Pendiente'] || 0),
            totalMovimientos: parseNumber(fields['Total Movimientos'] || 0),
            
            // Estado y fechas
            estadoFactura: fields['Estado_Factura'] || fields['Estado Factura'] || fields['Estado'] || 'Sin Pagar',
            fechaCreacion: fields['Fecha Creacion'] || fields['Fecha de Creacion'] || fields['Created'] || null,
            ultimaModificacion: fields['Ultima Modificación'] || fields['Last Modified'] || null,
            
            // IDs relacionados - manejo de arrays
            idFactura: Array.isArray(fields['id_factura']) ? fields['id_factura'][0] : fields['id_factura'],
            movimientosBancarios: fields['Movimientos_Bancarios (from id_factura)'] || fields['Movimientos Bancarios'] || []
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