import Airtable, { type FieldSet, type Record as AirtableRecord, type Table } from 'airtable';
import { actualizarEnLotes } from '@/lib/importacion/archivos-pendientes';
import { mapaSemanas } from '@/lib/centralizacion-semanal';

function tablaProyecciones(): Table<FieldSet> {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_PROYECCIONES_TABLE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_PROYECCIONES_TABLE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY, AIRTABLE_BASE_ID o AIRTABLE_PROYECCIONES_TABLE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID)(AIRTABLE_PROYECCIONES_TABLE_ID);
}

/**
 * Clave para vincular una proyección con Centralización General.
 * Formato: "año|semana"
 */
export function claveProyeccion(proyeccion: AirtableRecord<FieldSet>): string {
  return `${proyeccion.get('Año formulado')}|${proyeccion.get('Semana formulada')}`;
}

/**
 * Vincula proyecciones sin Centralización General con sus semanas correspondientes.
 * Busca proyecciones donde {Centralización General} = BLANK(), y las vincula por
 * Año formulado + Semana formulada.
 *
 * @returns Objeto con estadísticas: total procesadas, vinculadas y sin vincular
 */
export async function vincularProyecciones(): Promise<{
  procesadas: number;
  vinculadas: number;
  sinVincular: number;
}> {
  const tabla = tablaProyecciones();

  // Buscar proyecciones sin vínculo a Centralización General
  const proyeccionesSinVincular = await tabla
    .select({
      filterByFormula: '{Centralización General} = BLANK()',
      fields: ['Año formulado', 'Semana formulada', 'Mes', 'Concepto'],
    })
    .all();

  if (proyeccionesSinVincular.length === 0) {
    return { procesadas: 0, vinculadas: 0, sinVincular: 0 };
  }

  // Obtener años únicos de las proyecciones
  const anios = [...new Set(proyeccionesSinVincular.map(p => Number(p.get('Año formulado'))))];

  // Leer Centralización General UNA sola vez e indexar por año|semana
  const semanas = await mapaSemanas(anios);

  // Vincular cada proyección
  const actualizaciones: { id: string; fields: FieldSet }[] = [];
  let sinVincular = 0;

  for (const proyeccion of proyeccionesSinVincular) {
    const clave = claveProyeccion(proyeccion);
    const semanaId = semanas.get(clave);

    if (semanaId) {
      actualizaciones.push({
        id: proyeccion.id,
        fields: {
          'Centralización General': [semanaId],
          Automatizacion_Check: true,
        },
      });
    } else {
      sinVincular++;
      console.warn(
        `⚠️ No se encontró Centralización General para: ${clave} (${proyeccion.get('Concepto')})`
      );
    }
  }

  // Actualizar en lotes de 10
  await actualizarEnLotes(tabla, actualizaciones);

  return {
    procesadas: proyeccionesSinVincular.length,
    vinculadas: actualizaciones.length,
    sinVincular,
  };
}
