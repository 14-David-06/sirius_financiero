import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

// Configuración de Airtable para Sirius Insumos Core
const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const INSUMO_TABLE = process.env.AIRTABLE_INS_TABLE_ID || '';
const MOVIMIENTOS_TABLE = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID || '';
const CATEGORIAS_TABLE = process.env.AIRTABLE_CAT_INSUMO_TABLE_ID || '';

// Inicializar Airtable con API key específica para Insumos
const base = new Airtable({ apiKey: process.env.AIRTABLE_INS_API_KEY }).base(INSUMOS_BASE_ID);

// Interface para item a enviar
interface ItemParaInventario {
  id: string;
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
  'Unidad de Negocio'?: string;
  'Centro de Costo'?: string;
}

// Interface para validación IA
interface ValidacionIA {
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

// Interface para resultado de envío
interface ResultadoEnvio {
  itemId: string;
  itemNombre: string;
  exito: boolean;
  accion: 'vinculado' | 'creado' | 'ignorado' | 'error';
  insumoId?: string;
  movimientoId?: string;
  mensaje: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, validaciones, facturaId, numeroFactura } = body as {
      items: ItemParaInventario[];
      validaciones: ValidacionIA[];
      facturaId: string;
      numeroFactura: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron items para enviar' },
        { status: 400 }
      );
    }

    console.log(`📦 Enviando ${items.length} items al inventario desde factura ${numeroFactura}...`);

    const resultados: ResultadoEnvio[] = [];

    // Obtener categoría por defecto (primera categoría activa)
    let categoriaDefecto: string | null = null;
    try {
      const categoriasResult = await base(CATEGORIAS_TABLE)
        .select({ maxRecords: 1 })
        .firstPage();
      if (categoriasResult.length > 0) {
        categoriaDefecto = categoriasResult[0].id;
      }
    } catch (error) {
      console.warn('No se pudo obtener categoría por defecto:', error);
    }

    // Procesar cada item
    for (const item of items) {
      const validacion = validaciones.find(v => v.itemFacturaId === item.id);
      
      if (!validacion || validacion.accion === 'ignorar') {
        resultados.push({
          itemId: item.id,
          itemNombre: item.Item,
          exito: true,
          accion: 'ignorado',
          mensaje: 'Item ignorado según validación IA',
        });
        continue;
      }

      try {
        let insumoId: string;

        if (validacion.accion === 'vincular' && validacion.insumoExistenteId) {
          // Vincular a insumo existente
          insumoId = validacion.insumoExistenteId;
          console.log(`🔗 Vinculando item "${item.Item}" a insumo existente: ${validacion.insumoExistenteNombre}`);
        } else {
          // Crear nuevo insumo
          console.log(`➕ Creando nuevo insumo: "${item.Item}"`);
          
          const nuevoInsumo = await base(INSUMO_TABLE).create({
            'Nombre': item.Item,
            'Unidad Medida': item.Unidad || 'Unidad',
            'Estado Insumo': 'Activo',
            ...(categoriaDefecto && { 'Categoria Insumo': [categoriaDefecto] }),
          });
          
          insumoId = nuevoInsumo.id;
          console.log(`✅ Insumo creado con ID: ${insumoId}`);
        }

        // Crear movimiento de ingreso
        const movimiento = await base(MOVIMIENTOS_TABLE).create({
          'Name': `Ingreso - ${numeroFactura} - ${item.Item}`,
          'Cantidad': item.Cantidad,
          'Tipo Movimiento': 'Ingreso',
          'Insumo': [insumoId],
          'ID Origen Movimiento': facturaId,
          'Comentarios': `Ingreso desde factura ${numeroFactura}. Costo unitario: $${item['Vr. Unitario']?.toLocaleString() || 0}`,
        });

        console.log(`✅ Movimiento creado: ${movimiento.id}`);

        resultados.push({
          itemId: item.id,
          itemNombre: item.Item,
          exito: true,
          accion: validacion.accion === 'vincular' ? 'vinculado' : 'creado',
          insumoId,
          movimientoId: movimiento.id,
          mensaje: validacion.accion === 'vincular'
            ? `Vinculado a "${validacion.insumoExistenteNombre}" y movimiento creado`
            : `Nuevo insumo creado y movimiento registrado`,
        });

      } catch (error) {
        console.error(`❌ Error procesando item "${item.Item}":`, error);
        resultados.push({
          itemId: item.id,
          itemNombre: item.Item,
          exito: false,
          accion: 'error',
          mensaje: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    }

    const exitosos = resultados.filter(r => r.exito && r.accion !== 'ignorado').length;
    const ignorados = resultados.filter(r => r.accion === 'ignorado').length;
    const errores = resultados.filter(r => !r.exito).length;

    console.log(`📊 Resumen: ${exitosos} exitosos, ${ignorados} ignorados, ${errores} errores`);

    return NextResponse.json({
      success: errores === 0,
      facturaId,
      numeroFactura,
      totalItems: items.length,
      exitosos,
      ignorados,
      errores,
      resultados,
    });

  } catch (error) {
    console.error('❌ Error enviando insumos al inventario:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al enviar insumos',
      },
      { status: 500 }
    );
  }
}
