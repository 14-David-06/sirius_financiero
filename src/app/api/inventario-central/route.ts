import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import {
  INSUMO_FIELDS, CATEGORIA_INSUMO_FIELDS, MOVIMIENTO_INSUMO_FIELDS,
  STOCK_INSUMO_FIELDS, UNIDAD_FIELDS, AREA_FIELDS
} from '@/lib/config/airtable-fields';

const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const INSUMO_TABLE = process.env.AIRTABLE_INS_TABLE_ID || '';
const CATEGORIAS_TABLE = process.env.AIRTABLE_CAT_INSUMO_TABLE_ID || '';
const MOVIMIENTOS_TABLE = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID || '';
const STOCK_TABLE = process.env.AIRTABLE_STOCK_INSUMO_TABLE_ID || '';
const UNIDADES_TABLE = process.env.AIRTABLE_UNIDADES_TABLE_ID || '';
const AREAS_TABLE = process.env.AIRTABLE_AREAS_TABLE_ID || '';

const base = new Airtable({ apiKey: process.env.AIRTABLE_INS_API_KEY }).base(INSUMOS_BASE_ID);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seccion = searchParams.get('seccion') || 'resumen';

    if (seccion === 'resumen') {
      const [insumos, categorias, movimientos, stocks, unidades, areas] = await Promise.all([
        fetchInsumos(),
        fetchCategorias(),
        fetchMovimientos(),
        fetchStocks(),
        fetchUnidades(),
        fetchAreas(),
      ]);

      const insumosActivos = insumos.filter(i => i.estadoInsumo === 'Activo').length;
      const stockBajoMinimo = stocks.filter(s => {
        const insumo = insumos.find(i => i.id === s.insumoId);
        return insumo && insumo.stockMinimo > 0 && s.stockActual < insumo.stockMinimo;
      }).length;

      // Calcular valor total del inventario
      const valorTotalInventario = stocks.reduce((acc, s) => acc + (s.costoAcumulado || 0), 0);

      const movimientosRecientes = movimientos
        .sort((a, b) => new Date(b.creada).getTime() - new Date(a.creada).getTime())
        .slice(0, 20);

      return NextResponse.json({
        success: true,
        kpis: {
          totalInsumos: insumos.length,
          insumosActivos,
          totalCategorias: categorias.length,
          totalMovimientos: movimientos.length,
          stockBajoMinimo,
          valorTotalInventario,
          totalAreas: areas.filter(a => a.activa).length,
        },
        insumos,
        categorias,
        movimientos: movimientosRecientes,
        stocks,
        unidades,
        areas,
      });
    }

    if (seccion === 'insumos') {
      const insumos = await fetchInsumos();
      return NextResponse.json({ success: true, insumos });
    }

    if (seccion === 'movimientos') {
      const movimientos = await fetchMovimientos();
      return NextResponse.json({ success: true, movimientos });
    }

    if (seccion === 'stock') {
      const stocks = await fetchStocks();
      return NextResponse.json({ success: true, stocks });
    }

    if (seccion === 'categorias') {
      const categorias = await fetchCategorias();
      return NextResponse.json({ success: true, categorias });
    }

    if (seccion === 'unidades') {
      const unidades = await fetchUnidades();
      return NextResponse.json({ success: true, unidades });
    }

    if (seccion === 'areas') {
      const areas = await fetchAreas();
      return NextResponse.json({ success: true, areas });
    }

    return NextResponse.json({ success: false, error: 'Sección no válida' }, { status: 400 });
  } catch (error) {
    console.error('❌ Error en inventario-central:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error al cargar inventario' },
      { status: 500 }
    );
  }
}

interface InsumoRecord {
  id: string;
  codigoSirius: string;
  idNumero: number;
  nombre: string;
  unidadMedida: string;
  unidadBaseId: string;
  stockMinimo: number;
  estadoInsumo: string;
  etiquetas: string[];
  fichaTecnica: string;
  referenciaComercial: string;
  categoriaIds: string[];
  imagenReferencia: { url: string; filename: string; thumbnailUrl: string }[];
}

