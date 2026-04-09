import { NextRequest, NextResponse } from 'next/server';
import {
  validateCedula,
  sanitizeInput,
  checkRateLimit,
  securityHeaders,
  secureLog,
  escapeAirtableQuery
} from '@/lib/security/validation';

// Configuración de Sirius Nomina Core
const NOMINA_BASE_ID = process.env.NOMINA_AIRTABLE_BASE_ID;
// Usar token específico de Nomina si existe, sino usar el token general
const AIRTABLE_API_KEY = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
const NOMINA_PERSONAL_TABLE_ID = process.env.NOMINA_PERSONAL_TABLE_ID;
const NOMINA_ROLES_TABLE_ID = process.env.NOMINA_ROLES_TABLE_ID;
const NOMINA_AREAS_TABLE_ID = process.env.NOMINA_AREAS_TABLE_ID;

// Nombres de campos — deben venir de variables de entorno
const PERSONAL_CEDULA_FIELD = process.env.NOMINA_PERSONAL_CEDULA_FIELD!;
const PERSONAL_NOMBRE_FIELD = process.env.NOMINA_PERSONAL_NOMBRE_FIELD!;
const PERSONAL_PASSWORD_FIELD = process.env.NOMINA_PERSONAL_PASSWORD_FIELD!;
const PERSONAL_ROL_FIELD = process.env.NOMINA_PERSONAL_ROL_FIELD!;
const PERSONAL_ESTADO_FIELD = process.env.NOMINA_PERSONAL_ESTADO_FIELD!;
const PERSONAL_AREAS_FIELD = process.env.NOMINA_PERSONAL_AREAS_FIELD!;
const ROLES_NOMBRE_FIELD = process.env.NOMINA_ROLES_NOMBRE_FIELD!;
const AREAS_NOMBRE_FIELD = process.env.NOMINA_AREAS_NOMBRE_FIELD!;

