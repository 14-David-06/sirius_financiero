'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import {
  Package, Layers, ArrowUpDown, AlertTriangle, Search,
  RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Box, Filter, ArrowDownCircle, ArrowUpCircle, Clock,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface Insumo {
  id: string;
  codigoSirius: string;
  idNumero: number;
  nombre: string;
  unidadMedida: string;
  stockMinimo: number;
  estadoInsumo: string;
  etiquetas: string[];
  fichaTecnica: string;
  referenciaComercial: string;
  categoriaIds: string[];
  imagenReferencia: { url: string; filename: string; thumbnailUrl: string }[];
}

interface Categoria {
  id: string;
  codigoCategoria: string;
  idNumero: number;
  tipoInsumo: string;
  descripcion: string;
  insumoIds: string[];
  cantidadInsumos: number;
}

interface Movimiento {
  id: string;
  codigoMovimiento: string;
  idNumero: number;
  nombre: string;
  cantidad: number;
  tipoMovimiento: string;
  estadoEntrada: string;
  idResponsable: string;
  idAreaOrigen: string;
  idAreaDestino: string;
  creada: string;
  ultimaModificacion: string;
  insumoIds: string[];
  stockIds: string[];
}

interface Stock {
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

interface KPIs {
  totalInsumos: number;
  insumosActivos: number;
  totalCategorias: number;
  totalMovimientos: number;
  stockBajoMinimo: number;
}

type TabActiva = 'catalogo' | 'stock' | 'movimientos' | 'categorias';

// ─── Component ───────────────────────────────────────────────────

export default function InventarioCentral() {
  const { isAuthenticated, isLoading: authLoading } = useAuthSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState<TabActiva>('catalogo');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroTipoMov, setFiltroTipoMov] = useState<string>('');
  const [ordenCatalogo, setOrdenCatalogo] = useState<{ campo: string; dir: 'asc' | 'desc' }>({ campo: 'idNumero', dir: 'asc' });
  const [detalleInsumo, setDetalleInsumo] = useState<string | null>(null);

  const [kpis, setKpis] = useState<KPIs>({ totalInsumos: 0, insumosActivos: 0, totalCategorias: 0, totalMovimientos: 0, stockBajoMinimo: 0 });
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  // ─── Data fetching ─────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/inventario-central?seccion=resumen');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error desconocido');

