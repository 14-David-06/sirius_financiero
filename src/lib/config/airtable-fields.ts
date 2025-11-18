/**
 * Configuración centralizada de campos de Airtable
 * 
 * ⚠️ IMPORTANTE: Este archivo centraliza todos los nombres de campos de Airtable
 * para evitar hardcodear IDs de campos directamente en el código fuente.
 * 
 * Airtable permite usar NOMBRES de campos en lugar de Field IDs, lo cual es:
 * - Más legible y mantenible
 * - Más fácil de documentar
 * - No expone IDs internos de la base de datos
 */

/**
 * Campos de la tabla "Caja Menor"
 * Tabla principal que almacena los anticipos de caja menor mensuales
 */
export const CAJA_MENOR_FIELDS = {
  // Campos de datos
  FECHA_ANTICIPO: 'Fecha Anticipo',
  BENEFICIARIO: 'Beneficiario',
  NIT_CC: 'Nit-CC',
  CONCEPTO: 'Concepto Caja Menor',
  VALOR: 'Valor Caja Menor',
  REALIZA_REGISTRO: 'Realiza Registro',
  
  // Campo de consolidación
  FECHA_CONSOLIDACION: 'Fecha Consolidación',
  DOCUMENTO_CONSOLIDACION: 'Documento Consolidación',
  
  // Campo de relación
  ITEMS_CAJA_MENOR: 'Items Caja Menor'
} as const;

/**
 * Campos de la tabla "Items Caja Menor"
 * Tabla de detalle que almacena los gastos individuales de cada caja menor
 */
export const ITEMS_CAJA_MENOR_FIELDS = {
  // Auto Number
  ITEM: 'Item',
  
  // Campos de datos
  FECHA: 'Fecha',
  BENEFICIARIO: 'Beneficiario',
  NIT_CC: 'Nit/CC',
  CONCEPTO: 'Concepto',
  CENTRO_COSTO: 'Centro Costo',
  VALOR: 'Valor',
  REALIZA_REGISTRO: 'Realiza Registro',
  
  // Campo de relación (link a tabla principal)
  CAJA_MENOR: 'Caja Menor'
} as const;

/**
 * Tipo de datos para campos de Caja Menor
 */
export type CajaMenorFieldsType = typeof CAJA_MENOR_FIELDS;

/**
 * Tipo de datos para campos de Items Caja Menor
 */
export type ItemsCajaMenorFieldsType = typeof ITEMS_CAJA_MENOR_FIELDS;