async function airtableFetch(baseId: string, tableId: string, endpoint: string = '', method: string = 'GET') {
  const url = `https://api.airtable.com/v0/${baseId}/${tableId}${endpoint}`;
  const response = await fetch(url, {
    method,
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    if (!checkRateLimit(clientIP, 5, 60000)) { // 5 requests per minute
      secureLog('⚠️ Rate limit excedido', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        { 
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Validar entrada
    const body = await request.json().catch(() => null);
    if (!body || !body.cedula) {
      secureLog('⚠️ Solicitud sin cédula', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Cédula es requerida' }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    const { cedula } = body;

    // 🔒 Validar formato de cédula
    if (!validateCedula(cedula)) {
      secureLog('⚠️ Formato de cédula inválido', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Formato de cédula inválido' }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Sanitizar entrada
    const sanitizedCedula = sanitizeInput(cedula);

    // 🔒 Validar configuración de Airtable
    if (!NOMINA_BASE_ID || !AIRTABLE_API_KEY || !NOMINA_PERSONAL_TABLE_ID) {
      secureLog('🚨 Configuración de Nomina Core no encontrada');
      return new NextResponse(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        {
          status: 500,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Buscar usuario en tabla Personal (Sirius Nomina Core)
    const escapedCedula = escapeAirtableQuery(sanitizedCedula);
    const filterFormula = `{${PERSONAL_CEDULA_FIELD}} = "${escapedCedula}"`;

    const personalUrl = `https://api.airtable.com/v0/${NOMINA_BASE_ID}/${NOMINA_PERSONAL_TABLE_ID}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    const response = await fetch(personalUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      secureLog('🚨 Error al consultar Nomina Core', { status: response.status });
      return new NextResponse(
        JSON.stringify({ error: 'Error al consultar la base de datos' }),
        {
          status: 500,
          headers: securityHeaders
        }
      );
    }

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      // Usuario encontrado
      const userRecord = data.records[0];
      const user = userRecord.fields;
      const recordId = userRecord.id;

      console.log('Usuario encontrado en Personal (Nomina Core):', {
        recordId,
        nombre: user[PERSONAL_NOMBRE_FIELD],
        cedula: sanitizedCedula
      });

      // Verificar estado del usuario
      if (user[PERSONAL_ESTADO_FIELD] !== 'Activo') {
        secureLog('⚠️ Intento de acceso con usuario inactivo', { cedula: sanitizedCedula });
        return new NextResponse(
          JSON.stringify({
            valid: false,
            inactive: true,
            message: `Usuario inactivo. Estado actual: ${user[PERSONAL_ESTADO_FIELD]}. Contacte al administrador para reactivar su cuenta.`
          }),
          {
            status: 200,
            headers: securityHeaders
          }
        );
      }

      // Verificar si necesita configurar contraseña
      const needsPasswordSetup = !user[PERSONAL_PASSWORD_FIELD];

      // 🔍 Obtener rol del usuario (lookup a tabla Roles y Permisos)
      let categoria = 'Colaborador'; // Valor por defecto
      const rolIds = user[PERSONAL_ROL_FIELD] || [];

      if (rolIds.length > 0 && NOMINA_ROLES_TABLE_ID) {
        try {
          const rolData = await airtableFetch(NOMINA_BASE_ID, NOMINA_ROLES_TABLE_ID, `/${rolIds[0]}`);
          const rolNombre = sanitizeInput(rolData.fields[ROLES_NOMBRE_FIELD] || 'Colaborador');

          // Mapeo de roles específicos a categorías de permisos
          const rolesToCategoria: Record<string, string> = {
            // Super Admin (acceso total)
            'INGENIERO DE DESARROLLO': 'Desarrollador',
            'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)': 'Desarrollador',
            'CTO (CHIEF TECHNOLOGY OFFICER)': 'Desarrollador',
            'COORDINADORA LIDER GERENCIA': 'Desarrollador',

            // Gerencia (acceso gerencial)
            'DIRECTOR FINANCIERO': 'Gerencia',
            'JEFE DE PLANTA': 'Gerencia',
            'JEFE DE PRODUCCION': 'Gerencia',
            'SUPERVISOR DE PRODUCCION': 'Gerencia',

            // Administrador (acceso administrativo)
            'CONTADORA': 'Administrador',
            'ASISTENTE FINANCIERO Y CONTABLE': 'Administrador',
            'COORDINADOR DE COMPRAS': 'Administrador',
            'ASISTENTE ADMINISTRATIVO': 'Administrador',

            // Colaborador (acceso básico) - cualquier otro rol
          };

          categoria = rolesToCategoria[rolNombre] || 'Colaborador';
        } catch (error) {
          secureLog('⚠️ Error al obtener rol del usuario', { error });
          // Continuar con valor por defecto
        }
      }

      // 🔍 Obtener área del usuario (lookup a tabla Areas)
      let area = '';
      const areaIds = user[PERSONAL_AREAS_FIELD] || [];

      if (areaIds.length > 0 && NOMINA_AREAS_TABLE_ID) {
        try {
          const areaData = await airtableFetch(NOMINA_BASE_ID, NOMINA_AREAS_TABLE_ID, `/${areaIds[0]}`);
          area = sanitizeInput(areaData.fields[AREAS_NOMBRE_FIELD] || '');
        } catch (error) {
          secureLog('⚠️ Error al obtener área del usuario', { error });
          // Continuar sin área
        }
      }

      secureLog('✅ Usuario validado exitosamente (Nomina Core)', {
        cedula: sanitizedCedula,
        categoria,
        area,
        needsPasswordSetup
      });

      return new NextResponse(
        JSON.stringify({
          valid: true,
          needsPasswordSetup,
          user: {
            cedula: sanitizeInput(user[PERSONAL_CEDULA_FIELD] || ''),
            nombre: sanitizeInput(user[PERSONAL_NOMBRE_FIELD] || 'No disponible'),
            categoria,
            area
          }
        }),
        {
          status: 200,
          headers: securityHeaders
        }
      );
    } else {
      // Usuario no encontrado
      secureLog('⚠️ Intento de acceso con cédula no válida');
      
      return new NextResponse(
        JSON.stringify({
          valid: false,
          message: 'Cédula no encontrada en el sistema'
        }),
        {
          status: 200,
          headers: securityHeaders
        }
      );
    }

  } catch (error) {
    secureLog('🚨 Error validando usuario', { 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
    return new NextResponse(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