      setKpis(data.kpis);
      setInsumos(data.insumos);
      setCategorias(data.categorias);
      setMovimientos(data.movimientos);
      setStocks(data.stocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) cargarDatos();
  }, [isAuthenticated, cargarDatos]);

  // ─── Helpers ───────────────────────────────────────────────────

  const getNombreInsumo = useCallback((insumoId: string) => {
    return insumos.find(i => i.id === insumoId)?.nombre || 'Desconocido';
  }, [insumos]);

  const getCategoriaNombre = useCallback((categoriaId: string) => {
    return categorias.find(c => c.id === categoriaId)?.tipoInsumo || '';
  }, [categorias]);

  const getStockForInsumo = useCallback((insumoId: string) => {
    return stocks.find(s => s.insumoId === insumoId);
  }, [stocks]);

  const formatFecha = (fecha: string) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  // ─── Filtered & sorted data ────────────────────────────────────

  const insumosFiltrados = useMemo(() => {
    let resultado = [...insumos];
    if (busqueda) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter(i =>
        i.nombre.toLowerCase().includes(q) ||
        i.codigoSirius.toLowerCase().includes(q) ||
        i.referenciaComercial.toLowerCase().includes(q)
      );
    }
    if (filtroEstado) resultado = resultado.filter(i => i.estadoInsumo === filtroEstado);
    if (filtroCategoria) resultado = resultado.filter(i => i.categoriaIds.includes(filtroCategoria));

    resultado.sort((a, b) => {
      const campo = ordenCatalogo.campo as keyof Insumo;
      const valA = a[campo];
      const valB = b[campo];
      const mod = ordenCatalogo.dir === 'asc' ? 1 : -1;
      if (typeof valA === 'string' && typeof valB === 'string') return valA.localeCompare(valB) * mod;
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * mod;
      return 0;
    });
    return resultado;
  }, [insumos, busqueda, filtroEstado, filtroCategoria, ordenCatalogo]);

  const movimientosFiltrados = useMemo(() => {
    let resultado = [...movimientos];
    if (busqueda) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter(m =>
        m.nombre.toLowerCase().includes(q) ||
        m.codigoMovimiento.toLowerCase().includes(q)
      );
    }
    if (filtroTipoMov) resultado = resultado.filter(m => m.tipoMovimiento === filtroTipoMov);
    return resultado;
  }, [movimientos, busqueda, filtroTipoMov]);

  const stockConInsumo = useMemo(() => {
    return stocks.map(s => {
      const insumo = insumos.find(i => i.id === s.insumoId);
      return {
        ...s,
        nombreInsumo: insumo?.nombre || 'Sin asignar',
        codigoInsumo: insumo?.codigoSirius || '',
        stockMinimo: insumo?.stockMinimo || 0,
        unidadMedida: insumo?.unidadMedida || '',
        bajoMinimo: insumo ? s.stockActual < insumo.stockMinimo : false,
      };
    }).filter(s => {
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return s.nombreInsumo.toLowerCase().includes(q) || s.codigoInsumo.toLowerCase().includes(q);
    }).sort((a, b) => {
      if (a.bajoMinimo && !b.bajoMinimo) return -1;
      if (!a.bajoMinimo && b.bajoMinimo) return 1;
      return a.nombreInsumo.localeCompare(b.nombreInsumo);
    });
  }, [stocks, insumos, busqueda]);

  // ─── Render helpers ────────────────────────────────────────────

  const toggleOrden = (campo: string) => {
    setOrdenCatalogo(prev => ({
      campo,
      dir: prev.campo === campo && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const OrdenIcon = ({ campo }: { campo: string }) => {
    if (ordenCatalogo.campo !== campo) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return ordenCatalogo.dir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-emerald-400" />
      : <ChevronDown className="w-3 h-3 text-emerald-400" />;
  };

  // ─── Loading / Error states ────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-white/70 text-sm">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 mb-4">{error}</p>
          <button onClick={cargarDatos} className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors text-sm">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ─── Tabs config ───────────────────────────────────────────────

  const tabs: { key: TabActiva; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'catalogo', label: 'Catálogo', icon: <Package className="w-4 h-4" />, count: insumos.length },
    { key: 'stock', label: 'Stock', icon: <Box className="w-4 h-4" />, count: stocks.length },
    { key: 'movimientos', label: 'Movimientos', icon: <ArrowUpDown className="w-4 h-4" />, count: movimientos.length },
    { key: 'categorias', label: 'Categorías', icon: <Layers className="w-4 h-4" />, count: categorias.length },
  ];

  // ─── Main render ──────────────────────────────────────────────

  return (
    <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">📦 Inventario Central</h1>
          <p className="text-white/60 text-sm mt-1">Sirius Insumos Core — Gestión centralizada de insumos</p>
        </div>
        <button
          onClick={cargarDatos}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl transition-colors text-sm border border-white/10"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <KPICard icon={<Package className="w-5 h-5" />} label="Total Insumos" valor={kpis.totalInsumos} color="blue" />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Activos" valor={kpis.insumosActivos} color="emerald" />
        <KPICard icon={<Layers className="w-5 h-5" />} label="Categorías" valor={kpis.totalCategorias} color="purple" />
        <KPICard icon={<ArrowUpDown className="w-5 h-5" />} label="Movimientos" valor={kpis.totalMovimientos} color="cyan" />
        <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Bajo Mínimo" valor={kpis.stockBajoMinimo} color={kpis.stockBajoMinimo > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1 border border-white/10 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setTabActiva(tab.key); setBusqueda(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tabActiva === tab.key
                ? 'bg-white/15 text-white shadow-lg'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tabActiva === tab.key ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder={`Buscar en ${tabs.find(t => t.key === tabActiva)?.label.toLowerCase()}...`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors"
          />
        </div>
        {tabActiva === 'catalogo' && (
          <>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-800">Todos los estados</option>
              <option value="Activo" className="bg-slate-800">Activo</option>
              <option value="Inactivo" className="bg-slate-800">Inactivo</option>
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-800">Todas las categorías</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-800">{c.tipoInsumo}</option>
              ))}
            </select>
          </>
        )}
        {tabActiva === 'movimientos' && (
          <select
            value={filtroTipoMov}
            onChange={(e) => setFiltroTipoMov(e.target.value)}
            className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800">Todos los tipos</option>
            <option value="Entrada" className="bg-slate-800">Entrada</option>
            <option value="Salida" className="bg-slate-800">Salida</option>
            <option value="Ajuste" className="bg-slate-800">Ajuste</option>
          </select>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
        {tabActiva === 'catalogo' && (
          <TabCatalogo
            insumos={insumosFiltrados}
            categorias={categorias}
            stocks={stocks}
            getCategoriaNombre={getCategoriaNombre}
            getStockForInsumo={getStockForInsumo}
            toggleOrden={toggleOrden}
            OrdenIcon={OrdenIcon}
            detalleInsumo={detalleInsumo}
            setDetalleInsumo={setDetalleInsumo}
          />
        )}
        {tabActiva === 'stock' && (
          <TabStock stockConInsumo={stockConInsumo} formatFecha={formatFecha} />
        )}
        {tabActiva === 'movimientos' && (
          <TabMovimientos movimientos={movimientosFiltrados} getNombreInsumo={getNombreInsumo} formatFecha={formatFecha} />
        )}
        {tabActiva === 'categorias' && (
          <TabCategorias categorias={categorias} />
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────

function KPICard({ icon, label, valor, color }: { icon: React.ReactNode; label: string; valor: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-400',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-400',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
  };
  const cls = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-gradient-to-br ${cls} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-white/50">{label}</span></div>
      <p className="text-2xl font-bold text-white">{valor}</p>
    </div>
  );
}

// ─── Tab: Catálogo ───────────────────────────────────────────────

function TabCatalogo({
  insumos, categorias, stocks, getCategoriaNombre, getStockForInsumo, toggleOrden, OrdenIcon, detalleInsumo, setDetalleInsumo,
}: {
  insumos: Insumo[];
  categorias: Categoria[];
  stocks: Stock[];
  getCategoriaNombre: (id: string) => string;
  getStockForInsumo: (id: string) => Stock | undefined;
  toggleOrden: (campo: string) => void;
  OrdenIcon: React.FC<{ campo: string }>;
  detalleInsumo: string | null;
  setDetalleInsumo: (id: string | null) => void;
}) {
  if (insumos.length === 0) {
    return (
      <div className="p-8 text-center text-white/40">
        <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No se encontraron insumos con los filtros aplicados</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3 text-white/50 font-medium">
              <button onClick={() => toggleOrden('codigoSirius')} className="flex items-center gap-1 hover:text-white/80 transition-colors">
                Código <OrdenIcon campo="codigoSirius" />
              </button>
            </th>
            <th className="text-left px-4 py-3 text-white/50 font-medium">
              <button onClick={() => toggleOrden('nombre')} className="flex items-center gap-1 hover:text-white/80 transition-colors">
                Nombre <OrdenIcon campo="nombre" />
              </button>
            </th>
            <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">Categoría</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Unidad</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Stock</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Mínimo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((insumo) => {
            const stock = getStockForInsumo(insumo.id);
            const stockActual = stock?.stockActual ?? 0;
            const bajoMinimo = insumo.stockMinimo > 0 && stockActual < insumo.stockMinimo;
            const catNombre = insumo.categoriaIds.map(getCategoriaNombre).filter(Boolean).join(', ');
            const isExpanded = detalleInsumo === insumo.id;

            return (
              <React.Fragment key={insumo.id}>
                <tr
                  onClick={() => setDetalleInsumo(isExpanded ? null : insumo.id)}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${
                    bajoMinimo ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-4 py-3 text-white/70 font-mono text-xs">{insumo.codigoSirius}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {insumo.imagenReferencia.length > 0 && (
                        <img
                          src={insumo.imagenReferencia[0].thumbnailUrl}
                          alt=""
                          className="w-8 h-8 rounded-md object-cover border border-white/10"
                        />
                      )}
                      <span className="text-white font-medium">{insumo.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60 hidden md:table-cell">{catNombre || '—'}</td>
                  <td className="px-4 py-3 text-center text-white/60 hidden sm:table-cell">{insumo.unidadMedida}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      bajoMinimo ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {stockActual}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-white/50 hidden sm:table-cell">{insumo.stockMinimo}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      insumo.estadoInsumo === 'Activo' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {insumo.estadoInsumo}
                    </span>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-white/5">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-white/40 text-xs uppercase tracking-wider">Detalle</p>
                          {insumo.referenciaComercial && (
                            <p className="text-white/70 text-sm"><span className="text-white/40">Referencia:</span> {insumo.referenciaComercial}</p>
                          )}
                          {catNombre && (
                            <p className="text-white/70 text-sm"><span className="text-white/40">Categoría:</span> {catNombre}</p>
                          )}
                          {insumo.etiquetas.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {insumo.etiquetas.map((e, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">{e}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {insumo.fichaTecnica && (
                          <div>
                            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Ficha Técnica</p>
                            <p className="text-white/60 text-xs leading-relaxed whitespace-pre-line line-clamp-6">{insumo.fichaTecnica}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-white/10 text-white/40 text-xs">
        Mostrando {insumos.length} insumo{insumos.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Tab: Stock ──────────────────────────────────────────────────

function TabStock({
  stockConInsumo,
  formatFecha,
}: {
  stockConInsumo: {
    id: string; idStock: string; stockActual: number; ultimaActualizacion: string;
    nombreInsumo: string; codigoInsumo: string; stockMinimo: number;
    unidadMedida: string; bajoMinimo: boolean; cantidadIngresa: number[]; cantidadSale: number[];
  }[];
  formatFecha: (f: string) => string;
}) {
  if (stockConInsumo.length === 0) {
    return (
      <div className="p-8 text-center text-white/40">
        <Box className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No se encontraron registros de stock</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3 text-white/50 font-medium">Código Stock</th>
            <th className="text-left px-4 py-3 text-white/50 font-medium">Insumo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Stock Actual</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Mínimo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden md:table-cell">Total Ingresos</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden md:table-cell">Total Salidas</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Última Actualización</th>
          </tr>
        </thead>
        <tbody>
          {stockConInsumo.map((s) => {
            const totalIngresa = s.cantidadIngresa.reduce((a, b) => a + b, 0);
            const totalSale = s.cantidadSale.reduce((a, b) => a + b, 0);

            return (
              <tr key={s.id} className={`border-b border-white/5 ${s.bajoMinimo ? 'bg-red-500/5' : ''}`}>
                <td className="px-4 py-3 text-white/60 font-mono text-xs">{s.idStock}</td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{s.nombreInsumo}</p>
                  <p className="text-white/40 text-xs">{s.codigoInsumo}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold ${
                      s.bajoMinimo ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {s.bajoMinimo && <AlertTriangle className="w-3 h-3" />}
                      {s.stockActual} {s.unidadMedida}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-white/50 hidden sm:table-cell">{s.stockMinimo}</td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className="text-emerald-400/80 text-xs flex items-center justify-center gap-1">
                    <ArrowDownCircle className="w-3 h-3" /> {totalIngresa}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className="text-red-400/80 text-xs flex items-center justify-center gap-1">
                    <ArrowUpCircle className="w-3 h-3" /> {totalSale}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white/40 text-xs hidden sm:table-cell">{formatFecha(s.ultimaActualizacion)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-white/10 text-white/40 text-xs">
        Mostrando {stockConInsumo.length} registro{stockConInsumo.length !== 1 ? 's' : ''} de stock
      </div>
    </div>
  );
}

// ─── Tab: Movimientos ────────────────────────────────────────────

function TabMovimientos({
  movimientos, getNombreInsumo, formatFecha,
}: {
  movimientos: Movimiento[];
  getNombreInsumo: (id: string) => string;
  formatFecha: (f: string) => string;
}) {
  if (movimientos.length === 0) {
    return (
      <div className="p-8 text-center text-white/40">
        <ArrowUpDown className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No se encontraron movimientos</p>
      </div>
    );
  }

  const tipoConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    Entrada: { icon: <TrendingDown className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/20' },
    Salida: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-red-400 bg-red-500/20' },
    Ajuste: { icon: <ArrowUpDown className="w-4 h-4" />, color: 'text-yellow-400 bg-yellow-500/20' },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3 text-white/50 font-medium">Código</th>
            <th className="text-left px-4 py-3 text-white/50 font-medium">Descripción</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Tipo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Cantidad</th>
            <th className="text-left px-4 py-3 text-white/50 font-medium hidden md:table-cell">Insumo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Estado</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((mov) => {
            const cfg = tipoConfig[mov.tipoMovimiento] || tipoConfig.Ajuste;
            const insumoNombre = mov.insumoIds.length > 0 ? getNombreInsumo(mov.insumoIds[0]) : '—';

            return (
              <tr key={mov.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-white/60 font-mono text-xs">{mov.codigoMovimiento}</td>
                <td className="px-4 py-3 text-white/80 max-w-[200px] truncate">{mov.nombre}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                    {cfg.icon} {mov.tipoMovimiento}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-white font-medium">{mov.cantidad}</td>
                <td className="px-4 py-3 text-white/60 text-xs hidden md:table-cell max-w-[150px] truncate">{insumoNombre}</td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {mov.estadoEntrada ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      mov.estadoEntrada === 'Recibido' ? 'bg-emerald-500/20 text-emerald-400' :
                      mov.estadoEntrada === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {mov.estadoEntrada}
                    </span>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-white/40 text-xs hidden sm:table-cell">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {formatFecha(mov.creada)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-white/10 text-white/40 text-xs">
        Mostrando {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// ─── Tab: Categorías ─────────────────────────────────────────────

function TabCategorias({ categorias }: { categorias: Categoria[] }) {
  if (categorias.length === 0) {
    return (
      <div className="p-8 text-center text-white/40">
        <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No se encontraron categorías</p>
      </div>
    );
  }

  const colores = ['blue', 'emerald', 'purple', 'cyan', 'amber', 'rose', 'indigo', 'teal'];

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categorias.map((cat, idx) => {
        const color = colores[idx % colores.length];
        return (
          <div key={cat.id} className={`bg-${color}-500/5 border border-${color}-500/20 rounded-xl p-5`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white/40 text-xs font-mono">{cat.codigoCategoria}</p>
                <h3 className="text-white font-semibold text-lg">{cat.tipoInsumo}</h3>
              </div>
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-${color}-500/20 text-${color}-400 text-lg font-bold`}>
                {cat.cantidadInsumos}
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed line-clamp-3">{cat.descripcion}</p>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-white/30 text-xs">
              <Package className="w-3 h-3" />
              {cat.cantidadInsumos} insumo{cat.cantidadInsumos !== 1 ? 's' : ''} registrado{cat.cantidadInsumos !== 1 ? 's' : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
