import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

interface Employee {
  id: string;
  name: string;
  cedula: string;
  cargo: string;
  area: string;
}

// Nombres de campos - usar variables de entorno o intentar variaciones comunes
const FIELD_NAMES = {
  nombre: process.env.AIRTABLE_FIELD_NOMBRE || 'Nombre',
  cedula: process.env.AIRTABLE_FIELD_CEDULA || 'Cedula',
  cargo: process.env.AIRTABLE_FIELD_CARGO || 'Cargo',
  area: process.env.AIRTABLE_FIELD_AREA || 'Área',
  estado: process.env.AIRTABLE_FIELD_ESTADO_USUARIO || 'Estado Usuario',
};

// Función auxiliar para intentar obtener un campo con variaciones de nombre
function getFieldValue(fields: Record<string, unknown>, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const value = fields[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return String(value).trim();
    }
  }
  return '';
}

export async function GET() {
  const tableName = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';

  // Intentar primero con la base principal, luego con Nomina
  const attempts = [
    {
      name: 'Base Principal (Financiera)',
      key: process.env.AIRTABLE_API_KEY,
      baseId: process.env.AIRTABLE_BASE_ID
    },
    {
      name: 'Base Nomina Core',
      key: process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY,
      baseId: process.env.NOMINA_AIRTABLE_BASE_ID
    }
  ];

  let lastError: any = null;

  for (const attempt of attempts) {
    if (!attempt.key || !attempt.baseId) {
      console.log(`⏭️ Saltando ${attempt.name}: credenciales no configuradas`);
      continue;
    }

    try {
      console.log(`\n📊 Intentando conectar a ${attempt.name}`);
      console.log(`📦 Base ID: ${attempt.baseId.substring(0, 8)}...`);
      console.log(`📋 Tabla: ${tableName}`);

      const base = new Airtable({ apiKey: attempt.key }).base(attempt.baseId);

      // Consultar la tabla con filtro de usuarios activos
      const records = await base(tableName)
        .select({
          filterByFormula: `{${FIELD_NAMES.estado}} = 'Activo'`
        })
        .all();

      console.log(`✅ Conexión exitosa a ${attempt.name}!`);
      console.log(`📊 Encontrados ${records.length} registros`);

      // Procesar los registros
      const allRecords: Employee[] = [];
      const incompleteRecords: Array<{ name: string; missingFields: string[] }> = [];

      records.forEach((record) => {
        const fields = record.fields as Record<string, unknown>;

        const name = getFieldValue(fields, [FIELD_NAMES.nombre, 'Name', 'Usuario']);
        const cedula = getFieldValue(fields, [FIELD_NAMES.cedula, 'CC', 'Cédula', 'Identificación']);
        const cargo = getFieldValue(fields, [
          FIELD_NAMES.cargo,
          'Position',
          'Posición',
          'Titulo',
          'Title',
          'Puesto'
        ]);
        const area = getFieldValue(fields, [
          FIELD_NAMES.area,
          'Area',
          'Área de trabajo',
          'Department',
          'Departamento',
          'Division'
        ]);

        const employee: Employee = {
          id: record.id,
          name,
          cedula,
          cargo,
          area
        };

        if (employee.name && employee.cargo && employee.area) {
          allRecords.push(employee);
        } else {
          const missingFields: string[] = [];
          if (!employee.name) missingFields.push('Nombre');
          if (!employee.cargo) missingFields.push('Cargo');
          if (!employee.area) missingFields.push('Área');

          incompleteRecords.push({
            name: employee.name || 'Sin nombre',
            missingFields
          });
        }
      });

      const employees = allRecords;
      employees.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Successfully fetched ${employees.length} employees from ${attempt.name}`);
      console.log(`📋 Total de registros activos: ${records.length}`);

      // Log de registros incompletos
      if (incompleteRecords.length > 0) {
        console.warn(`\n⚠️ ${incompleteRecords.length} registros excluidos por falta de datos:`);
        incompleteRecords.slice(0, 5).forEach((rec) => {
          console.warn(`   - "${rec.name}": Falta(n) ${rec.missingFields.join(', ')}`);
        });
        if (incompleteRecords.length > 5) {
          console.warn(`   ... y ${incompleteRecords.length - 5} más`);
        }
      }

      // Log de campos disponibles si no hay empleados
      if (records.length > 0 && employees.length === 0) {
        console.log('\n🔍 Campos disponibles en el primer registro:');
        console.log(Object.keys(records[0].fields).join(', '));
      }

      // ✅ ÉXITO - Retornar los empleados
      return NextResponse.json({
        success: true,
        employees,
        count: employees.length,
        source: attempt.name
      });

    } catch (error: any) {
      console.error(`❌ Error con ${attempt.name}:`, error.message);
      lastError = error;

      // Si es error de permisos, intentar siguiente base
      if (error.statusCode === 403 || error.error === 'NOT_AUTHORIZED') {
        console.log(`   → Intentando siguiente base...`);
        continue;
      }

      // Si es otro tipo de error, no intentar más
      break;
    }
  }

  // Si llegamos aquí, ninguna base funcionó
  console.error('\n❌ No se pudo conectar a ninguna base');
  console.error('\n💡 SOLUCIONES:');
  console.error('   1. Verifica que AIRTABLE_BASE_ID o NOMINA_AIRTABLE_BASE_ID estén correctos');
  console.error('   2. Asegúrate de que la API Key tenga acceso a al menos una de las bases');
  console.error('   3. Lee PERMISOS_AIRTABLE.md para más información');

  return NextResponse.json(
    {
      error: 'No se pudo cargar empleados desde ninguna base',
      details: lastError?.message || 'Error desconocido',
      hint: 'Revisa los permisos de la API Key en Airtable'
    },
    { status: lastError?.statusCode || 500 }
  );
}

// POST con filtros
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { area, cargo } = body;

    const tableName = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';
    const nominaKey = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
    const nominaBaseId = process.env.NOMINA_AIRTABLE_BASE_ID;

    if (!nominaKey || !nominaBaseId) {
      return NextResponse.json(
        { error: 'Missing Nomina database configuration' },
        { status: 500 }
      );
    }

    const nominaBase = new Airtable({ apiKey: nominaKey }).base(nominaBaseId);

    const filters = [`{${FIELD_NAMES.estado}} = 'Activo'`];
    if (area) filters.push(`{${FIELD_NAMES.area}} = '${area.replace(/'/g, "\\'")}'`);
    if (cargo) filters.push(`{${FIELD_NAMES.cargo}} = '${cargo.replace(/'/g, "\\'")}'`);

    const filterFormula = filters.length > 1 ? `AND(${filters.join(', ')})` : filters[0];

    const records = await nominaBase(tableName)
      .select({
        filterByFormula: filterFormula
      })
      .all();

    const employees: Employee[] = records.map((record) => {
      const fields = record.fields as Record<string, unknown>;

      const name = getFieldValue(fields, [FIELD_NAMES.nombre, 'Name', 'Usuario']);
      const cedula = getFieldValue(fields, [FIELD_NAMES.cedula, 'CC', 'Cédula']);
      const cargoValue = getFieldValue(fields, [FIELD_NAMES.cargo, 'Position', 'Puesto']);
      const areaValue = getFieldValue(fields, [FIELD_NAMES.area, 'Area', 'Department']);

      return {
        id: record.id,
        name,
        cedula,
        cargo: cargoValue,
        area: areaValue
      };
    }).filter((employee: Employee) => {
      return employee.name && employee.cargo && employee.area;
    });

    employees.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      employees,
      count: employees.length,
      filters: { area, cargo }
    });

  } catch (error: any) {
    console.error('❌ Error fetching filtered employees:', error);
    return NextResponse.json(
      {
        error: 'Internal server error while fetching filtered employees',
        details: error.message
      },
      { status: 500 }
    );
  }
}
