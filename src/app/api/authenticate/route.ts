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
import { resolverCategoria } from '@/lib/auth/roles';

// Configuración de Airtable - Sirius Nómina Core
const NOMINA_BASE_ID = process.env.NOMINA_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const NOMINA_PERSONAL_TABLE_ID = process.env.NOMINA_PERSONAL_TABLE_ID;
const NOMINA_ROLES_TABLE_ID = process.env.NOMINA_ROLES_TABLE_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Nombres de campos configurables
const CEDULA_FIELD = process.env.NOMINA_PERSONAL_CEDULA_FIELD || 'Numero Documento';
const NOMBRE_FIELD = process.env.NOMINA_PERSONAL_NOMBRE_FIELD || 'Nombre completo';
const PASSWORD_FIELD = process.env.NOMINA_PERSONAL_PASSWORD_FIELD || 'Password';
const ROL_FIELD = process.env.NOMINA_PERSONAL_ROL_FIELD || 'Rol';
const ESTADO_FIELD = process.env.NOMINA_PERSONAL_ESTADO_FIELD || 'Estado de actividad';
const ROL_NOMBRE_FIELD = process.env.NOMINA_ROLES_NOMBRE_FIELD || 'Rol';
// Nivel de acceso: fuente de verdad para los permisos de la app
const NIVEL_ACCESO_PERSONAL_FIELD =
  process.env.NOMINA_PERSONAL_NIVEL_ACCESO_FIELD || 'Nivel Acceso (from Nivel_Sistema_Nuevo)';
const NIVEL_ACCESO_ROL_FIELD = process.env.NOMINA_ROLES_NIVEL_ACCESO_FIELD || 'Nivel_Acceso';

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
      secureLog('🚨 Configuración de Sirius Nómina Core no encontrada');
      return new NextResponse(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        {
          status: 500,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Buscar usuario en Sirius Nómina Core
    const airtableUrl = `https://api.airtable.com/v0/${NOMINA_BASE_ID}/${NOMINA_PERSONAL_TABLE_ID}`;
    const escapedCedula = escapeAirtableQuery(sanitizedCedula);
    const filterFormula = `{${CEDULA_FIELD}} = "${escapedCedula}"`;
    
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
      secureLog('🚨 Error al consultar Airtable para login', { status: response.status });
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

    const user = data.records[0].fields;
    const recordId = data.records[0].id; // Obtener el ID del registro de Airtable

    console.log('Usuario encontrado en Sirius Nómina Core:', {
      recordId,
      nombre: user[NOMBRE_FIELD],
      cedula: sanitizedCedula
    });

    // Verificar estado del usuario
    const estadoUsuario = user[ESTADO_FIELD];
    if (estadoUsuario !== 'Activo') {
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
    const passwordHash = user[PASSWORD_FIELD];
    if (!passwordHash || typeof passwordHash !== 'string' || passwordHash.trim() === '') {
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

    // 🔒 Verificar contraseña (comparar con hash bcrypt almacenado)
    const isPasswordValid = await bcrypt.compare(password, passwordHash);
    
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

    // Obtener rol del usuario (puede ser un array de IDs de linked records)
    const rolArray = user[ROL_FIELD];
    const rolId = Array.isArray(rolArray) && rolArray.length > 0 ? rolArray[0] : null;

    // Si hay un rolId, obtener el nombre del rol y su nivel de acceso desde la tabla Roles
    let rolNombre = 'Colaborador'; // Default
    let nivelAccesoRol: unknown;
    if (rolId && NOMINA_ROLES_TABLE_ID) {
      try {
        const rolResponse = await fetch(
          `https://api.airtable.com/v0/${NOMINA_BASE_ID}/${NOMINA_ROLES_TABLE_ID}/${rolId}`,
          {
            headers: {
              'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (rolResponse.ok) {
          const rolData = await rolResponse.json();
          rolNombre = rolData.fields[ROL_NOMBRE_FIELD] || 'Colaborador';
          nivelAccesoRol = rolData.fields[NIVEL_ACCESO_ROL_FIELD];
        }
      } catch (error) {
        console.warn('No se pudo obtener el nombre del rol:', error);
      }
    }

    // Resolver la categoría de acceso desde el nivel registrado en Airtable.
    // El nivel asignado a la persona manda sobre el nivel genérico del rol.
    const nivelAccesoPersonal = user[NIVEL_ACCESO_PERSONAL_FIELD];
    const categoria = resolverCategoria({
      nivelAccesoPersonal,
      nivelAccesoRol,
      cargo: rolNombre,
    });

    secureLog('🔐 Categoría resuelta para login', {
      cedula: sanitizedCedula,
      rol: rolNombre,
      categoria,
    });

    // 🔒 Generar JWT token
    const token = jwt.sign(
      {
        recordId,
        cedula: sanitizedCedula,
        nombre: sanitizeInput(user[NOMBRE_FIELD] || ''),
        cargo: sanitizeInput(rolNombre),
        area: 'No especificada',
        email: sanitizeInput(user['Email'] || ''),
        categoria,
        rol: sanitizeInput(rolNombre),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
      },
      JWT_SECRET
    );

    secureLog('✅ Login exitoso', { cedula: sanitizedCedula, rol: rolNombre });

    return new NextResponse(
      JSON.stringify({
        success: true,
        token,
        user: {
          recordId,
          cedula: sanitizedCedula,
          nombre: sanitizeInput(user[NOMBRE_FIELD] || ''),
          cargo: sanitizeInput(rolNombre),
          area: 'No especificada',
          email: sanitizeInput(user['Email'] || ''),
          categoria,
          rol: sanitizeInput(rolNombre),
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
