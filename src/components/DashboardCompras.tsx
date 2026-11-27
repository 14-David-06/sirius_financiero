'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, RefreshCw, Search, X } from 'lucide-react';
import DetalleCompraCompleto from './DetalleCompraCompleto';
import IngresoInventarioCompra from './IngresoInventarioCompra';
import Toast from './ui/Toast';
import FilaSolicitud from './compras/FilaSolicitud';
import { ESTILO_ESTADO, PESO_ESTADO, PESO_PRIORIDAD, normalizarValor } from './compras/estilos';
import { TARJETA } from './cartera/estilos';
import { useNotifications } from '@/lib/hooks/useNotifications';
import type { CompraCompleta, UserData, ApiResponse } from '@/types/compras';

interface DashboardComprasProps {
  userData: UserData;
  onLogout: () => void;
}

type Pestana = 'Pendiente' | 'Aprobado' | 'Comprado' | 'Rechazado' | 'todas';

const PESTANAS: { valor: Pestana; etiqueta: string }[] = [
  { valor: 'Pendiente', etiqueta: 'Pendientes' },
  { valor: 'Aprobado', etiqueta: 'Aprobadas' },
  { valor: 'Comprado', etiqueta: 'Compradas' },
  { valor: 'Rechazado', etiqueta: 'Rechazadas' },
  { valor: 'todas', etiqueta: 'Todas' },
];

const POR_PAGINA = 25;
const CAMPO =
  'w-full rounded-lg border border-white/15 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800';

const normalizarTexto = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pendientes primero; dentro de cada estado, prioridad alta primero y luego la más reciente. */
function ordenar(a: CompraCompleta, b: CompraCompleta): number {
  return (
    (PESO_ESTADO[normalizarValor(b.estadoSolicitud)] ?? 0) - (PESO_ESTADO[normalizarValor(a.estadoSolicitud)] ?? 0) ||
    (PESO_PRIORIDAD[normalizarValor(b.prioridadSolicitud)] ?? 0) - (PESO_PRIORIDAD[normalizarValor(a.prioridadSolicitud)] ?? 0) ||
    new Date(b.fechaSolicitud).getTime() - new Date(a.fechaSolicitud).getTime()
  );
}

