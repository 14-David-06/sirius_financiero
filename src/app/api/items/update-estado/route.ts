import { NextRequest, NextResponse } from 'next/server';
import { 
  sanitizeInput, 
  checkRateLimit, 
  securityHeaders,
  secureLog 
} from '@/lib/security/validation';

// Configuración de Airtable
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ITEMS_TABLE_ID = process.env.AIRTABLE_ITEMS_TABLE_ID;

export async function PATCH(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    if (!checkRateLimit(clientIP, 10, 60000)) { // 10 requests per minute
      secureLog('⚠️ Rate limit excedido en PATCH item estado', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        { 
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Validar configuración de Airtable
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !ITEMS_TABLE_ID) {
      secureLog('🚨 Configuración de Airtable no encontrada para update item');
      return new NextResponse(
        JSON.stringify({ error: 'Configuración de servidor no encontrada' }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Obtener y validar datos del body
    const body = await request.json();
    const { itemId, estadoItem } = body;

    // Validar parámetros requeridos
    if (!itemId || !estadoItem) {
      return new NextResponse(
        JSON.stringify({ error: 'itemId y estadoItem son requeridos' }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    // Validar que el estado sea uno de los permitidos
    const estadosPermitidos = ['Sin comprar', 'Comprado'];
    if (!estadosPermitidos.includes(estadoItem)) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Estado no válido. Estados permitidos: Sin comprar, Comprado' 
        }),
        { 
          status: 400,
          headers: securityHeaders
        }
      );
    }

    // Sanitizar inputs
    const sanitizedItemId = sanitizeInput(itemId);
    const sanitizedEstadoItem = sanitizeInput(estadoItem);

    // Construir URL para actualizar el item en Airtable
    const updateUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_TABLE_ID}/${sanitizedItemId}`;

    // Actualizar el estado del item
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Estado Item': sanitizedEstadoItem
        }
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      secureLog('🚨 Error al actualizar estado del item', { 
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        itemId: sanitizedItemId,
        errorText: errorText.substring(0, 200)
      });
      return new NextResponse(
        JSON.stringify({ 
          error: 'Error al actualizar el estado del item',
          details: process.env.NODE_ENV === 'development' ? {
            status: updateResponse.status,
            statusText: updateResponse.statusText
          } : undefined
        }),
        { 
          status: 500,
          headers: securityHeaders
        }
      );
    }

    const updatedItem = await updateResponse.json();

    secureLog('✅ Estado del item actualizado exitosamente', { 
      itemId: sanitizedItemId,
      nuevoEstado: sanitizedEstadoItem
    });

    return new NextResponse(
      JSON.stringify({
        success: true,
        message: 'Estado del item actualizado exitosamente',
        item: {
          id: updatedItem.id,
          estadoItem: updatedItem.fields['Estado Item']
        },
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: securityHeaders
      }
    );

  } catch (error) {
    console.error('Error actualizando estado del item:', error);
    secureLog('🚨 Error general en PATCH item estado', { 
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
    });
    
    return new NextResponse(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
