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

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_TEAM_TABLE_NAME = process.env.AIRTABLE_TEAM_TABLE_NAME || 'Equipo Financiero';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

    console.log('Usuario encontrado en Airtable:', {
      recordId,
      nombre: user.Nombre,
      cedula: sanitizedCedula
    });

    // Verificar estado del usuario
    if (user['Estado Usuario'] !== 'Activo') {
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
    if (!user.Hash || !user.Salt) {
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

    // 🔒 Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.Hash);
    
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

    // 🔒 Generar JWT token
    const token = jwt.sign(
      {
        recordId, // Agregar recordId al token
        cedula: sanitizedCedula,
        nombre: sanitizeInput(user.Nombre || ''),
        categoria: sanitizeInput(user['Categoria Usuario'] || ''),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 horas
      },
      JWT_SECRET
    );

    secureLog('✅ Login exitoso', { cedula: sanitizedCedula });
    
    return new NextResponse(
      JSON.stringify({
        success: true,
        token,
        user: {
          recordId, // Agregar recordId al objeto user
          cedula: sanitizedCedula,
          nombre: sanitizeInput(user.Nombre || ''),
          categoria: sanitizeInput(user['Categoria Usuario'] || ''),
          idChat: sanitizeInput(user.ID_Chat || '')
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
