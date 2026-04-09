import { NextRequest, NextResponse } from 'next/server';
import { NOMINA_PERSONAL_FIELDS, NOMINA_ROLES_FIELDS, NOMINA_AREAS_FIELDS } from '@/lib/config/airtable-fields';

interface Employee {
  id: string;
  name: string;
  cedula: string;
  cargo: string;
  area: string;
}

// Configuración de Sirius Nomina Core
const NOMINA_BASE_ID = process.env.NOMINA_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const NOMINA_PERSONAL_TABLE_ID = process.env.NOMINA_PERSONAL_TABLE_ID;
const NOMINA_ROLES_TABLE_ID = process.env.NOMINA_ROLES_TABLE_ID;
const NOMINA_AREAS_TABLE_ID = process.env.NOMINA_AREAS_TABLE_ID;

async function airtableFetch(baseId: string, tableId: string, endpoint: string = '') {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Airtable error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function GET() {
  try {
    // Verificar que tenemos las credenciales necesarias
    if (!AIRTABLE_API_KEY || !NOMINA_BASE_ID || !NOMINA_PERSONAL_TABLE_ID) {
      console.error('Missing Nomina Core credentials');
      return NextResponse.json(
        { error: 'Missing database configuration' },
        { status: 500 }
      );
    }

    // Consultar la tabla Personal de Nómina Core con filtro de usuarios activos
    const filterFormula = `{${NOMINA_PERSONAL_FIELDS.ESTADO_ACTIVIDAD}} = 'Activo'`;
    const personalUrl = `https://api.airtable.com/v0/${NOMINA_BASE_ID}/${NOMINA_PERSONAL_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await fetch(personalUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Error fetching from Nomina Core:', response.status);
      return NextResponse.json(
        { error: 'Error fetching employees from Nomina Core' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Procesar los registros y extraer la información relevante
    const employeesPromises = data.records.map(async (record: any) => {
      const fields = record.fields;
      const name = (fields[NOMINA_PERSONAL_FIELDS.NOMBRE_COMPLETO] || '') as string;
      const cedula = (fields[NOMINA_PERSONAL_FIELDS.CEDULA] || '') as string;

      // Obtener rol del usuario (lookup a tabla Roles y Permisos)
      let cargo = 'Colaborador'; // Valor por defecto
      const rolIds = fields[NOMINA_PERSONAL_FIELDS.ROL] || [];

      if (rolIds.length > 0 && NOMINA_ROLES_TABLE_ID) {
        try {
          const rolData = await airtableFetch(NOMINA_BASE_ID!, NOMINA_ROLES_TABLE_ID, `/${rolIds[0]}`);
          cargo = rolData.fields[NOMINA_ROLES_FIELDS.NOMBRE_ROL] || 'Colaborador';
        } catch (error) {
          console.warn('Error fetching role for user');
        }
      }

      // Obtener área del usuario (lookup a tabla Areas)
      let area = 'Sin área';
      const areaIds = fields[NOMINA_PERSONAL_FIELDS.AREAS] || [];

      if (areaIds.length > 0 && NOMINA_AREAS_TABLE_ID) {
        try {
          const areaData = await airtableFetch(NOMINA_BASE_ID!, NOMINA_AREAS_TABLE_ID, `/${areaIds[0]}`);
          area = areaData.fields[NOMINA_AREAS_FIELDS.NOMBRE_AREA] || 'Sin área';
        } catch (error) {
          console.warn('Error fetching area for user');
        }
      }

      return {
        id: record.id,
        name,
        cedula,
        cargo,
        area
      };
    });

    const employees: Employee[] = (await Promise.all(employeesPromises))
      .filter((employee: Employee) => employee.name && employee.name.trim() !== '');

    // Ordenar por nombre
    employees.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Successfully fetched ${employees.length} employees from Nomina Core`);

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