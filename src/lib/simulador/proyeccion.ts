import Airtable, { type FieldSet, type Record as AirtableRecord, type Table } from 'airtable';
import { actualizarEnLotes } from '@/lib/importacion/archivos-pendientes';

function base(): Airtable.Base {
  const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    throw new Error('Faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID');
  }
  return new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
}

function tablaCentralizacion(): Table<FieldSet> {
  const { AIRTABLE_CENTRALIZACION_TABLE_ID } = process.env;
  if (!AIRTABLE_CENTRALIZACION_TABLE_ID) {
    throw new Error('Falta AIRTABLE_CENTRALIZACION_TABLE_ID');
  }
  return base()(AIRTABLE_CENTRALIZACION_TABLE_ID);
}

function tablaProyecciones(): Table<FieldSet> {
  const { AIRTABLE_PROYECCIONES_TABLE_ID } = process.env;
  if (!AIRTABLE_PROYECCIONES_TABLE_ID) {
    throw new Error('Falta AIRTABLE_PROYECCIONES_TABLE_ID');
  }
  return base()(AIRTABLE_PROYECCIONES_TABLE_ID);
}

export interface SemanaProyectada {
  id: string;
  semana: number;
  anio: number;
  mes: string;
  saldoInicio: number;
  neto: number;
  saldoFinal: number;
}

export interface InformeSimulacion {
  incluirIngresos: 'con_ingresos' | 'sin_ingresos';
  prioridades: string[];
  semanaActual: SemanaProyectada | null;
  semanaPositiva: SemanaProyectada | null;
  semanaNegativa: SemanaProyectada | null;
  litrosParaEvitarNegativo: number;
  kilosParaEvitarNegativo: number;
  proyeccion: SemanaProyectada[];
  notaTecnica: string | null;
}

const valorNumero = (valor: unknown): number => Number(valor) || 0;

function aSemana(rec: AirtableRecord<FieldSet>): SemanaProyectada {
  const mes = rec.get('Mes');
  return {
    id: rec.id,
    semana: valorNumero(rec.get('Semana formulada')),
    anio: valorNumero(rec.get('Año formulado')),
    mes: mes ? String(mes) : '',
    saldoInicio: valorNumero(rec.get('Saldo Inicio Semana/Proyectado')),
    neto: valorNumero(rec.get('Neto Semanal/Proyectado')),
    saldoFinal: valorNumero(rec.get('Saldo Final Semana/Proyectado')),
  };
}

/**
 * Busca semana positiva (última con saldo inicio y fin > 0)
 * y semana negativa (primera con inicio > 0 y fin < 0)
 */
function buscarSemanasClaves(semanas: AirtableRecord<FieldSet>[]): {
  semanaPositiva: AirtableRecord<FieldSet> | null;
  semanaNegativa: AirtableRecord<FieldSet> | null;
} {
  // Ordenar descendente por semana formulada
  const descendente = [...semanas].sort(
    (a, b) => Number(b.get('Semana formulada')) - Number(a.get('Semana formulada'))
  );

  let semanaPositiva: AirtableRecord<FieldSet> | null = null;
  for (const semana of descendente) {
    const inicio = Number(semana.get('Saldo Inicio Semana/Proyectado')) || 0;
    const fin = Number(semana.get('Saldo Final Semana/Proyectado')) || 0;
    if (inicio > 0 && fin > 0) {
      semanaPositiva = semana;
      break;
    }
  }

  // Ordenar ascendente
  const ascendente = [...semanas].sort(
    (a, b) => Number(a.get('Semana formulada')) - Number(b.get('Semana formulada'))
  );

  let semanaNegativa: AirtableRecord<FieldSet> | null = null;
  for (const semana of ascendente) {
    const inicio = Number(semana.get('Saldo Inicio Semana/Proyectado')) || 0;
    const fin = Number(semana.get('Saldo Final Semana/Proyectado')) || 0;
    if (inicio > 0 && fin < 0) {
      semanaNegativa = semana;
      break;
    }
  }

  return { semanaPositiva, semanaNegativa };
}