async function fetchInsumos(): Promise<InsumoRecord[]> {
  const insumos: InsumoRecord[] = [];
  await base(INSUMO_TABLE)
    .select({
      fields: [
        INSUMO_FIELDS.CODIGO_SIRIUS, INSUMO_FIELDS.ID, INSUMO_FIELDS.NOMBRE, INSUMO_FIELDS.UNIDAD_MEDIDA, INSUMO_FIELDS.UNIDAD_BASE,
        INSUMO_FIELDS.STOCK_MINIMO, INSUMO_FIELDS.ESTADO, INSUMO_FIELDS.FICHA_TECNICA,
        INSUMO_FIELDS.REFERENCIA_COMERCIAL, INSUMO_FIELDS.CATEGORIA, INSUMO_FIELDS.IMAGEN_REFERENCIA,
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const imagenes = record.fields[INSUMO_FIELDS.IMAGEN_REFERENCIA] as Array<{
          url: string; filename: string; thumbnails?: { small?: { url: string } };
        }> | undefined;

        const refComercial = record.fields[INSUMO_FIELDS.REFERENCIA_COMERCIAL] as unknown;
        let refStr = '';
        if (refComercial && typeof refComercial === 'object' && 'value' in (refComercial as Record<string, unknown>)) {
          refStr = (refComercial as { value: string }).value || '';
        } else if (typeof refComercial === 'string') {
          refStr = refComercial;
        }

        const unidadBaseIds = record.fields[INSUMO_FIELDS.UNIDAD_BASE] as string[] || [];

        insumos.push({
          id: record.id,
          codigoSirius: record.fields[INSUMO_FIELDS.CODIGO_SIRIUS] as string || '',
          idNumero: record.fields[INSUMO_FIELDS.ID] as number || 0,
          nombre: record.fields[INSUMO_FIELDS.NOMBRE] as string || '',
          unidadMedida: record.fields[INSUMO_FIELDS.UNIDAD_MEDIDA] as string || '',
          unidadBaseId: unidadBaseIds[0] || '',
          stockMinimo: record.fields[INSUMO_FIELDS.STOCK_MINIMO] as number || 0,
          estadoInsumo: record.fields[INSUMO_FIELDS.ESTADO] as string || '',
          etiquetas: [],
          fichaTecnica: record.fields[INSUMO_FIELDS.FICHA_TECNICA] as string || '',
          referenciaComercial: refStr,
          categoriaIds: record.fields[INSUMO_FIELDS.CATEGORIA] as string[] || [],
          imagenReferencia: imagenes?.map(img => ({
            url: img.url,
            filename: img.filename,
            thumbnailUrl: img.thumbnails?.small?.url || img.url,
          })) || [],
        });
      });
      fetchNextPage();
    });
  return insumos;
}

interface CategoriaRecord {
  id: string;
  codigoCategoria: string;
  idNumero: number;
  tipoInsumo: string;
  descripcion: string;
  insumoIds: string[];
  cantidadInsumos: number;
}

async function fetchCategorias(): Promise<CategoriaRecord[]> {
  const categorias: CategoriaRecord[] = [];
  await base(CATEGORIAS_TABLE)
    .select({
      fields: [CATEGORIA_INSUMO_FIELDS.CODIGO, CATEGORIA_INSUMO_FIELDS.ID, CATEGORIA_INSUMO_FIELDS.TIPO_INSUMO, CATEGORIA_INSUMO_FIELDS.DESCRIPCION, CATEGORIA_INSUMO_FIELDS.INSUMO_LINK],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields[CATEGORIA_INSUMO_FIELDS.INSUMO_LINK] as string[] || [];
        categorias.push({
          id: record.id,
          codigoCategoria: record.fields[CATEGORIA_INSUMO_FIELDS.CODIGO] as string || '',
          idNumero: record.fields[CATEGORIA_INSUMO_FIELDS.ID] as number || 0,
          tipoInsumo: record.fields[CATEGORIA_INSUMO_FIELDS.TIPO_INSUMO] as string || '',
          descripcion: record.fields[CATEGORIA_INSUMO_FIELDS.DESCRIPCION] as string || '',
          insumoIds,
          cantidadInsumos: insumoIds.length,
        });
      });
      fetchNextPage();
    });
  return categorias;
}

