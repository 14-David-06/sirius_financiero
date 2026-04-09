import { NextResponse } from 'next/server';
import base from '@/lib/airtable';
import { CENTRALIZACION_FIELDS } from '@/lib/config/airtable-fields';

const CENTRALIZACION_TABLE_ID = process.env.AIRTABLE_CENTRALIZACION_TABLE_ID;

export async function GET() {
  try {
    // Validar variables de entorno requeridas
    if (!CENTRALIZACION_TABLE_ID) {
      console.error('❌ Falta variable de entorno AIRTABLE_CENTRALIZACION_TABLE_ID');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    // Obtener todos los años únicos
    const records = await base(CENTRALIZACION_TABLE_ID)
      .select({
        fields: [CENTRALIZACION_FIELDS.ANO_FORMULADO],
      })
      .all();

    // Extraer años únicos y ordenarlos
    const years = Array.from(
      new Set(
        records
          .map((record) => record.get(CENTRALIZACION_FIELDS.ANO_FORMULADO) as number)
          .filter((year) => year !== undefined && year !== null)
      )
    ).sort((a, b) => b - a); // Ordenar descendente (más reciente primero)

    return NextResponse.json({ 
      success: true, 
      years,
      total: years.length 
    });

  } catch (error) {
    console.error('Error fetching years:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener años disponibles' },
      { status: 500 }
    );
  }
}
