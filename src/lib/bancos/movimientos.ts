/**
 * Lectura de movimientos bancarios: cada banco tiene su tabla y sus propios campos,
 * y aquí se normalizan a un formato común para la UI.
 */

import Airtable, { type FieldSet, type Record as RegistroAirtable, type Table } from 'airtable';
import type { BancoId } from './cuentas';
import type {
  MovimientoBancario,
  PeriodoMovimientos,
  ResumenCuenta,
  TonoSoporte,
} from '@/types/movimientos-bancarios';

const texto = (valor: unknown): string => {
  if (Array.isArray(valor)) return [...new Set(valor.map(texto).filter(Boolean))].join(', ');
  if (valor === null || valor === undefined || typeof valor === 'object') return '';
  return String(valor).trim();
};

const numero = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null;

const vinculos = (valor: unknown): number => (Array.isArray(valor) ? valor.length : 0);

const si = (valor: unknown) => (valor ? 'Sí' : 'No');

/** 2026-09-14 → 14/09/2026 */
const fechaCorta = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso);

function datos(pares: [string, string][]): MovimientoBancario['datos'] {
  return pares.filter(([, valor]) => valor !== '').map(([etiqueta, valor]) => ({ etiqueta, valor }));
}

/** "✅ legalizada" → { texto: 'legalizada', tono: 'ok' } */
function soporteLegalizacion(legalizacion: string): MovimientoBancario['soporte'] {
  if (!legalizacion) return null;
  const tono: TonoSoporte = legalizacion.startsWith('✅')
    ? 'ok'
    : legalizacion.startsWith('❌')
      ? 'pendiente'
      : 'neutro';
  return { texto: legalizacion.replace(/^\p{Extended_Pictographic}️?\s*/u, ''), tono };
}

interface DefinicionTabla {
  variableTabla: 'AIRTABLE_MOVIMIENTOS_TABLE_ID' | 'AIRTABLE_BBVA_TABLE_ID';
  campoSaldo: string;
  campos: string[];
  normalizar: (registro: RegistroAirtable<FieldSet>) => MovimientoBancario;
}

