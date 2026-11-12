/**
 * Patrón común de las importaciones que antes hacía n8n: una carpeta de OneDrive
 * cuyos archivos se marcan como importados con su ID en el campo id_documento.
 */

import type { FieldSet, Record as AirtableRecord, Table } from 'airtable';
import { descargarArchivo, listarHijosCarpeta, type DriveItem } from '@/lib/microsoft-graph';

const LOTE_AIRTABLE = 10;
const DIA_MS = 86_400_000;
// Solo se buscan pendientes entre los archivos subidos en esta ventana: comparar
// carpetas completas (cientos de extractos) contra Airtable en cada ejecución es muy lento.
const VENTANA_DIAS = 45;

export interface ArchivoProcesado {
  nombre: string;
  registrosCreados: number;
  advertencias: string[];
}

export interface ResultadoImportacion {
  procesados: ArchivoProcesado[];
  errores: { nombre: string; error: string }[];
  /** Pendientes que no se alcanzaron a procesar antes del límite de tiempo */
  pendientesSinProcesar: number;
}

export interface ContextoArchivo {
  archivo: DriveItem;
  contenido: Buffer;
  /** IDs creados en la tabla principal; si el archivo falla se eliminan */
  creados: string[];
  advertencias: string[];
}

export async function crearEnLotes(
  tabla: Table<FieldSet>,
  registros: { fields: FieldSet }[],
  creados: string[],
  opciones: { typecast: boolean }
): Promise<AirtableRecord<FieldSet>[]> {
  const resultado: AirtableRecord<FieldSet>[] = [];
  for (let i = 0; i < registros.length; i += LOTE_AIRTABLE) {
    const lote = await tabla.create(registros.slice(i, i + LOTE_AIRTABLE), opciones);
    creados.push(...lote.map(registro => registro.id));
    resultado.push(...lote);
  }
  return resultado;
}

export async function actualizarEnLotes(
  tabla: Table<FieldSet>,
  registros: { id: string; fields: FieldSet }[]
): Promise<void> {
  for (let i = 0; i < registros.length; i += LOTE_AIRTABLE) {
    await tabla.update(registros.slice(i, i + LOTE_AIRTABLE), { typecast: true });
  }
}

async function eliminarEnLotes(tabla: Table<FieldSet>, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += LOTE_AIRTABLE) {
    await tabla.destroy(ids.slice(i, i + LOTE_AIRTABLE));
  }
}

export async function procesarArchivosPendientes(opciones: {
  carpetaId: string;
  tabla: Table<FieldSet>;
  campoIdDocumento: string;
  esArchivoValido: (archivo: DriveItem) => boolean;
  /** Extractos bancarios: un archivo saltado dejaría la cadena de saldos desordenada */
  detenerEnError: boolean;
  /** Marca de tiempo (ms) a partir de la cual no se empieza otro archivo */
  limite: number;
  procesar: (contexto: ContextoArchivo) => Promise<void>;
}): Promise<ResultadoImportacion> {
  const resultado: ResultadoImportacion = { procesados: [], errores: [], pendientesSinProcesar: 0 };
  const inicioVentana = Date.now() - VENTANA_DIAS * DIA_MS;

  const candidatos = (await listarHijosCarpeta(opciones.carpetaId))
    .filter(item => item.file && opciones.esArchivoValido(item) && Date.parse(item.createdDateTime) >= inicioVentana)
    .sort((a, b) => Date.parse(a.createdDateTime) - Date.parse(b.createdDateTime));

  if (candidatos.length === 0) return resultado;

  // Todo registro de un archivo se creó después de subirlo: basta revisar lo creado desde el más antiguo
  const desde = new Date(Date.parse(candidatos[0].createdDateTime) - DIA_MS).toISOString();
  const registrosRecientes = await opciones.tabla
    .select({
      filterByFormula: `IS_AFTER(CREATED_TIME(), DATETIME_PARSE('${desde}'))`,
      fields: [opciones.campoIdDocumento],
    })
    .all();
  const importados = new Set(registrosRecientes.map(registro => String(registro.get(opciones.campoIdDocumento) ?? '')));
  const pendientes = candidatos.filter(archivo => !importados.has(archivo.id));

  for (const [indice, archivo] of pendientes.entries()) {
    if (Date.now() > opciones.limite) {
      resultado.pendientesSinProcesar = pendientes.length - indice;
      break;
    }

    const contexto: ContextoArchivo = { archivo, contenido: Buffer.alloc(0), creados: [], advertencias: [] };
    try {
      contexto.contenido = await descargarArchivo(archivo.id);
      await opciones.procesar(contexto);
      resultado.procesados.push({
        nombre: archivo.name,
        registrosCreados: contexto.creados.length,
        advertencias: contexto.advertencias,
      });
    } catch (error) {
      console.error(`❌ Error importando "${archivo.name}":`, error);
      // Las filas creadas llevan id_documento: sin eliminarlas el archivo quedaría
      // marcado como importado con filas faltantes y no se reintentaría.
      await eliminarEnLotes(opciones.tabla, contexto.creados);
      resultado.errores.push({ nombre: archivo.name, error: error instanceof Error ? error.message : String(error) });
      if (opciones.detenerEnError) break;
    }
  }

  return resultado;
}

/** Texto corto para la UI y los logs. */
export function resumirImportacion(etiqueta: string, resultado: ResultadoImportacion): string {
  const partes: string[] = [];
  const registros = resultado.procesados.reduce((suma, archivo) => suma + archivo.registrosCreados, 0);

  if (resultado.procesados.length > 0) {
    partes.push(`${registros} registros de ${resultado.procesados.length} archivo(s)`);
  }
  for (const error of resultado.errores) {
    partes.push(`error en "${error.nombre}": ${error.error}`);
  }
  for (const archivo of resultado.procesados) {
    for (const advertencia of archivo.advertencias) {
      partes.push(`"${archivo.nombre}": ${advertencia}`);
    }
  }
  if (resultado.pendientesSinProcesar > 0) {
    partes.push(`${resultado.pendientesSinProcesar} archivo(s) quedan para la próxima ejecución`);
  }

  return `${etiqueta}: ${partes.length > 0 ? partes.join('; ') : 'sin archivos nuevos'}`;
}
