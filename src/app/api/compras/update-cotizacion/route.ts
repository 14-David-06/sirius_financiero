import { NextResponse } from 'next/server';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const COMPRAS_TABLE_ID = process.env.AIRTABLE_COMPRAS_TABLE_ID;

export async function POST(request: Request) {
  try {
    const { compraId, cotizacionUrl } = await request.json();

    if (!compraId || !cotizacionUrl) {
      return NextResponse.json(
        { error: 'ID de compra y URL de cotización son requeridos' },
        { status: 400 }
      );
    }

    // Validar configuración de Airtable
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !COMPRAS_TABLE_ID) {
      console.error('Variables de entorno de Airtable no encontradas');
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    // Actualizar la cotización en Airtable
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}/${compraId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Cotizacion Doc': cotizacionUrl
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de Airtable:', errorData);
      return NextResponse.json(
        { error: `Error al actualizar la cotización: ${errorData.error?.message || 'Error desconocido'}` },
        { status: response.status }
      );
    }

    const updatedRecord = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Cotización actualizada correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar cotización:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
