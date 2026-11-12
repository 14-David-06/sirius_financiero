import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import Airtable, { type FieldSet, type Record as AirtableRecord } from 'airtable';
import { actualizarEnLotes, crearEnLotes } from '@/lib/importacion/archivos-pendientes';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function base(): Airtable.Base {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
}

function tablaEgresos() {
  const tableId = process.env.AIRTABLE_FACTURACION_EGRESOS_TABLE_ID;
  if (!tableId) throw new Error('Falta AIRTABLE_FACTURACION_EGRESOS_TABLE_ID');
  return base()(tableId);
}

function tablaItemsEgresos() {
  const tableId = process.env.AIRTABLE_ITEM_FACTURACION_EGRESOS_TABLE_ID;
  if (!tableId) throw new Error('Falta AIRTABLE_ITEM_FACTURACION_EGRESOS_TABLE_ID');
  return base()(tableId);
}

function tablaCentralizacion() {
  const tableId = process.env.AIRTABLE_CENTRALIZACION_TABLE_ID;
  if (!tableId) throw new Error('Falta AIRTABLE_CENTRALIZACION_TABLE_ID');
  return base()(tableId);
}

interface DatosFacturaEgresos {
  'Factura No.': string;
  'Fecha de emisión': string;
  'Fecha de vencimiento': string;
  'Nombre del emisor': string;
  'NIT del emisor': string;
  'Dirección emisor': string;
  'Forma de Pago': string;
  Moneda: string;
  'Tipo de Operación': string;
  Ítems: Array<{
    Item: string;
    Unidad: string;
    Cantidad: number;
    'Vr. Unitario': number;
    'Vr. Total Flow 19%': number;
  }>;
  Observaciones: string;
  'Total Bruto': number;
  Descuento: number;
  Subtotal: number;
  IVA: number;
  RETIVA: number;
  RETEFUENTE: number;
  INC: number;
  RETEICA: number;
  'Total por cobrar': number;
  CUFE: string;
  'Plazo para pagar': number;
  'Condiciones de pago': string;
}

export interface FacturaProcesada {
  id: string;
  numeroFactura: string;
  proveedor: string;
  monto: number;
  omitida?: boolean;
  razon?: string;
}

/**
 * Extrae datos de una factura PDF usando Claude Opus 4.6
 */
