import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

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
        'Código SIRIUS-INS', 'ID', 'Nombre', 'Unidad Medida', 'Unidad Base',
        'Stock Minimo', 'Estado Insumo', 'Ficha Tecnica',
        'Referencia Comercial', 'Categoria', 'Imagen Referencia',
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const imagenes = record.fields['Imagen Referencia'] as Array<{
          url: string; filename: string; thumbnails?: { small?: { url: string } };
        }> | undefined;

        const refComercial = record.fields['Referencia Comercial'] as unknown;
        let refStr = '';
        if (refComercial && typeof refComercial === 'object' && 'value' in (refComercial as Record<string, unknown>)) {
          refStr = (refComercial as { value: string }).value || '';
        } else if (typeof refComercial === 'string') {
          refStr = refComercial;
        }

        const unidadBaseIds = record.fields['Unidad Base'] as string[] || [];

        insumos.push({
          id: record.id,
          codigoSirius: record.fields['Código SIRIUS-INS'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          nombre: record.fields['Nombre'] as string || '',
          unidadMedida: record.fields['Unidad Medida'] as string || '',
          unidadBaseId: unidadBaseIds[0] || '',
          stockMinimo: record.fields['Stock Minimo'] as number || 0,
          estadoInsumo: record.fields['Estado Insumo'] as string || '',
          etiquetas: [],
          fichaTecnica: record.fields['Ficha Tecnica'] as string || '',
          referenciaComercial: refStr,
          categoriaIds: record.fields['Categoria'] as string[] || [],
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
      fields: ['Código CAT-INS', 'ID', 'Tipo de insumo', 'Descripción', 'Insumo'],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields['Insumo'] as string[] || [];
        categorias.push({
          id: record.id,
          codigoCategoria: record.fields['Código CAT-INS'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          tipoInsumo: record.fields['Tipo de insumo'] as string || '',
          descripcion: record.fields['Descripción'] as string || '',
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
        'Código Movimiento Insumo', 'ID', 'Name', 'Cantidad ', 'Tipo Movimiento',
        'Subtipo', 'Cantidad Original', 'Unidad Original', 'Factor Conversion',
        'Cantidad Base', 'Costo Unitario', 'Costo Total', 'Costo Unitario Base',
        'Documento Origen', 'ID Solicitud Compra', 'Lote', 'Fecha Vencimiento', 'Notas',
        'Estado Entrada Insumo', 'ID Responsable Core', 'ID Area Origen',
        'ID Area Destino', 'Area Destino Link', 'Area Origen Link',
        'Creada', 'Última modificación', 'Insumo', 'Stock Insumos',
      ],
      sort: [{ field: 'Creada', direction: 'desc' }],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        movimientos.push({
          id: record.id,
          codigoMovimiento: record.fields['Código Movimiento Insumo'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          nombre: record.fields['Name'] as string || '',
          cantidad: record.fields['Cantidad '] as number || 0,
          tipoMovimiento: record.fields['Tipo Movimiento'] as string || '',
          subtipo: record.fields['Subtipo'] as string || '',
          cantidadOriginal: record.fields['Cantidad Original'] as number || 0,
          unidadOriginalId: (record.fields['Unidad Original'] as string[] || [])[0] || '',
          factorConversion: record.fields['Factor Conversion'] as number || 0,
          cantidadBase: record.fields['Cantidad Base'] as number || 0,
          costoUnitario: record.fields['Costo Unitario'] as number || 0,
          costoTotal: record.fields['Costo Total'] as number || 0,
          costoUnitarioBase: record.fields['Costo Unitario Base'] as number || 0,
          documentoOrigen: record.fields['Documento Origen'] as string || '',
          idSolicitudCompra: record.fields['ID Solicitud Compra'] as string || '',
          lote: record.fields['Lote'] as string || '',
          fechaVencimiento: record.fields['Fecha Vencimiento'] as string || '',
          notas: record.fields['Notas'] as string || '',
          estadoEntrada: record.fields['Estado Entrada Insumo'] as string || '',
          idResponsable: record.fields['ID Responsable Core'] as string || '',
          idAreaOrigen: record.fields['ID Area Origen'] as string || '',
          idAreaDestino: record.fields['ID Area Destino'] as string || '',
          areaDestinoLinkIds: record.fields['Area Destino Link'] as string[] || [],
          areaOrigenLinkIds: record.fields['Area Origen Link'] as string[] || [],
          creada: record.fields['Creada'] as string || '',
          ultimaModificacion: record.fields['Última modificación'] as string || '',
          insumoIds: record.fields['Insumo'] as string[] || [],
          stockIds: record.fields['Stock Insumos'] as string[] || [],
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
        'id_stock', 'ID', 'stock_actual', 'Ultima Actualizacion',
        'Cantidad Ingresa', 'Cantidad Sale', 'Insumo ID', 'Movimiento Insumo ID',
        'Area', 'Costo Acumulado',
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields['Insumo ID'] as string[] || [];
        const areaIds = record.fields['Area'] as string[] || [];
        stocks.push({
          id: record.id,
          idStock: record.fields['id_stock'] as string || '',
          idNumero: record.fields['ID'] as number || 0,
          stockActual: record.fields['stock_actual'] as number || 0,
          ultimaActualizacion: record.fields['Ultima Actualizacion'] as string || '',
          cantidadIngresa: (record.fields['Cantidad Ingresa'] as unknown as number[]) || [],
          cantidadSale: (record.fields['Cantidad Sale'] as unknown as number[]) || [],
          insumoId: insumoIds[0] || '',
          movimientoIds: record.fields['Movimiento Insumo ID'] as string[] || [],
          areaId: areaIds[0] || '',
          costoAcumulado: record.fields['Costo Acumulado'] as number || 0,
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
      fields: ['Nombre', 'Simbolo', 'Tipo', 'Factor a Base', 'Unidad Base de Tipo'],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        unidades.push({
          id: record.id,
          nombre: record.fields['Nombre'] as string || '',
          simbolo: record.fields['Simbolo'] as string || '',
          tipo: record.fields['Tipo'] as string || '',
          factorABase: record.fields['Factor a Base'] as number || 1,
          unidadBaseDeTipo: record.fields['Unidad Base de Tipo'] as string || '',
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
      fields: ['Nombre', 'ID Core', 'Responsable', 'Activa'],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        areas.push({
          id: record.id,
          nombre: record.fields['Nombre'] as string || '',
          idCore: record.fields['ID Core'] as string || '',
          responsable: record.fields['Responsable'] as string || '',
          activa: record.fields['Activa'] as boolean || false,
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
        'Nombre': nombre.trim(),
        'Unidad Medida': unidadMedida || 'Unidad',
        'Estado Insumo': estadoInsumo || 'Activo',
      };
      if (unidadBaseId) fields['Unidad Base'] = [unidadBaseId];
      if (stockMinimo !== undefined && stockMinimo !== null) fields['Stock Minimo'] = Number(stockMinimo);
      if (fichaTecnica) fields['Ficha Tecnica'] = fichaTecnica;
      if (referenciaComercial) fields['Referencia Comercial'] = referenciaComercial;
      if (categoriaId) fields['Categoria'] = [categoriaId];

      const record = await base(INSUMO_TABLE).create(fields);
      return NextResponse.json({
        success: true,
        insumo: { id: record.id, nombre: record.fields['Nombre'] },
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
        insumoNombre = insumoRec.fields['Nombre'] as string || '';
      } catch { /* ignore */ }

      const subtipoLabel = subtipo || tipoMovimiento;
      const movFields: Record<string, string | number | string[]> = {
        'Name': `${tipoMovimiento} - ${subtipoLabel} - ${insumoNombre}`.slice(0, 100),
        'Tipo Movimiento': tipoMovimiento,
        'Insumo': [insumoId],
        'Cantidad Original': Number(cantidadOriginal),
        'Factor Conversion': factor,
        'Cantidad Base': cantBase,
        'Cantidad ': cantBase, // Legacy field
        'Estado Entrada Insumo': 'Pendiente',
      };

      if (subtipo) movFields['Subtipo'] = subtipo;
      if (unidadOriginalId) movFields['Unidad Original'] = [unidadOriginalId];
      if (areaDestinoId) movFields['Area Destino Link'] = [areaDestinoId];
      if (areaOrigenId) movFields['Area Origen Link'] = [areaOrigenId];
      if (costoUnit > 0) {
        movFields['Costo Unitario'] = costoUnit;
        movFields['Costo Total'] = costoTotal;
        movFields['Costo Unitario Base'] = costoUnitBase;
      }
      if (documentoOrigen) movFields['Documento Origen'] = documentoOrigen;
      if (notas) movFields['Notas'] = notas;

      const record = await base(MOVIMIENTOS_TABLE).create(movFields);
      return NextResponse.json({
        success: true,
        movimiento: { id: record.id, nombre: record.fields['Name'] },
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
    if (nombre !== undefined) fields['Nombre'] = nombre.trim();
    if (unidadMedida !== undefined) fields['Unidad Medida'] = unidadMedida;
    if (unidadBaseId !== undefined) fields['Unidad Base'] = unidadBaseId ? [unidadBaseId] : [];
    if (stockMinimo !== undefined) fields['Stock Minimo'] = Number(stockMinimo);
    if (estadoInsumo !== undefined) fields['Estado Insumo'] = estadoInsumo;
    if (fichaTecnica !== undefined) fields['Ficha Tecnica'] = fichaTecnica;
    if (referenciaComercial !== undefined) fields['Referencia Comercial'] = referenciaComercial;
    if (categoriaId !== undefined) fields['Categoria'] = categoriaId ? [categoriaId] : [];

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
