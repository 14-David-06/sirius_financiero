import { NextResponse } from 'next/server';
import Airtable from 'airtable';

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
    const filterFormula = `OR({BANCO Y PROYECCION} = "❌ Proyección y Banco", {BANCO Y PROYECCION} = "❌ Proyección", {BANCO Y PROYECCION} = "❌ Banco")`;
    
    console.log('📋 Filtro aplicado:', filterFormula);

    await base(FACTURACION_EGRESOS_TABLE)
      .select({
        filterByFormula: filterFormula,
        sort: [{ field: 'Fecha de Emisión', direction: 'desc' }],
        maxRecords: 100,
      })
      .eachPage((records, fetchNextPage) => {
        console.log(`📄 Página recibida con ${records.length} registros`);
        
        records.forEach((record) => {
          const fields = record.fields;
          
          console.log(`📋 Factura encontrada: ${record.id}`, {
            numeroFactura: fields['Número de Factura'],
            emisor: fields['Emisor'],
            bancoProyeccion: fields['BANCO Y PROYECCION'],
          });

          // Obtener IDs de items relacionados usando nombre de campo
          const itemsRelacionados = fields['Items factura'] as string[] | undefined;
          if (itemsRelacionados && Array.isArray(itemsRelacionados)) {
            facturaItemsMap.set(record.id, itemsRelacionados);
          }

          const factura: FacturaEgreso = {
            id: record.id,
            // Usar nombres de campo en lugar de Field IDs para acceder a los datos
            ID: parseString(fields['ID']),
            'Número de Factura': parseString(fields['Número de Factura']),
            'Fecha de Emisión': parseString(fields['Fecha de Emisión']),
            'Fecha de Vencimiento': parseString(fields['Fecha de Vencimiento']),
            Emisor: parseString(fields['Emisor']),
            'NIT/CIF del Emisor': parseString(fields['NIT/CIF del Emisor']),
            'Dirección del Emisor': parseString(fields['Dirección del Emisor']),
            'Forma de Pago': parseString(fields['Forma de Pago']),
            'Condiciones de Pago': parseString(fields['Condiciones de Pago']),
            Moneda: parseString(fields['Moneda']) || 'COP',
            subtotal: parseNumber(fields['subtotal']),
            descuentos: parseNumber(fields['descuentos']),
            iva: parseNumber(fields['iva']),
            inc: parseNumber(fields['inc']),
            retencion: parseNumber(fields['retencion']),
            reteiva: parseNumber(fields['reteiva']),
            reteica: parseNumber(fields['reteica']),
            total_pagar: parseNumber(fields['total_pagar']),
            'C. Costos': parseString(fields['C. Costos']),
            GRUPO: parseString(fields['GRUPO']),
            CLASE: parseString(fields['CLASE']),
            CUENTA: parseString(fields['CUENTA']),
            'SUB-CUENTA': parseString(fields['SUB-CUENTA']),
            'BANCO Y PROYECCION': parseString(fields['BANCO Y PROYECCION']),
            tipo_retencion: parseString(fields['tipo_retencion']),
            'Tipo de Operación': parseString(fields['Tipo de Operación']),
            CUFE: parseString(fields['CUFE']),
            'Producto Terminado': parseString(fields['Producto Terminado']),
            'Clasificación del Costo': parseString(fields['Clasificación del Costo']),
            'Para Efectos Contables': parseString(fields['Para Efectos Contables']),
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
                // Usar nombres de campo
                Item: parseString(fields['Item']),
                Unidad: parseString(fields['Unidad']),
                Cantidad: parseNumber(fields['Cantidad']),
                'Vr. Unitario': parseNumber(fields['Vr. Unitario']),
                'Vr. Total Flow 19%': parseNumber(fields['Vr. Total Flow 19%']),
                'Unidad de Negocio': parseString(fields['Unidad de Negocio']),
                'Centro de Costo': parseString(fields['Centro de Costo']),
                COMENTARIOS: parseString(fields['COMENTARIOS']),
                TipoRTFE: parseString(fields['TipoRTFE']),
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