interface MovimientoRecord {
  id: string;
  codigoMovimiento: string;
  idNumero: number;
  nombre: string;
  cantidad: number;
  tipoMovimiento: string;
  subtipo: string;
  cantidadOriginal: number;
  unidadOriginalId: string;
  factorConversion: number;
  cantidadBase: number;
  costoUnitario: number;
  costoTotal: number;
  costoUnitarioBase: number;
  documentoOrigen: string;
  idSolicitudCompra: string;
  lote: string;
  fechaVencimiento: string;
  notas: string;
  estadoEntrada: string;
  idResponsable: string;
  idAreaOrigen: string;
  idAreaDestino: string;
  areaDestinoLinkIds: string[];
  areaOrigenLinkIds: string[];
  creada: string;
  ultimaModificacion: string;
  insumoIds: string[];
  stockIds: string[];
}

async function fetchMovimientos(): Promise<MovimientoRecord[]> {
  const movimientos: MovimientoRecord[] = [];
  await base(MOVIMIENTOS_TABLE)
    .select({
      fields: [
        MOVIMIENTO_INSUMO_FIELDS.CODIGO, MOVIMIENTO_INSUMO_FIELDS.ID, MOVIMIENTO_INSUMO_FIELDS.NOMBRE, MOVIMIENTO_INSUMO_FIELDS.CANTIDAD, MOVIMIENTO_INSUMO_FIELDS.TIPO_MOVIMIENTO,
        MOVIMIENTO_INSUMO_FIELDS.SUBTIPO, MOVIMIENTO_INSUMO_FIELDS.CANTIDAD_ORIGINAL, MOVIMIENTO_INSUMO_FIELDS.UNIDAD_ORIGINAL, MOVIMIENTO_INSUMO_FIELDS.FACTOR_CONVERSION,
        MOVIMIENTO_INSUMO_FIELDS.CANTIDAD_BASE, MOVIMIENTO_INSUMO_FIELDS.COSTO_UNITARIO, MOVIMIENTO_INSUMO_FIELDS.COSTO_TOTAL, MOVIMIENTO_INSUMO_FIELDS.COSTO_UNITARIO_BASE,
        MOVIMIENTO_INSUMO_FIELDS.DOCUMENTO_ORIGEN, MOVIMIENTO_INSUMO_FIELDS.ID_SOLICITUD_COMPRA, MOVIMIENTO_INSUMO_FIELDS.LOTE, MOVIMIENTO_INSUMO_FIELDS.FECHA_VENCIMIENTO, MOVIMIENTO_INSUMO_FIELDS.NOTAS,
        MOVIMIENTO_INSUMO_FIELDS.ESTADO, MOVIMIENTO_INSUMO_FIELDS.ID_RESPONSABLE, MOVIMIENTO_INSUMO_FIELDS.AREA_ORIGEN,
        MOVIMIENTO_INSUMO_FIELDS.AREA_DESTINO, MOVIMIENTO_INSUMO_FIELDS.AREA_DESTINO_LINK, MOVIMIENTO_INSUMO_FIELDS.AREA_ORIGEN_LINK,
        MOVIMIENTO_INSUMO_FIELDS.CREADA, MOVIMIENTO_INSUMO_FIELDS.ULTIMA_MODIFICACION, MOVIMIENTO_INSUMO_FIELDS.INSUMO_LINK, MOVIMIENTO_INSUMO_FIELDS.STOCK_LINK,
      ],
      sort: [{ field: MOVIMIENTO_INSUMO_FIELDS.CREADA, direction: 'desc' }],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        movimientos.push({
          id: record.id,
          codigoMovimiento: record.fields[MOVIMIENTO_INSUMO_FIELDS.CODIGO] as string || '',
          idNumero: record.fields[MOVIMIENTO_INSUMO_FIELDS.ID] as number || 0,
          nombre: record.fields[MOVIMIENTO_INSUMO_FIELDS.NOMBRE] as string || '',
          cantidad: record.fields[MOVIMIENTO_INSUMO_FIELDS.CANTIDAD] as number || 0,
          tipoMovimiento: record.fields[MOVIMIENTO_INSUMO_FIELDS.TIPO_MOVIMIENTO] as string || '',
          subtipo: record.fields[MOVIMIENTO_INSUMO_FIELDS.SUBTIPO] as string || '',
          cantidadOriginal: record.fields[MOVIMIENTO_INSUMO_FIELDS.CANTIDAD_ORIGINAL] as number || 0,
          unidadOriginalId: (record.fields[MOVIMIENTO_INSUMO_FIELDS.UNIDAD_ORIGINAL] as string[] || [])[0] || '',
          factorConversion: record.fields[MOVIMIENTO_INSUMO_FIELDS.FACTOR_CONVERSION] as number || 0,
          cantidadBase: record.fields[MOVIMIENTO_INSUMO_FIELDS.CANTIDAD_BASE] as number || 0,
          costoUnitario: record.fields[MOVIMIENTO_INSUMO_FIELDS.COSTO_UNITARIO] as number || 0,
          costoTotal: record.fields[MOVIMIENTO_INSUMO_FIELDS.COSTO_TOTAL] as number || 0,
          costoUnitarioBase: record.fields[MOVIMIENTO_INSUMO_FIELDS.COSTO_UNITARIO_BASE] as number || 0,
          documentoOrigen: record.fields[MOVIMIENTO_INSUMO_FIELDS.DOCUMENTO_ORIGEN] as string || '',
          idSolicitudCompra: record.fields[MOVIMIENTO_INSUMO_FIELDS.ID_SOLICITUD_COMPRA] as string || '',
          lote: record.fields[MOVIMIENTO_INSUMO_FIELDS.LOTE] as string || '',
          fechaVencimiento: record.fields[MOVIMIENTO_INSUMO_FIELDS.FECHA_VENCIMIENTO] as string || '',
          notas: record.fields[MOVIMIENTO_INSUMO_FIELDS.NOTAS] as string || '',
          estadoEntrada: record.fields[MOVIMIENTO_INSUMO_FIELDS.ESTADO] as string || '',
          idResponsable: record.fields[MOVIMIENTO_INSUMO_FIELDS.ID_RESPONSABLE] as string || '',
          idAreaOrigen: record.fields[MOVIMIENTO_INSUMO_FIELDS.AREA_ORIGEN] as string || '',
          idAreaDestino: record.fields[MOVIMIENTO_INSUMO_FIELDS.AREA_DESTINO] as string || '',
          areaDestinoLinkIds: record.fields[MOVIMIENTO_INSUMO_FIELDS.AREA_DESTINO_LINK] as string[] || [],
          areaOrigenLinkIds: record.fields[MOVIMIENTO_INSUMO_FIELDS.AREA_ORIGEN_LINK] as string[] || [],
          creada: record.fields[MOVIMIENTO_INSUMO_FIELDS.CREADA] as string || '',
          ultimaModificacion: record.fields[MOVIMIENTO_INSUMO_FIELDS.ULTIMA_MODIFICACION] as string || '',
          insumoIds: record.fields[MOVIMIENTO_INSUMO_FIELDS.INSUMO_LINK] as string[] || [],
          stockIds: record.fields[MOVIMIENTO_INSUMO_FIELDS.STOCK_LINK] as string[] || [],
        });
      });
      fetchNextPage();
    });
  return movimientos;
}

