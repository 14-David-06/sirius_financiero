import Airtable, { type FieldSet, type Record as AirtableRecord, type Table } from 'airtable';
import { actualizarEnLotes, crearEnLotes } from '@/lib/importacion/archivos-pendientes';

function tablaCentralizacion(): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_CENTRALIZACION_TABLE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_CENTRALIZACION_TABLE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o AIRTABLE_CENTRALIZACION_TABLE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(AIRTABLE_CENTRALIZACION_TABLE_ID);
}

function semanasDelAnio(tabla: Table<FieldSet>, anio: number) {
  return tabla
    .select({ filterByFormula: `{Año formulado} = ${anio}`, fields: ['Año formulado', 'Semana formulada'] })
    .all();
}

/** Una fila cada 7 días desde el 1 de enero, como en n8n; las fórmulas calculan año y semana. */
async function crearSemanasDelAnio(tabla: Table<FieldSet>, anio: number): Promise<void> {
  const registros: { fields: FieldSet }[] = [];
  for (let dia = 0; ; dia += 7) {
    const fecha = new Date(Date.UTC(anio, 0, 1 + dia));
    if (fecha.getUTCFullYear() !== anio) break;
    registros.push({ fields: { 'Fecha de creacion': fecha.toISOString().slice(0, 10) } });
  }
  await crearEnLotes(tabla, registros, [], { typecast: true });
}

/** "año|semana" → ID de Centralización General; crea las semanas de un año si no tiene ninguna. */
export async function mapaSemanas(anios: number[]): Promise<Map<string, string>> {
  const tabla = tablaCentralizacion();
  const semanas = new Map<string, string>();

  for (const anio of anios) {
    let registros = await semanasDelAnio(tabla, anio);
    if (registros.length === 0) {
      await crearSemanasDelAnio(tabla, anio);
      registros = await semanasDelAnio(tabla, anio);
    }
    for (const registro of registros) {
      semanas.set(`${registro.get('Año formulado')}|${registro.get('Semana formulada')}`, registro.id);
    }
  }

  return semanas;
}

export function claveSemanaMovimiento(movimiento: AirtableRecord<FieldSet>): string {
  return `${movimiento.get('Año formulado')}|${movimiento.get('Numero semana formulado')}`;
}

/**
 * Vincula cada movimiento con su semana de Centralización General según sus fórmulas
 * "Año formulado" y "Numero semana formulado". Devuelve cuántos quedaron sin semana.
 */
export async function vincularSemanas(
  tablaMovimientos: Table<FieldSet>,
  movimientos: AirtableRecord<FieldSet>[]
): Promise<number> {
  const semanas = await mapaSemanas([...new Set(movimientos.map(movimiento => Number(movimiento.get('Año formulado'))))]);

  const actualizaciones: { id: string; fields: FieldSet }[] = [];
  let sinSemana = 0;
  for (const movimiento of movimientos) {
    const semanaId = semanas.get(claveSemanaMovimiento(movimiento));
    if (semanaId) {
      actualizaciones.push({ id: movimiento.id, fields: { Centralizada: true, 'Centralización General': [semanaId] } });
    } else {
      sinSemana++;
    }
  }

  await actualizarEnLotes(tablaMovimientos, actualizaciones);
  return sinSemana;
}
