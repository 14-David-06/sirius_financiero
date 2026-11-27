'use client';

import type { ComponentType } from 'react';
import { FileCheck2, FileText, Loader2, PackagePlus } from 'lucide-react';
import type { CompraCompleta } from '@/types/compras';
import { formatoCOP } from '@/lib/cartera/formato';
import { plural } from '@/components/cartera/estilos';
import {
  ESTADOS_SOLICITUD,
  ESTILO_ESTADO,
  ESTILO_ESTADO_DESCONOCIDO,
  ESTILO_PRIORIDAD,
  normalizarValor,
} from './estilos';

const DIA_MS = 86_400_000;

function fechaCorta(iso: string): string {
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return 'Sin fecha';
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
}

// Una solicitud abierta por más de una semana se resalta
const DIAS_PARA_RESALTAR = 7;

function antiguedad(iso: string): { texto: string; atrasada: boolean } | null {
  const fecha = Date.parse(iso);
  if (isNaN(fecha)) return null;
  const dias = Math.floor((Date.now() - fecha) / DIA_MS);
  const texto = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  return { texto, atrasada: dias > DIAS_PARA_RESALTAR };
}

function BotonAccion({
  icono: Icono,
  etiqueta,
  onClick,
  cargando = false,
  titulo,
}: {
  icono: ComponentType<{ className?: string }>;
  etiqueta: string;
  onClick: () => void;
  cargando?: boolean;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      title={titulo ?? etiqueta}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-800/70 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700/80 disabled:opacity-60"
    >
      {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icono className="h-4 w-4 text-slate-300" />}
      {etiqueta}
    </button>
  );
}

export default function FilaSolicitud({
  compra,
  actualizandoEstado,
  generandoOrden,
  onCambiarEstado,
  onVerDetalle,
  onGenerarOrden,
  onIngresarInventario,
}: {
  compra: CompraCompleta;
  actualizandoEstado: boolean;
  generandoOrden: boolean;
  onCambiarEstado: (estado: string) => void;
  onVerDetalle: () => void;
  onGenerarOrden: () => void;
  onIngresarInventario: () => void;
}) {
  const estado = normalizarValor(compra.estadoSolicitud);
  const prioridad = normalizarValor(compra.prioridadSolicitud);
  const estiloEstado = ESTILO_ESTADO[estado] ?? ESTILO_ESTADO_DESCONOCIDO;
  const estiloPrioridad = ESTILO_PRIORIDAD[prioridad];
  const abierta = estado === 'Pendiente' || estado === 'Aprobado';
  const hace = abierta ? antiguedad(compra.fechaSolicitud) : null;
  const valor = compra.valorTotal || 0;
  const items = compra.items?.length ?? 0;

  const detalles = [
    compra.razonSocialProveedor && `Proveedor: ${compra.razonSocialProveedor}`,
    compra.nombresAdmin && `Revisada por: ${compra.nombresAdmin}`,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03] lg:flex-row lg:items-start lg:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-slate-50">{compra.nombreSolicitante || 'Sin solicitante'}</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400">{compra.areaCorrespondiente || 'Sin área'}</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="text-slate-400">
            {fechaCorta(compra.fechaSolicitud)}
            {hace && <span className={hace.atrasada ? 'font-medium text-amber-200' : ''}> ({hace.texto})</span>}
          </span>
          {prioridad && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${estiloPrioridad?.texto ?? 'text-slate-300'}`}>
              <span className={`h-2 w-2 rounded-full ${estiloPrioridad?.punto ?? 'bg-slate-400'}`} aria-hidden="true" />
              Prioridad {prioridad.toLowerCase()}
            </span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-slate-200" title={compra.descripcionSolicitud}>
          {compra.descripcionSolicitud || 'Sin descripción'}
        </p>
        {detalles.length > 0 && <p className="mt-1 text-xs text-slate-400">{detalles.join(' · ')}</p>}
      </div>

      <div className="flex shrink-0 items-baseline gap-2 lg:w-32 lg:flex-col lg:items-end lg:gap-0">
        <p className={`text-sm font-semibold tabular-nums ${valor > 0 ? 'text-slate-50' : 'text-slate-500'}`}>
          {valor > 0 ? formatoCOP(valor) : 'Sin valor'}
        </p>
        <p className="text-xs text-slate-400">{items > 0 ? plural(items, 'ítem', 'ítems') : 'Sin ítems'}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-[25rem] lg:justify-end">
        <label className="relative">
          <span className="sr-only">Estado de la solicitud</span>
          <span className={`pointer-events-none absolute left-2.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${estiloEstado.punto}`} />
          <select
            value={estado}
            onChange={e => onCambiarEstado(e.target.value)}
            disabled={actualizandoEstado}
            className={`cursor-pointer appearance-none rounded-lg py-1.5 pl-6 pr-7 text-sm font-medium ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:opacity-60 [&>option]:bg-slate-800 [&>option]:text-slate-100 ${estiloEstado.pildora}`}
          >
            {!ESTADOS_SOLICITUD.includes(estado as (typeof ESTADOS_SOLICITUD)[number]) && (
              <option value={estado} disabled>{estado || 'Sin estado'}</option>
            )}
            {ESTADOS_SOLICITUD.map(opcion => (
              <option key={opcion} value={opcion}>{opcion}</option>
            ))}
          </select>
          {actualizandoEstado ? (
            <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin" />
          ) : (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-70" aria-hidden="true">▾</span>
          )}
        </label>

        <BotonAccion icono={FileText} etiqueta="Detalle" onClick={onVerDetalle} titulo="Ver detalle, ítems y cotización" />
        {compra.cotizacionDoc && estado !== 'Rechazado' && (
          <BotonAccion
            icono={FileCheck2}
            etiqueta="Orden"
            onClick={onGenerarOrden}
            cargando={generandoOrden}
            titulo="Generar PDF de la orden de compra"
          />
        )}
        {(estado === 'Aprobado' || estado === 'Comprado') && (
          <BotonAccion icono={PackagePlus} etiqueta="Inventario" onClick={onIngresarInventario} titulo="Ingresar insumos al inventario" />
        )}
      </div>
    </li>
  );
}
