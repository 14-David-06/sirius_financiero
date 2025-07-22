import { NextRequest, NextResponse } from 'next/server';
import { 
  validateCedula, 
  sanitizeInput, 
  checkRateLimit, 
  securityHeaders,
  secureLog,
  escapeAirtableQuery 
} from '@/lib/security/validation';

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

    // 🔒 Consultar Airtable con escape seguro
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
      
      secureLog('✅ Usuario validado exitosamente');
      
      return new NextResponse(
        JSON.stringify({
          valid: true,
          user: {
            cedula: sanitizeInput(user.Cedula || ''),
            nombre: sanitizeInput(user.Nombre || 'No disponible'),
            cargo: sanitizeInput(user.Cargo || 'No disponible'),
            area: sanitizeInput(user.Area || 'No disponible'),
            email: sanitizeInput(user.Email || 'No disponible'),
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
