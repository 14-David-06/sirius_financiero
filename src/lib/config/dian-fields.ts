/**
 * Configuración de campos de la tabla "DIAN"
 *
 * Se mantiene en un módulo aparte de `airtable-fields.ts` a propósito: ese archivo
 * evalúa todos sus campos al importarse y lanza si falta una variable, por lo que
 * agregar campos aquí evita que una variable DIAN ausente rompa otros módulos
 * (Caja Menor, Items, etc.).
 *
 * IMPORTANTE: La validación ahora es lazy (se ejecuta al acceder a cada campo)
 * para evitar que el build de Next.js falle si las variables no están configuradas.
 */

function getRequiredField(envVar: string | undefined, fieldName: string): string {
  if (!envVar) {
    throw new Error(`❌ Variable de entorno requerida no configurada: ${fieldName}`);
  }
  return envVar;
}

/**
 * Campos de la tabla "DIAN" (documentos electrónicos recibidos/emitidos)
 * Usa getters para validación lazy: solo lanza error si se intenta usar el campo
 */
export const DIAN_FIELDS = {
  // Fecha de creación del registro: define qué entró en cada ejecución
  get CREADA() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_CREADA, 'AIRTABLE_FIELD_DIAN_CREADA');
  },

  // Identificación del documento
  get TIPO_DOCUMENTO() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_TIPO_DOCUMENTO, 'AIRTABLE_FIELD_DIAN_TIPO_DOCUMENTO');
  },
  get PREFIJO_FOLIO() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_PREFIJO_FOLIO, 'AIRTABLE_FIELD_DIAN_PREFIJO_FOLIO');
  },
  get CUFE() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_CUFE, 'AIRTABLE_FIELD_DIAN_CUFE');
  },

  // Fechas del documento
  get FECHA_EMISION() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_FECHA_EMISION, 'AIRTABLE_FIELD_DIAN_FECHA_EMISION');
  },
  get FECHA_RECEPCION() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_FECHA_RECEPCION, 'AIRTABLE_FIELD_DIAN_FECHA_RECEPCION');
  },

  // Partes
  get NIT_EMISOR() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_NIT_EMISOR, 'AIRTABLE_FIELD_DIAN_NIT_EMISOR');
  },
  get NOMBRE_EMISOR() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_NOMBRE_EMISOR, 'AIRTABLE_FIELD_DIAN_NOMBRE_EMISOR');
  },
  get NOMBRE_RECEPTOR() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_NOMBRE_RECEPTOR, 'AIRTABLE_FIELD_DIAN_NOMBRE_RECEPTOR');
  },

  // Valores
  get IVA() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_IVA, 'AIRTABLE_FIELD_DIAN_IVA');
  },
  get TOTAL() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_TOTAL, 'AIRTABLE_FIELD_DIAN_TOTAL');
  },

  // Clasificación
  get ESTADO() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_ESTADO, 'AIRTABLE_FIELD_DIAN_ESTADO');
  },
  get GRUPO() {
    return getRequiredField(process.env.AIRTABLE_FIELD_DIAN_GRUPO, 'AIRTABLE_FIELD_DIAN_GRUPO');
  },
} as const;

export type DianFieldsType = typeof DIAN_FIELDS;
