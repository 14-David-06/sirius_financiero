import Anthropic from '@anthropic-ai/sdk';
import Airtable, { type FieldSet } from 'airtable';
import { crearEnLotes } from '@/lib/importacion/archivos-pendientes';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function base(): Airtable.Base {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
}

function tablaIngresos() {
  const tableId = process.env.AIRTABLE_INGRESOS_TABLE_ID;
  if (!tableId) throw new Error('Falta AIRTABLE_INGRESOS_TABLE_ID');
  return base()(tableId);
}

function tablaItemsIngresos() {
  const tableId = process.env.AIRTABLE_ITEMS_INGRESOS_TABLE_ID;
  if (!tableId) throw new Error('Falta AIRTABLE_ITEMS_INGRESOS_TABLE_ID');
  return base()(tableId);
}

function tablaCentralizacion() {
  const tableId = process.env.AIRTABLE_CENTRALIZACION_TABLE_ID;
  if (!tableId) throw new Error('Falta AIRTABLE_CENTRALIZACION_TABLE_ID');
  return base()(tableId);
}

interface DatosFacturaIngresos {
  numeroFactura: string;
  condicionesPago: string;
  plazoPago: string;
  fechaEmision: string; // YYYY-MM-DD
  fechaVencimiento: string; // YYYY-MM-DD
  comprador: {
    nombre: string;
  };
  items: Array<{
    item: string;
    unidad: string;
    cantidad: number;
    valor_unitario: number;
    valor_total_flow: number;
  }>;
  totales: {
    totalBruto: number;
    descuento: number;
    subtotal: number;
    iva: number; // ✅ CORREGIDO: antes era reteica
    reteica: number;
    reteiva: number;
    retefuente: number;
    totalPagar: number;
  };
  observaciones: string;
  cufe: string;
}

export interface FacturaIngresoProcesada {
  id: string;
  numeroFactura: string;
  comprador: string;
  monto: number;
  omitida?: boolean;
  razon?: string;
  data?: DatosFacturaIngresos;
}

/**
 * Extrae datos de factura de ingresos usando Claude con JSON estructurado
 * CORRIGE bug: IVA ya no se confunde con ReteICA
 */
