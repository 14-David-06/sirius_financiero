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

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_TEAM_TABLE_NAME = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    if (!checkRateLimit(clientIP, 3, 60000)) { // 3 requests per minute
      secureLog('⚠️ Rate limit excedido para setup password', { ip: clientIP });
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
    if (!body || !body.cedula || !body.password) {
      secureLog('⚠️ Solicitud incompleta para setup password', { ip: clientIP });
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
      secureLog('⚠️ Formato de cédula inválido en setup', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Formato de cédula inválido' }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Validar fortaleza de contraseña
    if (password.length < 6) {
      return new NextResponse(
        JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Sanitizar entrada
    const sanitizedCedula = sanitizeInput(cedula);

    // 🔒 Validar configuración de Airtable
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY) {
      secureLog('🚨 Configuración de Airtable no encontrada');
      return new NextResponse(
        JSON.stringify({ error: 'Configuración del servidor incompleta' }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Buscar usuario en Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TEAM_TABLE_NAME}`;
    const escapedCedula = escapeAirtableQuery(sanitizedCedula);
    const filterFormula = `{Cedula} = "${escapedCedula}"`;
    
    const searchResponse = await fetch(
      `${airtableUrl}?filterByFormula=${encodeURIComponent(filterFormula)}`,
      {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      secureLog('🚨 Error al consultar Airtable para setup', { status: searchResponse.status });
      return new NextResponse(
        JSON.stringify({ error: 'Error al consultar la base de datos' }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    const searchData = await searchResponse.json();

    if (!searchData.records || searchData.records.length === 0) {
      secureLog('⚠️ Intento de setup con cédula no válida');
      return new NextResponse(
        JSON.stringify({ error: 'Usuario no encontrado en el sistema' }),
        { 
          status: 404,
          headers: securityHeaders
        }
      );
    }

    const userRecord = searchData.records[0];
    const user = userRecord.fields;

    // Verificar si el usuario ya tiene contraseña
    if (user.Hash && user.Salt) {
      return new NextResponse(
        JSON.stringify({ error: 'El usuario ya tiene una contraseña configurada' }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    // Verificar que el usuario esté activo
    if (user['Estado Usuario'] !== 'Activo') {
      return new NextResponse(
        JSON.stringify({ error: 'Usuario inactivo. Contacte al administrador.' }),
        { 
          status: 403,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Generar hash y salt
    const saltRounds = 12;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 🔒 Actualizar usuario en Airtable
    const updateResponse = await fetch(`${airtableUrl}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          id: userRecord.id,
          fields: {
            Hash: hashedPassword,
            Salt: salt
          }
        }]
      })
    });

    if (!updateResponse.ok) {
      secureLog('🚨 Error al actualizar contraseña en Airtable', { status: updateResponse.status });
      return new NextResponse(
        JSON.stringify({ error: 'Error al configurar la contraseña' }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    secureLog('✅ Contraseña configurada exitosamente', { cedula: sanitizedCedula });
    
    return new NextResponse(
      JSON.stringify({
        success: true,
        message: 'Contraseña configurada exitosamente'
      }),
      {
        status: 200,
        headers: securityHeaders
      }
    );

  } catch (error) {
    secureLog('🚨 Error configurando contraseña', { 
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
