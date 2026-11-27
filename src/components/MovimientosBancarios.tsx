'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, Landmark, RefreshCw, Search, X } from 'lucide-react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { BANCOS, CUENTAS_BANCARIAS, type BancoId } from '@/lib/bancos/cuentas';
import type { MovimientoBancario, PeriodoMovimientos, RespuestaMovimientos } from '@/types/movimientos-bancarios';
import { formatoCOP, formatoFecha } from '@/lib/cartera/formato';
import { TARJETA, plural } from './cartera/estilos';
import CargaExtracto from './movimientos/CargaExtracto';
import TablaMovimientos from './movimientos/TablaMovimientos';
import DetalleMovimiento from './movimientos/DetalleMovimiento';
import { MESES, montoConSigno } from './movimientos/formato';

const FONDO = { backgroundImage: 'url(/18032025-DSC_2933.jpg)' };
const CAMPO =
  'w-full rounded-lg border border-white/15 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 [&>option]:bg-slate-800';

const AÑO_ACTUAL = new Date().getFullYear();
const AÑOS = Array.from({ length: AÑO_ACTUAL - 2024 + 1 }, (_, i) => AÑO_ACTUAL - i);

type TipoMovimiento = '' | 'entradas' | 'salidas';

interface Filtros {
  busqueda: string;
  tipo: TipoMovimiento;
  tipoFlujo: string;
  soporte: string;
  centroCostos: string;
}

const SIN_FILTROS: Filtros = { busqueda: '', tipo: '', tipoFlujo: '', soporte: '', centroCostos: '' };

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const etiquetaPeriodo = (periodo: PeriodoMovimientos) =>
  periodo.mes ? `${MESES[periodo.mes - 1]} ${periodo.año}` : `Todo ${periodo.año}`;