interface StockRecord {
  id: string;
  idStock: string;
  idNumero: number;
  stockActual: number;
  ultimaActualizacion: string;
  cantidadIngresa: number[];
  cantidadSale: number[];
  insumoId: string;
  movimientoIds: string[];
  areaId: string;
  costoAcumulado: number;
}

async function fetchStocks(): Promise<StockRecord[]> {
  const stocks: StockRecord[] = [];
  await base(STOCK_TABLE)
    .select({
      fields: [
        STOCK_INSUMO_FIELDS.ID_STOCK, STOCK_INSUMO_FIELDS.ID, STOCK_INSUMO_FIELDS.STOCK_ACTUAL, STOCK_INSUMO_FIELDS.ULTIMA_ACTUALIZACION,
        STOCK_INSUMO_FIELDS.CANTIDAD_INGRESA, STOCK_INSUMO_FIELDS.CANTIDAD_SALE, STOCK_INSUMO_FIELDS.INSUMO_LINK, STOCK_INSUMO_FIELDS.MOVIMIENTO_LINK,
        STOCK_INSUMO_FIELDS.AREA, STOCK_INSUMO_FIELDS.COSTO_ACUMULADO,
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields[STOCK_INSUMO_FIELDS.INSUMO_LINK] as string[] || [];
        const areaIds = record.fields[STOCK_INSUMO_FIELDS.AREA] as string[] || [];
        stocks.push({
          id: record.id,
          idStock: record.fields[STOCK_INSUMO_FIELDS.ID_STOCK] as string || '',
          idNumero: record.fields[STOCK_INSUMO_FIELDS.ID] as number || 0,
          stockActual: record.fields[STOCK_INSUMO_FIELDS.STOCK_ACTUAL] as number || 0,
          ultimaActualizacion: record.fields[STOCK_INSUMO_FIELDS.ULTIMA_ACTUALIZACION] as string || '',
          cantidadIngresa: (record.fields[STOCK_INSUMO_FIELDS.CANTIDAD_INGRESA] as unknown as number[]) || [],
          cantidadSale: (record.fields[STOCK_INSUMO_FIELDS.CANTIDAD_SALE] as unknown as number[]) || [],
          insumoId: insumoIds[0] || '',
          movimientoIds: record.fields[STOCK_INSUMO_FIELDS.MOVIMIENTO_LINK] as string[] || [],
          areaId: areaIds[0] || '',
          costoAcumulado: record.fields[STOCK_INSUMO_FIELDS.COSTO_ACUMULADO] as number || 0,
        });
      });
      fetchNextPage();
    });
  return stocks;
}

