'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import type { FacturaAnalizada, ResumenCliente } from '@/lib/cartera/analisis';
import { formatoCOP, formatoDias, formatoFecha } from '@/lib/cartera/formato';
import { COLORES, COLOR_ESTADO, ESTADO_SEMAFORO, TARJETA, plural } from './estilos';

type Orden<T extends string> = { campo: T; asc: boolean };
type CampoFactura = 'cliente' | 'facturaNo' | 'fechaEmision' | 'diasVencida' | 'totalFactura' | 'pagado' | 'saldoPendiente';
type CampoCliente = 'cliente' | 'facturasPendientes' | 'saldo' | 'vencida' | 'porVencer' | 'diasMaxVencida' | 'ultimoPago';

function comparar(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), 'es');
}

function ordenar<T, C extends string>(filas: T[], orden: Orden<C>, valor: (fila: T, campo: C) => unknown): T[] {
  return [...filas].sort((a, b) => comparar(valor(a, orden.campo), valor(b, orden.campo)) * (orden.asc ? 1 : -1));
}

function Encabezado<C extends string>({
  campo,
  orden,
  onOrdenar,
  derecha,
  children,
}: {
  campo: C;
  orden: Orden<C>;
  onOrdenar: (campo: C) => void;
  derecha?: boolean;
  children: ReactNode;
}) {
  const activo = orden.campo === campo;
  const Icono = !activo ? ArrowUpDown : orden.asc ? ChevronUp : ChevronDown;
  return (
    <th
      scope="col"
      aria-sort={activo ? (orden.asc ? 'ascending' : 'descending') : undefined}
      className={`px-4 py-3 text-xs font-medium text-slate-400 ${derecha ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={`inline-flex items-center gap-1 rounded hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
          activo ? 'text-slate-100' : ''
        }`}
      >
        {children}
        <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </th>
  );
}

function EstadoBadge({ factura }: { factura: FacturaAnalizada }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-200 ring-1 ring-white/10">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLOR_ESTADO[factura.estadoFactura] }} />
        {factura.estadoFactura}
      </span>
      {factura.porConciliar && (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ESTADO_SEMAFORO.alerta }} />
          Pago por conciliar
        </span>
      )}
    </div>
  );
}

const alternar = <C extends string>(actual: Orden<C>, campo: C): Orden<C> =>
  actual.campo === campo ? { campo, asc: !actual.asc } : { campo, asc: campo === 'cliente' || campo === 'facturaNo' };

export default function TablaCartera({
  facturas,
  clientes,
  onSeleccionarCliente,
}: {
  facturas: FacturaAnalizada[];
  clientes: ResumenCliente[];
  onSeleccionarCliente: (cliente: string) => void;
}) {
  const [vista, setVista] = useState<'facturas' | 'clientes'>('facturas');
  const [incluirPagadas, setIncluirPagadas] = useState(false);
  const [ordenFacturas, setOrdenFacturas] = useState<Orden<CampoFactura>>({ campo: 'saldoPendiente', asc: false });
  const [ordenClientes, setOrdenClientes] = useState<Orden<CampoCliente>>({ campo: 'saldo', asc: false });

  const pendientes = facturas.filter(f => f.saldoPendiente > 0);
  // Si el filtro solo deja facturas pagadas, se muestran en lugar de una tabla vacía
  const mostrarPagadas = incluirPagadas || pendientes.length === 0;
  const visibles = mostrarPagadas ? facturas : pendientes;

  const filasFacturas = useMemo(
    () => ordenar(visibles, ordenFacturas, (f, campo) => f[campo]),
    [visibles, ordenFacturas]
  );
  const filasClientes = useMemo(
    () => ordenar(clientes, ordenClientes, (c, campo) => c[campo]),
    [clientes, ordenClientes]
  );

  const totales = filasFacturas.reduce(
    (t, f) => ({ total: t.total + f.totalFactura, pagado: t.pagado + f.pagado, saldo: t.saldo + f.saldoPendiente }),
    { total: 0, pagado: 0, saldo: 0 }
  );

  const pestana = (id: 'facturas' | 'clientes', texto: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={vista === id}
      onClick={() => setVista(id)}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        vista === id ? 'bg-white/10 font-medium text-slate-50' : 'text-slate-400 hover:text-slate-100'
      }`}
    >
      {texto}
    </button>
  );

  return (
    <div className={`${TARJETA} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div role="tablist" aria-label="Vista de la tabla" className="flex gap-1 rounded-lg bg-slate-950/40 p-1">
          {pestana('facturas', `Facturas (${visibles.length})`)}
          {pestana('clientes', `Clientes (${clientes.length})`)}
        </div>
        {vista === 'facturas' && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={incluirPagadas}
              onChange={e => setIncluirPagadas(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-slate-800 accent-blue-500"
            />
            Incluir facturas pagadas
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        {vista === 'facturas' ? (
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-slate-950/30">
              <tr>
                <Encabezado campo="cliente" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))}>Cliente</Encabezado>
                <Encabezado campo="facturaNo" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))}>Factura</Encabezado>
                <Encabezado campo="fechaEmision" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))}>Emisión</Encabezado>
                <Encabezado campo="diasVencida" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))}>Vencimiento</Encabezado>
                <Encabezado campo="totalFactura" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))} derecha>Total</Encabezado>
                <Encabezado campo="pagado" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))} derecha>Pagado</Encabezado>
                <Encabezado campo="saldoPendiente" orden={ordenFacturas} onOrdenar={c => setOrdenFacturas(o => alternar(o, c))} derecha>Saldo</Encabezado>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filasFacturas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No hay facturas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filasFacturas.map(f => (
                  <tr key={f.id} className="hover:bg-white/[0.03]">
                    <td className="max-w-[18rem] px-4 py-3">
                      <div className="truncate font-medium text-slate-100" title={f.cliente}>{f.cliente}</div>
                      <div className="text-xs text-slate-400">{f.clienteNIT || 'Sin NIT'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{f.facturaNo}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatoFecha(f.fechaEmision)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="text-slate-300">{formatoFecha(f.fechaVencimiento)}</div>
                      {f.saldoPendiente > 0 && f.fechaVencimiento && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: f.vencida ? COLORES.vencida : COLORES.porVencer }}
                            aria-hidden="true"
                          />
                          {formatoDias(f.diasVencida)}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">{formatoCOP(f.totalFactura)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">{formatoCOP(f.pagado)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-50">{formatoCOP(f.saldoPendiente)}</td>
                    <td className="px-4 py-3"><EstadoBadge factura={f} /></td>
                  </tr>
                ))
              )}
            </tbody>
            {filasFacturas.length > 0 && (
              <tfoot className="border-t border-white/15 bg-slate-950/30 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-slate-300" colSpan={4}>
                    Total · {plural(filasFacturas.length, 'factura', 'facturas')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatoCOP(totales.total)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatoCOP(totales.pagado)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-50">{formatoCOP(totales.saldo)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-slate-950/30">
              <tr>
                <Encabezado campo="cliente" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))}>Cliente</Encabezado>
                <Encabezado campo="facturasPendientes" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))} derecha>Facturas</Encabezado>
                <Encabezado campo="saldo" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))} derecha>Saldo</Encabezado>
                <Encabezado campo="vencida" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))} derecha>Vencida</Encabezado>
                <Encabezado campo="porVencer" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))} derecha>Por vencer</Encabezado>
                <Encabezado campo="diasMaxVencida" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))} derecha>Máx. días de mora</Encabezado>
                <Encabezado campo="ultimoPago" orden={ordenClientes} onOrdenar={c => setOrdenClientes(o => alternar(o, c))}>Último pago</Encabezado>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filasClientes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No hay clientes con saldo pendiente para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filasClientes.map(c => (
                  <tr
                    key={c.clave}
                    tabIndex={0}
                    onClick={() => {
                      onSeleccionarCliente(c.cliente);
                      setVista('facturas');
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        onSeleccionarCliente(c.cliente);
                        setVista('facturas');
                      }
                    }}
                    className="cursor-pointer hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-400"
                  >
                    <td className="max-w-[20rem] px-4 py-3">
                      <div className="truncate font-medium text-slate-100" title={c.cliente}>{c.cliente}</div>
                      <div className="text-xs text-slate-400">{c.nit || 'Sin NIT'}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{c.facturasPendientes}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-50">{formatoCOP(c.saldo)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">{formatoCOP(c.vencida)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">{formatoCOP(c.porVencer)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-300">{c.diasMaxVencida > 0 ? c.diasMaxVencida : '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatoFecha(c.ultimoPago)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
