/**
 * Importación de extractos PDF (antes: workflows n8n AUTOMA_Movimientos_Bancarios y
 * AUTOMA_Movimientos_Bancarios_BBVA). El saldo anterior de cada movimiento encadena
 * con el saldo actual (fórmula de Airtable) del movimiento previo.
 */

import Airtable, { type FieldSet, type Table } from 'airtable';
import { extraerTextoPdf } from '@/lib/pdf-texto';
import { vincularSemanas } from '@/lib/centralizacion-semanal';
import { crearEnLotes, procesarArchivosPendientes, type ResultadoImportacion } from '@/lib/importacion/archivos-pendientes';
import type { DriveItem } from '@/lib/microsoft-graph';
import { CUENTAS_BANCARIAS, type BancoId } from './cuentas';
import { parsearExtractoBancolombia, parsearExtractoBbva, type MovimientoBancolombia, type MovimientoBbva } from './parsers';

// Carpetas del OneDrive ADM con los extractos (las mismas que leía n8n):
// General/Documentos Soporte/2026/Movimientos Bancolombia y .../Movimientos BBVA
const CARPETA_BANCOLOMBIA_ID = '01LXL6CJGMBBCDCLRAZNCIT5QQW73QPXJQ';
const CARPETA_BBVA_ID = '01LXL6CJCMCGRXRLPLU5HID5UUPWTRV3NE';

const esPdf = (archivo: DriveItem) => /\.pdf$/i.test(archivo.name);
// Sin redondeo, el error de coma flotante se acumula a lo largo de la cadena de saldos
const redondear = (valor: number) => Math.round(valor * 100) / 100;

function movimientosBancolombia(texto: string): MovimientoBancolombia[] {
  const movimientos = parsearExtractoBancolombia(texto);
  if (movimientos.length === 0) {
    throw new Error('No se encontraron movimientos en el PDF');
  }
  if (movimientos.some(m => !Number.isFinite(m.valor) || !/^\d{4}-\d{2}-\d{2}$/.test(m.fecha))) {
    throw new Error('Hay movimientos con fecha o valor ilegible');
  }
  return movimientos;
}

function movimientosBbva(texto: string): MovimientoBbva[] {
  const movimientos = parsearExtractoBbva(texto);
  if (movimientos.length === 0) {
    throw new Error('No se encontraron movimientos en el PDF');
  }
  if (movimientos.some(m => m.importe === null || !Number.isFinite(m.importe) || !m.fechaOperacion)) {
    throw new Error('Hay movimientos con fecha o importe ilegible');
  }
  return movimientos;
}

function tablaDesdeEntorno(variable: 'AIRTABLE_MOVIMIENTOS_TABLE_ID' | 'AIRTABLE_BBVA_TABLE_ID'): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  const tablaId = process.env[variable];
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !tablaId) {
    throw new Error(`Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o ${variable}`);
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(tablaId);
}

async function saldoUltimoMovimiento(tabla: Table<FieldSet>, campoSaldo: string): Promise<number> {
  const [ultimo] = await tabla
    .select({ sort: [{ field: 'ID_Numerico', direction: 'desc' }], maxRecords: 1, fields: [campoSaldo] })
    .firstPage();
  const saldo = ultimo?.get(campoSaldo);
  if (typeof saldo !== 'number') {
    throw new Error(`No se encontró "${campoSaldo}" en el último movimiento para encadenar los saldos`);
  }
  return redondear(saldo);
}

export async function importarExtractosBancolombia(limite: number): Promise<ResultadoImportacion> {
  const tabla = tablaDesdeEntorno('AIRTABLE_MOVIMIENTOS_TABLE_ID');

  return procesarArchivosPendientes({
    carpetaId: CARPETA_BANCOLOMBIA_ID,
    tabla,
    campoIdDocumento: 'id_documento',
    esArchivoValido: esPdf,
    detenerEnError: true,
    limite,
    procesar: async ({ archivo, contenido, creados, advertencias }) => {
      const movimientos = movimientosBancolombia(await extraerTextoPdf(contenido));

      let saldo = await saldoUltimoMovimiento(tabla, 'Saldo_Bancario_Actual');
      const registros = movimientos.map(movimiento => {
        const fields: FieldSet = {
          Fecha: movimiento.fecha,
          'Descripción': movimiento.descripcion,
          Valor: movimiento.valor,
          Saldo_Bancario_Anterior: saldo,
          id_documento: archivo.id,
        };
        saldo = redondear(saldo + movimiento.valor);
        return { fields };
      });

      const registrosCreados = await crearEnLotes(tabla, registros, creados, { typecast: false });
      const sinSemana = await vincularSemanas(tabla, registrosCreados);
      if (sinSemana > 0) advertencias.push(`${sinSemana} movimiento(s) sin semana en Centralización General`);
    },
  });
}