function armarInforme(
  semanaActual: AirtableRecord<FieldSet> | undefined,
  semanasFuturas: AirtableRecord<FieldSet>[],
  opciones: {
    incluirIngresos: InformeSimulacion['incluirIngresos'];
    prioridades: string[];
    notaTecnica: string | null;
    // n8n evalúa la semana actual al buscar semanas clave solo en las ramas con prioridad
    actualCuentaParaClaves: boolean;
  }
): InformeSimulacion {
  const evaluadas =
    opciones.actualCuentaParaClaves && semanaActual ? [semanaActual, ...semanasFuturas] : semanasFuturas;
  const { semanaPositiva, semanaNegativa } = buscarSemanasClaves(evaluadas);

  return {
    incluirIngresos: opciones.incluirIngresos,
    prioridades: opciones.prioridades,
    semanaActual: semanaActual ? aSemana(semanaActual) : null,
    semanaPositiva: semanaPositiva ? aSemana(semanaPositiva) : null,
    semanaNegativa: semanaNegativa ? aSemana(semanaNegativa) : null,
    litrosParaEvitarNegativo: valorNumero(
      semanaNegativa?.get('Cantidad Litros Deberia Vender (Biologicos)')
    ),
    kilosParaEvitarNegativo: valorNumero(
      semanaNegativa?.get('Cantidad Kilogramos Deberia Vender (Biochar)')
    ),
    proyeccion: (semanaActual ? [semanaActual, ...semanasFuturas] : semanasFuturas).map(aSemana),
    notaTecnica: opciones.notaTecnica,
  };
}

/**
 * Rama A: Simulación Normal (tipo_simulacion = "normal")
 * Recalcula todas las semanas futuras propagando saldos desde la última semana con banco.
 */
