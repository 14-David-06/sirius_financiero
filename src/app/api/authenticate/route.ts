import { NextRequest, NextResponse } from 'next/server';
import {
  validateCedula,
  sanitizeInput,
  checkRateLimit,
  securityHeaders,
  secureLog,
  escapeAirtableQuery
} from '@/lib/security/validation';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Configuración de Sirius Nomina Core
const NOMINA_BASE_ID = process.env.NOMINA_AIRTABLE_BASE_ID;
// Usar token específico de Nomina si existe, sino usar el token general
const AIRTABLE_API_KEY = process.env.NOMINA_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
const NOMINA_PERSONAL_TABLE_ID = process.env.NOMINA_PERSONAL_TABLE_ID;
const NOMINA_ROLES_TABLE_ID = process.env.NOMINA_ROLES_TABLE_ID;
const NOMINA_AREAS_TABLE_ID = process.env.NOMINA_AREAS_TABLE_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Nombres de campos
const PERSONAL_CEDULA_FIELD = process.env.NOMINA_PERSONAL_CEDULA_FIELD || 'Numero Documento';
const PERSONAL_NOMBRE_FIELD = process.env.NOMINA_PERSONAL_NOMBRE_FIELD || 'Nombre completo';
const PERSONAL_PASSWORD_FIELD = process.env.NOMINA_PERSONAL_PASSWORD_FIELD || 'Password';
const PERSONAL_ROL_FIELD = process.env.NOMINA_PERSONAL_ROL_FIELD || 'Rol';
const PERSONAL_ESTADO_FIELD = process.env.NOMINA_PERSONAL_ESTADO_FIELD || 'Estado de actividad';
const PERSONAL_AREAS_FIELD = process.env.NOMINA_PERSONAL_AREAS_FIELD || 'Areas';
const ROLES_NOMBRE_FIELD = process.env.NOMINA_ROLES_NOMBRE_FIELD || 'Rol';
const AREAS_NOMBRE_FIELD = process.env.NOMINA_AREAS_NOMBRE_FIELD || 'Nombre del Area';

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
    // 🔒 Rate Limiting más estricto para login
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 5, 300000)) { // 5 intentos cada 5 minutos
      secureLog('⚠️ Rate limit excedido para login', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiados intentos de inicio de sesión. Intente más tarde.' }),
        {
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Validar entrada
    const body = await request.json().catch(() => null);
    if (!body || !body.cedula || !body.password) {
      secureLog('⚠️ Solicitud de login incompleta', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Cédula y contraseña son requeridas' }),
        {
          status: 400,
          headers: securityHeaders
        }
      );
    }

    const { cedula, password } = body;

    // 🔒 Validar formato de cédula
    if (!validateCedula(cedula)) {
      secureLog('⚠️ Formato de cédula inválido en login', { ip: clientIP });
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
      secureLog('🚨 Error al consultar Nomina Core para login', { status: response.status });
      return new NextResponse(
        JSON.stringify({ error: 'Error al consultar la base de datos' }),
        {
          status: 500,
          headers: securityHeaders
        }
      );
    }

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      secureLog('⚠️ Intento de login con cédula no válida', { cedula: sanitizedCedula });
      return new NextResponse(
        JSON.stringify({ error: 'Credenciales incorrectas' }),
        {
          status: 401,
          headers: securityHeaders
        }
      );
    }

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
      secureLog('⚠️ Intento de login con usuario inactivo', { cedula: sanitizedCedula });
      return new NextResponse(
        JSON.stringify({
          error: 'Usuario inactivo. Contacte al administrador para reactivar su cuenta.'
        }),
        {
          status: 403,
          headers: securityHeaders
        }
      );
    }

    // Verificar si el usuario tiene contraseña configurada
    if (!user[PERSONAL_PASSWORD_FIELD]) {
      return new NextResponse(
        JSON.stringify({
          needsPasswordSetup: true,
          message: 'Debe configurar su contraseña por primera vez'
        }),
        {
          status: 200,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Verificar contraseña (bcrypt con salt incluido en el hash)
    const isPasswordValid = await bcrypt.compare(password, user[PERSONAL_PASSWORD_FIELD]);

    if (!isPasswordValid) {
      secureLog('⚠️ Intento de login con contraseña incorrecta', { cedula: sanitizedCedula });
      return new NextResponse(
        JSON.stringify({ error: 'Credenciales incorrectas' }),
        {
          status: 401,
          headers: securityHeaders
        }
      );
    }

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

    // 🔒 Generar JWT token (sin idChat)
    const token = jwt.sign(
      {
        recordId,
        cedula: sanitizedCedula,
        nombre: sanitizeInput(user[PERSONAL_NOMBRE_FIELD] || ''),
        categoria,
        area,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
      },
      JWT_SECRET
    );

    secureLog('✅ Login exitoso (Nomina Core)', { cedula: sanitizedCedula, categoria, area });

    return new NextResponse(
      JSON.stringify({
        success: true,
        token,
        user: {
          recordId,
          cedula: sanitizedCedula,
          nombre: sanitizeInput(user[PERSONAL_NOMBRE_FIELD] || ''),
          categoria,
          area
        }
      }),
      {
        status: 200,
        headers: {
          ...securityHeaders,
          'Set-Cookie': `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
        }
      }
    );

  } catch (error) {
    secureLog('🚨 Error en login', {
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
