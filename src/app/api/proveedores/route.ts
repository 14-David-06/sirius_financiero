import { NextResponse } from 'next/server';
import { PROVEEDORES_FIELDS } from '@/lib/config/airtable-fields';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const PROVEEDORES_TABLE_ID = process.env.AIRTABLE_PROVEEDORES_TABLE_ID;

export async function GET() {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !PROVEEDORES_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable para proveedores no encontrada' },
        { status: 500 }
      );
    }

    const proveedores: Array<{ id: string; nombre: string; nit: string; ciudad: string }> = [];
    let offset: string | undefined;

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${PROVEEDORES_TABLE_ID}`);
      url.searchParams.set('fields[]', PROVEEDORES_FIELDS.NOMBRE);
      url.searchParams.append('fields[]', PROVEEDORES_FIELDS.NIT);
      url.searchParams.append('fields[]', PROVEEDORES_FIELDS.CIUDAD);
      url.searchParams.set('sort[0][field]', PROVEEDORES_FIELDS.NOMBRE);
      url.searchParams.set('sort[0][direction]', 'asc');
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
      });

      if (!response.ok) {
        throw new Error(`Airtable error: ${response.statusText}`);
      }

      const data = await response.json();
      
      for (const record of data.records) {
        proveedores.push({
          id: record.id,
          nombre: record.fields[PROVEEDORES_FIELDS.NOMBRE] || '',
          nit: record.fields[PROVEEDORES_FIELDS.NIT] || '',
          ciudad: record.fields[PROVEEDORES_FIELDS.CIUDAD] || '',
        });
      }

      offset = data.offset;
    } while (offset);

    return NextResponse.json({ success: true, proveedores });
  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    return NextResponse.json(
      { error: 'Error al obtener proveedores' },
      { status: 500 }
    );
  }
}
