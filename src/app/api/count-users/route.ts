import { NextRequest, NextResponse } from 'next/server';
import base from '@/lib/airtable';

// Configuración de Airtable
const AIRTABLE_TEAM_TABLE_NAME = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verificar credenciales
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      console.error('Missing Airtable credentials');
      return NextResponse.json(
        { error: 'Missing database configuration' },
        { status: 500 }
      );
    }

    // Consultar la tabla Equipo Financiero
    const records = await base(AIRTABLE_TEAM_TABLE_NAME)
      .select({
        fields: ['Cedula', 'Nombre', 'Categoria Usuario', 'Estado Usuario'], // Campos necesarios
        filterByFormula: "{Estado Usuario} = 'Activo'" // Solo usuarios activos
      })
      .all();

    // Extraer nombres y cargos
    const users = records.map(record => ({
      nombre: record.fields['Nombre'] || 'Sin nombre',
      cargo: record.fields['Categoria Usuario'] || 'Sin cargo',
      cedula: record.fields['Cedula'] || 'Sin cédula'
    }));

    return NextResponse.json({
      success: true,
      users: users,
      total: users.length
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Error al consultar la base de datos' },
      { status: 500 }
    );
  }
}