export async function simularNormal(): Promise<InformeSimulacion> {
  const tabla = tablaCentralizacion();
  const anioActual = new Date().getFullYear();

  // 1. Semanas futuras sin banco (vista "Saldos Bancarios Reales Vacios")
  const semanasVacias = await tabla
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} = BLANK()',
      sort: [{ field: 'Fecha de creacion', direction: 'asc' }],
      fields: [
        'ID',
        'Semana formulada',
        'Año formulado',
        'Mes',
        'Ingresos Estimados',
        'Egresos Estimados',
        'Saldo Inicio Semana/Proyectado',
        'Neto Semanal/Proyectado',
        'Saldo Final Semana/Proyectado',
      ],
    })
    .all();

  // 2. Propagación en cascada (Loop secuencial)
  const semanasActualizadas: AirtableRecord<FieldSet>[] = [];

  for (const semana of semanasVacias) {
    const semanaNum = Number(semana.get('Semana formulada'));
    const posicionAnterior = semanaNum - 1;

    // Buscar semana anterior
    const semanaAnterior = await tabla
      .select({
        filterByFormula: `AND({Semana formulada} = ${posicionAnterior}, {Año formulado} = ${anioActual})`,
        maxRecords: 1,
      })
      .firstPage();

    if (semanaAnterior.length === 0) {
      console.warn(`⚠️ No se encontró semana anterior ${posicionAnterior} para semana ${semanaNum}`);
      continue;
    }

    const P = semanaAnterior[0];

    // Actualizar Neto de P
    const netoP = Number(P.get('Ingresos Estimados') || 0) + Number(P.get('Egresos Estimados') || 0);
    await tabla.update(P.id, { 'Neto Semanal/Proyectado': netoP });

    // Releer P para obtener Saldo Final calculado
    const PActualizado = await tabla.find(P.id);
    const saldoFinalP = Number(PActualizado.get('Saldo Final Semana/Proyectado')) || 0;

    // Actualizar Saldo Inicio de W
    await tabla.update(semana.id, { 'Saldo Inicio Semana/Proyectado': saldoFinalP });

    // Actualizar Neto de W
    const netoW =
      Number(semana.get('Ingresos Estimados') || 0) + Number(semana.get('Egresos Estimados') || 0);
    const WActualizado = await tabla.update(semana.id, { 'Neto Semanal/Proyectado': netoW });

    semanasActualizadas.push(WActualizado);
  }

  // 3. Semana actual (última con banco)
  const semanaActualRecs = await tabla
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} != BLANK()',
      sort: [{ field: 'Numeracion', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();

  return armarInforme(semanaActualRecs[0], semanasActualizadas, {
    incluirIngresos: 'con_ingresos',
    prioridades: [],
    notaTecnica: null,
    actualCuentaParaClaves: false,
  });
}

/**
 * Rama B: Prioridad + Con Ingresos
 * DESTRUCTIVO: sobrescribe semana actual y futuras.
 */
export async function simularPrioridadConIngresos(
  prioridades: string[]
): Promise<InformeSimulacion> {
  const tablaCentral = tablaCentralizacion();
  const tablaProyec = tablaProyecciones();
  const anioActual = new Date().getFullYear();

  // 1. Semana actual (última con banco)
  const semanaActualRecs = await tablaCentral
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} != BLANK()',
      sort: [{ field: 'Numeracion', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();

  const S = semanaActualRecs[0];
  const idSemanaActual = S.get('ID') as string;

  // 2. Semana anterior
  const semanaAnteriorRecs = await tablaCentral
    .select({
      filterByFormula: `AND({Semana formulada} = ${Number(S.get('Semana formulada')) - 1}, {Año formulado} = ${anioActual})`,
      maxRecords: 1,
    })
    .firstPage();

  const P = semanaAnteriorRecs[0];

  // 3. Ingresos de semana actual
  const proyeccionesIngresos = await tablaProyec
    .select({
      filterByFormula: `AND({Año formulado} = ${anioActual}, FIND("${idSemanaActual}", {Centralización General}), {Vr.Presupuesto} > 0, OR({Tipo de Proyección} = "Ingresos Contables (Por Facturación)", {Tipo de Proyección} = "Otros Ingresos"))`,
    })
    .all();

  let ingresosEstimados = 0;
  for (const proy of proyeccionesIngresos) {
    ingresosEstimados += Number(proy.get('Vr.Presupuesto')) || 0;
  }

  // 4. Egresos filtrados por prioridad (valores validados en la ruta: Alta | Media | Baja)
  const condicionesPrioridad = prioridades.map(p => `{Prioridad} = "${p}"`).join(', ');

  const proyeccionesEgresos = await tablaProyec
    .select({
      filterByFormula: `AND({Centralización General} = "${idSemanaActual}", OR(${condicionesPrioridad}), {Vr.Presupuesto} < 0)`,
    })
    .all();

  let egresosEstimados = 0;
  for (const proy of proyeccionesEgresos) {
    egresosEstimados += Number(proy.get('Vr.Presupuesto')) || 0;
  }

  // 5. Actualizar semana actual (DESTRUCTIVO)
  const saldoFinalP = Number(P?.get('Saldo Final Semana/Proyectado')) || 0;
  const totalIngresosEgresos = ingresosEstimados + egresosEstimados;

  const SActualizado = await tablaCentral.update(S.id, {
    'Saldo Inicio Semana/Proyectado': saldoFinalP,
    'Neto Semanal/Proyectado': totalIngresosEgresos,
  });

  // 6. Semanas futuras vacías
  const semanasVacias = await tablaCentral
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} = BLANK()',
      sort: [{ field: 'Fecha de creacion', direction: 'asc' }],
    })
    .all();

  const semanasActualizadas: AirtableRecord<FieldSet>[] = [];

  for (const W of semanasVacias) {
    const semanaNum = Number(W.get('Semana formulada'));
    const posicionAnterior = semanaNum - 1;

    const PW = await tablaCentral
      .select({
        filterByFormula: `AND({Semana formulada} = ${posicionAnterior}, {Año formulado} = ${anioActual})`,
        maxRecords: 1,
      })
      .firstPage();

    if (PW.length === 0) continue;

    const saldoFinalPW = Number(PW[0].get('Saldo Final Semana/Proyectado')) || 0;
    const netoW = Number(W.get('Ingresos Estimados') || 0) + Number(W.get('Egresos Estimados') || 0);

    const WActualizado = await tablaCentral.update(W.id, {
      'Saldo Inicio Semana/Proyectado': saldoFinalPW,
      'Neto Semanal/Proyectado': netoW,
    });

    semanasActualizadas.push(WActualizado);
  }

  const semanaActualNum = SActualizado.get('Semana formulada');
  return armarInforme(SActualizado, semanasActualizadas, {
    incluirIngresos: 'con_ingresos',
    prioridades,
    notaTecnica: `Las prioridades están definidas únicamente para la semana actual (${semanaActualNum}), así que el sistema las aplicó solo a esa semana. Las semanas posteriores se proyectaron con los datos estándar, sin personalización de prioridades, con base en los ingresos y egresos habituales registrados por semana.`,
    actualCuentaParaClaves: true,
  });
}

