import { NextResponse } from 'next/server';
import Airtable from 'airtable';

/**
 * Endpoint de debug para listar todos los campos de la tabla DIAN
 * GET /api/debug/dian-fields
 */
export async function GET() {
  try {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableId = process.env.AIRTABLE_DIAN_TABLE_ID;

    if (!apiKey || !baseId || !tableId) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno requeridas' },
        { status: 500 }
      );
    }

    const base = new Airtable({ apiKey }).base(baseId);
    const records = await base(tableId).select({ maxRecords: 1 }).firstPage();

    if (records.length === 0) {
      return NextResponse.json({
        message: 'La tabla está vacía',
        fields: [],
      });
    }

    const fields = Object.keys(records[0].fields).sort();

    // Filtrar campos relacionados con tipo/documento
    const tipoDocumentoFields = fields.filter(f =>
      f.toLowerCase().includes('tipo') || f.toLowerCase().includes('documento')
    );

    return NextResponse.json({
      totalFields: fields.length,
      allFields: fields,
      tipoDocumentoRelated: tipoDocumentoFields,
      sampleRecord: records[0].fields,
    });

  } catch (error) {
    console.error('Error listando campos DIAN:', error);
    return NextResponse.json(
      {
        error: 'Error al listar campos',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
