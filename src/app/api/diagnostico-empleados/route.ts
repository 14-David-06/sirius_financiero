import { NextResponse } from 'next/server';
import Airtable from 'airtable';

/**
 * Endpoint de diagnóstico para ver qué campos existen en la tabla Equipo Financiero
 * de la base Nomina Core y qué valores tienen los empleados.
 *
 * Acceso: GET /api/diagnostico-empleados
 */
export async function GET() {
  try {
    // Usar la base de NOMINA donde están los datos de empleados
    const nominaKey = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
    const nominaBaseId = process.env.NOMINA_AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';

    if (!nominaKey || !nominaBaseId) {
      return NextResponse.json(
        {
          error: 'Missing Nomina Airtable configuration',
          hint: 'Asegúrate de tener NOMINA_AIRTABLE_BASE_ID configurado en .env.local'
        },
        { status: 500 }
      );
    }

    console.log(`🔍 Diagnóstico: Conectando a base Nomina Core, tabla: ${tableName}`);

    // Conectar a la base de Nomina
    const nominaBase = new Airtable({ apiKey: nominaKey }).base(nominaBaseId);

    // Obtener todos los registros activos
    const records = await nominaBase(tableName)
      .select({
        filterByFormula: "{Estado Usuario} = 'Activo'",
        maxRecords: 10 // Solo primeros 10 para diagnóstico
      })
      .all();

    // Extraer información de diagnóstico
    const diagnostico = {
      totalRegistros: records.length,
      camposDisponibles: records.length > 0 ? Object.keys(records[0].fields) : [],
      registrosEjemplo: records.slice(0, 3).map(record => {
        const fields = record.fields;
        return {
          id: record.id,
          camposCompletos: Object.entries(fields).reduce((acc, [key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              acc[key] = typeof value === 'string' && value.length > 50
                ? value.substring(0, 50) + '...'
                : value;
            }
            return acc;
          }, {} as Record<string, unknown>)
        };
      })
    };

    return NextResponse.json({
      success: true,
      baseDeDatos: 'Sirius Nomina Core ✅',
      configuracion: {
        NOMINA_AIRTABLE_BASE_ID: nominaBaseId ? '✅ Configurado' : '❌ No configurado',
        NOMINA_AIRTABLE_API_KEY: nominaKey ? '✅ Configurado' : '❌ No configurado',
        AIRTABLE_TEAM_TABLE_NAME: tableName || '❌ No configurado',
        AIRTABLE_FIELD_NOMBRE: process.env.AIRTABLE_FIELD_NOMBRE || 'Nombre (por defecto)',
        AIRTABLE_FIELD_CARGO: process.env.AIRTABLE_FIELD_CARGO || 'Cargo (por defecto)',
        AIRTABLE_FIELD_AREA: process.env.AIRTABLE_FIELD_AREA || 'Área (por defecto)',
      },
      diagnostico,
      recomendaciones: [
        '✅ Los empleados se obtienen de la base NOMINA CORE (no de la base principal)',
        '✅ Verifica que los campos "Cargo" y "Área" (o "Area") existan en Airtable Nomina Core',
        '✅ Asegúrate de que estos campos tengan valores para todos los empleados activos',
        '✅ Si los nombres de tus campos son diferentes, configura las variables de entorno correspondientes',
        '✅ La API intentará automáticamente variaciones comunes como: Cargo/Position/Puesto y Área/Area/Department'
      ]
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return NextResponse.json(
      {
        error: 'Error al obtener diagnóstico',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
