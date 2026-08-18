/**
 * Resolución de categorías de acceso a partir de los datos de Sirius Nomina Core.
 *
 * La fuente de verdad es el nivel de acceso registrado en Airtable, no una lista
 * de cargos en el código. El mapeo de cargos se conserva solo como respaldo para
 * usuarios sin nivel asignado y para tokens JWT emitidos antes de este cambio.
 */

export type Categoria = 'Desarrollador' | 'Gerencia' | 'Administrador' | 'Colaborador';

export const CATEGORIAS: Categoria[] = [
  'Desarrollador',
  'Gerencia',
  'Administrador',
  'Colaborador',
];

/**
 * Niveles de acceso de Sirius Nomina Core → categorías de la app.
 * Incluye las dos escalas que usa la base: la tabla Niveles_Acceso
 * (Super Admin, Admin, Avanzado, Usuario, Lectura) y el campo Nivel_Acceso
 * de Roles y Permisos (Super Admin, Admin Depto, Avanzado, Estándar).
 */
const NIVEL_ACCESO_A_CATEGORIA: Record<string, Categoria> = {
  'SUPER ADMIN': 'Desarrollador',
  'ADMIN DEPTO': 'Gerencia',
  ADMIN: 'Administrador',
  AVANZADO: 'Administrador',
  ESTANDAR: 'Colaborador',
  USUARIO: 'Colaborador',
  LECTURA: 'Colaborador',
};

/**
 * Respaldo por nombre de cargo. Solo se consulta si el usuario no tiene nivel de
 * acceso en Airtable. Los cargos nuevos no necesitan agregarse aquí: basta con
 * asignarles Nivel_Sistema_Nuevo o Nivel_Acceso en la base.
 */
const CARGO_A_CATEGORIA: Record<string, Categoria> = {
  'INGENIERO DE DESARROLLO': 'Desarrollador',
  'DIRECTOR EJECUTIVO (CEO) (CHIEF EXECUTIVE OFFICER)': 'Desarrollador',
  'CTO (CHIEF TECHNOLOGY OFFICER)': 'Desarrollador',
  'COORDINADORA LIDER GERENCIA': 'Desarrollador',
  'DIRECTOR FINANCIERO': 'Gerencia',
  'JEFE DE PLANTA': 'Gerencia',
  'JEFE DE PRODUCCION': 'Gerencia',
  'SUPERVISOR DE PRODUCCION': 'Gerencia',
  CONTADORA: 'Administrador',
  'ASISTENTE FINANCIERO Y CONTABLE': 'Administrador',
  'COORDINADOR DE COMPRAS': 'Administrador',
  'ASISTENTE ADMINISTRATIVO': 'Administrador',
};

/**
 * Normaliza texto para comparar: quita acentos y espacios sobrantes.
 * Airtable tiene valores como "JEFE DE PLANTA " (con espacio final) y "Estándar",
 * que sin esto no coincidirían con las claves de los mapas.
 */
function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/** Acepta el valor crudo de Airtable, que en lookups llega como arreglo. */
function primerValor(valor: unknown): string | undefined {
  if (Array.isArray(valor)) {
    return primerValor(valor[0]);
  }
  if (typeof valor === 'string' && valor.trim() !== '') {
    return valor;
  }
  return undefined;
}

/** Traduce un nivel de acceso de Airtable a una categoría de la app. */
export function categoriaDesdeNivelAcceso(nivelAcceso: unknown): Categoria | undefined {
  const nivel = primerValor(nivelAcceso);
  if (!nivel) return undefined;
  return NIVEL_ACCESO_A_CATEGORIA[normalizarTexto(nivel)];
}

/** Traduce un nombre de cargo a una categoría de la app (respaldo). */
export function categoriaDesdeCargo(cargo: unknown): Categoria | undefined {
  const nombre = primerValor(cargo);
  if (!nombre) return undefined;
  return CARGO_A_CATEGORIA[normalizarTexto(nombre)];
}

/**
 * Resuelve la categoría de un usuario. Orden de precedencia:
 *   1. Nivel de acceso asignado a la persona (Personal → Nivel_Sistema_Nuevo)
 *   2. Nivel de acceso del rol (Roles y Permisos → Nivel_Acceso)
 *   3. Categoría ya normalizada (tokens JWT antiguos)
 *   4. Mapeo por nombre de cargo (respaldo)
 *   5. Colaborador
 */
export function resolverCategoria(datos: {
  nivelAccesoPersonal?: unknown;
  nivelAccesoRol?: unknown;
  categoria?: unknown;
  cargo?: unknown;
}): Categoria {
  const porPersonal = categoriaDesdeNivelAcceso(datos.nivelAccesoPersonal);
  if (porPersonal) return porPersonal;

  const porRol = categoriaDesdeNivelAcceso(datos.nivelAccesoRol);
  if (porRol) return porRol;

  const categoria = primerValor(datos.categoria);
  if (categoria && (CATEGORIAS as string[]).includes(categoria)) {
    return categoria as Categoria;
  }

  return categoriaDesdeCargo(datos.cargo) ?? categoriaDesdeCargo(categoria) ?? 'Colaborador';
}

/**
 * Normaliza la categoría que viaja en el JWT. Los tokens nuevos ya traen
 * `categoria` resuelta y `nivelAcceso`; los antiguos traen el nombre del cargo.
 */
export function normalizarCategoria(
  categoria: string | undefined,
  nivelAcceso?: unknown
): Categoria {
  return resolverCategoria({ nivelAccesoPersonal: nivelAcceso, categoria });
}
