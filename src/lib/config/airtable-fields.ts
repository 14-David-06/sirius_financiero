/**
 * Configuración centralizada de campos de Airtable
 * 
 * ⚠️ IMPORTANTE: Este archivo obtiene TODOS los nombres de campos desde variables de entorno.
 * NO hay fallbacks hardcodeados para garantizar que siempre se usen las configuraciones externas.
 * 
 * Si una variable de entorno no está configurada, el sistema fallará intencionalmente
 * para evitar usar nombres hardcodeados accidentalmente.
 */

// Función helper para obtener campo requerido de variable de entorno
function getRequiredField(envVar: string | undefined, fieldName: string): string {
  if (!envVar) {
    throw new Error(`❌ Variable de entorno requerida no configurada: ${fieldName}`);
  }
  return envVar;
}

/**
 * Campos de la tabla "Caja Menor"
 * Tabla principal que almacena los anticipos de caja menor mensuales
 */
export const CAJA_MENOR_FIELDS = {
  // Campos de datos
  FECHA_ANTICIPO: getRequiredField(process.env.AIRTABLE_FIELD_FECHA_ANTICIPO, 'AIRTABLE_FIELD_FECHA_ANTICIPO'),
  BENEFICIARIO: getRequiredField(process.env.AIRTABLE_FIELD_BENEFICIARIO, 'AIRTABLE_FIELD_BENEFICIARIO'),
  NIT_CC: getRequiredField(process.env.AIRTABLE_FIELD_NIT_CC, 'AIRTABLE_FIELD_NIT_CC'),
  CONCEPTO: getRequiredField(process.env.AIRTABLE_FIELD_CONCEPTO_CAJA_MENOR, 'AIRTABLE_FIELD_CONCEPTO_CAJA_MENOR'),
  VALOR: getRequiredField(process.env.AIRTABLE_FIELD_VALOR_CAJA_MENOR, 'AIRTABLE_FIELD_VALOR_CAJA_MENOR'),
  REALIZA_REGISTRO: getRequiredField(process.env.AIRTABLE_FIELD_REALIZA_REGISTRO, 'AIRTABLE_FIELD_REALIZA_REGISTRO'),
  
  // Campo de consolidación
  FECHA_CONSOLIDACION: getRequiredField(process.env.AIRTABLE_FIELD_FECHA_CONSOLIDACION, 'AIRTABLE_FIELD_FECHA_CONSOLIDACION'),
  DOCUMENTO_CONSOLIDACION: getRequiredField(process.env.AIRTABLE_FIELD_DOCUMENTO_CONSOLIDACION, 'AIRTABLE_FIELD_DOCUMENTO_CONSOLIDACION'),
  ESTADO_CAJA_MENOR: getRequiredField(process.env.AIRTABLE_FIELD_ESTADO_CAJA_MENOR, 'AIRTABLE_FIELD_ESTADO_CAJA_MENOR'),
  
  // Campo para URL original de S3 del documento de consolidación
  URL_S3: getRequiredField(process.env.AIRTABLE_FIELD_URL_S3, 'AIRTABLE_FIELD_URL_S3'),
  
  // Campo de relación
  ITEMS_CAJA_MENOR: getRequiredField(process.env.AIRTABLE_FIELD_ITEMS_CAJA_MENOR, 'AIRTABLE_FIELD_ITEMS_CAJA_MENOR')
} as const;

/**
 * Campos de la tabla "Items Caja Menor"
 * Tabla de detalle que almacena los gastos individuales de cada caja menor
 */
export const ITEMS_CAJA_MENOR_FIELDS = {
  // Auto Number
  ITEM: getRequiredField(process.env.AIRTABLE_FIELD_ITEM, 'AIRTABLE_FIELD_ITEM'),
  
  // Campos de datos
  FECHA: getRequiredField(process.env.AIRTABLE_FIELD_FECHA, 'AIRTABLE_FIELD_FECHA'),
  BENEFICIARIO: getRequiredField(process.env.AIRTABLE_FIELD_BENEFICIARIO_ITEMS, 'AIRTABLE_FIELD_BENEFICIARIO_ITEMS'),
  NIT_CC: getRequiredField(process.env.AIRTABLE_FIELD_NIT_CC_ITEMS, 'AIRTABLE_FIELD_NIT_CC_ITEMS'),
  CONCEPTO: getRequiredField(process.env.AIRTABLE_FIELD_CONCEPTO_ITEMS, 'AIRTABLE_FIELD_CONCEPTO_ITEMS'),
  CENTRO_COSTO: getRequiredField(process.env.AIRTABLE_FIELD_CENTRO_COSTO, 'AIRTABLE_FIELD_CENTRO_COSTO'),
  VALOR: getRequiredField(process.env.AIRTABLE_FIELD_VALOR_ITEMS, 'AIRTABLE_FIELD_VALOR_ITEMS'),
  REALIZA_REGISTRO: getRequiredField(process.env.AIRTABLE_FIELD_REALIZA_REGISTRO_ITEMS, 'AIRTABLE_FIELD_REALIZA_REGISTRO_ITEMS'),
  
  // Campo de adjuntos
  COMPROBANTE: getRequiredField(process.env.AIRTABLE_FIELD_COMPROBANTE, 'AIRTABLE_FIELD_COMPROBANTE'),
  
  // Campo para URL original de S3
  URL_S3: getRequiredField(process.env.AIRTABLE_FIELD_URL_S3_ITEMS, 'AIRTABLE_FIELD_URL_S3_ITEMS'),
  
  // Campo de relación (link a tabla principal)
  CAJA_MENOR: getRequiredField(process.env.AIRTABLE_FIELD_CAJA_MENOR, 'AIRTABLE_FIELD_CAJA_MENOR')
} as const;

/**
 * Tipo de datos para campos de Caja Menor
 */
export type CajaMenorFieldsType = typeof CAJA_MENOR_FIELDS;

/**
 * Tipo de datos para campos de Items Caja Menor
 */
export type ItemsCajaMenorFieldsType = typeof ITEMS_CAJA_MENOR_FIELDS;