function opciones(movimientos: MovimientoBancario[], valor: (m: MovimientoBancario) => string | undefined): string[] {
  return [...new Set(movimientos.map(valor).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

function Pantalla({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cover bg-fixed bg-center bg-no-repeat" style={FONDO}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 mx-4 max-w-md rounded-3xl border border-white/30 bg-white/25 p-8 shadow-2xl backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}

function Cifra({ titulo, valor, detalle, color = 'text-slate-50' }: { titulo: string; valor: string; detalle: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
      <dt className="text-sm text-slate-300">{titulo}</dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${color}`}>{valor}</dd>
      <dd className="mt-1 text-xs text-slate-400">{detalle}</dd>
    </div>
  );
}

function Selector({ etiqueta, valor, onCambiar, children, ancho = 'sm:w-44' }: {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  children: ReactNode;
  ancho?: string;
}) {
  return (
    <label className={ancho}>
      <span className="mb-1 block text-xs font-medium text-slate-400">{etiqueta}</span>
      <select value={valor} onChange={e => onCambiar(e.target.value)} className={CAMPO}>
        {children}
      </select>
    </label>
  );
}

export default function MovimientosBancarios() {
  const { isAuthenticated, isLoading } = useAuthSession();

  const [banco, setBanco] = useState<BancoId>('bancolombia');
  // null = automático: el último mes con movimientos registrados del banco
  const [periodoElegido, setPeriodoElegido] = useState<PeriodoMovimientos | null>(null);
  const [datos, setDatos] = useState<RespuestaMovimientos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [seleccionado, setSeleccionado] = useState<MovimientoBancario | null>(null);
  const ultimaSolicitud = useRef(0);

  const cargar = useCallback(async () => {
    const solicitud = ++ultimaSolicitud.current;
    setCargando(true);
    setError(null);
    try {
      const parametros = new URLSearchParams({ banco });
      if (periodoElegido) {
        parametros.set('anio', String(periodoElegido.año));
        if (periodoElegido.mes) parametros.set('mes', String(periodoElegido.mes));
      }
      const respuesta = await fetch(`/api/movimientos-bancarios?${parametros}`, { cache: 'no-store' });
      const resultado = await respuesta.json().catch(() => ({}));
      if (solicitud !== ultimaSolicitud.current) return;
      if (!respuesta.ok || !resultado.success) {
        throw new Error(resultado.error || `Error ${respuesta.status}`);
      }
      setDatos(resultado);
    } catch (e) {
      if (solicitud !== ultimaSolicitud.current) return;
      console.error('Error al cargar movimientos bancarios:', e);
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los movimientos');
    } finally {
      if (solicitud === ultimaSolicitud.current) setCargando(false);
    }
  }, [banco, periodoElegido]);

  useEffect(() => {
    if (isAuthenticated) cargar();
  }, [isAuthenticated, cargar]);

  const cambiarBanco = (id: BancoId) => {
    if (id === banco) return;
    setBanco(id);
    setFiltros(SIN_FILTROS);
    setSeleccionado(null);
  };

  // Tras una importación lo nuevo está en el último mes: se vuelve al periodo automático
  const alImportar = () => {
    if (periodoElegido) setPeriodoElegido(null);
    else cargar();
  };

  const cuenta = CUENTAS_BANCARIAS[banco];
  const datosBanco = datos?.banco === banco ? datos : null;
  const movimientos = useMemo(() => datosBanco?.movimientos ?? [], [datosBanco]);
  const periodo = periodoElegido ?? datosBanco?.periodo ?? null;
  const ultimoMovimiento = datos?.cuentas[banco]?.fechaUltimoMovimiento ?? null;

  const resumen = useMemo(() => {
    let entradas = 0, salidas = 0, numEntradas = 0, numSalidas = 0;
    for (const m of movimientos) {
      if (m.valor > 0) {
        entradas += m.valor;
        numEntradas++;
      } else if (m.valor < 0) {
        salidas -= m.valor;
        numSalidas++;
      }
    }
    // Vienen del más reciente al más antiguo
    const masAntiguo = movimientos[movimientos.length - 1];
    const saldoInicial = masAntiguo
      ? masAntiguo.saldoAnterior ?? (masAntiguo.saldo !== null ? masAntiguo.saldo - masAntiguo.valor : null)
      : null;
    const saldoFinal = movimientos[0]?.saldo ?? null;
    // En datos históricos hay saldos anteriores que no siguen al saldo del movimiento previo
    const descuadre =
      saldoInicial !== null && saldoFinal !== null ? saldoFinal - (saldoInicial + entradas - salidas) : 0;
    return { entradas, salidas, numEntradas, numSalidas, saldoInicial, saldoFinal, descuadre };
  }, [movimientos]);

  const listas = useMemo(
    () => ({
      tipoFlujo: opciones(movimientos, m => m.tipoFlujo),
      soporte: opciones(movimientos, m => m.soporte?.texto),
      centroCostos: opciones(movimientos, m => m.centroCostos),
    }),
    [movimientos]
  );

  const filtrados = useMemo(() => {
    const termino = normalizar(filtros.busqueda.trim());
    const digitos = termino.replace(/\D/g, '');
    return movimientos.filter(
      m =>
        (!termino ||
          normalizar(`${m.descripcion} ${m.detalle} ${m.centroCostos}`).includes(termino) ||
          (digitos.length >= 3 && String(Math.round(Math.abs(m.valor))).includes(digitos))) &&
        (!filtros.tipo || (filtros.tipo === 'entradas' ? m.valor > 0 : m.valor < 0)) &&
        (!filtros.tipoFlujo || m.tipoFlujo === filtros.tipoFlujo) &&
        (!filtros.soporte || m.soporte?.texto === filtros.soporte) &&
        (!filtros.centroCostos || m.centroCostos === filtros.centroCostos)
    );
  }, [movimientos, filtros]);

  const hayFiltros = Object.values(filtros).some(Boolean);
  const filtrar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => setFiltros(f => ({ ...f, [campo]: valor }));

  if (isLoading) {
    return (
      <Pantalla>
        <div className="flex items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-white" />
          <span className="text-lg font-semibold text-white">Cargando...</span>
        </div>
      </Pantalla>
    );
  }

  if (!isAuthenticated) {
    return (
      <Pantalla>
        <CircleAlert className="mx-auto mb-4 h-16 w-16 text-red-400" />
        <h2 className="mb-2 text-center text-2xl font-bold text-white">Acceso restringido</h2>
        <p className="text-center text-white/80">Debes iniciar sesión para ver los movimientos bancarios.</p>
      </Pantalla>
    );
  }

  return (
    <div className="relative min-h-screen bg-cover bg-fixed bg-center bg-no-repeat" style={FONDO}>
      <div className="absolute inset-0 bg-slate-950/40" />
      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-28 sm:px-6">
        <header className={`${TARJETA} mb-4 flex flex-wrap items-center justify-between gap-4 p-6`}>
          <div>
            <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Movimientos bancarios</h1>
            <p className="mt-1 text-sm text-slate-400">
              Cada cuenta se maneja por separado: tiene su propia tabla en Airtable y su propia carpeta de extractos.
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-slate-800/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700/70 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </header>

        <div role="tablist" aria-label="Cuenta bancaria" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BANCOS.map(id => {
            const datosCuenta = CUENTAS_BANCARIAS[id];
            const resumenCuenta = datos?.cuentas[id];
            const activo = id === banco;
            return (
              <button
                key={id}
                id={`pestana-${id}`}
                type="button"
                role="tab"
                aria-selected={activo}
                aria-controls="panel-banco"
                onClick={() => cambiarBanco(id)}
                className={`${TARJETA} p-5 text-left transition ${
                  activo ? 'ring-2 ring-blue-500' : 'opacity-75 hover:bg-slate-900/90 hover:opacity-100'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-base font-semibold text-slate-50">
                    <Landmark className="h-5 w-5 text-blue-300" aria-hidden="true" />
                    {datosCuenta.nombre}
                  </span>
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-slate-300">{datosCuenta.proposito}</span>
                </span>
                <span className="mt-3 block text-xs text-slate-400">Saldo actual</span>
                <span className="block text-2xl font-semibold tabular-nums text-slate-50">
                  {resumenCuenta?.saldoActual != null ? formatoCOP(resumenCuenta.saldoActual) : '—'}
                </span>
                <span className="mt-1 block text-xs text-slate-400">
                  {resumenCuenta?.fechaUltimoMovimiento
                    ? `Último movimiento registrado: ${formatoFecha(resumenCuenta.fechaUltimoMovimiento)}`
                    : resumenCuenta
                      ? 'Sin movimientos registrados'
                      : 'Cargando…'}
                </span>
              </button>
            );
          })}
        </div>

        <div id="panel-banco" role="tabpanel" aria-labelledby={`pestana-${banco}`}>
          <CargaExtracto banco={banco} onImportado={alImportar} />

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-400/40 bg-red-950/70 p-4 text-sm text-red-100 backdrop-blur-md">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
              <div>
                <p className="font-medium">No se pudieron cargar los movimientos de {cuenta.nombre}</p>
                <p className="text-red-200/80">{error}</p>
              </div>
            </div>
          )}

          <section aria-labelledby="titulo-periodo" className={`${TARJETA} mb-4 p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 id="titulo-periodo" className="text-lg font-semibold text-slate-50">
                  {cuenta.nombre} · {periodo ? etiquetaPeriodo(periodo) : '…'}
                </h2>
                <p className="text-sm text-slate-400">
                  {periodoElegido ? 'Periodo seleccionado' : 'Último mes con movimientos registrados'}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Selector
                  etiqueta="Año"
                  ancho="sm:w-28"
                  valor={String(periodo?.año ?? AÑO_ACTUAL)}
                  onCambiar={v => setPeriodoElegido({ año: Number(v), mes: periodo?.mes ?? null })}
                >
                  {AÑOS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Selector>
                <Selector
                  etiqueta="Mes"
                  valor={periodo?.mes ? String(periodo.mes) : ''}
                  onCambiar={v => setPeriodoElegido({ año: periodo?.año ?? AÑO_ACTUAL, mes: v ? Number(v) : null })}
                >
                  <option value="">Todo el año</option>
                  {MESES.map((nombre, i) => (
                    <option key={nombre} value={i + 1}>{nombre}</option>
                  ))}
                </Selector>
                {periodoElegido && (
                  <button
                    type="button"
                    onClick={() => setPeriodoElegido(null)}
                    className="rounded-lg px-3 py-2 text-sm text-blue-300 hover:bg-white/5"
                  >
                    Ir al último mes
                  </button>
                )}
              </div>
            </div>

            {datosBanco && movimientos.length > 0 && (
              <dl className={`mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 ${cargando ? 'opacity-60' : ''}`}>
                <Cifra
                  titulo="Saldo inicial"
                  valor={resumen.saldoInicial !== null ? formatoCOP(resumen.saldoInicial) : '—'}
                  detalle="Antes del primer movimiento del periodo"
                />
                <Cifra
                  titulo="Entradas"
                  valor={montoConSigno(resumen.entradas)}
                  color="text-emerald-300"
                  detalle={plural(resumen.numEntradas, 'movimiento', 'movimientos')}
                />
                <Cifra
                  titulo="Salidas"
                  valor={montoConSigno(-resumen.salidas)}
                  color="text-rose-300"
                  detalle={plural(resumen.numSalidas, 'movimiento', 'movimientos')}
                />
                <Cifra
                  titulo="Saldo final"
                  valor={resumen.saldoFinal !== null ? formatoCOP(resumen.saldoFinal) : '—'}
                  detalle="Después del último movimiento del periodo"
                />
              </dl>
            )}
            {datosBanco && Math.abs(resumen.descuadre) >= 1 && (
              <p className="mt-3 flex items-start gap-2 text-sm text-amber-200">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Los saldos guardados no cuadran con los movimientos de este periodo (diferencia de{' '}
                {formatoCOP(resumen.descuadre)}): hay movimientos cuyo saldo anterior no coincide con el saldo del
                movimiento previo.
              </p>
            )}
          </section>

          {!datosBanco ? (
            cargando && (
              <div className={`${TARJETA} flex items-center justify-center gap-3 p-16 text-slate-300`}>
                <RefreshCw className="h-6 w-6 animate-spin" />
                Cargando movimientos de {cuenta.nombre}…
              </div>
            )
          ) : movimientos.length === 0 ? (
            <div className={`${TARJETA} p-10 text-center`}>
              <p className="font-medium text-slate-100">
                No hay movimientos de {cuenta.nombre} en {periodo ? etiquetaPeriodo(periodo).toLowerCase() : 'este periodo'}.
              </p>
              {ultimoMovimiento && (
                <p className="mt-1 text-sm text-slate-400">
                  El último movimiento registrado es del {formatoFecha(ultimoMovimiento)}.
                </p>
              )}
              {periodoElegido && (
                <button
                  type="button"
                  onClick={() => setPeriodoElegido(null)}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Ver el último mes con movimientos
                </button>
              )}
            </div>
          ) : (
            <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
              <div className={`${TARJETA} flex flex-col gap-3 p-4 lg:flex-row lg:items-end`}>
                <label className="flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="search"
                      value={filtros.busqueda}
                      onChange={e => filtrar('busqueda', e.target.value)}
                      placeholder="Descripción, concepto o valor"
                      className={`${CAMPO} pl-9 placeholder:text-slate-500`}
                    />
                  </span>
                </label>
                <Selector etiqueta="Movimiento" ancho="lg:w-36" valor={filtros.tipo} onCambiar={v => filtrar('tipo', v as TipoMovimiento)}>
                  <option value="">Todos</option>
                  <option value="entradas">Entradas</option>
                  <option value="salidas">Salidas</option>
                </Selector>
                {listas.tipoFlujo.length > 0 && (
                  <Selector etiqueta="Tipo de flujo" ancho="lg:w-44" valor={filtros.tipoFlujo} onCambiar={v => filtrar('tipoFlujo', v)}>
                    <option value="">Todos</option>
                    {listas.tipoFlujo.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </Selector>
                )}
                {listas.soporte.length > 0 && (
                  <Selector etiqueta="Soporte" ancho="lg:w-44" valor={filtros.soporte} onCambiar={v => filtrar('soporte', v)}>
                    <option value="">Todos</option>
                    {listas.soporte.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </Selector>
                )}
                {listas.centroCostos.length > 0 && (
                  <Selector etiqueta="Centro de costos" ancho="lg:w-44" valor={filtros.centroCostos} onCambiar={v => filtrar('centroCostos', v)}>
                    <option value="">Todos</option>
                    {listas.centroCostos.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </Selector>
                )}
                {hayFiltros && (
                  <button
                    type="button"
                    onClick={() => setFiltros(SIN_FILTROS)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-slate-50"
                  >
                    <X className="h-4 w-4" />
                    Limpiar
                  </button>
                )}
              </div>

              <TablaMovimientos movimientos={filtrados} total={movimientos.length} onSeleccionar={setSeleccionado} />
            </div>
          )}
        </div>
      </main>

      {seleccionado && (
        <DetalleMovimiento movimiento={seleccionado} banco={cuenta.nombre} onCerrar={() => setSeleccionado(null)} />
      )}
    </div>
  );
}
