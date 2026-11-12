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

interface SemanaSimulada {
  mes?: string;
  año?: number;
  semana?: number;
  saldoInicio: number;
  netoSemanal: number;
  saldoFinal: number;
  ingresosEstimados?: number;
  egresosEstimados?: number;
  cantidadLitros?: number;
  cantidadKilogramos?: number;
}

interface ResultadoSimulacion {
  semanaActual: number;
  saldoInicioSemanaActual: number;
  netoEstimadoActual: number;
  saldoFinalSemanaActual: number;
  semanaPositiva: SemanaSimulada | null;
  semanaNegativa: SemanaSimulada | null;
  prioridades?: string[];
  incluirIngresos?: string;
}

/**
 * Formateadores de moneda según rama (replicando comportamiento n8n)
 */
export const formatCurrencyESCO = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '$ 0';
  return value.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
};

export const formatCurrencyESCONoDecimals = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};

export const formatCurrencyENUS = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return 'N/A';
  return value < 0
    ? `-$${Math.abs(value).toLocaleString('en-US')}`
    : `$${value.toLocaleString('en-US')}`;
};

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

/**
 * Rama A: Simulación Normal (tipo_simulacion = "normal")
 * Recalcula todas las semanas futuras propagando saldos desde la última semana con banco.
 */