export async function extraerDatosIngresos(
  pdfBuffer: Buffer,
  nombreArchivo: string
): Promise<DatosFacturaIngresos> {
  console.log(`🤖 [Claude Ingresos] Analizando: ${nombreArchivo}`);

  const promptExtraccion = `Extrae los datos de esta factura de INGRESOS.

Reglas CRÍTICAS:
1. Fechas en formato YYYY-MM-DD (ISO)
2. **IVA es IVA, NO confundir con ReteICA** ← BUG CORREGIDO
3. Si un campo numérico no existe, usa 0
4. Si un campo de texto no existe, usa "No disponible"

Devuelve un JSON con EXACTAMENTE esta estructura:

{
  "numeroFactura": "F-12345",
  "condicionesPago": "Contado",
  "plazoPago": "30",
  "fechaEmision": "2026-11-12",
  "fechaVencimiento": "2026-12-12",
  "comprador": {
    "nombre": "Nombre del comprador"
  },
  "items": [
    {
      "item": "Descripción del producto/servicio",
      "unidad": "Unidad",
      "cantidad": 10,
      "valor_unitario": 50000,
      "valor_total_flow": 500000
    }
  ],
  "totales": {
    "totalBruto": 500000,
    "descuento": 0,
    "subtotal": 500000,
    "iva": 95000,
    "reteica": 5000,
    "reteiva": 9500,
    "retefuente": 25000,
    "totalPagar": 555500
  },
  "observaciones": "Observaciones de la factura",
  "cufe": "CUFE de la factura electrónica"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: promptExtraccion,
          },
        ],
      },
    ],
  });

  const textoRespuesta =
    message.content[0].type === 'text' ? message.content[0].text : '';

  // Extraer JSON de la respuesta
  let datosExtraidos: DatosFacturaIngresos;
  try {
    // Buscar JSON en la respuesta (puede venir con markdown)
    const jsonMatch = textoRespuesta.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se encontró JSON en la respuesta de Claude');
    }
    datosExtraidos = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('❌ Error parseando JSON:', textoRespuesta);
    throw new Error('Error parseando datos extraídos: ' + (error as Error).message);
  }

  console.log(`✅ [Claude Ingresos] Datos extraídos:`, {
    factura: datosExtraidos.numeroFactura,
    comprador: datosExtraidos.comprador.nombre,
    total: datosExtraidos.totales.totalPagar,
    items: datosExtraidos.items.length,
    iva: datosExtraidos.totales.iva, // ✅ Verificar que NO sea reteica
    reteica: datosExtraidos.totales.reteica,
  });

  return datosExtraidos;
}

/**
 * Normaliza fecha a formato YYYY-MM-DD
 */
function normalizarFecha(fecha: string | undefined): string | null {
  if (!fecha || fecha === 'No disponible') return null;

  // Ya en formato ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;

  // Intentar parsear
  try {
    const parsed = new Date(fecha);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}

  return null;
}

/**
 * Procesa factura de ingresos: crea cabecera, centraliza y crea ítems
 */
export async function procesarFacturaIngresos(
  datos: DatosFacturaIngresos,
  idDocumento: string
): Promise<FacturaIngresoProcesada> {
  const tablaFact = tablaIngresos();
  const tablaItems = tablaItemsIngresos();
  const tablaCentral = tablaCentralizacion();

  // Normalizar fechas (undefined si no hay valor válido)
  const fechaEmision = normalizarFecha(datos.fechaEmision) || undefined;
  const fechaVencimiento = normalizarFecha(datos.fechaVencimiento) || fechaEmision;

  // Crear cabecera
  const registros = [
    {
      fields: {
        'Factura No.': datos.numeroFactura || 'Sin número',
        'Fecha Emision': fechaEmision,
        'Nombre del Comprador': datos.comprador.nombre || 'No disponible',
        'Condiciones de pago': datos.condicionesPago || 'No disponible',
        'Plazo para pagar': parseInt(datos.plazoPago || '0') || 0,
        'Fecha de Vencimiento': fechaVencimiento,
        Observaciones: datos.observaciones || '',
        'Total Bruto': datos.totales.totalBruto || 0,
        Descuento: datos.totales.descuento || 0,
        Subtotal: datos.totales.subtotal || 0,
        IVA: datos.totales.iva || 0, // ✅ CORREGIDO: antes era reteica
        'Total por Cobrar': datos.totales.totalPagar || 0,
        RETEICA: datos.totales.reteica || 0,
        RETEIVA: datos.totales.reteiva || 0,
        RETEFUENTE: datos.totales.retefuente || 0,
        CUFE: datos.cufe || 'No disponible',
        id_documento: idDocumento,
      },
    },
  ];

  const cabecera = await crearEnLotes(tablaFact, registros, [], { typecast: true });
  const facturaCreada = cabecera[0];
  console.log(`✅ [Airtable Ingresos] Factura creada:`, facturaCreada.id);

  // Releer para obtener campos calculados
  const facturaCompleta = await tablaFact.find(facturaCreada.id);
  const añoFormulado = facturaCompleta.get('Año formulado emitido') as number;
  const semanaFormulada = facturaCompleta.get('Semana formulada emitida') as number;

  // Buscar Centralización General
  let centralizacionId: string | undefined;
  if (añoFormulado && semanaFormulada) {
    const centralizaciones = await tablaCentral
      .select({
        filterByFormula: `AND({Año formulado} = ${añoFormulado}, {Semana formulada} = ${semanaFormulada})`,
        maxRecords: 1,
      })
      .firstPage();

    if (centralizaciones.length > 0) {
      centralizacionId = centralizaciones[0].id;

      // Actualizar factura con centralización
      await tablaFact.update(facturaCreada.id, {
        Centralizada: true,
        'Centralización General': [centralizacionId],
      });

      console.log(`✅ [Airtable Ingresos] Factura centralizada:`, centralizacionId);
    } else {
      console.warn(
        `⚠️ No se encontró centralización para año ${añoFormulado}, semana ${semanaFormulada}`
      );
    }
  }

  // Crear ítems
  const items = datos.items || [];
  if (items.length > 0) {
    const itemsParaCrear = items.map(item => ({
      fields: {
        Item: item.item || 'Sin descripción',
        Unidad: item.unidad || 'Unidad',
        Cantidad: item.cantidad || 0,
        'Vr. Unitario': item.valor_unitario || 0,
        'Vr. Total Flow': item.valor_total_flow || 0,
        Facturacion: [facturaCreada.id],
        id_doc: idDocumento,
        ...(centralizacionId && { 'Centralización General': [centralizacionId] }),
      },
    }));

    await crearEnLotes(tablaItems, itemsParaCrear, [], { typecast: false });
    console.log(`✅ [Airtable Ingresos] ${items.length} ítems creados`);
  }

  return {
    id: facturaCreada.id,
    numeroFactura: datos.numeroFactura || 'Sin número',
    comprador: datos.comprador.nombre || 'No disponible',
    monto: datos.totales.totalPagar || 0,
    data: datos,
  };
}

/**
 * Verifica si una factura ya fue procesada por ID_DOC
 */
export async function facturaIngresoYaProcesada(idDocumento: string): Promise<boolean> {
  const tabla = tablaIngresos();
  const registros = await tabla
    .select({
      filterByFormula: `{id_documento} = "${idDocumento}"`,
      maxRecords: 1,
    })
    .firstPage();

  return registros.length > 0;
}
