'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import {
  Package, Layers, ArrowUpDown, AlertTriangle, Search,
  RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  Box, Filter, ArrowDownCircle, ArrowUpCircle, Clock,
  Plus, Edit3, X, Save, Loader2, ArrowRightLeft, DollarSign,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface Insumo {
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
  subtipo: string;
  cantidadOriginal: number;
  unidadOriginalId: string;
  factorConversion: number;
  cantidadBase: number;
  costoUnitario: number;
  costoTotal: number;
  costoUnitarioBase: number;
  documentoOrigen: string;
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
  areaId: string;
  costoAcumulado: number;
}

interface Unidad {
  id: string;
  nombre: string;
  simbolo: string;
  tipo: string;
  factorABase: number;
  unidadBaseDeTipo: string;
}

interface Area {
  id: string;
  nombre: string;
  idCore: string;
  responsable: string;
  activa: boolean;
}

interface KPIs {
  totalInsumos: number;
  insumosActivos: number;
  totalCategorias: number;
  totalMovimientos: number;
  stockBajoMinimo: number;
  valorTotalInventario: number;
  totalAreas: number;
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
  const [filtroArea, setFiltroArea] = useState<string>('');
  const [ordenCatalogo, setOrdenCatalogo] = useState<{ campo: string; dir: 'asc' | 'desc' }>({ campo: 'idNumero', dir: 'asc' });
  const [detalleInsumo, setDetalleInsumo] = useState<string | null>(null);

  const [kpis, setKpis] = useState<KPIs>({ totalInsumos: 0, insumosActivos: 0, totalCategorias: 0, totalMovimientos: 0, stockBajoMinimo: 0, valorTotalInventario: 0, totalAreas: 0 });
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  // ─── Modal states ──────────────────────────────────────────────

  const [showModalInsumo, setShowModalInsumo] = useState(false);
  const [editandoInsumo, setEditandoInsumo] = useState<Insumo | null>(null);
  const [showModalMovimiento, setShowModalMovimiento] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [operando, setOperando] = useState(false);