// ─── Unidades de Medida ──────────────────────────────────────────

interface UnidadRecord {
  id: string;
  nombre: string;
  simbolo: string;
  tipo: string;
  factorABase: number;
  unidadBaseDeTipo: string;
}

async function fetchUnidades(): Promise<UnidadRecord[]> {
  const unidades: UnidadRecord[] = [];
  await base(UNIDADES_TABLE)
    .select({
      fields: [UNIDAD_FIELDS.NOMBRE, UNIDAD_FIELDS.SIMBOLO, UNIDAD_FIELDS.TIPO, UNIDAD_FIELDS.FACTOR_A_BASE, UNIDAD_FIELDS.UNIDAD_BASE_DE_TIPO],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        unidades.push({
          id: record.id,
          nombre: record.fields[UNIDAD_FIELDS.NOMBRE] as string || '',
          simbolo: record.fields[UNIDAD_FIELDS.SIMBOLO] as string || '',
          tipo: record.fields[UNIDAD_FIELDS.TIPO] as string || '',
          factorABase: record.fields[UNIDAD_FIELDS.FACTOR_A_BASE] as number || 1,
          unidadBaseDeTipo: record.fields[UNIDAD_FIELDS.UNIDAD_BASE_DE_TIPO] as string || '',
        });
      });
      fetchNextPage();
    });
  return unidades;
}

// ─── Áreas ───────────────────────────────────────────────────────

interface AreaRecord {
  id: string;
  nombre: string;
  idCore: string;
  responsable: string;
  activa: boolean;
}

