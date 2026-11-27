'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, ExternalLink, FileText, Loader2, Sparkles, Upload, X } from 'lucide-react';
import type { AirtableField, CompraCompleta, CompraItem } from '@/types/compras';
import { formatoCOP, formatoFecha } from '@/lib/cartera/formato';
import { plural } from '@/components/cartera/estilos';
import { ESTILO_ESTADO, ESTILO_ESTADO_DESCONOCIDO, ESTILO_PRIORIDAD, normalizarValor } from './compras/estilos';
import TextoIA from './compras/TextoIA';

/** Airtable a veces entrega respuestas de IA como {state, value, isStale} o JSON en texto. */
const safeRender = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    if (value.startsWith('{') && value.includes('"state"') && value.includes('"value"')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) return String(parsed.value || '');
      } catch {
        // No era JSON: se muestra tal cual
      }
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(safeRender).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) return String(obj.value || '');
    if ('state' in obj) return String(obj.state || '');
  }
  return '';
};

const texto = (valor: unknown) => safeRender(valor).trim();

const SOLO_CANTIDAD =
  /^\d+(?:[.,]\d+)?\s*(?:kg|kilos?|g|gr|gramos?|l|lts?|litros?|ml|und|unds|unidades?|cajas?|bolsas?|galones?|gal|mts?|metros?|@|arrobas?|libras?|lb)\.?$/i;

/**
 * Las descripciones dictadas suelen traer el producto y su cantidad en líneas separadas
 * ("Glucosa" / "8 kg"). Solo para mostrar, se unen en una línea: "Glucosa · 8 kg".
 */
function compactarDescripcion(descripcion: string): string {
  const lineas: string[] = [];
  for (const linea of descripcion.split(/\r?\n/)) {
    const limpia = linea.trim();
    const anterior = lineas[lineas.length - 1]?.trim();
    if (limpia && anterior && SOLO_CANTIDAD.test(limpia) && !SOLO_CANTIDAD.test(anterior)) {
      lineas[lineas.length - 1] = `${anterior} · ${limpia}`;
    } else {
      lineas.push(linea);
    }
  }
  return lineas.join('\n');
}

function fechaLarga(iso: string | undefined): string {
  if (!iso) return 'Sin fecha';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return 'Sin fecha';
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
}

type EstadoItem = 'Sin comprar' | 'Comprado';