  const mostrarToast = useCallback((msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── CRUD handlers ────────────────────────────────────────────

  const handleGuardarInsumo = async (data: Record<string, string | number | undefined>) => {
    setOperando(true);
    try {
      const isEdit = !!data.id;
      const res = await fetch('/api/inventario-central', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? data : { accion: 'crear_insumo', ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      mostrarToast(result.mensaje || (isEdit ? 'Insumo actualizado' : 'Insumo creado'));
      setShowModalInsumo(false);
      setEditandoInsumo(null);
      cargarDatos();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al guardar', 'err');
    } finally {
      setOperando(false);
    }
  };

  const handleRegistrarMovimiento = async (data: Record<string, string | number | undefined>) => {
    setOperando(true);
    try {
      const res = await fetch('/api/inventario-central', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'registrar_movimiento', ...data }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      mostrarToast(result.mensaje || 'Movimiento registrado');
      setShowModalMovimiento(false);
      cargarDatos();
    } catch (err) {
      mostrarToast(err instanceof Error ? err.message : 'Error al registrar movimiento', 'err');
    } finally {
      setOperando(false);
    }
  };

  const abrirEditarInsumo = (insumo: Insumo) => {
    setEditandoInsumo(insumo);
    setShowModalInsumo(true);
  };

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
      setUnidades(data.unidades || []);
      setAreas(data.areas || []);
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

  const getAreaNombre = useCallback((areaId: string) => {
    return areas.find(a => a.id === areaId)?.nombre || '';
  }, [areas]);

  const getUnidadSimbolo = useCallback((unidadId: string) => {
    return unidades.find(u => u.id === unidadId)?.simbolo || '';
  }, [unidades]);

  const formatMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor);
  };

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
        areaNombre: getAreaNombre(s.areaId),
      };
    }).filter(s => {
      if (filtroArea && s.areaId !== filtroArea) return false;
      if (!busqueda) return true;
      const q = busqueda.toLowerCase();
      return s.nombreInsumo.toLowerCase().includes(q) || s.codigoInsumo.toLowerCase().includes(q);
    }).sort((a, b) => {
      if (a.bajoMinimo && !b.bajoMinimo) return -1;
      if (!a.bajoMinimo && b.bajoMinimo) return 1;
      return a.nombreInsumo.localeCompare(b.nombreInsumo);
    });
  }, [stocks, insumos, busqueda, filtroArea, getAreaNombre]);

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
    <div className="relative min-h-screen">
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-slate-900/40" />
      
      <div className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">📦 Inventario Central</h1>
          <p className="text-white/60 text-sm mt-1">Sirius Insumos Core — Gestión centralizada de insumos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setEditandoInsumo(null); setShowModalInsumo(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors text-sm border border-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Nuevo Insumo
          </button>
          <button
            onClick={() => setShowModalMovimiento(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl transition-colors text-sm border border-blue-500/20"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Registrar Movimiento
          </button>
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/60 hover:bg-slate-700/80 text-white/90 rounded-xl transition-colors text-sm border border-white/30"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <KPICard icon={<Package className="w-5 h-5" />} label="Total Insumos" valor={kpis.totalInsumos} color="blue" />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Activos" valor={kpis.insumosActivos} color="emerald" />
        <KPICard icon={<Layers className="w-5 h-5" />} label="Categorías" valor={kpis.totalCategorias} color="purple" />
        <KPICard icon={<ArrowUpDown className="w-5 h-5" />} label="Movimientos" valor={kpis.totalMovimientos} color="cyan" />
        <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Bajo Mínimo" valor={kpis.stockBajoMinimo} color={kpis.stockBajoMinimo > 0 ? 'red' : 'emerald'} />
        <KPICard icon={<Box className="w-5 h-5" />} label="Áreas Activas" valor={kpis.totalAreas} color="cyan" />
        <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Valor Inventario" valor={kpis.valorTotalInventario} color="emerald" formato="moneda" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-800/50 backdrop-blur-md rounded-xl p-1 border border-white/30 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setTabActiva(tab.key); setBusqueda(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tabActiva === tab.key
                ? 'bg-slate-700/70 text-white shadow-lg'
                : 'text-white/60 hover:text-white hover:bg-slate-700/40'
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tabActiva === tab.key ? 'bg-white/30 text-white' : 'bg-slate-700/50 text-white/50'
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
            className="w-full pl-10 pr-4 py-2.5 bg-slate-700/60 border border-white/30 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/50 focus:bg-slate-700/80 transition-colors"
          />
        </div>
        {tabActiva === 'catalogo' && (
          <>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2.5 bg-slate-700/60 border border-white/30 rounded-xl text-white text-sm focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-800">Todos los estados</option>
              <option value="Activo" className="bg-slate-800">Activo</option>
              <option value="Inactivo" className="bg-slate-800">Inactivo</option>
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="px-3 py-2.5 bg-slate-700/60 border border-white/30 rounded-xl text-white text-sm focus:outline-none appearance-none cursor-pointer"
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
            className="px-3 py-2.5 bg-slate-700/60 border border-white/30 rounded-xl text-white text-sm focus:outline-none appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800">Todos los tipos</option>
            <option value="Ingreso" className="bg-slate-800">Ingreso</option>
            <option value="Egreso" className="bg-slate-800">Egreso</option>
            <option value="Ajuste" className="bg-slate-800">Ajuste</option>
          </select>
        )}
        {tabActiva === 'stock' && areas.length > 0 && (
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="px-3 py-2.5 bg-slate-700/60 border border-white/30 rounded-xl text-white text-sm focus:outline-none appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-800">Todas las áreas</option>
            {areas.filter(a => a.activa).map(a => (
              <option key={a.id} value={a.id} className="bg-slate-800">{a.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800/50 backdrop-blur-md border border-white/30 rounded-2xl overflow-hidden shadow-xl">
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
            onEditInsumo={abrirEditarInsumo}
          />
        )}
        {tabActiva === 'stock' && (
          <TabStock stockConInsumo={stockConInsumo} formatFecha={formatFecha} formatMoneda={formatMoneda} />
        )}
        {tabActiva === 'movimientos' && (
          <TabMovimientos movimientos={movimientosFiltrados} getNombreInsumo={getNombreInsumo} getAreaNombre={getAreaNombre} getUnidadSimbolo={getUnidadSimbolo} formatFecha={formatFecha} formatMoneda={formatMoneda} />
        )}
        {tabActiva === 'categorias' && (
          <TabCategorias categorias={categorias} />
        )}
      </div>

      {/* ─── Toast Notification ─────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium border backdrop-blur-md transition-all animate-in slide-in-from-bottom-4 ${
          toast.tipo === 'ok'
            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/20 border-red-500/30 text-red-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ─── Modal: Crear / Editar Insumo ─────────────────────── */}
      {showModalInsumo && (
        <ModalInsumo
          insumo={editandoInsumo}
          categorias={categorias}
          unidades={unidades}
          operando={operando}
          onGuardar={handleGuardarInsumo}
          onCerrar={() => { setShowModalInsumo(false); setEditandoInsumo(null); }}
        />
      )}

      {/* ─── Modal: Registrar Movimiento ──────────────────────── */}
      {showModalMovimiento && (
        <ModalMovimiento
          insumos={insumos}
          unidades={unidades}
          areas={areas}
          operando={operando}
          onRegistrar={handleRegistrarMovimiento}
          onCerrar={() => setShowModalMovimiento(false)}
        />
      )}
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────

function KPICard({ icon, label, valor, color, formato }: { icon: React.ReactNode; label: string; valor: number; color: string; formato?: 'moneda' }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500/30 to-blue-600/20 border-blue-500/40 text-blue-400',
    emerald: 'from-emerald-500/30 to-emerald-600/20 border-emerald-500/40 text-emerald-400',
    purple: 'from-purple-500/30 to-purple-600/20 border-purple-500/40 text-purple-400',
    cyan: 'from-cyan-500/30 to-cyan-600/20 border-cyan-500/40 text-cyan-400',
    red: 'from-red-500/30 to-red-600/20 border-red-500/40 text-red-400',
  };
  const cls = colorMap[color] || colorMap.blue;

  const valorDisplay = formato === 'moneda'
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor)
    : valor;

  return (
    <div className={`bg-gradient-to-br bg-slate-800/40 ${cls} border backdrop-blur-sm rounded-xl p-4 shadow-lg`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-white/50">{label}</span></div>
      <p className={`${formato === 'moneda' ? 'text-lg' : 'text-2xl'} font-bold text-white`}>{valorDisplay}</p>
    </div>
  );
}

// ─── Tab: Catálogo ───────────────────────────────────────────────

function TabCatalogo({
  insumos, categorias, stocks, getCategoriaNombre, getStockForInsumo, toggleOrden, OrdenIcon, detalleInsumo, setDetalleInsumo, onEditInsumo,
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
  onEditInsumo: (insumo: Insumo) => void;
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
                    bajoMinimo ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-slate-700/30'
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
                  <tr className="bg-slate-700/30">
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
                      <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditInsumo(insumo); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-xs border border-blue-500/20"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar Insumo
                        </button>
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
  formatMoneda,
}: {
  stockConInsumo: {
    id: string; idStock: string; stockActual: number; ultimaActualizacion: string;
    nombreInsumo: string; codigoInsumo: string; stockMinimo: number;
    unidadMedida: string; bajoMinimo: boolean; cantidadIngresa: number[]; cantidadSale: number[];
    areaNombre: string; costoAcumulado: number;
  }[];
  formatFecha: (f: string) => string;
  formatMoneda: (v: number) => string;
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
            <th className="text-left px-4 py-3 text-white/50 font-medium">Insumo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Área</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Stock Actual</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Mínimo</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium hidden md:table-cell">Costo Acum.</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden lg:table-cell">Ingresos</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden lg:table-cell">Salidas</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Últ. Actualización</th>
          </tr>
        </thead>
        <tbody>
          {stockConInsumo.map((s) => {
            const totalIngresa = s.cantidadIngresa.reduce((a, b) => a + b, 0);
            const totalSale = s.cantidadSale.reduce((a, b) => a + b, 0);

            return (
              <tr key={s.id} className={`border-b border-white/5 ${s.bajoMinimo ? 'bg-red-500/5' : ''}`}>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{s.nombreInsumo}</p>
                  <p className="text-white/40 text-xs">{s.codigoInsumo}</p>
                </td>
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {s.areaNombre ? (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-xs">{s.areaNombre}</span>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
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
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <span className="text-white/70 text-xs">{s.costoAcumulado > 0 ? formatMoneda(s.costoAcumulado) : '—'}</span>
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  <span className="text-emerald-400/80 text-xs flex items-center justify-center gap-1">
                    <ArrowDownCircle className="w-3 h-3" /> {totalIngresa}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
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
  movimientos, getNombreInsumo, getAreaNombre, getUnidadSimbolo, formatFecha, formatMoneda,
}: {
  movimientos: Movimiento[];
  getNombreInsumo: (id: string) => string;
  getAreaNombre: (id: string) => string;
  getUnidadSimbolo: (id: string) => string;
  formatFecha: (f: string) => string;
  formatMoneda: (v: number) => string;
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
    Ingreso: { icon: <TrendingDown className="w-4 h-4" />, color: 'text-emerald-400 bg-emerald-500/20' },
    Egreso: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-red-400 bg-red-500/20' },
    Ajuste: { icon: <ArrowUpDown className="w-4 h-4" />, color: 'text-yellow-400 bg-yellow-500/20' },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left px-4 py-3 text-white/50 font-medium">Descripción</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Tipo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium">Cantidad</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium hidden md:table-cell">Costo Total</th>
            <th className="text-left px-4 py-3 text-white/50 font-medium hidden lg:table-cell">Insumo</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden md:table-cell">Área Destino</th>
            <th className="text-center px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Estado</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium hidden sm:table-cell">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {movimientos.map((mov) => {
            const cfg = tipoConfig[mov.tipoMovimiento] || tipoConfig.Ajuste;
            const insumoNombre = mov.insumoIds.length > 0 ? getNombreInsumo(mov.insumoIds[0]) : '—';
            const areaDestino = mov.areaDestinoLinkIds.length > 0 ? getAreaNombre(mov.areaDestinoLinkIds[0]) : '';
            const unidadOrig = mov.unidadOriginalId ? getUnidadSimbolo(mov.unidadOriginalId) : '';
            const cantidadDisplay = mov.cantidadOriginal > 0
              ? `${mov.cantidadOriginal}${unidadOrig ? ' ' + unidadOrig : ''}`
              : `${mov.cantidad}`;

            return (
              <tr key={mov.id} className="border-b border-white/10 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white/80 max-w-[200px] truncate">{mov.nombre}</p>
                  {mov.subtipo && <span className="text-white/30 text-xs">{mov.subtipo}{mov.documentoOrigen ? ` · ${mov.documentoOrigen}` : ''}</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                    {cfg.icon} {mov.tipoMovimiento}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-white font-medium">{cantidadDisplay}</td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  {mov.costoTotal > 0 ? (
                    <span className="text-white/70 text-xs">{formatMoneda(mov.costoTotal)}</span>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/60 text-xs hidden lg:table-cell max-w-[150px] truncate">{insumoNombre}</td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  {areaDestino ? (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full text-xs">{areaDestino}</span>
                  ) : (
                    <span className="text-white/30 text-xs">—</span>
                  )}
                </td>
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

// ─── Modal: Crear / Editar Insumo ────────────────────────────────

function ModalInsumo({
  insumo, categorias, unidades, operando, onGuardar, onCerrar,
}: {
  insumo: Insumo | null;
  categorias: Categoria[];
  unidades: Unidad[];
  operando: boolean;
  onGuardar: (data: Record<string, string | number | undefined>) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(insumo?.nombre || '');
  const [unidadMedida, setUnidadMedida] = useState(insumo?.unidadMedida || 'Unidad');
  const [unidadBaseId, setUnidadBaseId] = useState(insumo?.unidadBaseId || '');
  const [stockMinimo, setStockMinimo] = useState(insumo?.stockMinimo ?? 0);
  const [estadoInsumo, setEstadoInsumo] = useState(insumo?.estadoInsumo || 'Activo');
  const [fichaTecnica, setFichaTecnica] = useState(insumo?.fichaTecnica || '');
  const [referenciaComercial, setReferenciaComercial] = useState(insumo?.referenciaComercial || '');
  const [categoriaId, setCategoriaId] = useState(insumo?.categoriaIds?.[0] || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGuardar({
      ...(insumo ? { id: insumo.id } : {}),
      nombre,
      unidadMedida,
      unidadBaseId: unidadBaseId || undefined,
      stockMinimo,
      estadoInsumo,
      fichaTecnica: fichaTecnica || undefined,
      referenciaComercial: referenciaComercial || undefined,
      categoriaId: categoriaId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCerrar}>
      <div className="bg-slate-900/95 backdrop-blur-md border border-white/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            {insumo ? <Edit3 className="w-5 h-5 text-blue-400" /> : <Plus className="w-5 h-5 text-emerald-400" />}
            {insumo ? 'Editar Insumo' : 'Nuevo Insumo'}
          </h2>
          <button onClick={onCerrar} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Nombre del Insumo *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              placeholder="Ej: Guantes de nitrilo"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Unidad Medida + Unidad Base */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Unidad de Medida</label>
              <input
                type="text"
                value={unidadMedida}
                onChange={(e) => setUnidadMedida(e.target.value)}
                placeholder="kg, litro, unidad..."
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Unidad Base</label>
              <select
                value={unidadBaseId}
                onChange={(e) => setUnidadBaseId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">Sin unidad base</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-800">
                    {u.nombre} ({u.simbolo}) — {u.tipo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock Mínimo + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Stock Mínimo</label>
              <input
                type="number"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Estado</label>
              <select
                value={estadoInsumo}
                onChange={(e) => setEstadoInsumo(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="Activo" className="bg-slate-800">Activo</option>
                <option value="Inactivo" className="bg-slate-800">Inactivo</option>
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Categoría</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
            >
              <option value="" className="bg-slate-800">Sin categoría</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-800">{c.tipoInsumo}</option>
              ))}
            </select>
          </div>

          {/* Referencia Comercial */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Referencia Comercial</label>
            <input
              type="text"
              value={referenciaComercial}
              onChange={(e) => setReferenciaComercial(e.target.value)}
              placeholder="Marca, modelo, proveedor..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Ficha Técnica */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Ficha Técnica</label>
            <textarea
              value={fichaTecnica}
              onChange={(e) => setFichaTecnica(e.target.value)}
              rows={3}
              placeholder="Especificaciones, características técnicas..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={operando || !nombre.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl text-sm transition-colors border border-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {operando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {insumo ? 'Guardar Cambios' : 'Crear Insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Registrar Movimiento ─────────────────────────────────

function ModalMovimiento({
  insumos, unidades, areas, operando, onRegistrar, onCerrar,
}: {
  insumos: Insumo[];
  unidades: Unidad[];
  areas: Area[];
  operando: boolean;
  onRegistrar: (data: Record<string, string | number | undefined>) => void;
  onCerrar: () => void;
}) {
  const [insumoId, setInsumoId] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('Ingreso');
  const [subtipo, setSubtipo] = useState('');
  const [cantidadOriginal, setCantidadOriginal] = useState<number | ''>('');
  const [unidadOriginalId, setUnidadOriginalId] = useState('');
  const [areaDestinoId, setAreaDestinoId] = useState('');
  const [areaOrigenId, setAreaOrigenId] = useState('');
  const [costoUnitario, setCostoUnitario] = useState<number | ''>('');
  const [documentoOrigen, setDocumentoOrigen] = useState('');
  const [notas, setNotas] = useState('');
  const [busquedaInsumo, setBusquedaInsumo] = useState('');

  const subtipoOpciones: Record<string, string[]> = {
    Ingreso: ['Compra', 'Transferencia', 'Ajuste Inventario', 'Devolución'],
    Egreso: ['Consumo', 'Transferencia', 'Merma', 'Ajuste Inventario'],
    Ajuste: ['Ajuste Inventario', 'Corrección', 'Inventario Físico'],
  };

  const unidadSeleccionada = unidades.find(u => u.id === unidadOriginalId);
  const factorConversion = unidadSeleccionada?.factorABase || 1;
  const cantidadBase = cantidadOriginal !== '' ? Number(cantidadOriginal) * factorConversion : 0;
  const costoTotal = cantidadOriginal !== '' && costoUnitario !== '' ? Number(cantidadOriginal) * Number(costoUnitario) : 0;

  const insumosFiltrados = busquedaInsumo
    ? insumos.filter(i => i.nombre.toLowerCase().includes(busquedaInsumo.toLowerCase()) || i.codigoSirius.toLowerCase().includes(busquedaInsumo.toLowerCase()))
    : insumos;

  const areasActivas = areas.filter(a => a.activa);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRegistrar({
      insumoId,
      tipoMovimiento,
      subtipo: subtipo || undefined,
      cantidadOriginal: Number(cantidadOriginal),
      unidadOriginalId: unidadOriginalId || undefined,
      factorConversion,
      areaDestinoId: areaDestinoId || undefined,
      areaOrigenId: areaOrigenId || undefined,
      costoUnitario: costoUnitario !== '' ? Number(costoUnitario) : undefined,
      documentoOrigen: documentoOrigen || undefined,
      notas: notas || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onCerrar}>
      <div className="bg-slate-900/95 backdrop-blur-md border border-white/30 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-400" />
            Registrar Movimiento
          </h2>
          <button onClick={onCerrar} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Insumo selector */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Insumo *</label>
            <input
              type="text"
              value={busquedaInsumo}
              onChange={(e) => setBusquedaInsumo(e.target.value)}
              placeholder="Buscar insumo por nombre o código..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
            />
            {(busquedaInsumo || !insumoId) && (
              <div className="mt-1 max-h-36 overflow-y-auto bg-slate-800 border border-white/10 rounded-xl">
                {insumosFiltrados.slice(0, 8).map(ins => (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => { setInsumoId(ins.id); setBusquedaInsumo(ins.nombre); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                      insumoId === ins.id ? 'bg-blue-500/10 text-blue-400' : 'text-white/70'
                    }`}
                  >
                    <span className="font-mono text-white/40 text-xs mr-2">{ins.codigoSirius}</span>
                    {ins.nombre}
                  </button>
                ))}
                {insumosFiltrados.length === 0 && (
                  <p className="px-3 py-2 text-white/30 text-xs">Sin resultados</p>
                )}
              </div>
            )}
          </div>

          {/* Tipo + Subtipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Tipo de Movimiento *</label>
              <select
                value={tipoMovimiento}
                onChange={(e) => { setTipoMovimiento(e.target.value); setSubtipo(''); }}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="Ingreso" className="bg-slate-800">Ingreso</option>
                <option value="Egreso" className="bg-slate-800">Egreso</option>
                <option value="Ajuste" className="bg-slate-800">Ajuste</option>
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Subtipo</label>
              <select
                value={subtipo}
                onChange={(e) => setSubtipo(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">— Seleccionar —</option>
                {(subtipoOpciones[tipoMovimiento] || []).map(s => (
                  <option key={s} value={s} className="bg-slate-800">{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cantidad + Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Cantidad *</label>
              <input
                type="number"
                value={cantidadOriginal}
                onChange={(e) => setCantidadOriginal(e.target.value ? Number(e.target.value) : '')}
                required
                min={0.01}
                step="any"
                placeholder="0"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Unidad</label>
              <select
                value={unidadOriginalId}
                onChange={(e) => setUnidadOriginalId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">Unidad base (×1)</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-800">
                    {u.nombre} ({u.simbolo}) ×{u.factorABase}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversión preview */}
          {cantidadOriginal !== '' && factorConversion !== 1 && (
            <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
              <span className="font-medium">{cantidadOriginal}</span> × {factorConversion} = <span className="font-bold">{cantidadBase.toFixed(2)}</span> unidades base
            </div>
          )}

          {/* Área Destino + Área Origen */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Área Destino</label>
              <select
                value={areaDestinoId}
                onChange={(e) => setAreaDestinoId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">— Ninguna —</option>
                {areasActivas.map(a => (
                  <option key={a.id} value={a.id} className="bg-slate-800">{a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/60 text-xs mb-1.5">Área Origen</label>
              <select
                value={areaOrigenId}
                onChange={(e) => setAreaOrigenId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 text-sm focus:outline-none appearance-none cursor-pointer"
              >
                <option value="" className="bg-slate-800">— Ninguna —</option>
                {areasActivas.map(a => (
                  <option key={a.id} value={a.id} className="bg-slate-800">{a.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Costo Unitario + Preview */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Costo Unitario (COP)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="number"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value ? Number(e.target.value) : '')}
                min={0}
                step="any"
                placeholder="0"
                className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            {costoTotal > 0 && (
              <p className="text-white/40 text-xs mt-1">
                Costo total: <span className="text-white/70 font-medium">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(costoTotal)}</span>
              </p>
            )}
          </div>

          {/* Documento Origen */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Documento de Origen</label>
            <input
              type="text"
              value={documentoOrigen}
              onChange={(e) => setDocumentoOrigen(e.target.value)}
              placeholder="Factura, orden de compra, etc."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-white/60 text-xs mb-1.5">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 transition-colors resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={operando || !insumoId || cantidadOriginal === ''}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-xl text-sm transition-colors border border-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {operando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Registrar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