export async function extraerDatosConClaude(
  pdfBuffer: Buffer,
  nombreArchivo: string
): Promise<DatosFacturaEgresos> {
  console.log(`🤖 [Claude] Analizando factura: ${nombreArchivo}`);

  // Prompt de análisis documental (del workflow n8n)
  const promptAnalisis = `Eres un motor experto en análisis documental y extracción estructurada de facturas (electrónicas o escaneadas). Tu objetivo es extraer absolutamente todos los datos visibles, implícitos y explícitos contenidos en una factura, sin perder información y sin inferencias inventadas.`;

  // Llamar a Claude con el PDF
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6-20241022',
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
            text: promptAnalisis,
          },
        ],
      },
    ],
  });

  const textoExtraido =
    message.content[0].type === 'text' ? message.content[0].text : '';

  console.log(`✅ [Claude] Texto extraído (${textoExtraido.length} caracteres)`);

  // Estructurar con OpenAI (gpt-4o-mini + JSON mode)
  const promptEstructura = `Extrae exclusivamente los campos solicitados de la factura usando toda la información disponible proveniente de las siguientes tres fuentes:

Extracción de texto desde n8n.

Extracción mediante análisis de imagen con IA.

Extracción desde el servicio externo.

Si alguna fuente no proporciona información o falla, ignórala y utiliza exclusivamente las que estén disponibles.

No generes información adicional, no inventes datos.

La respuesta debe ser estrictamente en formato JSON con estructura idéntica al siguiente ejemplo.

No incluyas texto explicativo ni comentarios fuera del JSON.

No modifiques ni traduzcas los nombres de los campos.

📌 REGLAS PARA COMPLETAR LOS VALORES:

Si el campo solicitado es de tipo texto (nombre, CUFE, observaciones, dirección, etc.) y no existe en ninguna fuente, coloca exactamente: "No disponible".

Si el campo solicitado es de tipo numérico (IVA, descuentos, totales, cantidades, etc.) y no existe, coloca 0.

El campo "Fecha de emisión" es obligatorio y debe estar presente siempre. Si no se encuentra en ninguna fuente, coloca "No disponible".

El campo "Fecha de vencimiento" debe:

Usar el valor disponible de cualquier fuente.

Si no está disponible, debe tomar exactamente el mismo valor de "Fecha de emisión" (aunque sea "No disponible").

Es Obligatorio que la fecha tenga este formato "AAAA-MM-DD" no se acepta ningun otro formato.

La estructura del campo "Ítems" debe mantenerse, aunque esté vacío.

Mantén el orden y tipo de los campos exactamente como se muestra.

📄 Estructura JSON obligatoria:

{
  "Factura No.": "FE-10239",
  "Fecha de emisión": "2025-05-10",
  "Fecha de vencimiento": "2025-06-10",
  "Nombre del emisor": "Distribuciones del Sur S.A.S.",
  "NIT del emisor": "900123456-7",
  "Dirección emisor": "Carrera 34 Sur Bogota",
  "Forma de Pago": "CREDITO",
  "Moneda": "COP",
  "Tipo de Operación": "Venta",
  "Ítems": [
    {
      "Item": "Cartuchos de tinta HP 664",
      "Unidad": "Unidad",
      "Cantidad": 10,
      "Vr. Unitario": 25000.00,
      "Vr. Total Flow 19%": 250000.00
    }
  ],
  "Observaciones": "Entrega inmediata, pago contra entrega.",
  "Total Bruto": 325000.00,
  "Descuento": 25000.00,
  "Subtotal": 300000.00,
  "IVA": 57000.00,
  "RETIVA": 9500.00,
  "RETEFUENTE": 15000.00,
  "INC": 0,
  "RETEICA": 4800.00,
  "Total por cobrar": 267700.00,
  "CUFE": "e3a1b2c4d5678f90",
  "Plazo para pagar": 30,
  "Condiciones de pago": "Pago a 30 días calendario."
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `El usuario envió un mensaje con la siguiente información
Texto o descripción del mensaje:
\`\`\`${textoExtraido}
\`\`\``,
      },
      {
        role: 'system',
        content: promptEstructura,
      },
    ],
  });

  const datosExtraidos = JSON.parse(
    completion.choices[0].message.content || '{}'
  ) as DatosFacturaEgresos;

  console.log(`✅ [OpenAI] Datos estructurados:`, {
    factura: datosExtraidos['Factura No.'],
    emisor: datosExtraidos['Nombre del emisor'],
    total: datosExtraidos['Total por cobrar'],
    items: datosExtraidos.Ítems?.length || 0,
  });

  return datosExtraidos;
}

/**
 * Normaliza una fecha en formato AAAA-MM-DD
 * Maneja "No disponible" y formatos alternativos
 */
function normalizarFecha(fecha: string | undefined, fallback?: string): string {
  if (!fecha || fecha === 'No disponible') {
    return fallback || new Date().toISOString().split('T')[0];
  }

  // Ya está en formato AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  // Intentar parsear otros formatos
  try {
    const parsed = new Date(fecha);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}

  return fallback || new Date().toISOString().split('T')[0];
}

/**
 * Normaliza un número, retorna 0 si no es válido
 */
