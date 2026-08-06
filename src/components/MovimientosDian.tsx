'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import {
  AlertCircle,
  CheckCircle,
  FileSearch,
  FileText,
  Info,
  Play,
  Receipt,
  RefreshCw,
  User,
} from 'lucide-react';

interface DocumentoDian {
  id: string;
  creada: string;
  tipoDocumento: string;
  prefijoFolio: string;
  fechaEmision: string;
  nitEmisor: string;
  nombreEmisor: string;
  iva: number;
  total: number;
  estado: string;
  grupo: string;
}

interface Agrupacion {
  nombre: string;
  cantidad: number;
  valor: number;
}

interface ResumenDian {
  totalDocumentos: number;
  totalValor: number;
  totalIva: number;
  porTipoDocumento: Agrupacion[];
  porGrupo: Agrupacion[];
  porEstado: Agrupacion[];
  topEmisores: Agrupacion[];
  rangoFechaEmision: { desde: string; hasta: string } | null;
}

interface RespuestaResumen {
  success: boolean;
  alcance: { tipo: 'desde-ejecucion' | 'ultimos-registros'; desde: string | null; limite: number | null };
  resumen: ResumenDian;
  documentos: DocumentoDian[];
  error?: string;
}

const formatearMoneda = (valor: number) =>
  `$${(valor || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

const formatearFecha = (fechaISO: string) => {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO);
  if (isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function MovimientosDian() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [ejecutando, setEjecutando] = useState(false);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimaEjecucion, setUltimaEjecucion] = useState<string | null>(null);
  const [datos, setDatos] = useState<RespuestaResumen | null>(null);

  // `desde` acota el resumen a lo que entró en esta ejecución; sin él trae los más recientes
  const cargarResumen = useCallback(async (desde?: string) => {
    setCargandoResumen(true);
    try {
      const url = desde
        ? `/api/movimientos-dian/resumen?desde=${encodeURIComponent(desde)}`
        : '/api/movimientos-dian/resumen';

      const response = await fetch(url);
      const result: RespuestaResumen = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al cargar el resumen de movimientos DIAN');
      }

      setDatos(result);
    } catch (err) {
      console.error('❌ Error cargando resumen DIAN:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el resumen');
    } finally {
      setCargandoResumen(false);
    }
  }, []);

  // Al entrar, mostrar los documentos más recientes ya cargados
  useEffect(() => {
    if (isAuthenticated) {
      cargarResumen();
    }
  }, [isAuthenticated, cargarResumen]);

  const ejecutarConsultaDian = async () => {
    setEjecutando(true);
    setMensajeExito(null);
    setError(null);

    // Marca de tiempo previa: todo lo creado después pertenece a esta ejecución
    const inicioEjecucion = new Date().toISOString();

    try {
      console.log('🚀 Solicitando consulta de movimientos DIAN...');

      const response = await fetch('/api/movimientos-dian', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          usuario: userData?.nombre || 'Usuario',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al ejecutar la consulta de movimientos DIAN');
      }

      console.log('✅ Consulta ejecutada:', result);

      setMensajeExito(result.message || 'Consulta de movimientos DIAN ejecutada exitosamente');
      setUltimaEjecucion(
        new Date().toLocaleString('es-CO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );

      // Cargar el resumen de lo que entró en esta ejecución
      await cargarResumen(inicioEjecucion);
    } catch (err) {
      console.error('❌ Error ejecutando consulta DIAN:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al ejecutar la consulta');
    } finally {
      setEjecutando(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-28"
        style={{ backgroundImage: 'url(/18032025-DSC_2933.jpg)' }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10 text-center">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <RefreshCw className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
            <p className="text-white text-lg">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative flex items-center justify-center pt-28"
        style={{ backgroundImage: 'url(/18032025-DSC_2933.jpg)' }}
      >
        <div className="absolute inset-0 bg-slate-900/20"></div>
        <div className="relative z-10 text-center">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Acceso Denegado</h2>
            <p className="text-slate-100">Debe iniciar sesión para acceder a este módulo</p>
          </div>
        </div>
      </div>
    );
  }

  const resumen = datos?.resumen;
  const esResumenDeEjecucion = datos?.alcance.tipo === 'desde-ejecucion';

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative"
      style={{ backgroundImage: 'url(/18032025-DSC_2933.jpg)' }}
    >
      <div className="absolute inset-0 bg-slate-900/20 min-h-screen"></div>

      {/* pt-36: el navbar es fixed con h-24 (96px); esto deja ~48px de aire bajo él */}
      <div className="relative z-10 pt-36 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl shadow-lg">
                  <FileSearch className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                    Movimientos DIAN
                  </h1>
                  <p className="text-slate-200 text-lg mt-1">
                    Consulta y sincronización de movimientos ante la DIAN
                  </p>
                </div>
              </div>

              {userData && (
                <div className="flex items-center space-x-3 bg-slate-700/40 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
                  <User className="w-5 h-5 text-amber-400" />
                  <div className="text-sm">
                    <p className="font-semibold text-white">{userData.nombre}</p>
                    <p className="text-slate-300">{userData.categoria}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mensajes de estado */}
          {mensajeExito && (
            <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{mensajeExito}</p>
                {ultimaEjecucion && (
                  <p className="text-sm text-emerald-200/80 mt-1">
                    Última ejecución: {ultimaEjecucion}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-red-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Panel de ejecución */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/30">
            <h2 className="text-2xl font-bold text-white mb-2">Ejecutar consulta</h2>
            <p className="text-slate-200 mb-6">
              Al ejecutar, se dispara el proceso automático que consulta los movimientos
              registrados en la DIAN y los sincroniza en el sistema.
            </p>

            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-400/30 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-200">
                <p className="font-semibold text-amber-300 mb-1">Antes de continuar</p>
                <p>
                  El proceso puede tardar hasta 2 minutos. No cierre ni recargue la página
                  mientras esté en ejecución.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={ejecutarConsultaDian}
                disabled={ejecutando}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-amber-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              >
                {ejecutando ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Consultando movimientos...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Consultar Movimientos DIAN
                  </>
                )}
              </button>

              <button
                onClick={() => cargarResumen()}
                disabled={ejecutando || cargandoResumen}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-700/50 hover:bg-slate-700/80 text-white rounded-xl font-semibold border border-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-5 h-5 ${cargandoResumen ? 'animate-spin' : ''}`} />
                Actualizar resumen
              </button>
            </div>
          </div>

          {/* Resumen de la ejecución */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/30">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
              <h2 className="text-2xl font-bold text-white">Resumen de carga</h2>
              {datos && (
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    esResumenDeEjecucion
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-slate-700/50 text-slate-300 border-white/20'
                  }`}
                >
                  {esResumenDeEjecucion
                    ? 'Documentos cargados en la última ejecución'
                    : `Últimos ${datos.alcance.limite} documentos registrados`}
                </span>
              )}
            </div>
            <p className="text-slate-200 mb-6">
              {esResumenDeEjecucion
                ? 'Detalle de los movimientos que ingresaron con la ejecución más reciente.'
                : 'Movimientos DIAN más recientes en el sistema. Ejecute una consulta para ver el detalle de una carga puntual.'}
            </p>

            {cargandoResumen && !datos ? (
              <div className="flex items-center gap-3 text-slate-200 py-8 justify-center">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Cargando resumen...
              </div>
            ) : !resumen ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-white/20 mb-4" />
                <p className="text-white/50">No hay información de resumen disponible</p>
              </div>
            ) : resumen.totalDocumentos === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Info className="w-12 h-12 text-amber-400/60 mb-4" />
                <p className="text-white/70 font-semibold">
                  La ejecución no cargó documentos nuevos
                </p>
                <p className="text-white/40 text-sm mt-1">
                  No se encontraron movimientos nuevos en la DIAN para sincronizar.
                </p>
              </div>
            ) : (
              <>
                {/* Métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center gap-2 mb-1">
                      <Receipt className="w-4 h-4 text-amber-400" />
                      <p className="text-xs text-white/60 uppercase tracking-wider">Documentos</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{resumen.totalDocumentos}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Valor total</p>
                    <p className="text-3xl font-bold text-white">{formatearMoneda(resumen.totalValor)}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-white/10">
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">IVA total</p>
                    <p className="text-3xl font-bold text-white">{formatearMoneda(resumen.totalIva)}</p>
                  </div>
                </div>

                {resumen.rangoFechaEmision && (
                  <p className="text-sm text-slate-300 mb-6">
                    Fechas de emisión: {formatearFecha(resumen.rangoFechaEmision.desde)} —{' '}
                    {formatearFecha(resumen.rangoFechaEmision.hasta)}
                  </p>
                )}

                {/* Desgloses */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  {[
                    { titulo: 'Por tipo de documento', datos: resumen.porTipoDocumento },
                    { titulo: 'Por grupo', datos: resumen.porGrupo },
                    { titulo: 'Por estado', datos: resumen.porEstado },
                  ].map(bloque => (
                    <div
                      key={bloque.titulo}
                      className="bg-slate-700/30 rounded-xl p-5 border border-white/10"
                    >
                      <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">
                        {bloque.titulo}
                      </h3>
                      {bloque.datos.length === 0 ? (
                        <p className="text-white/40 text-sm">—</p>
                      ) : (
                        <ul className="space-y-2">
                          {bloque.datos.map(item => (
                            <li key={item.nombre} className="flex items-center justify-between gap-2 text-sm">
                              <span className="text-white/70 truncate">{item.nombre}</span>
                              <span className="text-white font-semibold shrink-0">{item.cantidad}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {/* Top emisores */}
                {resumen.topEmisores.length > 0 && (
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-white/10 mb-6">
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">
                      Principales emisores
                    </h3>
                    <ul className="space-y-2">
                      {resumen.topEmisores.map(emisor => (
                        <li key={emisor.nombre} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/70 truncate">{emisor.nombre}</span>
                          <span className="flex items-center gap-4 shrink-0">
                            <span className="text-white/50">{emisor.cantidad} doc.</span>
                            <span className="text-white font-semibold">{formatearMoneda(emisor.valor)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Detalle de documentos */}
                <h3 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3">
                  Detalle de documentos ({datos?.documentos.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="border-b border-white/20 text-left">
                        <th className="pb-3 pr-3 text-xs font-bold text-white/60 uppercase tracking-wider">Documento</th>
                        <th className="pb-3 pr-3 text-xs font-bold text-white/60 uppercase tracking-wider">Tipo</th>
                        <th className="pb-3 pr-3 text-xs font-bold text-white/60 uppercase tracking-wider">Emisor</th>
                        <th className="pb-3 pr-3 text-xs font-bold text-white/60 uppercase tracking-wider">Emisión</th>
                        <th className="pb-3 pr-3 text-xs font-bold text-white/60 uppercase tracking-wider">Grupo</th>
                        <th className="pb-3 text-xs font-bold text-white/60 uppercase tracking-wider text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {datos?.documentos.map(doc => (
                        <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 pr-3 text-white/80 whitespace-nowrap">{doc.prefijoFolio || '—'}</td>
                          <td className="py-3 pr-3 text-white/60">{doc.tipoDocumento || '—'}</td>
                          <td className="py-3 pr-3 text-white/70 max-w-[220px] truncate" title={doc.nombreEmisor}>
                            {doc.nombreEmisor || '—'}
                          </td>
                          <td className="py-3 pr-3 text-white/60 whitespace-nowrap">{formatearFecha(doc.fechaEmision)}</td>
                          <td className="py-3 pr-3 text-white/60">{doc.grupo || '—'}</td>
                          <td className="py-3 text-white/90 text-right font-medium whitespace-nowrap">
                            {formatearMoneda(doc.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/20">
                        <td colSpan={5} className="pt-3 text-sm font-bold text-white/60 text-right pr-3">
                          Total
                        </td>
                        <td className="pt-3 text-sm font-bold text-white text-right">
                          {formatearMoneda(resumen.totalValor)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
