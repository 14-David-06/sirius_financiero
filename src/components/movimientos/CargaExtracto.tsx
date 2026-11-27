'use client';

import { useRef, useState } from 'react';
import { CircleAlert, CircleCheck, FolderSync, Info, RefreshCw, Upload, X } from 'lucide-react';
import { CUENTAS_BANCARIAS, type BancoId } from '@/lib/bancos/cuentas';
import type { ResultadoImportacion } from '@/lib/importacion/archivos-pendientes';
import { formatoFecha } from '@/lib/cartera/formato';
import { TARJETA, plural } from '@/components/cartera/estilos';

const TAMANO_MAXIMO = 4 * 1024 * 1024;

type TipoAviso = 'exito' | 'aviso' | 'error' | 'info';

interface Aviso {
  tipo: TipoAviso;
  titulo: string;
  lineas: string[];
}

const ESTILO_AVISO: Record<TipoAviso, { caja: string; icono: typeof CircleCheck; color: string }> = {
  exito: { caja: 'border-emerald-400/40 bg-emerald-950/70', icono: CircleCheck, color: 'text-emerald-300' },
  aviso: { caja: 'border-amber-400/40 bg-amber-950/70', icono: CircleAlert, color: 'text-amber-300' },
  error: { caja: 'border-red-400/40 bg-red-950/70', icono: CircleAlert, color: 'text-red-300' },
  info: { caja: 'border-white/15 bg-slate-900/80', icono: Info, color: 'text-slate-300' },
};

function lineasImportacion(resultado: ResultadoImportacion, excluir?: string): string[] {
  return [
    ...resultado.procesados
      .filter(p => p.nombre !== excluir)
      .map(p => `${p.nombre}: ${plural(p.registrosCreados, 'movimiento registrado', 'movimientos registrados')}`),
    ...resultado.procesados.flatMap(p => p.advertencias.map(a => `Revisar "${p.nombre}": ${a}`)),
    ...resultado.errores.map(e => `No se importó "${e.nombre}": ${e.error}`),
    ...(resultado.pendientesSinProcesar > 0
      ? [`${plural(resultado.pendientesSinProcesar, 'archivo quedó', 'archivos quedaron')} sin procesar por tiempo: vuelve a buscar pendientes.`]
      : []),
  ];
}