function normalizarNumero(valor: any): number {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const parsed = parseFloat(valor.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Procesa una factura: crea cabecera, centraliza y crea ítems
 */
export async function procesarFactura(
  datos: DatosFacturaEgresos,
  idDocumento: string
): Promise<FacturaProcesada> {
  const tablaFact = tablaEgresos();
  const tablaItems = tablaItemsEgresos();
  const tablaCentral = tablaCentralizacion();

  // Normalizar fechas
  const fechaEmision = normalizarFecha(datos['Fecha de emisión']);
  const fechaVencimiento = normalizarFecha(datos['Fecha de vencimiento'], fechaEmision);

  // Crear cabecera de factura
  const cabecera = await tablaFact.create(
    [
      {
        fields: {
          'Número de Factura': datos['Factura No.'] || 'Sin número',
          'Fecha de Emisión': fechaEmision,
          'Fecha de Vencimiento': fechaVencimiento,
          Emisor: datos['Nombre del emisor'] || 'No disponible',
          'NIT/CIF del Emisor': datos['NIT del emisor'] || 'No disponible',
          'Dirección del Emisor': datos['Dirección emisor'] || 'No disponible',
          'Forma de Pago': datos['Forma de Pago'] || 'No disponible',
          'Condiciones de Pago': datos['Condiciones de pago'] || 'No disponible',
          Moneda: datos.Moneda || 'COP',
          'Tipo de Operación': datos['Tipo de Operación'] || 'Venta',
          subtotal: normalizarNumero(datos.Subtotal),
          descuentos: normalizarNumero(datos.Descuento),
          iva: normalizarNumero(datos.IVA),
          inc: normalizarNumero(datos.INC),
          retencion: normalizarNumero(datos.RETEFUENTE),
          reteiva: normalizarNumero(datos.RETIVA),
          reteica: normalizarNumero(datos.RETEICA),
          total_pagar: normalizarNumero(datos['Total por cobrar']),
          CUFE: datos.CUFE || 'No disponible',
          ID_DOC: idDocumento,
        },
      },
    ],
    { typecast: true }
  );

  const facturaCreada = cabecera[0];
  console.log(`✅ [Airtable] Factura creada:`, facturaCreada.id);

  // Releer para obtener campos calculados
  const facturaCompleta = await tablaFact.find(facturaCreada.id);
  const añoFormulado = facturaCompleta.get('Año formulado') as number;
  const semanaFormulada = facturaCompleta.get('Numero de la semana') as number;

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

      console.log(`✅ [Airtable] Factura centralizada:`, centralizacionId);
    } else {
      console.warn(
        `⚠️ [Airtable] No se encontró centralización para año ${añoFormulado}, semana ${semanaFormulada}`
      );
    }
  }

  // Crear ítems
  const items = datos.Ítems || [];
  if (items.length > 0) {
    const itemsParaCrear = items.map(item => ({
      fields: {
        Item: item.Item || 'Sin descripción',
        Unidad: item.Unidad || 'Unidad',
        Cantidad: normalizarNumero(item.Cantidad),
        'Vr. Unitario': normalizarNumero(item['Vr. Unitario']),
        'Vr. Total Flow 19%': normalizarNumero(item['Vr. Total Flow 19%']),
        ID_DOC: idDocumento,
        'Facturacion Egresos': [facturaCreada.id],
        ...(centralizacionId && { 'Centralización General': centralizacionId }),
      },
    }));

    await crearEnLotes(tablaItems, itemsParaCrear, [], { typecast: false });
    console.log(`✅ [Airtable] ${items.length} ítems creados`);
  }

  return {
    id: facturaCreada.id,
    numeroFactura: datos['Factura No.'] || 'Sin número',
    proveedor: datos['Nombre del emisor'] || 'No disponible',
    monto: normalizarNumero(datos['Total por cobrar']),
  };
}

/**
 * Verifica si una factura ya fue procesada por ID_DOC
 */
export async function facturaYaProcesada(idDocumento: string): Promise<boolean> {
  const tabla = tablaEgresos();
  const registros = await tabla
    .select({
      filterByFormula: `{ID_DOC} = "${idDocumento}"`,
      maxRecords: 1,
    })
    .firstPage();

  return registros.length > 0;
}