/**
 * Rama C: Prioridad + Sin Ingresos
 * DESTRUCTIVO: sobrescribe semana actual y futuras.
 * BUG REPLICADO: Ignora prioridades seleccionadas, siempre filtra solo "Alta".
 */
export async function simularPrioridadSinIngresos(
  prioridades: string[] // Ignorado, siempre usa "Alta" (bug n8n)
): Promise<InformeSimulacion> {
  const tablaCentral = tablaCentralizacion();
  const tablaProyec = tablaProyecciones();
  const anioActual = new Date().getFullYear();

  // 1. Semana actual
  const semanaActualRecs = await tablaCentral
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} != BLANK()',
      sort: [{ field: 'Numeracion', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();

  const S = semanaActualRecs[0];
  const idSemanaActual = S.get('ID') as string;

  // 2. Semana anterior
  const semanaAnteriorRecs = await tablaCentral
    .select({
      filterByFormula: `AND({Semana formulada} = ${Number(S.get('Semana formulada')) - 1}, {Año formulado} = ${anioActual})`,
      maxRecords: 1,
    })
    .firstPage();

  const P = semanaAnteriorRecs[0];

  // 3. Solo egresos con prioridad ALTA (hardcoded - bug replicado)
  const proyeccionesEgresos = await tablaProyec
    .select({
      filterByFormula: `AND({Centralización General} = "${idSemanaActual}", AND(FIND("Alta", "Alta"), {Prioridad} = "Alta"), {Vr.Presupuesto} < 0)`,
    })
    .all();

  let egresosEstimados = 0;
  for (const proy of proyeccionesEgresos) {
    egresosEstimados += Number(proy.get('Vr.Presupuesto')) || 0;
  }

  // 4. Actualizar semana actual (sin ingresos)
  const saldoFinalP = Number(P?.get('Saldo Final Semana/Proyectado')) || 0;

  const SActualizado = await tablaCentral.update(S.id, {
    'Saldo Inicio Semana/Proyectado': saldoFinalP,
    'Neto Semanal/Proyectado': egresosEstimados, // Solo egresos
  });

  // 5. Semanas futuras (solo egresos estimados, sin ingresos)
  const semanasVacias = await tablaCentral
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} = BLANK()',
      sort: [{ field: 'Fecha de creacion', direction: 'asc' }],
    })
    .all();

  const semanasActualizadas: AirtableRecord<FieldSet>[] = [];

  for (const W of semanasVacias) {
    const semanaNum = Number(W.get('Semana formulada'));
    const posicionAnterior = semanaNum - 1;

    const PW = await tablaCentral
      .select({
        filterByFormula: `AND({Semana formulada} = ${posicionAnterior}, {Año formulado} = ${anioActual})`,
        maxRecords: 1,
      })
      .firstPage();

    if (PW.length === 0) continue;

    const saldoFinalPW = Number(PW[0].get('Saldo Final Semana/Proyectado')) || 0;
    const egresosW = Number(W.get('Egresos Estimados') || 0); // Solo egresos

    const WActualizado = await tablaCentral.update(W.id, {
      'Saldo Inicio Semana/Proyectado': saldoFinalPW,
      'Neto Semanal/Proyectado': egresosW,
    });

    semanasActualizadas.push(WActualizado);
  }

  const semanaActualNum = SActualizado.get('Semana formulada');
  return armarInforme(SActualizado, semanasActualizadas, {
    incluirIngresos: 'sin_ingresos',
    prioridades,
    notaTecnica: `Las prioridades seleccionadas y la simulación sin ingresos se aplicaron solo a la semana actual (${semanaActualNum}): en esa semana el sistema filtró los egresos por prioridad y eliminó todos los ingresos para proyectar un escenario conservador. Las semanas posteriores continúan únicamente con los egresos proyectados, sin filtro de prioridad.`,
    actualCuentaParaClaves: true,
  });
}