export default function DashboardCompras({ userData }: DashboardComprasProps) {
  const [comprasData, setComprasData] = useState<CompraCompleta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('Pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [updatingStates, setUpdatingStates] = useState<Set<string>>(new Set());
  const [selectedCompra, setSelectedCompra] = useState<CompraCompleta | null>(null);
  const [showDetalleCompleto, setShowDetalleCompleto] = useState(false);
  const [showIngresoInventario, setShowIngresoInventario] = useState(false);
  const [inventarioCompra, setInventarioCompra] = useState<CompraCompleta | null>(null);
  const [generatingOrden, setGeneratingOrden] = useState<string | null>(null);
  const pestanaInicialFijada = useRef(false);

  const { showToastNotification, showToast, toastMessage, hideToast } = useNotifications(userData);

  const cargarDatos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch('/api/compras', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Error al cargar los datos');
      }
      const data: ApiResponse = await response.json();
      setComprasData(data.compras);
    } catch (error) {
      setError('No se pudieron cargar las solicitudes de compra');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Si no hay pendientes al entrar, se muestran todas en lugar de una lista vacía
  useEffect(() => {
    if (pestanaInicialFijada.current || comprasData.length === 0) return;
    pestanaInicialFijada.current = true;
    if (!comprasData.some(c => normalizarValor(c.estadoSolicitud) === 'Pendiente')) setPestana('todas');
  }, [comprasData]);

  const handleGenerarOrdenCompra = async (compra: CompraCompleta) => {
    if (!compra.cotizacionDoc) {
      alert('Debe cargar una cotización antes de generar la orden de compra');
      return;
    }
    setGeneratingOrden(compra.id);
    try {
      const response = await fetch('/api/generate-orden-compra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudData: compra, compraId: compra.id }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al generar la orden de compra');
      }
      window.open(result.pdfUrl, '_blank');
      showToastNotification(`✅ Orden de compra ${result.ordenCompraId || ''} generada con ${result.itemsCreados || 0} items`);
      await cargarDatos();
    } catch (error) {
      console.error('Error generando orden de compra:', error);
      alert('Error al generar la orden de compra: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setGeneratingOrden(null);
    }
  };

  const updateEstado = async (compraId: string, nuevoEstado: string) => {
    try {
      setUpdatingStates(prev => new Set([...prev, compraId]));
      const response = await fetch('/api/compras/update-estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compraId, nuevoEstado, nombresAdmin: userData.nombre }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        throw new Error(errorData.error || 'Error al actualizar el estado');
      }
      const result = await response.json();
      const notificacion = result.notificacion;
      if (notificacion?.enviado) {
        showToastNotification(`✅ Estado actualizado a ${nuevoEstado}. Se notificó a ${notificacion.destinatario}`);
      } else if (notificacion) {
        showToastNotification(`Estado actualizado a ${nuevoEstado}. Correo no enviado: ${notificacion.motivo}`);
      }
      await cargarDatos();
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert(`Error al actualizar el estado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setUpdatingStates(prev => {
        const siguiente = new Set(prev);
        siguiente.delete(compraId);
        return siguiente;
      });
    }
  };

  const areas = useMemo(
    () => [...new Set(comprasData.map(c => c.areaCorrespondiente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [comprasData]
  );

  // Filtros de búsqueda, área y prioridad: los conteos de las pestañas los respetan
  const filtradasSinEstado = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    return comprasData.filter(
      c =>
        (!filtroArea || c.areaCorrespondiente === filtroArea) &&
        (!filtroPrioridad || normalizarValor(c.prioridadSolicitud) === filtroPrioridad) &&
        (!termino ||
          normalizarTexto(
            `${c.nombreSolicitante} ${c.descripcionSolicitud} ${c.razonSocialProveedor ?? ''} ${c.areaCorrespondiente}`
          ).includes(termino))
    );
  }, [comprasData, busqueda, filtroArea, filtroPrioridad]);

  const conteos = useMemo(() => {
    const resultado: Record<Pestana, number> = { Pendiente: 0, Aprobado: 0, Comprado: 0, Rechazado: 0, todas: 0 };
    for (const c of filtradasSinEstado) {
      const estado = normalizarValor(c.estadoSolicitud) as Pestana;
      if (estado in resultado) resultado[estado]++;
      resultado.todas++;
    }
    return resultado;
  }, [filtradasSinEstado]);

  const comprasFiltradas = useMemo(
    () =>
      filtradasSinEstado
        .filter(c => pestana === 'todas' || normalizarValor(c.estadoSolicitud) === pestana)
        .sort(ordenar),
    [filtradasSinEstado, pestana]
  );

  useEffect(() => setVisibles(POR_PAGINA), [pestana, busqueda, filtroArea, filtroPrioridad]);

  const hayFiltros = Boolean(busqueda || filtroArea || filtroPrioridad);
  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroArea('');
    setFiltroPrioridad('');
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
      <header className={`${TARJETA} mb-4 flex flex-wrap items-center justify-between gap-4 p-6`}>
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Solicitudes de compra</h1>
          <p className="mt-1 text-sm text-slate-400">Revisa, aprueba y da seguimiento a las solicitudes de las áreas.</p>
        </div>
        <button
          type="button"
          onClick={cargarDatos}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-800/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700/70 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </header>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-400/40 bg-red-950/70 p-4 text-sm text-red-100 backdrop-blur-md">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            <button type="button" onClick={cargarDatos} className="mt-1 text-red-200 underline hover:text-white">
              Reintentar
            </button>
          </div>
        </div>
      )}

      <section aria-label="Solicitudes" className={`${TARJETA} overflow-hidden`}>
        <div role="tablist" aria-label="Estado" className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 pt-3">
          {PESTANAS.map(({ valor, etiqueta }) => {
            const activa = pestana === valor;
            const punto = valor !== 'todas' ? ESTILO_ESTADO[valor]?.punto : null;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setPestana(valor)}
                className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm transition-colors ${
                  activa ? 'border-blue-400 text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {punto && <span className={`h-2 w-2 rounded-full ${punto}`} aria-hidden="true" />}
                {etiqueta}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                    activa ? 'bg-blue-500/20 text-blue-100' : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {conteos[valor]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Solicitante, descripción o proveedor"
                className={`${CAMPO} pl-9 placeholder:text-slate-500`}
              />
            </span>
          </label>
          <label className="md:w-48">
            <span className="mb-1 block text-xs font-medium text-slate-400">Área</span>
            <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className={CAMPO}>
              <option value="">Todas las áreas</option>
              {areas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
          <label className="md:w-40">
            <span className="mb-1 block text-xs font-medium text-slate-400">Prioridad</span>
            <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)} className={CAMPO}>
              <option value="">Todas</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </label>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-slate-50"
            >
              <X className="h-4 w-4" />
              Limpiar
            </button>
          )}
        </div>

        {isLoading && comprasData.length === 0 ? (
          <div className="flex items-center justify-center gap-3 p-16 text-slate-300">
            <RefreshCw className="h-6 w-6 animate-spin" />
            Cargando solicitudes…
          </div>
        ) : comprasFiltradas.length === 0 ? (
          <p className="p-12 text-center text-sm text-slate-400">
            {hayFiltros
              ? 'Ninguna solicitud coincide con los filtros.'
              : pestana === 'Pendiente'
                ? 'No hay solicitudes pendientes por revisar.'
                : 'No hay solicitudes en este estado.'}
          </p>
        ) : (
          <>
            <ul className={`divide-y divide-white/10 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
              {comprasFiltradas.slice(0, visibles).map(compra => (
                <FilaSolicitud
                  key={compra.id}
                  compra={compra}
                  actualizandoEstado={updatingStates.has(compra.id)}
                  generandoOrden={generatingOrden === compra.id}
                  onCambiarEstado={estado => updateEstado(compra.id, estado)}
                  onVerDetalle={() => {
                    setSelectedCompra(compra);
                    setShowDetalleCompleto(true);
                  }}
                  onGenerarOrden={() => handleGenerarOrdenCompra(compra)}
                  onIngresarInventario={() => {
                    setInventarioCompra(compra);
                    setShowIngresoInventario(true);
                  }}
                />
              ))}
            </ul>
            {comprasFiltradas.length > visibles && (
              <div className="border-t border-white/10 p-3 text-center">
                <button
                  type="button"
                  onClick={() => setVisibles(v => v + POR_PAGINA)}
                  className="rounded-lg px-4 py-2 text-sm text-blue-300 hover:bg-white/5"
                >
                  Mostrar más · {comprasFiltradas.length - visibles} restantes
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {showDetalleCompleto && selectedCompra && (
        <DetalleCompraCompleto
          compra={selectedCompra}
          onClose={() => {
            setShowDetalleCompleto(false);
            setSelectedCompra(null);
          }}
          onCotizacionUpdated={() => {
            cargarDatos();
          }}
        />
      )}

      {showIngresoInventario && inventarioCompra && (
        <IngresoInventarioCompra
          compra={inventarioCompra}
          onClose={() => {
            setShowIngresoInventario(false);
            setInventarioCompra(null);
          }}
          onCompleted={() => {
            cargarDatos();
            showToastNotification('✅ Insumos ingresados al inventario exitosamente');
          }}
          onCotizacionSaved={() => {
            cargarDatos();
            showToastNotification('✅ Cotización guardada exitosamente');
          }}
        />
      )}

      <Toast message={toastMessage} isVisible={showToast} onClose={hideToast} type="info" />
    </main>
  );
}