export async function importarExtractosBbva(limite: number): Promise<ResultadoImportacion> {
  const tabla = tablaDesdeEntorno('AIRTABLE_BBVA_TABLE_ID');

  return procesarArchivosPendientes({
    carpetaId: CARPETA_BBVA_ID,
    tabla,
    campoIdDocumento: 'id_documento',
    esArchivoValido: esPdf,
    detenerEnError: true,
    limite,
    procesar: async ({ archivo, contenido, creados, advertencias }) => {
      const movimientos = movimientosBbva(await extraerTextoPdf(contenido));

      let saldo = await saldoUltimoMovimiento(tabla, 'Saldo Bancario Actual');
      const registros = movimientos.map(movimiento => {
        const importe = movimiento.importe as number;
        const fields: FieldSet = {
          Importe: importe,
          Fecha: movimiento.fechaOperacion ?? undefined,
          'F Valor': movimiento.fechaValor ?? undefined,
          Codigo: movimiento.codigo,
          Concepto: movimiento.concepto,
          'Saldo Bancario Anterior': saldo,
          id_documento: archivo.id,
        };
        saldo = redondear(saldo + importe);
        return { fields };
      });

      const registrosCreados = await crearEnLotes(tabla, registros, creados, { typecast: true });
      const sinSemana = await vincularSemanas(tabla, registrosCreados);
      if (sinSemana > 0) advertencias.push(`${sinSemana} movimiento(s) sin semana en Centralización General`);

      // El extracto BBVA trae el saldo después de cada movimiento: sirve para validar la cadena
      const saldoExtracto = movimientos[movimientos.length - 1].saldo;
      if (saldoExtracto !== null && Math.abs(saldoExtracto - saldo) > 1) {
        advertencias.push(`el saldo calculado (${saldo}) no coincide con el del extracto (${saldoExtracto})`);
      }
    },
  });
}

export const EXTRACTOS: Record<BancoId, { carpetaId: string; importar: (limite: number) => Promise<ResultadoImportacion> }> = {
  bancolombia: { carpetaId: CARPETA_BANCOLOMBIA_ID, importar: importarExtractosBancolombia },
  bbva: { carpetaId: CARPETA_BBVA_ID, importar: importarExtractosBbva },
};

interface MovimientoComparable {
  fecha: string;
  valor: number;
}

const LECTORES: Record<BancoId, (texto: string) => MovimientoComparable[]> = {
  bancolombia: texto => movimientosBancolombia(texto).map(m => ({ fecha: m.fecha, valor: m.valor })),
  bbva: texto => movimientosBbva(texto).map(m => ({ fecha: m.fechaOperacion as string, valor: m.importe as number })),
};

const TABLAS: Record<BancoId, { variable: 'AIRTABLE_MOVIMIENTOS_TABLE_ID' | 'AIRTABLE_BBVA_TABLE_ID'; campoValor: string }> = {
  bancolombia: { variable: 'AIRTABLE_MOVIMIENTOS_TABLE_ID', campoValor: 'Valor' },
  bbva: { variable: 'AIRTABLE_BBVA_TABLE_ID', campoValor: 'Importe' },
};

const fechaLegible = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Un extracto cargado dos veces duplicaría sus movimientos y descuadraría la cadena de
 * saldos. Se considera repetido solo si TODOS sus movimientos (fecha + valor) ya existen.
 */
async function yaEstaRegistrado(banco: BancoId, movimientos: MovimientoComparable[], desde: string): Promise<boolean> {
  const { variable, campoValor } = TABLAS[banco];
  const existentes = await tablaDesdeEntorno(variable)
    .select({
      filterByFormula: `NOT(IS_BEFORE({Fecha}, DATETIME_PARSE('${desde}', 'YYYY-MM-DD')))`,
      fields: ['Fecha', campoValor],
    })
    .all();

  const clave = (fecha: string, valor: number) => `${fecha}|${redondear(valor)}`;
  const disponibles = new Map<string, number>();
  for (const registro of existentes) {
    const valor = registro.get(campoValor);
    if (typeof valor !== 'number') continue;
    const k = clave(String(registro.get('Fecha')), valor);
    disponibles.set(k, (disponibles.get(k) ?? 0) + 1);
  }

  return movimientos.every(movimiento => {
    const k = clave(movimiento.fecha, movimiento.valor);
    const quedan = disponibles.get(k) ?? 0;
    if (quedan === 0) return false;
    disponibles.set(k, quedan - 1);
    return true;
  });
}

export interface ExtractoValidado {
  movimientos: number;
  desde: string;
  hasta: string;
}

/**
 * Revisa un PDF antes de subirlo a la carpeta del banco: un archivo que no se puede
 * importar bloquearía los siguientes (la importación se detiene en el primer error).
 */
export async function validarExtracto(banco: BancoId, contenido: Buffer): Promise<ExtractoValidado> {
  const nombre = CUENTAS_BANCARIAS[banco].nombre;
  let texto: string;
  try {
    texto = await extraerTextoPdf(contenido);
  } catch {
    throw new Error('No se pudo leer el PDF. Verifica que no esté dañado ni protegido con contraseña.');
  }

  let movimientos: MovimientoComparable[];
  try {
    movimientos = LECTORES[banco](texto);
  } catch (error) {
    const otro: BancoId = banco === 'bancolombia' ? 'bbva' : 'bancolombia';
    let esDelOtroBanco = false;
    try {
      esDelOtroBanco = LECTORES[otro](texto).length > 0;
    } catch {
      // Tampoco tiene el formato del otro banco
    }
    if (esDelOtroBanco) {
      const nombreOtro = CUENTAS_BANCARIAS[otro].nombre;
      throw new Error(`Este PDF parece un extracto de ${nombreOtro}. Cárgalo desde la pestaña ${nombreOtro}.`);
    }
    const motivo = error instanceof Error ? error.message : String(error);
    throw new Error(`El PDF no tiene el formato de extracto de ${nombre} (${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}).`);
  }

  const fechas = movimientos.map(m => m.fecha).sort();
  const resumen = { movimientos: movimientos.length, desde: fechas[0], hasta: fechas[fechas.length - 1] };

  if (await yaEstaRegistrado(banco, movimientos, resumen.desde)) {
    throw new Error(
      `Este extracto ya está cargado: sus ${movimientos.length} movimientos (del ${fechaLegible(resumen.desde)} ` +
        `al ${fechaLegible(resumen.hasta)}) ya existen en la tabla de ${nombre}.`
    );
  }

  return resumen;
}