export default function CargaExtracto({ banco, onImportado }: { banco: BancoId; onImportado: () => void }) {
  const cuenta = CUENTAS_BANCARIAS[banco];
  const entrada = useRef<HTMLInputElement>(null);
  const [accion, setAccion] = useState<'subiendo' | 'buscando' | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // El aviso pertenece al banco con el que se hizo la carga
  const [avisoBanco, setAvisoBanco] = useState<BancoId>(banco);
  const avisoVisible = aviso && avisoBanco === banco ? aviso : null;

  const mostrar = (nuevo: Aviso) => {
    setAviso(nuevo);
    setAvisoBanco(banco);
  };

  const subir = async (archivo: File) => {
    if (archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) {
      mostrar({ tipo: 'error', titulo: 'Solo se aceptan archivos PDF', lineas: [] });
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      mostrar({ tipo: 'error', titulo: 'El archivo supera el máximo de 4 MB', lineas: [] });
      return;
    }

    setAccion('subiendo');
    setAviso(null);
    try {
      const datos = new FormData();
      datos.append('banco', banco);
      datos.append('archivo', archivo);
      const respuesta = await fetch('/api/movimientos-bancarios/extracto', { method: 'POST', body: datos });
      const resultado = await respuesta.json().catch(() => ({}));

      if (!resultado.archivo) {
        mostrar({ tipo: 'error', titulo: 'No se cargó el extracto', lineas: [resultado.error || `Error ${respuesta.status}`] });
        return;
      }

      const importacion: ResultadoImportacion | undefined = resultado.importacion;
      const propio = importacion?.procesados.find(p => p.nombre === resultado.archivo.nombre);
      const rango = resultado.extracto
        ? `Del ${formatoFecha(resultado.extracto.desde)} al ${formatoFecha(resultado.extracto.hasta)}`
        : '';

      if (propio) {
        mostrar({
          tipo: resultado.success ? 'exito' : 'aviso',
          titulo: `Extracto cargado: ${plural(propio.registrosCreados, 'movimiento registrado', 'movimientos registrados')} en ${cuenta.nombre}`,
          lineas: [rango, ...lineasImportacion(importacion!, propio.nombre)].filter(Boolean),
        });
      } else {
        mostrar({
          tipo: 'aviso',
          titulo: 'El extracto quedó en OneDrive, pero sus movimientos no se registraron',
          lineas: [
            ...(resultado.error ? [resultado.error] : []),
            ...(importacion ? lineasImportacion(importacion) : []),
            'Cuando se resuelva, usa "Buscar pendientes en OneDrive" para terminar la importación.',
          ],
        });
      }
      if (importacion?.procesados.length) onImportado();
    } catch {
      mostrar({ tipo: 'error', titulo: 'No se pudo conectar con el servidor', lineas: ['Verifica tu conexión e inténtalo de nuevo.'] });
    } finally {
      setAccion(null);
    }
  };

  const buscarPendientes = async () => {
    setAccion('buscando');
    setAviso(null);
    try {
      const respuesta = await fetch('/api/movimientos-bancarios/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banco }),
      });
      const resultado = await respuesta.json().catch(() => ({}));
      const importacion: ResultadoImportacion | null = resultado[banco] ?? null;

      if (!importacion) {
        mostrar({ tipo: 'error', titulo: 'No se pudo revisar la carpeta', lineas: [resultado.error || `Error ${respuesta.status}`] });
        return;
      }
      const registros = importacion.procesados.reduce((suma, p) => suma + p.registrosCreados, 0);
      if (importacion.procesados.length === 0 && importacion.errores.length === 0) {
        mostrar({ tipo: 'info', titulo: `No hay extractos pendientes en la carpeta de ${cuenta.nombre}`, lineas: [] });
      } else {
        mostrar({
          tipo: importacion.errores.length > 0 ? 'aviso' : 'exito',
          titulo:
            registros > 0
              ? `${plural(registros, 'movimiento registrado', 'movimientos registrados')} en ${cuenta.nombre}`
              : 'No se registraron movimientos',
          lineas: lineasImportacion(importacion),
        });
      }
      if (registros > 0) onImportado();
    } catch {
      mostrar({ tipo: 'error', titulo: 'No se pudo conectar con el servidor', lineas: ['Verifica tu conexión e inténtalo de nuevo.'] });
    } finally {
      setAccion(null);
    }
  };

  const estilo = avisoVisible ? ESTILO_AVISO[avisoVisible.tipo] : null;

  return (
    <section aria-labelledby="titulo-carga" className="mb-4 space-y-3">
      <div className={`${TARJETA} flex flex-col gap-4 p-5 md:flex-row md:items-center`}>
        <div className="flex-1">
          <h2 id="titulo-carga" className="text-base font-semibold text-slate-50">
            Cargar extracto de {cuenta.nombre}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Sube el PDF del extracto: se guarda en OneDrive ({cuenta.carpeta}) y sus movimientos se registran en la tabla{' '}
            {cuenta.tabla}. Máximo 4 MB.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={entrada}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={e => {
              const archivo = e.target.files?.[0];
              e.target.value = '';
              if (archivo) subir(archivo);
            }}
          />
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            disabled={accion !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {accion === 'subiendo' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {accion === 'subiendo' ? 'Cargando extracto…' : 'Subir extracto PDF'}
          </button>
          <button
            type="button"
            onClick={buscarPendientes}
            disabled={accion !== null}
            title="Importa los PDF que se copiaron directamente a la carpeta de OneDrive y aún no están en Airtable"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-slate-800/70 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700/70 disabled:opacity-60"
          >
            <FolderSync className={`h-4 w-4 ${accion === 'buscando' ? 'animate-pulse' : ''}`} />
            {accion === 'buscando' ? 'Buscando…' : 'Buscar pendientes en OneDrive'}
          </button>
        </div>
      </div>

      {accion === 'subiendo' && (
        <p role="status" className="px-1 text-sm text-slate-300">
          Revisando el PDF, guardándolo en OneDrive y registrando los movimientos. Puede tardar hasta un minuto.
        </p>
      )}

      {avisoVisible && estilo && (
        <div role="status" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm backdrop-blur-md ${estilo.caja}`}>
          <estilo.icono className={`mt-0.5 h-5 w-5 shrink-0 ${estilo.color}`} aria-hidden="true" />
          <div className="flex-1 text-slate-100">
            <p className="font-medium">{avisoVisible.titulo}</p>
            {avisoVisible.lineas.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-slate-300">
                {avisoVisible.lineas.map((linea, i) => (
                  <li key={i}>{linea}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Cerrar aviso"
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}
