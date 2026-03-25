import { NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración Airtable para Sirius Insumos Core — tabla Areas
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const AREAS_TABLE = process.env.AIRTABLE_AREAS_TABLE_ID || '';

const base = new Airtable({ apiKey: process.env.AIRTABLE_INS_API_KEY }).base(INSUMOS_BASE_ID);

export async function GET() {
  try {
    if (!INSUMOS_BASE_ID || !AREAS_TABLE || !process.env.AIRTABLE_INS_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Areas no encontrada' },
        { status: 500 }
      );
    }

    interface AreaRecord {
      id: string;
      nombre: string;
      idCore: string;
      responsable: string;
    }

    const areasData: AreaRecord[] = [];

    await base(AREAS_TABLE)
      .select({ fields: ['Name', 'ID Core', 'Responsable'] })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          const nombre = record.fields['Name'] as string || '';
          if (nombre.trim()) {
            areasData.push({
              id: record.id,
              nombre: nombre.trim(),
              idCore: record.fields['ID Core'] as string || '',
              responsable: record.fields['Responsable'] as string || '',
            });
          }
        });
        fetchNextPage();
      });

    // Compatibilidad: devolver lista simple de nombres + datos completos
    const areas = areasData.map(a => a.nombre).sort();

    return NextResponse.json({
      success: true,
      areas,
      areasDetalle: areasData,
      total: areasData.length,
    });
  } catch (error) {
    console.error('Error en API areas-nomina:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