// "Centro de Costos " lleva un espacio al final en ambas tablas de Airtable
const DEFINICIONES: Record<BancoId, DefinicionTabla> = {
  bancolombia: {
    variableTabla: 'AIRTABLE_MOVIMIENTOS_TABLE_ID',
    campoSaldo: 'Saldo_Bancario_Actual',
    campos: [
      'Fecha', 'Descripción', 'Valor', 'Saldo_Bancario_Anterior', 'Saldo_Bancario_Actual',
      'Clasificacion', 'Tipo de Movimiento (Apoyo)', 'Unidad de Negocio', 'Centro de Costos ',
      'Centro de Resultados (Solo Ingresos)', 'Tipo de Flujo', 'Fijo o Variable', 'AFECTA',
      'Legalización', 'GRUPO PRUEBA', 'CLASE PRUEBA', 'CUENTA PRUEBA',
      'Facturacion Egresos', 'Facturacion Ingresos', 'CuentasCobro', 'Centralizada',
    ],
    normalizar: ({ id, fields: f }) => ({
      id,
      fecha: texto(f['Fecha']),
      descripcion: texto(f['Descripción']) || 'Sin descripción',
      detalle: [texto(f['Clasificacion']), texto(f['Unidad de Negocio'])].filter(Boolean).join(' · '),
      valor: numero(f['Valor']) ?? 0,
      saldoAnterior: numero(f['Saldo_Bancario_Anterior']),
      saldo: numero(f['Saldo_Bancario_Actual']),
      tipoFlujo: texto(f['Tipo de Flujo']),
      centroCostos: texto(f['Centro de Costos ']),
      soporte: soporteLegalizacion(texto(f['Legalización'])),
      datos: datos([
        ['Clasificación', texto(f['Clasificacion'])],
        ['Tipo de movimiento', texto(f['Tipo de Movimiento (Apoyo)'])],
        ['Unidad de negocio', texto(f['Unidad de Negocio'])],
        ['Centro de costos', texto(f['Centro de Costos '])],
        ['Centro de resultados', texto(f['Centro de Resultados (Solo Ingresos)'])],
        ['Tipo de flujo', texto(f['Tipo de Flujo'])],
        ['Fijo o variable', texto(f['Fijo o Variable'])],
        ['Afecta', texto(f['AFECTA'])],
        ['Grupo', texto(f['GRUPO PRUEBA'])],
        ['Clase', texto(f['CLASE PRUEBA'])],
        ['Cuenta', texto(f['CUENTA PRUEBA'])],
        ['Facturas de egreso vinculadas', String(vinculos(f['Facturacion Egresos']))],
        ['Facturas de ingreso vinculadas', String(vinculos(f['Facturacion Ingresos']))],
        ['Cuentas de cobro vinculadas', String(vinculos(f['CuentasCobro']))],
        ['Centralizada', si(f['Centralizada'])],
      ]),
    }),
  },
  bbva: {
    variableTabla: 'AIRTABLE_BBVA_TABLE_ID',
    campoSaldo: 'Saldo Bancario Actual',
    campos: [
      'Fecha', 'F Valor', 'Codigo', 'Concepto', 'Descripción', 'Importe',
      'Saldo Bancario Anterior', 'Saldo Bancario Actual', 'Centro de Costos ', 'Tipo de Flujo',
      'Naturaleza Contable', 'Fijo o Variable', 'Facturacion Egresos Real', 'CuentasCobro',
      'Proyecto de Inversión (from Proyecto de Inversión (from Proyecto))',
      'GRUPO', 'CLASE', 'CUENTA', 'U.N', 'Centralizada',
    ],
    normalizar: ({ id, fields: f }) => {
      const concepto = texto(f['Concepto']);
      const descripcion = texto(f['Descripción']);
      const facturas = vinculos(f['Facturacion Egresos Real']);
      return {
        id,
        fecha: texto(f['Fecha']),
        // Descripción la escribe el equipo; Concepto es el texto original del extracto
        descripcion: descripcion || concepto || 'Sin descripción',
        detalle: descripcion ? concepto : '',
        valor: numero(f['Importe']) ?? 0,
        saldoAnterior: numero(f['Saldo Bancario Anterior']),
        saldo: numero(f['Saldo Bancario Actual']),
        tipoFlujo: texto(f['Tipo de Flujo']),
        centroCostos: texto(f['Centro de Costos ']),
        soporte: facturas > 0
          ? { texto: facturas === 1 ? 'factura vinculada' : `${facturas} facturas vinculadas`, tono: 'ok' }
          : null,
        datos: datos([
          ['Concepto del banco', concepto],
          ['Código', texto(f['Codigo'])],
          ['Fecha valor', fechaCorta(texto(f['F Valor']))],
          ['Centro de costos', texto(f['Centro de Costos '])],
          ['Tipo de flujo', texto(f['Tipo de Flujo'])],
          ['Naturaleza contable', texto(f['Naturaleza Contable'])],
          ['Proyecto de inversión', texto(f['Proyecto de Inversión (from Proyecto de Inversión (from Proyecto))'])],
          ['Fijo o variable', texto(f['Fijo o Variable'])],
          ['Unidad de negocio', texto(f['U.N'])],
          ['Grupo', texto(f['GRUPO'])],
          ['Clase', texto(f['CLASE'])],
          ['Cuenta', texto(f['CUENTA'])],
          ['Facturas de egreso vinculadas', String(facturas)],
          ['Cuentas de cobro vinculadas', String(vinculos(f['CuentasCobro']))],
          ['Centralizada', si(f['Centralizada'])],
        ]),
      };
    },
  },
};

function tabla(banco: BancoId): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  const variable = DEFINICIONES[banco].variableTabla;
  const tablaId = process.env[variable];
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !tablaId) {
    throw new Error(`Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o ${variable}`);
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(tablaId);
}

/** El último movimiento por ID_Numerico es el mismo del que parte la cadena de saldos al importar. */
export async function resumenCuenta(banco: BancoId): Promise<ResumenCuenta> {
  const { campoSaldo } = DEFINICIONES[banco];
  const [ultimo] = await tabla(banco)
    .select({ sort: [{ field: 'ID_Numerico', direction: 'desc' }], maxRecords: 1, fields: ['Fecha', campoSaldo] })
    .firstPage();
  return {
    saldoActual: numero(ultimo?.get(campoSaldo)),
    fechaUltimoMovimiento: texto(ultimo?.get('Fecha')) || null,
  };
}

export async function movimientosDelPeriodo(banco: BancoId, periodo: PeriodoMovimientos): Promise<MovimientoBancario[]> {
  const { campos, normalizar } = DEFINICIONES[banco];
  const filtros = [`YEAR({Fecha}) = ${periodo.año}`];
  if (periodo.mes) filtros.push(`MONTH({Fecha}) = ${periodo.mes}`);

  const registros = await tabla(banco)
    .select({
      filterByFormula: `AND(${filtros.join(', ')})`,
      fields: campos,
      sort: [
        { field: 'Fecha', direction: 'desc' },
        { field: 'ID_Numerico', direction: 'desc' },
      ],
    })
    .all();

  return registros.map(normalizar);
}
