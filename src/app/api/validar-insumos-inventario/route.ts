import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import OpenAI from 'openai';
import { INSUMO_FIELDS } from '@/lib/config/airtable-fields';

// Configuración de Airtable para Sirius Insumos Core
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const INSUMO_TABLE = process.env.AIRTABLE_INS_TABLE_ID || '';

// Inicializar Airtable con API key específica para Insumos
const base = new Airtable({ apiKey: process.env.AIRTABLE_INS_API_KEY }).base(INSUMOS_BASE_ID);

// Interface para items de factura
interface ItemFactura {
  id: string;
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
  'Unidad de Negocio'?: string;
  'Centro de Costo'?: string;
}

// Interface para insumo del catálogo
interface InsumoInventario {
  id: string;
  nombre: string;
  codigo: string;
  unidadMedida: string;
  estado: string;
}

// Interface para resultado de validación
interface ValidacionItem {
  itemFacturaId: string;
  itemFacturaNombre: string;
  encontrado: boolean;
  insumoExistenteId?: string;
  insumoExistenteNombre?: string;
  insumoExistenteCodigo?: string;
  similitud: number;
  accion: 'vincular' | 'crear_nuevo' | 'ignorar';
  sugerencia?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, facturaId } = body as { items: ItemFactura[]; facturaId: string };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron items para validar' },
        { status: 400 }
      );
    }

    console.log(`🔍 Validando ${items.length} items de factura ${facturaId}...`);

    // 1. Obtener todos los insumos del catálogo
    const insumosInventario: InsumoInventario[] = [];
    
    await base(INSUMO_TABLE)
      .select({
        fields: [INSUMO_FIELDS.NOMBRE, INSUMO_FIELDS.CODIGO_SIRIUS, INSUMO_FIELDS.UNIDAD_MEDIDA, INSUMO_FIELDS.ESTADO],
        filterByFormula: `{${INSUMO_FIELDS.ESTADO}} = "Activo"`,
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          insumosInventario.push({
            id: record.id,
            nombre: record.fields[INSUMO_FIELDS.NOMBRE] as string || '',
            codigo: record.fields[INSUMO_FIELDS.CODIGO_SIRIUS] as string || '',
            unidadMedida: record.fields[INSUMO_FIELDS.UNIDAD_MEDIDA] as string || '',
            estado: record.fields[INSUMO_FIELDS.ESTADO] as string || '',
          });
        });
        fetchNextPage();
      });

    console.log(`📦 Catálogo de insumos cargado: ${insumosInventario.length} insumos activos`);

    // 2. Usar IA para comparar items de factura con catálogo
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const itemsNombres = items.map((item, idx) => `${idx + 1}. "${item.Item}" (Unidad: ${item.Unidad}, Cantidad: ${item.Cantidad})`).join('\n');
    const catalogoNombres = insumosInventario.map((insumo) => `- ID: ${insumo.id} | Código: ${insumo.codigo} | Nombre: "${insumo.nombre}" | Unidad: ${insumo.unidadMedida}`).join('\n');

    const prompt = `Eres un experto en gestión de inventarios industriales. Tu tarea es comparar items de una factura de compra con un catálogo de insumos existente para determinar coincidencias.

ITEMS DE LA FACTURA A VALIDAR:
${itemsNombres}

CATÁLOGO DE INSUMOS EXISTENTES:
${catalogoNombres}

Para cada item de la factura, debes:
1. Buscar si existe un insumo similar en el catálogo
2. Asignar un porcentaje de similitud (0-100%)
3. Recomendar una acción: "vincular" (si encontraste coincidencia >= 50%), "crear_nuevo" (si no hay coincidencia suficiente), o "ignorar" (si el item no es un insumo válido)

CRITERIOS DE SIMILITUD - SÉ MUY FLEXIBLE:
- Mismo MATERIAL: policarbonato, acetato, acero, hierro, plástico, etc. = +40% similitud
- Misma CATEGORÍA/USO: visores, gafas, cascos = protección visual; guantes, botas = EPP; discos, brocas = herramientas
- Variaciones de nombre: "ACETATO BORDE METALICO EN POLICARBONATO" puede ser un "Visor de policarbonato" (ambos usan policarbonato para protección visual)
- Nombres en facturas suelen ser más técnicos/largos que en catálogo
- Considera sinónimos: visor=careta=protector facial, acetato=lámina transparente

REGLAS:
- Si comparten material Y uso/categoría = similitud >= 60%, vincular
- Servicios, fletes, transportes = "ignorar"
- Ante la duda, sugiere vincular con menor similitud antes que crear duplicado

Responde SOLO con un JSON válido con esta estructura (sin markdown, sin backticks):
{
  "validaciones": [
    {
      "indiceItem": 1,
      "itemNombre": "nombre del item de factura",
      "encontrado": true/false,
      "insumoId": "id del insumo encontrado o null",
      "insumoNombre": "nombre del insumo encontrado o null",
      "insumoCodigo": "código del insumo encontrado o null",
      "similitud": 85,
      "accion": "vincular" | "crear_nuevo" | "ignorar",
      "sugerencia": "explicación breve de por qué se tomó esta decisión"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en gestión de inventarios. Responde siempre con JSON válido sin markdown ni backticks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extraer el texto de la respuesta
    const responseText = response.choices[0]?.message?.content || '';
    
    // Parsear la respuesta JSON
    let validacionesIA;
    try {
      validacionesIA = JSON.parse(responseText);
    } catch {
      console.error('Error parseando respuesta de IA:', responseText);
      throw new Error('Error al procesar la respuesta de la IA');
    }

    // 3. Construir resultado de validación
    const validaciones: ValidacionItem[] = items.map((item, index) => {
      const validacionIA = validacionesIA.validaciones?.find(
        (v: { indiceItem: number }) => v.indiceItem === index + 1
      );

      if (!validacionIA) {
        return {
          itemFacturaId: item.id,
          itemFacturaNombre: item.Item,
          encontrado: false,
          similitud: 0,
          accion: 'crear_nuevo' as const,
          sugerencia: 'No se encontró validación para este item',
        };
      }

      return {
        itemFacturaId: item.id,
        itemFacturaNombre: item.Item,
        encontrado: validacionIA.encontrado,
        insumoExistenteId: validacionIA.insumoId || undefined,
        insumoExistenteNombre: validacionIA.insumoNombre || undefined,
        insumoExistenteCodigo: validacionIA.insumoCodigo || undefined,
        similitud: validacionIA.similitud || 0,
        accion: validacionIA.accion || 'crear_nuevo',
        sugerencia: validacionIA.sugerencia || '',
      };
    });

    console.log(`✅ Validación completada para ${validaciones.length} items`);

    return NextResponse.json({
      success: true,
      facturaId,
      totalItems: items.length,
      itemsParaVincular: validaciones.filter((v) => v.accion === 'vincular').length,
      itemsParaCrear: validaciones.filter((v) => v.accion === 'crear_nuevo').length,
      itemsIgnorados: validaciones.filter((v) => v.accion === 'ignorar').length,
      validaciones,
    });
  } catch (error) {
    console.error('❌ Error validando insumos:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al validar insumos',
      },
      { status: 500 }
    );
  }
}
