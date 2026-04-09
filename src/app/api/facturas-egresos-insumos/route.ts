import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { FACTURACION_EGRESOS_FIELDS, ITEM_FACTURACION_EGRESOS_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);

// IDs de las tablas de Airtable desde variables de entorno
const FACTURACION_EGRESOS_TABLE = process.env.AIRTABLE_FACTURACION_EGRESOS_TABLE_ID || '';
const ITEM_FACTURACION_EGRESOS_TABLE = process.env.AIRTABLE_ITEM_FACTURACION_EGRESOS_TABLE_ID || '';

// Helper function para convertir valores a números de forma segura
function parseNumber(value: unknown): number {
  if (Array.isArray(value)) {
    return parseNumber(value[0]);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Helper para obtener string de forma segura
function parseString(value: unknown): string {
  if (Array.isArray(value)) {
    return parseString(value[0]);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value !== null && value !== undefined) {
    return String(value);
  }
  return '';
}

interface ItemFactura {
  id: string;
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
  'Unidad de Negocio'?: string;
  'Centro de Costo'?: string;
  COMENTARIOS?: string;
  TipoRTFE?: string;
}

interface FacturaEgreso {
  id: string;
  ID: string;
  'Número de Factura': string;
  'Fecha de Emisión': string;
  'Fecha de Vencimiento': string;
  Emisor: string;
  'NIT/CIF del Emisor': string;
  'Dirección del Emisor': string;
  'Forma de Pago': string;
  'Condiciones de Pago': string;
  Moneda: string;
  subtotal: number;
  descuentos: number;
  iva: number;
  inc: number;
  retencion: number;
  reteiva: number;
  reteica: number;
  total_pagar: number;
  'C. Costos'?: string;
  GRUPO?: string;
  CLASE?: string;
  CUENTA?: string;
  'SUB-CUENTA'?: string;
  'BANCO Y PROYECCION': string;
  tipo_retencion?: string;
  'Tipo de Operación'?: string;
  CUFE?: string;
  'Producto Terminado'?: string;
  'Clasificación del Costo'?: string;
  'Para Efectos Contables'?: string;
  items: ItemFactura[];
}

export async function GET() {
  try {
    // Validar configuración
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      console.error('❌ Faltan variables de entorno requeridas para Airtable');
      return NextResponse.json(
        { error: 'Configuración incompleta del servidor', success: false },
        { status: 500 }
      );
    }

    console.log('🔍 Buscando facturas pendientes de proyección o banco...');

    // Primero obtenemos las facturas con el filtro
    const facturas: FacturaEgreso[] = [];
    const facturaItemsMap: Map<string, string[]> = new Map();

    // IMPORTANTE: Las fórmulas de Airtable usan NOMBRES de campos, no Field IDs
    // Filtro: BANCO Y PROYECCION = "❌ Proyección y Banco", "❌ Proyección", o "❌ Banco"
    const filterFormula = `OR({${FACTURACION_EGRESOS_FIELDS.BANCO_Y_PROYECCION}} = "❌ Proyección y Banco", {${FACTURACION_EGRESOS_FIELDS.BANCO_Y_PROYECCION}} = "❌ Proyección", {${FACTURACION_EGRESOS_FIELDS.BANCO_Y_PROYECCION}} = "❌ Banco")`;
    
    console.log('📋 Filtro aplicado:', filterFormula);

    await base(FACTURACION_EGRESOS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: FACTURACION_EGRESOS_FIELDS.FECHA_EMISION, direction: 'desc' }],
        maxRecords: 100,
      })
      .eachPage((records, fetchNextPage) => {
        console.log(`📄 Página recibida con ${records.length} registros`);
        
        records.forEach((record) => {
          const fields = record.fields;
          
          console.log(`📋 Factura encontrada: ${record.id}`, {
            numeroFactura: fields[FACTURACION_EGRESOS_FIELDS.NUMERO_FACTURA],
            emisor: fields[FACTURACION_EGRESOS_FIELDS.EMISOR],
            bancoProyeccion: fields[FACTURACION_EGRESOS_FIELDS.BANCO_Y_PROYECCION],
          });

          // Obtener IDs de items relacionados usando nombre de campo
          const itemsRelacionados = fields[FACTURACION_EGRESOS_FIELDS.ITEMS_FACTURA] as string[] | undefined;
          if (itemsRelacionados && Array.isArray(itemsRelacionados)) {
            facturaItemsMap.set(record.id, itemsRelacionados);
          }

          const factura: FacturaEgreso = {
            id: record.id,
            // Usar nombres de campo desde config centralizada
            ID: parseString(fields[FACTURACION_EGRESOS_FIELDS.ID]),
            'Número de Factura': parseString(fields[FACTURACION_EGRESOS_FIELDS.NUMERO_FACTURA]),
            'Fecha de Emisión': parseString(fields[FACTURACION_EGRESOS_FIELDS.FECHA_EMISION]),
            'Fecha de Vencimiento': parseString(fields[FACTURACION_EGRESOS_FIELDS.FECHA_VENCIMIENTO]),
            Emisor: parseString(fields[FACTURACION_EGRESOS_FIELDS.EMISOR]),
            'NIT/CIF del Emisor': parseString(fields[FACTURACION_EGRESOS_FIELDS.NIT_EMISOR]),
            'Dirección del Emisor': parseString(fields[FACTURACION_EGRESOS_FIELDS.DIRECCION_EMISOR]),
            'Forma de Pago': parseString(fields[FACTURACION_EGRESOS_FIELDS.FORMA_PAGO]),
            'Condiciones de Pago': parseString(fields[FACTURACION_EGRESOS_FIELDS.CONDICIONES_PAGO]),
            Moneda: parseString(fields[FACTURACION_EGRESOS_FIELDS.MONEDA]) || 'COP',
            subtotal: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.SUBTOTAL]),
            descuentos: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.DESCUENTOS]),
            iva: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.IVA]),
            inc: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.INC]),
            retencion: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.RETENCION]),
            reteiva: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.RETEIVA]),
            reteica: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.RETEICA]),
            total_pagar: parseNumber(fields[FACTURACION_EGRESOS_FIELDS.TOTAL_PAGAR]),
            'C. Costos': parseString(fields[FACTURACION_EGRESOS_FIELDS.C_COSTOS]),
            GRUPO: parseString(fields[FACTURACION_EGRESOS_FIELDS.GRUPO]),
            CLASE: parseString(fields[FACTURACION_EGRESOS_FIELDS.CLASE]),
            CUENTA: parseString(fields[FACTURACION_EGRESOS_FIELDS.CUENTA]),
            'SUB-CUENTA': parseString(fields[FACTURACION_EGRESOS_FIELDS.SUB_CUENTA]),
            'BANCO Y PROYECCION': parseString(fields[FACTURACION_EGRESOS_FIELDS.BANCO_Y_PROYECCION]),
            tipo_retencion: parseString(fields[FACTURACION_EGRESOS_FIELDS.TIPO_RETENCION]),
            'Tipo de Operación': parseString(fields[FACTURACION_EGRESOS_FIELDS.TIPO_OPERACION]),
            CUFE: parseString(fields[FACTURACION_EGRESOS_FIELDS.CUFE]),
            'Producto Terminado': parseString(fields[FACTURACION_EGRESOS_FIELDS.PRODUCTO_TERMINADO]),
            'Clasificación del Costo': parseString(fields[FACTURACION_EGRESOS_FIELDS.CLASIFICACION_COSTO]),
            'Para Efectos Contables': parseString(fields[FACTURACION_EGRESOS_FIELDS.PARA_EFECTOS_CONTABLES]),
            items: [],
          };

          facturas.push(factura);
        });
        fetchNextPage();
      });

    console.log(`✅ Encontradas ${facturas.length} facturas con BANCO Y PROYECCIÓN ✅`);

    // Obtener todos los IDs de items únicos
    const allItemIds: Set<string> = new Set();
    facturaItemsMap.forEach((itemIds) => {
      itemIds.forEach(id => allItemIds.add(id));
    });

    // Ahora obtenemos los items de las facturas
    if (allItemIds.size > 0) {
      console.log(`🔍 Obteniendo ${allItemIds.size} items de las facturas...`);

      const itemsMap: Map<string, ItemFactura> = new Map();

      // Procesar items en batches
      const itemIdsArray = Array.from(allItemIds);
      const batchSize = 50;

      for (let i = 0; i < itemIdsArray.length; i += batchSize) {
        const batch = itemIdsArray.slice(i, i + batchSize);
        const recordIdFilter = batch.map(id => `RECORD_ID() = "${id}"`).join(', ');
        const itemFilter = `OR(${recordIdFilter})`;

        await base(ITEM_FACTURACION_EGRESOS_TABLE)
          .select({
            filterByFormula: itemFilter,
          })
          .eachPage((records, fetchNextPage) => {
            records.forEach((record) => {
              const fields = record.fields;

              const item: ItemFactura = {
                id: record.id,
                // Usar nombres de campo desde config centralizada
                Item: parseString(fields[ITEM_FACTURACION_EGRESOS_FIELDS.ITEM]),
                Unidad: parseString(fields[ITEM_FACTURACION_EGRESOS_FIELDS.UNIDAD]),
                Cantidad: parseNumber(fields[ITEM_FACTURACION_EGRESOS_FIELDS.CANTIDAD]),
                'Vr. Unitario': parseNumber(fields[ITEM_FACTURACION_EGRESOS_FIELDS.VR_UNITARIO]),
                'Vr. Total Flow 19%': parseNumber(fields[ITEM_FACTURACION_EGRESOS_FIELDS.VR_TOTAL_FLOW]),
                'Unidad de Negocio': parseString(fields[ITEM_FACTURACION_EGRESOS_FIELDS.UNIDAD_NEGOCIO]),
                'Centro de Costo': parseString(fields[ITEM_FACTURACION_EGRESOS_FIELDS.CENTRO_COSTO]),
                COMENTARIOS: parseString(fields[ITEM_FACTURACION_EGRESOS_FIELDS.COMENTARIOS]),
                TipoRTFE: parseString(fields[ITEM_FACTURACION_EGRESOS_FIELDS.TIPO_RTFE]),
              };

              itemsMap.set(record.id, item);
            });
            fetchNextPage();
          });
      }

      // Asignar items a cada factura
      facturas.forEach((factura) => {
        const itemIds = facturaItemsMap.get(factura.id);
        if (itemIds) {
          factura.items = itemIds
            .map(itemId => itemsMap.get(itemId))
            .filter((item): item is ItemFactura => item !== undefined);
        }
      });

      console.log(`✅ Items cargados correctamente`);
    }

    return NextResponse.json({
      success: true,
      facturas,
      total: facturas.length,
      message: `Se encontraron ${facturas.length} factura(s) pendientes de Proyección o Banco`,
    });

  } catch (error) {
    console.error('❌ Error obteniendo facturas para insumos:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al obtener facturas',
      },
      { status: 500 }
    );
  }
}
