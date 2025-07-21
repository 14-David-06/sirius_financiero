import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { compraId, nuevoEstado, nombresAdmin } = await request.json();
    
    // Log removido por seguridad;

    if (!compraId || !nuevoEstado || !nombresAdmin) {
      console.error('Faltan datos requeridos');
      return NextResponse.json(
        { error: 'ID de compra, nuevo estado y nombre del administrador son requeridos' },
        { status: 400 }
      );
    }

    // Configurar Airtable
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const airtableApiKey = process.env.AIRTABLE_API_KEY;

    if (!airtableBaseId || !airtableApiKey) {
      console.error('Variables de entorno de Airtable no encontradas');
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    console.log('Actualizando registro en Airtable...');

    // Actualizar el estado en Airtable
    const response = await fetch(
      `https://api.airtable.com/v0/${airtableBaseId}/tblC7QjS4OeexqlbM/${compraId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${airtableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            'Estado Solicitud': nuevoEstado,
            'Nombres Admin': nombresAdmin
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de Airtable:', errorData);
      return NextResponse.json(
        { error: `Error al actualizar el estado en la base de datos: ${errorData.error?.message || 'Error desconocido'}` },
        { status: response.status }
      );
    }

    const updatedRecord = await response.json();
    console.log('Registro actualizado exitosamente:', updatedRecord);

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: 'Estado actualizado correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
