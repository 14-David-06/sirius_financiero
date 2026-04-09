import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;
const ITEMS_OC_TABLE_ID = process.env.AIRTABLE_ITEMS_OC_TABLE_ID;

// Roles con acceso a warehouse
const WAREHOUSE_ALLOWED_ROLES = [
  'DIRECTOR EJECUTIVO (CEO) (Chief Executive Officer)',
  'CTO (CHIEF TECHNOLOGY OFFICER)',
  'DIRECTOR FINANCIERO',
  'COORDINADORA LIDER GERENCIA',
  'INGENIERO DE DESARROLLO',
  'JEFE DE PLANTA',
  'JEFE DE PRODUCCION',
  'SUPERVISOR DE PRODUCCION',
  'CONTADORA',
  'ASISTENTE FINANCIERO Y CONTABLE',
];

async function airtableFetch(baseId: string, tableId: string, filterFormula?: string) {
  const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
  if (filterFormula) {
    url.searchParams.set('filterByFormula', filterFormula);
  }
  url.searchParams.set('sort[0][field]', 'Fecha de Emisión');
  url.searchParams.set('sort[0][direction]', 'desc');

  const response = await fetch(url.toString(), {
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

/**
 * GET /api/warehouse/ordenes-pendientes
 *
 * Lista órdenes de compra en estado "Emitida" o "Recibida Parcial"
 * que requieren recepción en almacén
 */
export async function GET(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 20, 60000)) {
      secureLog('⚠️ Rate limit excedido en GET warehouse/ordenes-pendientes', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        {
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // 🔒 Autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401, headers: securityHeaders }
      );
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401, headers: securityHeaders }
      );
    }

    // 🔒 Autorización
    if (!WAREHOUSE_ALLOWED_ROLES.includes(decoded.categoria)) {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Se requiere rol de almacén o gerencial.' },
        { status: 403, headers: securityHeaders }
      );
    }

    // Validar configuración
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !ORDENES_TABLE_ID || !ITEMS_OC_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de base de datos no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Buscar OCs en estado Emitida o Recibida Parcial
    const filterFormula = `OR(
      {Estado Orden de Compra} = 'Emitida',
      {Estado Orden de Compra} = 'Recibida Parcial'
    )`;

    const ordenesData = await airtableFetch(AIRTABLE_BASE_ID, ORDENES_TABLE_ID, filterFormula);

    // Para cada OC, obtener sus items
    const ordenesConItems = await Promise.all(
      ordenesData.records.map(async (oc: any) => {
        const itemsIds = oc.fields['Items OC'] || [];
        const items = [];

        // Obtener items de la OC
        for (const itemId of itemsIds) {
          try {
            const itemUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_OC_TABLE_ID}/${itemId}`;
            const itemResponse = await fetch(itemUrl, {
              headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
            });

            if (itemResponse.ok) {
              const itemData = await itemResponse.json();
              items.push({
                id: itemData.id,
                descripcion: itemData.fields[process.env.AIRTABLE_IOC_DESCRIPCION_FIELD || 'Descripcion del Item'] || '',
                cantidad: itemData.fields[process.env.AIRTABLE_IOC_CANTIDAD_FIELD || 'Cantidad'] || 0,
                unidad: itemData.fields[process.env.AIRTABLE_IOC_UNIDAD_MEDIDA_FIELD || 'Unidad de Medida'] || 'Unidad',
                valorUnitario: itemData.fields[process.env.AIRTABLE_IOC_VALOR_UNITARIO_FIELD || 'Valor Unitario'] || 0,
                valorTotal: itemData.fields['Valor Total Item'] || 0,
              });
            }
          } catch (error) {
            console.error(`Error obteniendo item ${itemId}:`, error);
          }
        }

        return {
          id: oc.id,
          idOrdenCompra: oc.fields[process.env.AIRTABLE_OC_ID_FIELD || 'ID Orden de Compra'] || '',
          fechaEmision: oc.fields[process.env.AIRTABLE_OC_FECHA_EMISION_FIELD || 'Fecha de Emisión'] || '',
          estado: oc.fields[process.env.AIRTABLE_OC_ESTADO_FIELD || 'Estado Orden de Compra'] || '',
          prioridad: oc.fields[process.env.AIRTABLE_OC_PRIORIDAD_FIELD || 'Prioridad'] || 'Media',
          nombreSolicitante: oc.fields[process.env.AIRTABLE_OC_NOMBRE_SOLICITANTE_FIELD || 'Nombre Solicitante'] || '',
          area: oc.fields[process.env.AIRTABLE_OC_AREA_FIELD || 'Area Correspondiente'] || '',
          proveedor: oc.fields['Proveedor Nombre'] || [],
          subtotal: oc.fields['Subtotal'] || 0,
          iva: oc.fields[process.env.AIRTABLE_OC_IVA_FIELD || 'IVA'] || 0,
          totalNeto: oc.fields['Total Neto'] || 0,
          documentoUrl: oc.fields[process.env.AIRTABLE_OC_DOCUMENTO_FIELD || 'Documento OC'] || '',
          items,
        };
      })
    );

    secureLog('✅ Órdenes pendientes de recepción obtenidas', {
      usuario: decoded.nombre,
      cantidad: ordenesConItems.length,
    });

    return NextResponse.json({
      success: true,
      ordenes: ordenesConItems,
      total: ordenesConItems.length,
    }, { headers: securityHeaders });

  } catch (error) {
    console.error('Error obteniendo órdenes pendientes:', error);
    secureLog('🚨 Error en GET warehouse/ordenes-pendientes', {
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error interno del servidor',
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