function Seccion({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Lista de dato/valor que omite los vacíos. */
function Datos({ pares }: { pares: [string, ReactNode][] }) {
  const visibles = pares.filter(([, valor]) => valor !== '' && valor !== null && valor !== undefined);
  if (visibles.length === 0) return null;
  return (
    <dl className="space-y-2 text-sm">
      {visibles.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex items-baseline justify-between gap-4">
          <dt className="text-slate-400">{etiqueta}</dt>
          <dd className="text-right text-slate-100">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function FilaItem({
  item,
  estado,
  actualizando,
  onCambiar,
}: {
  item: CompraItem;
  estado: EstadoItem;
  actualizando: boolean;
  onCambiar: (estado: EstadoItem) => void;
}) {
  const cantidad = Number(item.cantidad) || 0;
  const proveedor = texto(item.nombreProveedor);
  const detalles = [
    cantidad > 0 && plural(cantidad, 'unidad', 'unidades'),
    texto(item.centroCostos),
    texto(item.compraServicio),
    texto(item.prioridad) && `Prioridad ${texto(item.prioridad).toLowerCase()}`,
    item.fechaRequerida && `Requerido para el ${formatoFecha(item.fechaRequerida)}`,
    texto(item.formaPago) && `Pago: ${texto(item.formaPago).toLowerCase()}`,
  ].filter(Boolean);
  const notas = [texto(item.reciboRemision), texto(item.transporte) && `Transporte: ${texto(item.transporte)}`].filter(Boolean);
  const contacto = [texto(item.nitProveedor) && `NIT ${texto(item.nitProveedor)}`, texto(item.correoProveedor), texto(item.celularProveedor)]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-slate-100">{texto(item.objeto) || 'Ítem sin nombre'}</p>
        {detalles.length > 0 && <p className="mt-0.5 text-xs text-slate-400">{detalles.join(' · ')}</p>}
        {notas.map(nota => (
          <p key={nota} className="mt-1 text-xs text-slate-300">{nota}</p>
        ))}
        {proveedor && (
          <p className="mt-1 text-xs text-slate-400">
            Proveedor: <span className="text-slate-300">{proveedor}</span>
            {contacto && ` · ${contacto}`}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
        <p className="text-sm font-semibold tabular-nums text-slate-50">
          {Number(item.valorItem) > 0 ? formatoCOP(Number(item.valorItem)) : 'Sin valor'}
        </p>
        <div role="group" aria-label="Estado del ítem" className="inline-flex rounded-lg border border-white/15 p-0.5 text-xs">
          {(['Sin comprar', 'Comprado'] as const).map(opcion => {
            const activo = estado === opcion;
            return (
              <button
                key={opcion}
                type="button"
                aria-pressed={activo}
                disabled={actualizando || activo}
                onClick={() => onCambiar(opcion)}
                className={`rounded-md px-2.5 py-1 transition-colors disabled:cursor-default ${
                  activo
                    ? opcion === 'Comprado'
                      ? 'bg-emerald-500/20 font-medium text-emerald-200'
                      : 'bg-slate-600/60 font-medium text-slate-100'
                    : 'text-slate-400 hover:text-slate-100 disabled:opacity-60'
                }`}
              >
                {actualizando && !activo ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : opcion}
              </button>
            );
          })}
        </div>
      </div>
    </li>
  );
}

interface DetalleCompraCompletoProps {
  compra: CompraCompleta;
  onClose: () => void;
  onCotizacionUpdated?: () => void;
}

export default function DetalleCompraCompleto({ compra, onClose, onCotizacionUpdated }: DetalleCompraCompletoProps) {
  const [estadosItems, setEstadosItems] = useState<Record<string, EstadoItem>>(() =>
    Object.fromEntries(compra.items.map(item => [item.id, item.estadoItem === 'Comprado' ? 'Comprado' : 'Sin comprar']))
  );
  const [actualizandoItems, setActualizandoItems] = useState<Record<string, boolean>>({});
  const [subiendoCotizacion, setSubiendoCotizacion] = useState(false);
  const [cotizacionUrl, setCotizacionUrl] = useState<string | undefined>(compra.cotizacionDoc);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onClose);
  alCerrar.current = onClose;

  useEffect(() => {
    botonCerrar.current?.focus();
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar.current();
    window.addEventListener('keydown', alPresionar);
    // La página de fondo no se desplaza mientras el modal está abierto
    const desbordeAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = desbordeAnterior;
    };
  }, []);

  const subirCotizacion = async (archivo: File) => {
    setSubiendoCotizacion(true);
    setAviso(null);
    try {
      const datos = new FormData();
      datos.append('file', archivo);
      datos.append('proveedorNombre', compra.razonSocialProveedor || compra.nombreProveedor?.[0] || 'SinProveedor');
      datos.append('solicitanteNombre', compra.nombreSolicitante || 'SinNombre');

      const subida = await fetch('/api/upload-file', { method: 'POST', body: datos });
      const resultadoSubida = await subida.json();
      if (!subida.ok || !resultadoSubida.success) {
        throw new Error(resultadoSubida.error || 'Error al subir el archivo');
      }

      const actualizacion = await fetch('/api/compras/update-cotizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compraId: compra.id, cotizacionUrl: resultadoSubida.fileUrl }),
      });
      const resultadoActualizacion = await actualizacion.json();
      if (!actualizacion.ok || !resultadoActualizacion.success) {
        throw new Error(resultadoActualizacion.error || 'Error al guardar la cotización');
      }

      setCotizacionUrl(resultadoSubida.fileUrl);
      setAviso({ tipo: 'exito', texto: 'Cotización cargada' });
      onCotizacionUpdated?.();
    } catch (error) {
      console.error('Error subiendo cotización:', error);
      setAviso({ tipo: 'error', texto: error instanceof Error ? error.message : 'No se pudo cargar la cotización' });
    } finally {
      setSubiendoCotizacion(false);
    }
  };

  const alElegirArchivo = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      setAviso({ tipo: 'error', texto: 'Solo se aceptan PDF, JPG, PNG o WebP' });
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setAviso({ tipo: 'error', texto: 'El archivo supera el máximo de 10 MB' });
      return;
    }
    subirCotizacion(archivo);
  };

  const cambiarEstadoItem = async (itemId: string, estadoItem: EstadoItem) => {
    setActualizandoItems(prev => ({ ...prev, [itemId]: true }));
    try {
      const respuesta = await fetch('/api/items/update-estado', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, estadoItem }),
      });
      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        throw new Error(error.error || 'Error al actualizar el estado');
      }
      setEstadosItems(prev => ({ ...prev, [itemId]: estadoItem }));
    } catch (error) {
      console.error('Error al actualizar estado del item:', error);
      alert('No se pudo actualizar el ítem: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setActualizandoItems(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const estado = normalizarValor(compra.estadoSolicitud);
  const prioridad = normalizarValor(compra.prioridadSolicitud);
  const estiloEstado = ESTILO_ESTADO[estado] ?? ESTILO_ESTADO_DESCONOCIDO;
  const estiloPrioridad = ESTILO_PRIORIDAD[prioridad];
  const cargo = texto(compra.cargoSolicitante);
  const descripcion = compactarDescripcion(texto(compra.descripcionSolicitud));
  const descripcionIA = texto(compra.descripcionIA);
  const compradosItems = compra.items.filter(item => estadosItems[item.id] === 'Comprado').length;
  const monto = (valor: number | undefined) => (valor && valor > 0 ? formatoCOP(valor) : '');

  const proveedor: [string, ReactNode][] = [
    ['Razón social', texto(compra.razonSocialProveedor)],
    ['Nombre', texto(compra.nombreProveedor)],
    ['NIT / C.C.', texto(compra.nitProveedor)],
    ['Ciudad', [texto(compra.ciudadProveedor), texto(compra.departamentoProveedor)].filter(Boolean).join(', ')],
    ['Tipo de persona', texto(compra.personaProveedor)],
    ['Contribuyente', texto(compra.contribuyente)],
    ['Autorretenedor', texto(compra.autoretenedor)],
    ['Responsable de IVA', texto(compra.responsableIVA)],
    ['Responsable de ICA', texto(compra.responsableICA)],
    ['Tarifa de actividad', texto(compra.tarifaActividad)],
    ['Facturador electrónico', texto(compra.facturadorElectronico)],
    ['Declarante de renta', texto(compra.declaranteRenta)],
  ];
  const hayProveedor = proveedor.some(([, valor]) => valor !== '') || (compra.rutProveedor?.length ?? 0) > 0;

  const bancario: [string, ReactNode][] = [
    ['Semana', texto(compra.numeroSemanaBancario)],
    ['Clasificación', texto(compra.clasificacionBancaria)],
    ['Valor', (compra.valorBancario ?? []).map(v => formatoCOP(Number(v))).join(', ')],
    ['Proyección', texto(compra.proyeccionBancaria)],
  ];
  const hayBancario = bancario.some(([, valor]) => valor !== '');

  // Se monta en <body>: así ningún contenedor de la página (z-index, desenfoques) lo deja
  // por debajo de la barra de navegación fija (z-50).
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-compra"
        onClick={e => e.stopPropagation()}
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">Solicitud de compra · {fechaLarga(compra.fechaSolicitud)}</p>
            <h2 id="titulo-detalle-compra" className="mt-1 truncate text-xl font-semibold text-slate-50">
              {compra.nombreSolicitante || 'Sin solicitante'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {[cargo !== 'Sin especificar' && cargo, compra.areaCorrespondiente || 'Sin área'].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${estiloEstado.pildora}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${estiloEstado.punto}`} aria-hidden="true" />
                {estado || 'Sin estado'}
              </span>
              {prioridad && (
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${estiloPrioridad?.texto ?? 'text-slate-300'}`}>
                  <span className={`h-2 w-2 rounded-full ${estiloPrioridad?.punto ?? 'bg-slate-400'}`} aria-hidden="true" />
                  Prioridad {prioridad.toLowerCase()}
                </span>
              )}
              {compra.nombresAdmin && <span className="text-xs text-slate-400">Revisada por {compra.nombresAdmin}</span>}
            </div>
          </div>
          <button
            ref={botonCerrar}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-3">
          {/* Columna lateral: en celular va primero, en escritorio a la derecha */}
          <aside className="space-y-4 lg:order-2">
            <Seccion titulo="Valores">
              {compra.valorTotal && compra.valorTotal > 0 ? (
                <>
                  <p className="text-2xl font-semibold tabular-nums text-slate-50">{formatoCOP(compra.valorTotal)}</p>
                  <p className="mb-3 text-xs text-slate-400">Valor total</p>
                  <Datos
                    pares={[
                      ['IVA', monto(compra.iva)],
                      ['Retención', monto(compra.retencion)],
                      ['Total neto', monto(compra.totalNeto)],
                      ['Tipo', texto(compra.compraServicio)],
                    ]}
                  />
                  {compra.baseMinimaEnPesos ? (
                    <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-400">
                      Base mínima de retención: {compra.baseMinimaEnUVT} UVT ({formatoCOP(compra.baseMinimaEnPesos)})
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-slate-400">Aún no tiene valor. Se calcula cuando la solicitud tiene ítems con precio.</p>
              )}
            </Seccion>

            <Seccion titulo="Documentos">
              <div className="flex flex-col gap-2">
                {compra.documentoSolicitud && (
                  <a
                    href={compra.documentoSolicitud}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/80"
                  >
                    <FileText className="h-4 w-4 text-slate-300" />
                    Solicitud original
                    <ExternalLink className="ml-auto h-3.5 w-3.5 text-slate-500" />
                  </a>
                )}
                {cotizacionUrl && (
                  <a
                    href={cotizacionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-800/70 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/80"
                  >
                    <FileText className="h-4 w-4 text-emerald-300" />
                    Cotización
                    <ExternalLink className="ml-auto h-3.5 w-3.5 text-slate-500" />
                  </a>
                )}
                <input
                  ref={entradaArchivo}
                  type="file"
                  onChange={alElegirArchivo}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => entradaArchivo.current?.click()}
                  disabled={subiendoCotizacion}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                >
                  {subiendoCotizacion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {subiendoCotizacion ? 'Subiendo…' : cotizacionUrl ? 'Reemplazar cotización' : 'Cargar cotización'}
                </button>
                {aviso && (
                  <p
                    role="status"
                    className={`flex items-start gap-1.5 text-xs ${aviso.tipo === 'exito' ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {aviso.tipo === 'exito' ? <CircleCheck className="h-3.5 w-3.5 shrink-0" /> : <CircleAlert className="h-3.5 w-3.5 shrink-0" />}
                    {aviso.texto}
                  </p>
                )}
                <p className="text-xs text-slate-500">PDF, JPG, PNG o WebP · máximo 10 MB</p>
              </div>
            </Seccion>

            {hayProveedor && (
              <Seccion titulo="Proveedor">
                <Datos pares={proveedor} />
                {compra.rutProveedor && compra.rutProveedor.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-3">
                    {compra.rutProveedor.map((rut: AirtableField, i: number) => (
                      <a
                        key={i}
                        href={rut.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {rut.filename || 'RUT del proveedor'}
                      </a>
                    ))}
                  </div>
                )}
              </Seccion>
            )}

            {hayBancario && (
              <Seccion titulo="Movimiento bancario">
                <Datos pares={bancario} />
              </Seccion>
            )}
          </aside>

          <div className="space-y-4 lg:order-1 lg:col-span-2">
            <Seccion titulo="Descripción">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{descripcion || 'Sin descripción'}</p>
            </Seccion>

            <Seccion
              titulo={`Ítems (${compra.items.length})`}
              extra={
                compra.items.length > 0 && (
                  <span className="text-xs text-slate-400">{compradosItems} de {compra.items.length} comprados</span>
                )
              }
            >
              {compra.items.length > 0 ? (
                <ul className="-my-3 divide-y divide-white/10">
                  {compra.items.map(item => (
                    <FilaItem
                      key={item.id}
                      item={item}
                      estado={estadosItems[item.id]}
                      actualizando={Boolean(actualizandoItems[item.id])}
                      onCambiar={nuevo => cambiarEstadoItem(item.id, nuevo)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Esta solicitud no tiene ítems registrados.</p>
              )}
            </Seccion>

            {descripcionIA && (
              <details className="group rounded-xl border border-white/10 bg-slate-800/40">
                <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-slate-100 [&::-webkit-details-marker]:hidden">
                  <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
                  Estimación de la IA
                  <span className="ml-auto text-xs font-normal text-slate-400 group-open:hidden">Mostrar</span>
                  <span className="ml-auto hidden text-xs font-normal text-slate-400 group-open:inline">Ocultar</span>
                </summary>
                <div className="border-t border-white/10 p-4">
                  <p className="mb-3 text-xs text-slate-500">
                    Calculada automáticamente a partir de la descripción. Es una referencia, no reemplaza una cotización.
                  </p>
                  <TextoIA texto={descripcionIA} />
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