export async function simularNormal(): Promise<string> {
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

  if (semanasVacias.length === 0) {
    return '⚠️ No hay semanas futuras para simular.';
  }

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

  // 3. Buscar semanas clave
  const { semanaPositiva, semanaNegativa } = buscarSemanasClaves(semanasActualizadas);

  // 4. Semana actual (última con banco)
  const semanaActualRecs = await tabla
    .select({
      filterByFormula: '{Saldo Inicial Semana/Bancos} != BLANK()',
      sort: [{ field: 'Numeracion', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();

  const semanaActual = semanaActualRecs[0];

  // 5. Formatear resultado (es-CO, con decimales para actual, sin decimales para positiva/negativa)
  const saldoInicioActual = formatCurrencyESCO(
    Number(semanaActual?.get('Saldo Inicio Semana/Proyectado'))
  );
  const netoActual = formatCurrencyESCO(Number(semanaActual?.get('Neto Semanal/Proyectado')));
  const saldoFinalActual = formatCurrencyESCO(Number(semanaActual?.get('Saldo Final Semana/Proyectado')));

  const positivaData = semanaPositiva
    ? {
        semana: semanaPositiva.get('Semana formulada'),
        saldoInicio: formatCurrencyESCONoDecimals(
          Number(semanaPositiva.get('Saldo Inicio Semana/Proyectado'))
        ),
        neto: formatCurrencyESCONoDecimals(Number(semanaPositiva.get('Neto Semanal/Proyectado'))),
        saldoFinal: formatCurrencyESCONoDecimals(Number(semanaPositiva.get('Saldo Final Semana/Proyectado'))),
      }
    : null;

  const negativaData = semanaNegativa
    ? {
        semana: semanaNegativa.get('Semana formulada'),
        saldoInicio: formatCurrencyESCONoDecimals(
          Number(semanaNegativa.get('Saldo Inicio Semana/Proyectado'))
        ),
        neto: formatCurrencyESCONoDecimals(Number(semanaNegativa.get('Neto Semanal/Proyectado'))),
        saldoFinal: formatCurrencyESCONoDecimals(Number(semanaNegativa.get('Saldo Final Semana/Proyectado'))),
        litros: semanaNegativa.get('Cantidad Litros Deberia Vender (Biologicos)') || 0,
        kilos: semanaNegativa.get('Cantidad Kilogramos Deberia Vender (Biochar)') || 0,
      }
    : null;

  // 6. Construir texto (replicando template n8n)
  return `✅ ¡Simulación completada con éxito!

He realizado la proyección según la siguiente configuración:

🔹 Prioridades seleccionadas: N/A
🔹 Simulación con/sin ingresos: Con Ingresos

📅 Semana actual: ${semanaActual?.get('Semana formulada')}
🔄 Inicio de semana: ${saldoInicioActual}
🧮 Neto estimado: ${netoActual}
📦 Fin de semana proyectado: ${saldoFinalActual}

🟢 Semana hasta donde alcanza la caja: ${positivaData?.semana || 'N/A'}
🔄 Inicio de semana: ${positivaData?.saldoInicio || 'N/A'}
💵 Neto en esa semana: ${positivaData?.neto || 'N/A'}
✅ Fin de semana: ${positivaData?.saldoFinal || 'N/A'}

🔴 Semana que terminamos sin dinero: ${negativaData?.semana || 'N/A'}
🔄 Inicio de semana: ${negativaData?.saldoInicio || 'N/A'}
📉 Neto de esa semana: ${negativaData?.neto || 'N/A'}
❌ Fin de semana: ${negativaData?.saldoFinal || 'N/A'}

🛑 Para evitar cerrar en negativo:

🚰 Deberías vender ${negativaData?.litros || 0} litros de producto
🌱 O ${negativaData?.kilos || 0}kg de biochar`;
}

/**
 * Rama B: Prioridad + Con Ingresos
 * DESTRUCTIVO: sobrescribe semana actual y futuras.
 */
export async function simularPrioridadConIngresos(
  prioridades: string[]
): Promise<string> {
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

  // 4. Egresos filtrados por prioridad (REPLICANDO BUG: array como string en FIND)
  const prioridadesStr = JSON.stringify(prioridades); // ["Alta","Media"] → problema potencial en fórmula
  const condicionesPrioridad = prioridades
    .map(p => `AND(FIND("${p}", "${prioridadesStr}"), {Prioridad} = "${p}")`)
    .join(', ');

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

  const semanasActualizadas: AirtableRecord<FieldSet>[] = [SActualizado];

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

  // 7. Buscar semanas clave
  const { semanaPositiva, semanaNegativa } = buscarSemanasClaves(semanasActualizadas);

  // 8. Formatear (en-US)
  const formatActual = (field: string) =>
    formatCurrencyENUS(Number(SActualizado.fields[field]));

  const formatSemana = (semana: AirtableRecord<FieldSet> | null, field: string) =>
    formatCurrencyENUS(semana ? Number(semana.get(field)) : undefined);

  return `✅ ¡Simulación completada con éxito!

He realizado la proyección según la siguiente configuración:

🔹 Prioridades seleccionadas: ${prioridades.join(', ')}
🔹 Simulación con/sin ingresos: con_ingresos

📅 Semana actual: ${SActualizado.fields['Semana formulada']}
🔄 Inicio de semana: ${formatActual('Saldo Inicio Semana/Proyectado')}
🧮 Neto estimado: ${formatActual('Neto Semanal/Proyectado')}
📦 Fin de semana proyectado: ${formatActual('Saldo Final Semana/Proyectado')}

🧠 Nota técnica:
Dado que las prioridades están definidas únicamente para la semana actual (${SActualizado.fields['Semana formulada']}), el sistema ha aplicado estas configuraciones exclusivamente a dicha semana. Las semanas posteriores han sido proyectadas utilizando los datos estándar sin personalización de prioridades, con base en los ingresos y egresos habituales registrados por semana.

🟢 Semana hasta donde alcanza la caja: ${semanaPositiva?.get('Semana formulada') || 'N/A'}
🔄 Inicio de semana: ${formatSemana(semanaPositiva, 'Saldo Inicio Semana/Proyectado')}
💵 Neto en esa semana: ${formatSemana(semanaPositiva, 'Neto Semanal/Proyectado')}
✅ Fin de semana: ${formatSemana(semanaPositiva, 'Saldo Final Semana/Proyectado')}

🔴 Semana que terminamos sin dinero: ${semanaNegativa?.get('Semana formulada') || 'N/A'}
🔄 Inicio de semana: ${formatSemana(semanaNegativa, 'Saldo Inicio Semana/Proyectado')}
📉 Neto de esa semana: ${formatSemana(semanaNegativa, 'Neto Semanal/Proyectado')}
❌ Fin de semana: ${formatSemana(semanaNegativa, 'Saldo Final Semana/Proyectado')}

🛑 Para evitar cerrar en negativo:

🚰 Deberías vender ${semanaNegativa?.get('Cantidad Litros Deberia Vender (Biologicos)') || 0} litros de producto
🌱 O ${semanaNegativa?.get('Cantidad Kilogramos Deberia Vender (Biochar)') || 0}kg de biochar`;
}

/**
 * Rama C: Prioridad + Sin Ingresos
 * DESTRUCTIVO: sobrescribe semana actual y futuras.
 * BUG REPLICADO: Ignora prioridades seleccionadas, siempre filtra solo "Alta".
 */
export async function simularPrioridadSinIngresos(
  prioridades: string[] // Ignorado, siempre usa "Alta" (bug n8n)
): Promise<string> {
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

  const semanasActualizadas: AirtableRecord<FieldSet>[] = [SActualizado];

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

  // 6. Buscar semanas clave
  const { semanaPositiva, semanaNegativa } = buscarSemanasClaves(semanasActualizadas);

  // 7. Formatear (en-US)
  const formatActual = (field: string) =>
    formatCurrencyENUS(Number(SActualizado.fields[field]));

  const formatSemana = (semana: AirtableRecord<FieldSet> | null, field: string) =>
    formatCurrencyENUS(semana ? Number(semana.get(field)) : undefined);

  return `✅ ¡Simulación completada con éxito!

He realizado la proyección según la siguiente configuración:

🔹 Prioridades seleccionadas: ${prioridades.join(', ')}
🔹 Simulación con/sin ingresos: sin_ingresos
📅 Semana actual: ${SActualizado.fields['Semana formulada']}
🔄 Inicio de semana: ${formatActual('Saldo Inicio Semana/Proyectado')}
🧮 Neto estimado: ${formatActual('Neto Semanal/Proyectado')}
📦 Fin de semana proyectado: ${formatActual('Saldo Final Semana/Proyectado')}

🧠 Nota técnica:
Con base en la configuración proporcionada, las prioridades seleccionadas y la simulación sin ingresos se aplicaron exclusivamente a la semana actual (${SActualizado.fields['Semana formulada']}).
En esta semana, el sistema filtró y priorizó los egresos según las prioridades indicadas y eliminó todos los ingresos para proyectar un escenario más conservador.

Para las semanas posteriores, la simulación continúa únicamente con los egresos negativos proyectados, sin aplicar filtros de prioridad, ya que la lógica de priorización está programada solo para ejecutarse en la semana actual.

🟢 Semana hasta donde alcanza la caja: ${semanaPositiva?.get('Semana formulada') || 'No existe o tal vez sea esta semana 😟'}

🔄 Inicio de semana: ${formatSemana(semanaPositiva, 'Saldo Inicio Semana/Proyectado')}
💵 Neto en esa semana: ${formatSemana(semanaPositiva, 'Neto Semanal/Proyectado')}
✅ Fin de semana: ${formatSemana(semanaPositiva, 'Saldo Final Semana/Proyectado')}

🔴 Semana que terminamos sin dinero: ${semanaNegativa?.get('Semana formulada') || 'N/A'}
🔄 Inicio de semana: ${formatSemana(semanaNegativa, 'Saldo Inicio Semana/Proyectado')}
📉 Neto de esa semana: ${formatSemana(semanaNegativa, 'Neto Semanal/Proyectado')}
❌ Fin de semana: ${formatSemana(semanaNegativa, 'Saldo Final Semana/Proyectado')}

🛑 Para evitar cerrar en negativo:

🚰 Deberías vender ${semanaNegativa?.get('Cantidad Litros Deberia Vender (Biologicos)') || 0} litros de producto
🌱 O ${semanaNegativa?.get('Cantidad Kilogramos Deberia Vender (Biochar)') || 0}kg de biochar`;
}
