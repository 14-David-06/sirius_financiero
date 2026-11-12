/**
 * Importación de documentos DIAN (antes: workflow n8n AUTOMA_DIAN).
 *
 * Cada Excel de la carpeta de OneDrive que aún no tenga registros en la tabla DIAN
 * (por id_documento) se importa con un registro por fila.
 */

import Airtable, { type FieldSet, type Table } from 'airtable';
import * as XLSX from 'xlsx';
import { DIAN_FIELDS } from '@/lib/config/dian-fields';
import { crearEnLotes, procesarArchivosPendientes, type ResultadoImportacion } from '@/lib/importacion/archivos-pendientes';

// Carpeta del OneDrive ADM donde se dejan los Excel exportados de la DIAN
const CARPETA_DIAN_ONEDRIVE_ID = '01LXL6CJHTKRHHXZNCJJBZWNGD5E4ZFWN4';

type FilaExcel = Record<string, string | number | boolean>;

function tablaDian(): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_DIAN_TABLE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_DIAN_TABLE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o AIRTABLE_DIAN_TABLE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(AIRTABLE_DIAN_TABLE_ID);
}

/** Primera hoja con encabezados en la fila 1, igual que el nodo "Extract from File" de n8n. */
export function leerFilasExcel(contenido: Buffer): FilaExcel[] {
  const libro = XLSX.read(contenido, { type: 'buffer' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  if (!hoja) {
    throw new Error('El Excel no tiene hojas');
  }
  return XLSX.utils.sheet_to_json<FilaExcel>(hoja);
}

/**
 * Acepta YYYY-MM-DD / YYYY/MM/DD o DD-MM-YYYY / DD/MM/YYYY (la hora se ignora)
 * y devuelve YYYY-MM-DD. Los campos de fecha de la tabla DIAN son solo fecha:
 * si se envía la hora con zona, Airtable la pasa a UTC y una recepción después
 * de las 7 p. m. queda con el día siguiente.
 */
export function aFecha(valor: unknown): string | null {
  if (!valor) return null;
  const texto = String(valor).trim();

  let anio: string, mes: string, dia: string;
  const isoLike = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const colombiano = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (isoLike) {
    [, anio, mes, dia] = isoLike;
  } else if (colombiano) {
    [, dia, mes, anio] = colombiano;
  } else {
    return null;
  }

  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

export function mapearFilaDian(fila: FilaExcel, archivoId: string): FieldSet {
  const campos: Record<string, string | number | boolean | null | undefined> = {
    [DIAN_FIELDS.TIPO_DOCUMENTO]: fila['Tipo de documento'],
    [DIAN_FIELDS.CUFE]: fila['CUFE/CUDE'],
    [DIAN_FIELDS.FOLIO]: fila['Folio'],
    [DIAN_FIELDS.PREFIJO]: fila['Prefijo'],
    [DIAN_FIELDS.FECHA_EMISION]: aFecha(fila['Fecha Emisión']),
    [DIAN_FIELDS.FECHA_RECEPCION]: aFecha(fila['Fecha Recepción']),
    [DIAN_FIELDS.NIT_EMISOR]: fila['NIT Emisor'],
    [DIAN_FIELDS.NOMBRE_EMISOR]: fila['Nombre Emisor'],
    [DIAN_FIELDS.NIT_RECEPTOR]: fila['NIT Receptor'],
    [DIAN_FIELDS.NOMBRE_RECEPTOR]: fila['Nombre Receptor'],
    [DIAN_FIELDS.IVA]: fila['IVA'],
    [DIAN_FIELDS.ICA]: fila['ICA'],
    [DIAN_FIELDS.IPC]: fila['IPC'],
    [DIAN_FIELDS.TOTAL]: fila['Total'],
    [DIAN_FIELDS.ESTADO]: fila['Estado'],
    [DIAN_FIELDS.GRUPO]: fila['Grupo'],
    [DIAN_FIELDS.ID_DOCUMENTO]: archivoId,
  };

  return Object.fromEntries(
    Object.entries(campos).filter(([, valor]) => valor !== undefined && valor !== null && valor !== '')
  ) as FieldSet;
}

export async function importarExcelPendientesDian(limite: number): Promise<ResultadoImportacion> {
  const tabla = tablaDian();

  return procesarArchivosPendientes({
    carpetaId: CARPETA_DIAN_ONEDRIVE_ID,
    tabla,
    campoIdDocumento: DIAN_FIELDS.ID_DOCUMENTO,
    esArchivoValido: archivo => /\.xlsx?$/i.test(archivo.name),
    detenerEnError: false,
    limite,
    procesar: async ({ archivo, contenido, creados, advertencias }) => {
      const filas = leerFilasExcel(contenido);
      if (filas.length === 0) {
        advertencias.push('el Excel no tiene filas');
        return;
      }
      const registros = filas.map(fila => ({ fields: mapearFilaDian(fila, archivo.id) }));
      await crearEnLotes(tabla, registros, creados, { typecast: true });
    },
  });
}
