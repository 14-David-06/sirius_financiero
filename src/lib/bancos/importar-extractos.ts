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
import { parsearExtractoBancolombia, parsearExtractoBbva } from './parsers';

// Carpetas del OneDrive ADM con los extractos (las mismas que leía n8n)
const CARPETA_BANCOLOMBIA_ID = '01LXL6CJGMBBCDCLRAZNCIT5QQW73QPXJQ';
const CARPETA_BBVA_ID = '01LXL6CJCMCGRXRLPLU5HID5UUPWTRV3NE';

const esPdf = (archivo: DriveItem) => /\.pdf$/i.test(archivo.name);
// Sin redondeo, el error de coma flotante se acumula a lo largo de la cadena de saldos
const redondear = (valor: number) => Math.round(valor * 100) / 100;

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
      const movimientos = parsearExtractoBancolombia(await extraerTextoPdf(contenido));
      if (movimientos.length === 0) {
        throw new Error('No se encontraron movimientos en el PDF');
      }
      if (movimientos.some(m => !Number.isFinite(m.valor) || !/^\d{4}-\d{2}-\d{2}$/.test(m.fecha))) {
        throw new Error('Hay movimientos con fecha o valor ilegible');
      }

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
      const movimientos = parsearExtractoBbva(await extraerTextoPdf(contenido));
      if (movimientos.length === 0) {
        throw new Error('No se encontraron movimientos en el PDF');
      }
      if (movimientos.some(m => m.importe === null || !Number.isFinite(m.importe) || !m.fechaOperacion)) {
        throw new Error('Hay movimientos con fecha o importe ilegible');
      }

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
