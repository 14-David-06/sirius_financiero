import { NextResponse } from 'next/server';

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
      url.searchParams.set('fields[]', 'Nombre');
      url.searchParams.append('fields[]', 'C.c o Nit');
      url.searchParams.append('fields[]', 'Ciudad');
      url.searchParams.set('sort[0][field]', 'Nombre');
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
          nombre: record.fields['Nombre'] || '',
          nit: record.fields['C.c o Nit'] || '',
          ciudad: record.fields['Ciudad'] || '',
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
