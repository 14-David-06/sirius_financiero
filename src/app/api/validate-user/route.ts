import { NextRequest, NextResponse } from 'next/server';
import { 
  validateCedula, 
  sanitizeInput, 
  checkRateLimit, 
  securityHeaders,
  secureLog,
  escapeAirtableQuery 
} from '@/lib/security/validation';

// Configuración de Airtable - Sirius Nómina Core
const NOMINA_BASE_ID = process.env.NOMINA_AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const NOMINA_PERSONAL_TABLE_ID = process.env.NOMINA_PERSONAL_TABLE_ID;
const NOMINA_ROLES_TABLE_ID = process.env.NOMINA_ROLES_TABLE_ID;

// Nombres de campos configurables
const CEDULA_FIELD = process.env.NOMINA_PERSONAL_CEDULA_FIELD || 'Numero Documento';
const NOMBRE_FIELD = process.env.NOMINA_PERSONAL_NOMBRE_FIELD || 'Nombre completo';
const PASSWORD_FIELD = process.env.NOMINA_PERSONAL_PASSWORD_FIELD || 'Password';
const ROL_FIELD = process.env.NOMINA_PERSONAL_ROL_FIELD || 'Rol';
const ESTADO_FIELD = process.env.NOMINA_PERSONAL_ESTADO_FIELD || 'Estado de actividad';
const ROL_NOMBRE_FIELD = process.env.NOMINA_ROLES_NOMBRE_FIELD || 'Rol';

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
      secureLog('🚨 Configuración de Sirius Nómina Core no encontrada');
      return new NextResponse(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        {
          status: 500,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Consultar Sirius Nómina Core con escape seguro
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
      secureLog('🚨 Error al consultar Airtable', { status: response.status });
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
      const user = data.records[0].fields;

      // Verificar estado del usuario
      const estadoUsuario = user[ESTADO_FIELD];
      if (estadoUsuario !== 'Activo') {
        secureLog('⚠️ Intento de acceso con usuario inactivo', { cedula: sanitizedCedula });
        return new NextResponse(
          JSON.stringify({
            valid: false,
            inactive: true,
            message: `Usuario inactivo. Estado actual: ${estadoUsuario}. Contacte al administrador para reactivar su cuenta.`
          }),
          {
            status: 200,
            headers: securityHeaders
          }
        );
      }

      // Verificar si necesita configurar contraseña
      const passwordHash = user[PASSWORD_FIELD];
      const needsPasswordSetup = !passwordHash || typeof passwordHash !== 'string' || passwordHash.trim() === '';

      secureLog('✅ Usuario validado exitosamente', { cedula: sanitizedCedula });

      // Obtener rol del usuario (puede ser un array de IDs de linked records)
      const rolArray = user[ROL_FIELD];
      const rolId = Array.isArray(rolArray) && rolArray.length > 0 ? rolArray[0] : null;

      // Si hay un rolId, obtener el nombre del rol desde la tabla Roles
      let rolNombre = 'Colaborador'; // Default
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
          }
        } catch (error) {
          console.warn('No se pudo obtener el nombre del rol:', error);
        }
      }

      return new NextResponse(
        JSON.stringify({
          valid: true,
          needsPasswordSetup,
          user: {
            cedula: sanitizeInput(user[CEDULA_FIELD] || ''),
            nombre: sanitizeInput(user[NOMBRE_FIELD] || 'No disponible'),
            cargo: sanitizeInput(rolNombre),
            area: 'No especificada',
            email: sanitizeInput(user['Email'] || ''),
            categoria: sanitizeInput(rolNombre),
            rol: sanitizeInput(rolNombre),
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
