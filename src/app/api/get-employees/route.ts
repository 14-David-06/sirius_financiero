import { NextRequest, NextResponse } from 'next/server';

interface Employee {
  id: string;
  name: string;
  cedula: string;
  cargo: string;
  area: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
}

export async function GET() {
  try {
    // Verificar que tenemos las credenciales necesarias
    const apiKey = process.env.NOMINA_AIRTABLE_API_KEY;
    const baseId = process.env.NOMINA_AIRTABLE_BASE_ID;
    const tableName = process.env.NOMINA_AIRTABLE_TABLE_NAME;

    if (!apiKey || !baseId || !tableName) {
      console.error('Missing Airtable credentials for payroll database');
      return NextResponse.json(
        { error: 'Missing database configuration' },
        { status: 500 }
      );
    }

    // Construir la URL de la API de Airtable
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Airtable API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Failed to fetch employees from database' },
        { status: response.status }
      );
    }

    const data: AirtableResponse = await response.json();

    // Procesar los registros y extraer la información relevante
    const employees: Employee[] = data.records.map((record: AirtableRecord) => {
      const fields = record.fields;
      return {
        id: record.id,
        name: (fields['Nombre'] || fields['Name'] || fields['nombre'] || '') as string,
        cedula: (fields['Cedula'] || fields['Cédula'] || fields['cedula'] || '') as string,
        cargo: (fields['Cargo'] || fields['Position'] || fields['cargo'] || '') as string,
        area: (fields['Area'] || fields['Área'] || fields['area'] || fields['Department'] || '') as string
      };
    }).filter((employee: Employee) => employee.name && employee.name.trim() !== '');

    // Ordenar por nombre
    employees.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Successfully fetched ${employees.length} employees from payroll database`);

    return NextResponse.json({
      success: true,
      employees,
      count: employees.length
    });

  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching employees' },
      { status: 500 }
    );
  }
}

// También podemos agregar soporte para POST si necesitamos filtros específicos
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { area, cargo } = body;

    // Usar la misma lógica de GET pero con filtros
    const apiKey = process.env.NOMINA_AIRTABLE_API_KEY;
    const baseId = process.env.NOMINA_AIRTABLE_BASE_ID;
    const tableName = process.env.NOMINA_AIRTABLE_TABLE_NAME;

    if (!apiKey || !baseId || !tableName) {
      return NextResponse.json(
        { error: 'Missing database configuration' },
        { status: 500 }
      );
    }

    let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    
    // Agregar filtros si se proporcionan
    if (area || cargo) {
      const filters = [];
      if (area) filters.push(`{Area} = '${area}'`);
      if (cargo) filters.push(`{Cargo} = '${cargo}'`);
      
      if (filters.length > 0) {
        const filterFormula = filters.length > 1 ? `AND(${filters.join(', ')})` : filters[0];
        url += `?filterByFormula=${encodeURIComponent(filterFormula)}`;
      }
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch filtered employees' },
        { status: response.status }
      );
    }

    const data: AirtableResponse = await response.json();

    const employees: Employee[] = data.records.map((record: AirtableRecord) => {
      const fields = record.fields;
      return {
        id: record.id,
        name: (fields['Nombre'] || fields['Name'] || fields['nombre'] || '') as string,
        cedula: (fields['Cedula'] || fields['Cédula'] || fields['cedula'] || '') as string,
        cargo: (fields['Cargo'] || fields['Position'] || fields['cargo'] || '') as string,
        area: (fields['Area'] || fields['Área'] || fields['area'] || fields['Department'] || '') as string
      };
    }).filter((employee: Employee) => employee.name && employee.name.trim() !== '');

    employees.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      employees,
      count: employees.length,
      filters: { area, cargo }
    });

  } catch (error) {
    console.error('Error fetching filtered employees:', error);
    return NextResponse.json(
      { error: 'Internal server error while fetching filtered employees' },
      { status: 500 }
    );
  }
}
