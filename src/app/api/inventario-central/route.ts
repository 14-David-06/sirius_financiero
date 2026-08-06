import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';

const INSUMOS_BASE_ID = process.env.AIRTABLE_INS_BASE_ID || '';
const INSUMO_TABLE = process.env.AIRTABLE_INS_TABLE_ID || '';
const CATEGORIAS_TABLE = process.env.AIRTABLE_CAT_INSUMO_TABLE_ID || '';
const MOVIMIENTOS_TABLE = process.env.AIRTABLE_MOV_INSUMO_TABLE_ID || '';
const STOCK_TABLE = process.env.AIRTABLE_STOCK_INSUMO_TABLE_ID || '';
const UNIDADES_TABLE = process.env.AIRTABLE_UNIDADES_TABLE_ID || '';
// No hay tabla de Áreas: se derivan del texto de los movimientos (ver derivarAreas)

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(INSUMOS_BASE_ID);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seccion = searchParams.get('seccion') || 'resumen';

    if (seccion === 'resumen') {
      const [insumos, categorias, movimientos, stocks, unidades] = await Promise.all([
        fetchInsumos(),
        fetchCategorias(),
        fetchMovimientos(),
        fetchStocks(),
        fetchUnidades(),
      ]);

      // Las áreas se derivan de los movimientos: ya no existen como tabla
      const areas = derivarAreas(movimientos);

      const insumosActivos = insumos.filter(i => i.estadoInsumo === 'Activo').length;
      const stockBajoMinimo = stocks.filter(s => {
        const insumo = insumos.find(i => i.id === s.insumoId);
        return insumo && insumo.stockMinimo > 0 && s.stockActual < insumo.stockMinimo;
      }).length;

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
          totalAreas: areas.length,
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
      const areas = derivarAreas(await fetchMovimientos());
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

/**
 * Refleja el esquema actual de "Movimientos Insumos".
 *
 * El modelo se rediseñó: se eliminaron los campos de costo (Costo Unitario/Total/
 * Unitario Base), conversión de unidades (Cantidad Original/Unidad Original/
 * Factor Conversion/Cantidad Base), lote y vencimiento, subtipo, documento de
 * origen, estado de recepción y los links a Áreas. En su lugar entraron los
 * campos de trazabilidad `Fecha Movimiento`, `ID Bache Origen` e
 * `ID Produccion Destino`. Las áreas ahora son solo texto (ID Area Origen/Destino).
 */
interface MovimientoRecord {
  id: string;
  codigoMovimiento: string;
  idNumero: number;
  nombre: string;
  cantidad: number;
  tipoMovimiento: string;
  idResponsable: string;
  idAreaOrigen: string;
  idAreaDestino: string;
  fechaMovimiento: string;
  idBacheOrigen: string;
  idProduccionDestino: string;
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
        'ID Responsable Core', 'ID Area Origen', 'ID Area Destino',
        'Fecha Movimiento', 'ID Bache Origen', 'ID Produccion Destino',
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
          idResponsable: record.fields['ID Responsable Core'] as string || '',
          idAreaOrigen: record.fields['ID Area Origen'] as string || '',
          idAreaDestino: record.fields['ID Area Destino'] as string || '',
          fechaMovimiento: record.fields['Fecha Movimiento'] as string || '',
          idBacheOrigen: record.fields['ID Bache Origen'] as string || '',
          idProduccionDestino: record.fields['ID Produccion Destino'] as string || '',
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

/**
 * Refleja el esquema actual de "Stock Insumos".
 * El rediseño eliminó `Area` y `Costo Acumulado`, por lo que el stock ya no está
 * segmentado por área ni valorizado.
 */
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
}

async function fetchStocks(): Promise<StockRecord[]> {
  const stocks: StockRecord[] = [];
  await base(STOCK_TABLE)
    .select({
      fields: [
        'id_stock', 'ID', 'stock_actual', 'Ultima Actualizacion',
        'Cantidad Ingresa', 'Cantidad Sale', 'Insumo ID', 'Movimiento Insumo ID',
      ],
    })
    .eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const insumoIds = record.fields['Insumo ID'] as string[] || [];
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

/**
 * Las áreas ya no son una tabla de Airtable: el rediseño las dejó como texto
 * libre en `ID Area Origen` / `ID Area Destino` de cada movimiento. Se derivan
 * de ahí para no perder el filtro por área en la UI.
 */
interface AreaRecord {
  id: string;
  nombre: string;
  movimientosOrigen: number;
  movimientosDestino: number;
}

// Código de área de Sirius. Los campos de área son texto libre, así que hay
// registros con basura (p.ej. referencias de factura); el patrón las descarta.
const PATRON_CODIGO_AREA = /^SIRIUS-AREA-\d+$/i;

// Únicas opciones del singleSelect "Tipo Movimiento" en Airtable
const TIPOS_MOVIMIENTO = ['Entrada', 'Salida', 'Ajuste'];

function derivarAreas(movimientos: MovimientoRecord[]): AreaRecord[] {
  const mapa = new Map<string, AreaRecord>();
  const descartados = new Set<string>();

  const registrar = (valor: string, sentido: 'origen' | 'destino') => {
    const clave = (valor || '').trim();
    if (!clave) return;
    if (!PATRON_CODIGO_AREA.test(clave)) {
      descartados.add(clave);
      return;
    }
    const actual = mapa.get(clave) || {
      id: clave,
      nombre: clave,
      movimientosOrigen: 0,
      movimientosDestino: 0,
    };
    if (sentido === 'origen') actual.movimientosOrigen += 1;
    else actual.movimientosDestino += 1;
    mapa.set(clave, actual);
  };

  for (const mov of movimientos) {
    registrar(mov.idAreaOrigen, 'origen');
    registrar(mov.idAreaDestino, 'destino');
  }

  if (descartados.size > 0) {
    console.warn(
      `⚠️ Valores en campos de área que no son códigos de área (ignorados): ${Array.from(descartados).join(', ')}`
    );
  }

  return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
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
        insumoId, tipoMovimiento, cantidad, areaDestino, areaOrigen,
        fechaMovimiento, idBacheOrigen, idProduccionDestino, idResponsable,
      } = body;

      if (!insumoId || !tipoMovimiento || !cantidad) {
        return NextResponse.json({ success: false, error: 'insumoId, tipoMovimiento y cantidad son obligatorios' }, { status: 400 });
      }

      if (!TIPOS_MOVIMIENTO.includes(tipoMovimiento)) {
        return NextResponse.json(
          { success: false, error: `tipoMovimiento debe ser uno de: ${TIPOS_MOVIMIENTO.join(', ')}` },
          { status: 400 }
        );
      }

      const cantidadNum = Number(cantidad);
      if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
        return NextResponse.json({ success: false, error: 'La cantidad debe ser un número mayor a cero' }, { status: 400 });
      }

      // Obtener nombre del insumo para el Name del movimiento
      let insumoNombre = '';
      try {
        const insumoRec = await base(INSUMO_TABLE).find(insumoId);
        insumoNombre = insumoRec.fields['Nombre'] as string || '';
      } catch { /* ignore */ }

      const movFields: Record<string, string | number | string[]> = {
        'Name': `${tipoMovimiento} - ${insumoNombre}`.slice(0, 100),
        'Tipo Movimiento': tipoMovimiento,
        'Insumo': [insumoId],
        'Cantidad ': cantidadNum,
      };

      // Las áreas son texto libre desde el rediseño, no links a una tabla
      if (areaOrigen) movFields['ID Area Origen'] = String(areaOrigen);
      if (areaDestino) movFields['ID Area Destino'] = String(areaDestino);
      if (idResponsable) movFields['ID Responsable Core'] = String(idResponsable);
      // Sin fecha explícita el registro queda fechado por `Creada`
      if (fechaMovimiento) movFields['Fecha Movimiento'] = String(fechaMovimiento);
      if (idBacheOrigen) movFields['ID Bache Origen'] = String(idBacheOrigen);
      if (idProduccionDestino) movFields['ID Produccion Destino'] = String(idProduccionDestino);

      const record = await base(MOVIMIENTOS_TABLE).create(movFields);
      return NextResponse.json({
        success: true,
        movimiento: { id: record.id, nombre: record.fields['Name'] },
        mensaje: `Movimiento de ${tipoMovimiento.toLowerCase()} registrado (${cantidadNum})`,
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
