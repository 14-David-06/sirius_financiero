import { NextRequest, NextResponse } from 'next/server';
import base from '@/lib/airtable';

interface Employee {
  id: string;
  name: string;
  cedula: string;
  cargo: string;
  area: string;
}

// Función para mapear categoria a cargo y area
function mapCategoria(categoria: string): { cargo: string; area: string } {
  switch (categoria) {
    case "Desarrollador":
      return { cargo: "Ingeniero de desarrollo", area: "RAAS" };
    case "Gerencia":
      return { cargo: "Gerente", area: "Administrativo" };
    case "Administrador":
      return { cargo: "Administrador", area: "Administrativo" };
    case "Colaborador":
      return { cargo: "Colaborador", area: "Administrativo" };
    default:
      return { cargo: categoria, area: "Administrativo" };
  }
}

// Mapeo específico de usuarios conocidos (fallback adicional)
function getUserSpecificMapping(name: string): { cargo: string; area: string } | null {
  const userMappings: { [key: string]: { cargo: string; area: string } } = {
    "Santiago Amaya": { cargo: "Jefe de Planta", area: "Pirolisis" },
    "Luisa Ramirez": { cargo: "Coordinadora Líder", area: "Laboratorio" },
    "Katherin Roldan": { cargo: "Líder de SST", area: "SST" },
    "Yesenia Ramirez": { cargo: "Auxiliar de Laboratorio", area: "Laboratorio" },
    "Carolina Casas": { cargo: "Auxiliar Administrativo y Contable", area: "Administrativo" },
    "Juan Manuel": { cargo: "CMO", area: "Administrativo" },
    "Pablo Acebedo": { cargo: "CTO", area: "RAAS" },
    "Hermes David Hernandez Garcia": { cargo: "Ingeniero de desarrollo", area: "RAAS" },
    "David Hernandez": { cargo: "Ingeniero de desarrollo", area: "RAAS" }
  };

  return userMappings[name] || null;
}

export async function GET() {
  try {
    // Verificar que tenemos las credenciales necesarias
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TEAM_TABLE_NAME;

    if (!apiKey || !baseId || !tableName) {
      console.error('Missing Airtable credentials or table name');
      return NextResponse.json(
        { error: 'Missing database configuration' },
        { status: 500 }
      );
    }

    // Consultar la tabla Equipo Financiero con filtro de usuarios activos
    const records = await base(tableName)
      .select({
        filterByFormula: "{Estado Usuario} = 'Activo'"
      })
      .all();

    // Procesar los registros y extraer la información relevante
    const employees: Employee[] = records.map((record) => {
      const fields = record.fields;
      const name = (fields['Nombre'] || '') as string;

      // Preferir campos explícitos si existen
      const explicitCargo = ((fields['Cargo'] || fields['Position'] || '') as string).trim();
      const explicitArea = ((fields['Area'] || fields['Área'] || '') as string).trim();

      // Si no hay campos explícitos, intentar mapeo específico de usuario
      const userMapping = getUserSpecificMapping(name);

      // Si no hay mapeo específico, mapear desde la categoria
      const categoria = (fields['Categoria Usuario'] || '') as string;
      const categoryMapping = mapCategoria(categoria);

      // Prioridad: explícito > mapeo específico > mapeo por categoría
      const cargo = explicitCargo || (userMapping?.cargo) || categoryMapping.cargo || '';
      const area = explicitArea || (userMapping?.area) || categoryMapping.area || '';

      return {
        id: record.id,
        name,
        cedula: (fields['Cedula'] || '') as string,
        cargo,
        area
      };
    }).filter((employee: Employee) => employee.name && employee.name.trim() !== '');

    // Ordenar por nombre
    employees.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Successfully fetched ${employees.length} employees from Equipo Financiero`);

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

    // Usar la misma lógica pero con filtros
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_TEAM_TABLE_NAME;

    if (!apiKey || !baseId || !tableName) {
      return NextResponse.json(
        { error: 'Missing database configuration' },
        { status: 500 }
      );
    }

    // Construir filtro
    const filters = ["{Estado Usuario} = 'Activo'"];
    if (area) filters.push(`{Categoria Usuario} = '${area.replace(/'/g, "\\'")}'`);
    if (cargo) filters.push(`{Categoria Usuario} = '${cargo.replace(/'/g, "\\'")}'`);
    
    const filterFormula = filters.length > 1 ? `AND(${filters.join(', ')})` : filters[0];

    const records = await base(tableName)
      .select({
        filterByFormula: filterFormula
      })
      .all();

    const employees: Employee[] = records.map((record) => {
      const fields = record.fields;
      const name = (fields['Nombre'] || '') as string;

      const explicitCargo = ((fields['Cargo'] || fields['Position'] || '') as string).trim();
      const explicitArea = ((fields['Area'] || fields['Área'] || '') as string).trim();

      // Si no hay campos explícitos, intentar mapeo específico de usuario
      const userMapping = getUserSpecificMapping(name);

      // Si no hay mapeo específico, mapear desde la categoria
      const categoria = (fields['Categoria Usuario'] || '') as string;
      const categoryMapping = mapCategoria(categoria);

      // Prioridad: explícito > mapeo específico > mapeo por categoría
      const cargo = explicitCargo || (userMapping?.cargo) || categoryMapping.cargo || '';
      const area = explicitArea || (userMapping?.area) || categoryMapping.area || '';

      return {
        id: record.id,
        name,
        cedula: (fields['Cedula'] || '') as string,
        cargo,
        area
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
