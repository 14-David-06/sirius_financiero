import { NextResponse } from 'next/server';

// Configuración Airtable para Sirius Nomina Core
const NOMINA_API_KEY = process.env.NOMINA_AIRTABLE_API_KEY || '';
const NOMINA_BASE_ID = process.env.NOMINA_AIRTABLE_BASE_ID || '';
const NOMINA_TABLE_NAME = process.env.NOMINA_AIRTABLE_TABLE_NAME || '';

export async function GET() {
  try {
    if (!NOMINA_API_KEY || !NOMINA_BASE_ID || !NOMINA_TABLE_NAME) {
      return NextResponse.json(
        { success: false, error: 'Configuración de Nomina Core no encontrada' },
        { status: 500 }
      );
    }

    // Obtener todos los registros con solo el campo "Area"
    const url = `https://api.airtable.com/v0/${NOMINA_BASE_ID}/${encodeURIComponent(NOMINA_TABLE_NAME)}?fields%5B%5D=Area&maxRecords=200`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${NOMINA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Error fetching areas from Nomina Core:', response.status);
      return NextResponse.json(
        { success: false, error: 'Error al consultar la base de Nómina' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Extraer áreas únicas y filtrar vacías
    const areasSet = new Set<string>();
    for (const record of data.records || []) {
      const area = record.fields?.Area;
      if (area && typeof area === 'string' && area.trim()) {
        areasSet.add(area.trim());
      }
    }

    const areas = Array.from(areasSet).sort();

    return NextResponse.json({
      success: true,
      areas,
      total: areas.length,
    });
  } catch (error) {
    console.error('Error en API areas-nomina:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
