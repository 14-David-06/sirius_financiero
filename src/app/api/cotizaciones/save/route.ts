import { NextRequest, NextResponse } from 'next/server';
import { COTIZACION_FIELDS, ITEMS_COTIZADOS_FIELDS, COMPRAS_FIELDS } from '@/lib/config/airtable-fields';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const COTIZACIONES_TABLE_ID = process.env.AIRTABLE_COTIZACIONES_TABLE_ID;
const ITEMS_COTIZADOS_TABLE_ID = process.env.AIRTABLE_ITEMS_COTIZADOS_TABLE_ID;
const COMPRAS_TABLE_ID = process.env.AIRTABLE_COMPRAS_TABLE_ID;

interface ItemCotizado {
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  valorUnitario: number;
  valorTotal: number;
  comentarios?: string;
  itemCompraId?: string;
}

interface CotizacionData {
  compraId: string;
  proveedorId?: string;
  idCotizacion: string;
  fecha: string;
  valorTotal: number;
  documentoUrl: string;
  solicitante: string;
  estado: string;
  comentarios?: string;
  items: ItemCotizado[];
}

async function airtableRequest(tableId: string, method: string, body?: object) {
  const response = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`,
    {
      method,
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Airtable error: ${errorData.error?.message || response.statusText}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    if (!AIRTABLE_BASE_ID || !AIRTABLE_API_KEY || !COTIZACIONES_TABLE_ID || !ITEMS_COTIZADOS_TABLE_ID) {
      return NextResponse.json(
        { error: 'Configuración de Airtable para cotizaciones no encontrada' },
        { status: 500 }
      );
    }

    const data: CotizacionData = await request.json();

    if (!data.compraId || !data.items?.length) {
      return NextResponse.json(
        { error: 'ID de compra y al menos un item son requeridos' },
        { status: 400 }
      );
    }

    // 1. Crear registro de Cotización
    const cotizacionFields: Record<string, any> = {
      [COTIZACION_FIELDS.ID_COTIZACION]: data.idCotizacion,
      [COTIZACION_FIELDS.FECHA]: data.fecha,
      // Valor Total Cotizado es rollup (computado) - no se escribe
      [COTIZACION_FIELDS.SOLICITANTE]: data.solicitante,
      [COTIZACION_FIELDS.COMPRA_RELACIONADA]: [data.compraId],
      [COTIZACION_FIELDS.ESTADO]: data.estado || 'Recibida',
    };

    if (data.documentoUrl) {
      cotizacionFields[COTIZACION_FIELDS.DOCUMENTO] = [
        { url: data.documentoUrl }
      ];
    }

    if (data.comentarios) {
      cotizacionFields[COTIZACION_FIELDS.COMENTARIOS] = data.comentarios;
    }

    if (data.proveedorId) {
      cotizacionFields[COTIZACION_FIELDS.PROVEEDOR] = [data.proveedorId];
    }

    const cotizacionRecord = await airtableRequest(COTIZACIONES_TABLE_ID, 'POST', {
      fields: cotizacionFields,
    });

    const cotizacionRecordId = cotizacionRecord.id;

    // 2. Crear Items Cotizados (en lotes de max 10 por request de Airtable)
    const itemRecords: any[] = [];
    const batches = [];
    
    for (let i = 0; i < data.items.length; i += 10) {
      batches.push(data.items.slice(i, i + 10));
    }

    for (const batch of batches) {
      const records = batch.map((item, idx) => {
        const fields: Record<string, any> = {
          [ITEMS_COTIZADOS_FIELDS.ID_ITEM_COTIZADO]: `${data.idCotizacion}-ITEM-${String(itemRecords.length + idx + 1).padStart(2, '0')}`,
          [ITEMS_COTIZADOS_FIELDS.COTIZACION_RELACIONADA]: [cotizacionRecordId],
          [ITEMS_COTIZADOS_FIELDS.DESCRIPCION]: item.descripcion,
          [ITEMS_COTIZADOS_FIELDS.CANTIDAD]: item.cantidad,
          [ITEMS_COTIZADOS_FIELDS.UNIDAD_MEDIDA]: item.unidadMedida,
          [ITEMS_COTIZADOS_FIELDS.VALOR_UNITARIO]: item.valorUnitario,
          // Valor Total Item Cotizado es formula (computado) - no se escribe
        };

        if (item.comentarios) {
          fields[ITEMS_COTIZADOS_FIELDS.COMENTARIOS] = item.comentarios;
        }

        if (item.itemCompraId) {
          fields[ITEMS_COTIZADOS_FIELDS.ITEM_COMPRA_RELACIONADO] = [item.itemCompraId];
        }

        return { fields };
      });

      const batchResult = await airtableRequest(ITEMS_COTIZADOS_TABLE_ID, 'POST', {
        records,
      });

      itemRecords.push(...(batchResult.records || []));
    }

    // 3. Actualizar Items Cotizados link en la Cotización
    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COTIZACIONES_TABLE_ID}/${cotizacionRecordId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            [COTIZACION_FIELDS.ITEMS_COTIZADOS]: itemRecords.map(r => r.id),
          }
        }),
      }
    );

    // 4. Actualizar URL de cotización en la Compra original
    if (data.documentoUrl && COMPRAS_TABLE_ID) {
      await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${COMPRAS_TABLE_ID}/${data.compraId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              [COMPRAS_FIELDS.COTIZACION_DOC]: data.documentoUrl,
            }
          }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      cotizacionId: cotizacionRecordId,
      itemsCreados: itemRecords.length,
      message: `Cotización creada con ${itemRecords.length} items`
    });

  } catch (error) {
    console.error('Error guardando cotización:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