async function fetchAreas(): Promise<AreaRecord[]> {
  const areas: AreaRecord[] = [];
  await base(AREAS_TABLE)
    .select({
      fields: [AREA_FIELDS.NOMBRE, AREA_FIELDS.ID_CORE, AREA_FIELDS.RESPONSABLE, AREA_FIELDS.ACTIVA],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        areas.push({
          id: record.id,
          nombre: record.fields[AREA_FIELDS.NOMBRE] as string || '',
          idCore: record.fields[AREA_FIELDS.ID_CORE] as string || '',
          responsable: record.fields[AREA_FIELDS.RESPONSABLE] as string || '',
          activa: record.fields[AREA_FIELDS.ACTIVA] as boolean || false,
        });
      });
      fetchNextPage();
    });
  return areas;
}

// ═══════════════════════════════════════════════════════════════════
// POST — Crear insumo o registrar movimiento
// ═══════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accion } = body as { accion: string };

    // ── Crear insumo ─────────────────────────────────────────────
    if (accion === 'crear_insumo') {
      const { nombre, unidadMedida, unidadBaseId, stockMinimo, estadoInsumo, fichaTecnica, referenciaComercial, categoriaId } = body;
      if (!nombre?.trim()) {
        return NextResponse.json({ success: false, error: 'El nombre es obligatorio' }, { status: 400 });
      }

      const fields: Record<string, string | number | string[]> = {
        [INSUMO_FIELDS.NOMBRE]: nombre.trim(),
        [INSUMO_FIELDS.UNIDAD_MEDIDA]: unidadMedida || 'Unidad',
        [INSUMO_FIELDS.ESTADO]: estadoInsumo || 'Activo',
      };
      if (unidadBaseId) fields[INSUMO_FIELDS.UNIDAD_BASE] = [unidadBaseId];
      if (stockMinimo !== undefined && stockMinimo !== null) fields[INSUMO_FIELDS.STOCK_MINIMO] = Number(stockMinimo);
      if (fichaTecnica) fields[INSUMO_FIELDS.FICHA_TECNICA] = fichaTecnica;
      if (referenciaComercial) fields[INSUMO_FIELDS.REFERENCIA_COMERCIAL] = referenciaComercial;
      if (categoriaId) fields[INSUMO_FIELDS.CATEGORIA] = [categoriaId];

      const record = await base(INSUMO_TABLE).create(fields);
      return NextResponse.json({
        success: true,
        insumo: { id: record.id, nombre: record.fields[INSUMO_FIELDS.NOMBRE] },
        mensaje: `Insumo "${nombre}" creado exitosamente`,
      });
    }

    // ── Registrar movimiento ─────────────────────────────────────
    if (accion === 'registrar_movimiento') {
      const {
        insumoId, tipoMovimiento, subtipo, cantidadOriginal, unidadOriginalId,
        factorConversion, areaDestinoId, areaOrigenId, costoUnitario,
        documentoOrigen, notas,
      } = body;

      if (!insumoId || !tipoMovimiento || !cantidadOriginal) {
        return NextResponse.json({ success: false, error: 'insumoId, tipoMovimiento y cantidadOriginal son obligatorios' }, { status: 400 });
      }

      const factor = Number(factorConversion) || 1;
      const cantBase = Number(cantidadOriginal) * factor;
      const costoUnit = Number(costoUnitario) || 0;
      const costoTotal = Number(cantidadOriginal) * costoUnit;
      const costoUnitBase = cantBase > 0 ? costoTotal / cantBase : 0;

      // Obtener nombre del insumo para el Name del movimiento
      let insumoNombre = '';
      try {
        const insumoRec = await base(INSUMO_TABLE).find(insumoId);
        insumoNombre = insumoRec.fields[INSUMO_FIELDS.NOMBRE] as string || '';
      } catch { /* ignore */ }

      const subtipoLabel = subtipo || tipoMovimiento;
      const movFields: Record<string, string | number | string[]> = {
        [MOVIMIENTO_INSUMO_FIELDS.NOMBRE]: `${tipoMovimiento} - ${subtipoLabel} - ${insumoNombre}`.slice(0, 100),
        [MOVIMIENTO_INSUMO_FIELDS.TIPO_MOVIMIENTO]: tipoMovimiento,
        [MOVIMIENTO_INSUMO_FIELDS.INSUMO_LINK]: [insumoId],
        [MOVIMIENTO_INSUMO_FIELDS.CANTIDAD_ORIGINAL]: Number(cantidadOriginal),
        [MOVIMIENTO_INSUMO_FIELDS.FACTOR_CONVERSION]: factor,
        [MOVIMIENTO_INSUMO_FIELDS.CANTIDAD_BASE]: cantBase,
        [MOVIMIENTO_INSUMO_FIELDS.CANTIDAD]: cantBase, // Legacy field
        [MOVIMIENTO_INSUMO_FIELDS.ESTADO]: 'Pendiente',
      };

      if (subtipo) movFields[MOVIMIENTO_INSUMO_FIELDS.SUBTIPO] = subtipo;
      if (unidadOriginalId) movFields[MOVIMIENTO_INSUMO_FIELDS.UNIDAD_ORIGINAL] = [unidadOriginalId];
      if (areaDestinoId) movFields[MOVIMIENTO_INSUMO_FIELDS.AREA_DESTINO_LINK] = [areaDestinoId];
      if (areaOrigenId) movFields[MOVIMIENTO_INSUMO_FIELDS.AREA_ORIGEN_LINK] = [areaOrigenId];
      if (costoUnit > 0) {
        movFields[MOVIMIENTO_INSUMO_FIELDS.COSTO_UNITARIO] = costoUnit;
        movFields[MOVIMIENTO_INSUMO_FIELDS.COSTO_TOTAL] = costoTotal;
        movFields[MOVIMIENTO_INSUMO_FIELDS.COSTO_UNITARIO_BASE] = costoUnitBase;
      }
      if (documentoOrigen) movFields[MOVIMIENTO_INSUMO_FIELDS.DOCUMENTO_ORIGEN] = documentoOrigen;
      if (notas) movFields[MOVIMIENTO_INSUMO_FIELDS.NOTAS] = notas;

      const record = await base(MOVIMIENTOS_TABLE).create(movFields);
      return NextResponse.json({
        success: true,
        movimiento: { id: record.id, nombre: record.fields[MOVIMIENTO_INSUMO_FIELDS.NOMBRE] },
        mensaje: `Movimiento de ${tipoMovimiento.toLowerCase()} registrado (${cantidadOriginal} → ${cantBase} base)`,
      });
    }

    return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error('❌ Error POST inventario-central:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error al procesar operación' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUT — Editar insumo
// ═══════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nombre, unidadMedida, unidadBaseId, stockMinimo, estadoInsumo, fichaTecnica, referenciaComercial, categoriaId } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID del insumo es obligatorio' }, { status: 400 });
    }

    const fields: Record<string, string | number | string[]> = {};
    if (nombre !== undefined) fields[INSUMO_FIELDS.NOMBRE] = nombre.trim();
    if (unidadMedida !== undefined) fields[INSUMO_FIELDS.UNIDAD_MEDIDA] = unidadMedida;
    if (unidadBaseId !== undefined) fields[INSUMO_FIELDS.UNIDAD_BASE] = unidadBaseId ? [unidadBaseId] : [];
    if (stockMinimo !== undefined) fields[INSUMO_FIELDS.STOCK_MINIMO] = Number(stockMinimo);
    if (estadoInsumo !== undefined) fields[INSUMO_FIELDS.ESTADO] = estadoInsumo;
    if (fichaTecnica !== undefined) fields[INSUMO_FIELDS.FICHA_TECNICA] = fichaTecnica;
    if (referenciaComercial !== undefined) fields[INSUMO_FIELDS.REFERENCIA_COMERCIAL] = referenciaComercial;
    if (categoriaId !== undefined) fields[INSUMO_FIELDS.CATEGORIA] = categoriaId ? [categoriaId] : [];

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ success: false, error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
    }

    await base(INSUMO_TABLE).update(id, fields);
    return NextResponse.json({ success: true, mensaje: 'Insumo actualizado exitosamente' });
  } catch (error) {
    console.error('❌ Error PUT inventario-central:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error al actualizar insumo' },
      { status: 500 }
    );
  }
}
