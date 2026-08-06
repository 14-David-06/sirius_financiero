/**
 * Configuración de campos de la tabla "DIAN"
 *
 * Se mantiene en un módulo aparte de `airtable-fields.ts` a propósito: ese archivo
 * evalúa todos sus campos al importarse y lanza si falta una variable, por lo que
 * agregar campos aquí evita que una variable DIAN ausente rompa otros módulos
 * (Caja Menor, Items, etc.).
 */

function getRequiredField(envVar: string | undefined, fieldName: string): string {
  if (!envVar) {
    throw new Error(`❌ Variable de entorno requerida no configurada: ${fieldName}`);
  }
  return envVar;
}

/**
 * Campos de la tabla "DIAN" (documentos electrónicos recibidos/emitidos)
 */
export const DIAN_FIELDS = {
  // Fecha de creación del registro: define qué entró en cada ejecución
  CREADA: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_CREADA, 'AIRTABLE_FIELD_DIAN_CREADA'),

  // Identificación del documento
  TIPO_DOCUMENTO: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_TIPO_DOCUMENTO, 'AIRTABLE_FIELD_DIAN_TIPO_DOCUMENTO'),
  PREFIJO_FOLIO: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_PREFIJO_FOLIO, 'AIRTABLE_FIELD_DIAN_PREFIJO_FOLIO'),
  CUFE: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_CUFE, 'AIRTABLE_FIELD_DIAN_CUFE'),

  // Fechas del documento
  FECHA_EMISION: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_FECHA_EMISION, 'AIRTABLE_FIELD_DIAN_FECHA_EMISION'),
  FECHA_RECEPCION: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_FECHA_RECEPCION, 'AIRTABLE_FIELD_DIAN_FECHA_RECEPCION'),

  // Partes
  NIT_EMISOR: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_NIT_EMISOR, 'AIRTABLE_FIELD_DIAN_NIT_EMISOR'),
  NOMBRE_EMISOR: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_NOMBRE_EMISOR, 'AIRTABLE_FIELD_DIAN_NOMBRE_EMISOR'),
  NOMBRE_RECEPTOR: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_NOMBRE_RECEPTOR, 'AIRTABLE_FIELD_DIAN_NOMBRE_RECEPTOR'),

  // Valores
  IVA: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_IVA, 'AIRTABLE_FIELD_DIAN_IVA'),
  TOTAL: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_TOTAL, 'AIRTABLE_FIELD_DIAN_TOTAL'),

  // Clasificación
  ESTADO: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_ESTADO, 'AIRTABLE_FIELD_DIAN_ESTADO'),
  GRUPO: getRequiredField(process.env.AIRTABLE_FIELD_DIAN_GRUPO, 'AIRTABLE_FIELD_DIAN_GRUPO'),
} as const;

export type DianFieldsType = typeof DIAN_FIELDS;
