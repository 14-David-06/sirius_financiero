/**
 * Parseo de extractos PDF, portado de los nodos Code de los workflows n8n
 * AUTOMA_Movimientos_Bancarios (Bancolombia) y AUTOMA_Movimientos_Bancarios_BBVA.
 * Reciben el texto de `extraerTextoPdf`.
 */

export interface MovimientoBancolombia {
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  valor: number;
}

export interface MovimientoBbva {
  fechaOperacion: string | null; // YYYY-MM-DD
  fechaValor: string | null;
  codigo: string | undefined;
  concepto: string;
  importe: number | null;
  saldo: number | null;
}

const VILLANUEVA_CASANARE = /VILLANUEVA\s*CASANARE/g;

function extraerValorDeDescripcion(descripcion: string): number | null {
  const coincidencia = descripcion.match(/(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:-\s*\d*Página.*)?$/);
  return coincidencia ? Number(coincidencia[1].replace(/,/g, '')) : null;
}

function limpiarDescripcionBancolombia(descripcion: string): string {
  return descripcion
    .replace(/\s+[-]?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:-\s*\d*Página.*)?$/, '')
    .replace(/^-\s*/, '')
    .trim();
}

/** Filas "YYYY/MM/DD", descripción y valor en formato 1,234.56; resultado ordenado por fecha. */
export function parsearExtractoBancolombia(texto: string): MovimientoBancolombia[] {
  const filas = texto
    .replace(/Empresa:[\s\S]*?SAS ZOMAC/, '')
    .split(/\n(?=\d{4}\/\d{2}\/\d{2})/)
    .filter(fila => /^\d{4}\/\d{2}\/\d{2}/.test(fila));

  const movimientos = filas.map(fila => {
    const columnas = fila.split('\n').filter(columna => columna.trim() !== '');
    const fecha = columnas[0].trim();
    const ultimaColumna = columnas[columnas.length - 1].trim();
    const descripcionInicial = columnas.slice(1, columnas.length - 1).join(' ').trim().replace(VILLANUEVA_CASANARE, '').trim();
    const descripcionValor = `${descripcionInicial} - ${ultimaColumna}`.replace(VILLANUEVA_CASANARE, '').trim();

    // n8n solo quitaba la primera coma aquí; el resto lo resuelve la limpieza final
    const coincidencia = descripcionValor.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/);
    const valorTexto = coincidencia ? coincidencia[0].replace(',', '') : '';
    let descripcion = descripcionValor.replace(valorTexto, '').trim();
    let valor = Number(valorTexto.replace(/,/g, ''));

    if ((valor === 0 || isNaN(parseFloat(valorTexto))) && descripcion) {
      const valorExtraido = extraerValorDeDescripcion(descripcion);
      if (valorExtraido !== null) valor = valorExtraido;
    }
    descripcion = limpiarDescripcionBancolombia(descripcion);

    return { fecha: fecha.replace(/\//g, '-'), descripcion, valor };
  });

  // Orden estable: dentro del mismo día se conserva el orden del PDF
  return movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function fechaBbvaAIso(fecha: string | undefined): string | null {
  if (!fecha) return null;
  const [dia, mes, anio] = fecha.split('/');
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function numeroBbva(texto: string | undefined): number | null {
  if (!texto) return null;
  return parseFloat(texto.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
}

/** Línea: "DD/MM/YYYY DD/MM/YYYY <ref> <código> <concepto…> <importe> COP <saldo> COP …" */
function parsearLineaBbva(linea: string): MovimientoBbva {
  const partes = linea.split(' ');
  const indicePrimerCop = partes.findIndex(parte => parte === 'COP');
  const indiceSegundoCop = partes.findIndex((parte, indice) => parte === 'COP' && indice > indicePrimerCop);

  return {
    fechaOperacion: fechaBbvaAIso(partes[0]),
    fechaValor: fechaBbvaAIso(partes[1]),
    codigo: partes[3],
    concepto: partes.slice(4, indicePrimerCop - 1).join(' '),
    importe: numeroBbva(partes[indicePrimerCop - 1]),
    saldo: numeroBbva(partes[indiceSegundoCop - 1]),
  };
}

/** El PDF lista del más reciente al más antiguo; se devuelven del más antiguo al más reciente. */
export function parsearExtractoBbva(texto: string): MovimientoBbva[] {
  const normalizado = texto
    .replace(/(\d{2}\/\d{2})\s*\n\s*\/(\d{4})/g, '$1/$2')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalizado
    .split(/(?=\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4})/)
    .map(bloque => bloque.trim())
    .filter(bloque => /^\d{2}\/\d{2}\/\d{4}/.test(bloque))
    .map(parsearLineaBbva)
    .reverse();
}
