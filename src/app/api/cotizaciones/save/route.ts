import { NextRequest, NextResponse } from 'next/server';

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
      [process.env.AIRTABLE_COT_ID_FIELD || 'ID Cotización']: data.idCotizacion,
      [process.env.AIRTABLE_COT_FECHA_FIELD || 'Fecha de Cotización']: data.fecha,
      // Valor Total Cotizado es rollup (computado) - no se escribe
      [process.env.AIRTABLE_COT_SOLICITANTE_FIELD || 'Solicitante']: data.solicitante,
      [process.env.AIRTABLE_COT_COMPRA_RELACIONADA_FIELD || 'Compras y Adquisiciones Relacionada']: [data.compraId],
      [process.env.AIRTABLE_COT_ESTADO_FIELD || 'Estado de Cotización']: data.estado || 'Recibida',
    };

    if (data.documentoUrl) {
      cotizacionFields[process.env.AIRTABLE_COT_DOCUMENTO_FIELD || 'Documento Cotización'] = [
        { url: data.documentoUrl }
      ];
    }

    if (data.comentarios) {
      cotizacionFields[process.env.AIRTABLE_COT_COMENTARIOS_FIELD || 'Comentarios'] = data.comentarios;
    }

    if (data.proveedorId) {
      cotizacionFields[process.env.AIRTABLE_COT_PROVEEDOR_FIELD || 'Proveedor'] = [data.proveedorId];
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
          [process.env.AIRTABLE_ICOT_ID_FIELD || 'ID Item Cotizado']: `${data.idCotizacion}-ITEM-${String(itemRecords.length + idx + 1).padStart(2, '0')}`,
          [process.env.AIRTABLE_ICOT_COTIZACION_FIELD || 'Cotización Relacionada']: [cotizacionRecordId],
          [process.env.AIRTABLE_ICOT_DESCRIPCION_FIELD || 'Descripción del Item']: item.descripcion,
          [process.env.AIRTABLE_ICOT_CANTIDAD_FIELD || 'Cantidad Cotizada']: item.cantidad,
          [process.env.AIRTABLE_ICOT_UNIDAD_FIELD || 'Unidad de Medida']: item.unidadMedida,
          [process.env.AIRTABLE_ICOT_VALOR_UNITARIO_FIELD || 'Valor Unitario Cotizado']: item.valorUnitario,
          // Valor Total Item Cotizado es formula (computado) - no se escribe
        };

        if (item.comentarios) {
          fields[process.env.AIRTABLE_ICOT_COMENTARIOS_FIELD || 'Comentarios Item Cotizado'] = item.comentarios;
        }

        if (item.itemCompraId) {
          fields[process.env.AIRTABLE_ICOT_ITEM_COMPRA_FIELD || 'Item Compra Relacionado'] = [item.itemCompraId];
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
            [process.env.AIRTABLE_COT_ITEMS_FIELD || 'Items Cotizados']: itemRecords.map(r => r.id),
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
              'Cotizacion Doc': data.documentoUrl,
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
