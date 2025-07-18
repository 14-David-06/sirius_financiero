import { NextRequest, NextResponse } from 'next/server';

// Configuración de Airtable (debes configurar tus variables de entorno)
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_TABLE_NAME = 'Equipo Financiero';

export async function POST(request: NextRequest) {
  try {
    const { cedula } = await request.json();

    if (!cedula) {
      return NextResponse.json(
        { error: 'Cédula es requerida' },
        { status: 400 }
      );
    }

    // Validar configuración de Airtable
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500 }
      );
    }

    // Consultar Airtable para validar la cédula
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;
    const filterFormula = `{Cedula} = "${cedula}"`;
    
    const response = await fetch(
      `${airtableUrl}?filterByFormula=${encodeURIComponent(filterFormula)}`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Error al consultar la base de datos' },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      // Usuario encontrado
      const user = data.records[0].fields;
      return NextResponse.json({
        valid: true,
        user: {
          cedula: user.Cedula,
          nombre: user.Nombre || 'No disponible',
          cargo: user.Cargo || 'No disponible',
          area: user.Area || 'No disponible',
          email: user.Email || 'No disponible',
        }
      });
    } else {
      // Usuario no encontrado
      return NextResponse.json({
        valid: false,
        message: 'Cédula no encontrada en el sistema'
      });
    }

  } catch (error) {
    console.error('Error validando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
