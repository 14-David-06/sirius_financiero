import { NextRequest, NextResponse } from 'next/server';
import {
  OrdenCompraCompleta,
  ItemOCCompleto,
  ListarOrdenesCompraQuery,
  ListarOrdenesCompraResponse
} from '@/types/inventario';
import { sanitizeInput, checkRateLimit, securityHeaders, secureLog } from '@/lib/security/validation';
import { OC_FIELDS, ITEMS_OC_FIELDS } from '@/lib/config/airtable-fields';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const ORDENES_TABLE_ID = process.env.AIRTABLE_ORDENES_COMPRA_TABLE_ID;
const ITEMS_OC_TABLE_ID = process.env.AIRTABLE_ITEMS_OC_TABLE_ID;

async function airtableFetch(url: string) {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  try {
    // 🔒 Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    if (!checkRateLimit(clientIP, 20, 60000)) {
      secureLog('⚠️ Rate limit excedido en GET ordenes-compra', { ip: clientIP });
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intente más tarde.' }),
        {
          status: 429,
          headers: securityHeaders
        }
      );
    }

    // Validar configuración
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !ORDENES_TABLE_ID || !ITEMS_OC_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable no encontrada' },
        { status: 500, headers: securityHeaders }
      );
    }

    // Obtener y sanitizar parámetros de consulta
    const { searchParams } = new URL(request.url);
    const rawEstado = searchParams.get('estado');
    const rawProveedor = searchParams.get('proveedor');
    const rawDesde = searchParams.get('desde');
    const rawHasta = searchParams.get('hasta');
    const rawPrioridad = searchParams.get('prioridad');
    const rawMaxRecords = searchParams.get('maxRecords') || '100';

    // Construir filtro de Airtable
    const filtros: string[] = [];

    if (rawEstado) {
      const estado = sanitizeInput(rawEstado);
      filtros.push(`{${OC_FIELDS.ESTADO}} = "${estado}"`);
    }

    if (rawProveedor) {
      const proveedor = sanitizeInput(rawProveedor);
      filtros.push(`SEARCH("${proveedor}", ARRAYJOIN({${OC_FIELDS.PROVEEDOR}}))`);
    }

    if (rawDesde) {
      const desde = sanitizeInput(rawDesde);
      filtros.push(`IS_AFTER({${OC_FIELDS.FECHA_EMISION}}, "${desde}")`);
    }

    if (rawHasta) {
      const hasta = sanitizeInput(rawHasta);
      filtros.push(`IS_BEFORE({${OC_FIELDS.FECHA_EMISION}}, "${hasta}")`);
    }

    if (rawPrioridad) {
      const prioridad = sanitizeInput(rawPrioridad);
      filtros.push(`{${OC_FIELDS.PRIORIDAD}} = "${prioridad}"`);
    }

    const maxRecords = Math.min(parseInt(rawMaxRecords) || 100, 500);

    // Construir URL de consulta
    const ordenesUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ORDENES_TABLE_ID}`);
    ordenesUrl.searchParams.set('maxRecords', maxRecords.toString());
    ordenesUrl.searchParams.set('sort[0][field]', OC_FIELDS.FECHA_EMISION);
    ordenesUrl.searchParams.set('sort[0][direction]', 'desc');

    if (filtros.length > 0) {
      const filterFormula = filtros.length === 1
        ? filtros[0]
        : `AND(${filtros.join(', ')})`;
      ordenesUrl.searchParams.set('filterByFormula', filterFormula);
    }

    // Obtener órdenes de compra
    const ordenesData = await airtableFetch(ordenesUrl.toString());

    // Obtener todos los items relacionados
    const itemsUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ITEMS_OC_TABLE_ID}`);
    itemsUrl.searchParams.set('maxRecords', '1000');
    const itemsData = await airtableFetch(itemsUrl.toString());

    // Procesar órdenes de compra con sus items
    const ordenesCompra: OrdenCompraCompleta[] = ordenesData.records.map((orden: any) => {
      const f = orden.fields;

      // Filtrar items relacionados
      const itemsIds: string[] = f[OC_FIELDS.ITEMS_OC_LINK] || [];
      const itemsRelacionados = itemsData.records.filter((item: any) =>
        itemsIds.includes(item.id)
      );

      const items: ItemOCCompleto[] = itemsRelacionados.map((item: any) => {
        const fi = item.fields;
        return {
          id: item.id,
          idItemOC: fi[ITEMS_OC_FIELDS.ID_ITEM_OC] || '',
          ordenCompraRelacionadaId: fi[ITEMS_OC_FIELDS.ORDEN_COMPRA_RELACIONADA] || [],
          descripcion: fi[ITEMS_OC_FIELDS.DESCRIPCION] || '',
          centroCostos: fi[ITEMS_OC_FIELDS.CENTRO_COSTOS],
          cantidad: fi[ITEMS_OC_FIELDS.CANTIDAD] || 0,
          unidadMedida: fi[ITEMS_OC_FIELDS.UNIDAD_MEDIDA],
          valorUnitario: fi[ITEMS_OC_FIELDS.VALOR_UNITARIO] || 0,
          valorTotal: fi[ITEMS_OC_FIELDS.VALOR_TOTAL] || 0,
          comentarios: fi[ITEMS_OC_FIELDS.COMENTARIOS],
          itemCompraRelacionadoId: fi[ITEMS_OC_FIELDS.ITEM_COMPRA_RELACIONADO],
          itemCotizadoRelacionadoId: fi[ITEMS_OC_FIELDS.ITEM_COTIZADO_RELACIONADO],
        };
      });

      return {
        id: orden.id,
        idOrdenCompra: f[OC_FIELDS.ID_ORDEN_COMPRA] || '',
        fechaEmision: f[OC_FIELDS.FECHA_EMISION] || '',
        estadoOC: f[OC_FIELDS.ESTADO] || 'Emitida',
        proveedor: f[OC_FIELDS.PROVEEDOR],
        proveedorNombre: Array.isArray(f[OC_FIELDS.NOMBRE_FROM_PROVEEDOR])
          ? f[OC_FIELDS.NOMBRE_FROM_PROVEEDOR][0]
          : undefined,
        nombreSolicitante: f[OC_FIELDS.NOMBRE_SOLICITANTE],
        cargoSolicitante: f[OC_FIELDS.CARGO_SOLICITANTE],
        areaCorrespondiente: f[OC_FIELDS.AREA_CORRESPONDIENTE],
        prioridad: f[OC_FIELDS.PRIORIDAD],
        autorizadoPor: f[OC_FIELDS.AUTORIZADO_POR],
        descripcion: f[OC_FIELDS.DESCRIPCION],
        items,
        subtotal: f[OC_FIELDS.SUBTOTAL] || 0,
        iva: f[OC_FIELDS.IVA] || 0,
        retencion: f[OC_FIELDS.RETENCION] || 0,
        totalNeto: f[OC_FIELDS.TOTAL_NETO] || 0,
        documentoUrl: f[OC_FIELDS.DOCUMENTO_OC],
        cotizacionDocUrl: f[OC_FIELDS.COTIZACION_DOC_URL],
        comentarios: f[OC_FIELDS.COMENTARIOS],
        fechaAprobacion: f[OC_FIELDS.FECHA_APROBACION],
        compraRelacionadaId: f[OC_FIELDS.COMPRA_RELACIONADA],
        cotizacionRelacionadaId: f[OC_FIELDS.COTIZACION_RELACIONADA],
      };
    });

    const response: ListarOrdenesCompraResponse = {
      ordenesCompra,
      total: ordenesCompra.length,
      filtros: {
        estado: rawEstado as "En Tránsito" | "Recibida" | "Ingresada a Inventario" | "Cancelada" | "Emitida" | undefined,
        proveedor: rawProveedor || undefined,
        desde: rawDesde || undefined,
        hasta: rawHasta || undefined,
        prioridad: rawPrioridad as "Alta" | "Media" | "Baja" | undefined,
        maxRecords,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { headers: securityHeaders });

  } catch (error) {
    console.error('Error obteniendo órdenes de compra:', error);
    secureLog('🚨 Error en GET ordenes-compra', {
      error: error instanceof Error ? error.message : 'Error desconocido'
    });

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      },
      {
        status: 500,
        headers: securityHeaders
      }
    );
  }
}
