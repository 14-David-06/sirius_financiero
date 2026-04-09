/**
 * Tipos para el sistema de inventario (Sirius Insumos Core)
 * Base de Airtable: ver AIRTABLE_INS_BASE_ID en .env
 */

// ============ ÓRDENES DE COMPRA (Base Financiera) ============

export interface OrdenCompraCompleta {
  id: string;
  idOrdenCompra: string;
  fechaEmision: string;
  estadoOC: 'Emitida' | 'En Tránsito' | 'Recibida' | 'Ingresada a Inventario' | 'Cancelada';
  proveedor?: string[];
  proveedorNombre?: string;
  nombreSolicitante?: string;
  cargoSolicitante?: string;
  areaCorrespondiente?: string;
  prioridad?: 'Alta' | 'Media' | 'Baja';
  autorizadoPor?: string;
  descripcion?: string;
  items: ItemOCCompleto[];
  subtotal: number;
  iva: number;
  retencion: number;
  totalNeto: number;
  documentoUrl?: string;
  cotizacionDocUrl?: string;
  comentarios?: string;
  fechaAprobacion?: string;
  // Relaciones
  compraRelacionadaId?: string[];
  cotizacionRelacionadaId?: string[];
}

export interface ItemOCCompleto {
  id: string;
  idItemOC: string;
  ordenCompraRelacionadaId: string[];
  descripcion: string;
  centroCostos?: string;
  cantidad: number;
  unidadMedida?: string;
  valorUnitario: number;
  valorTotal: number;
  comentarios?: string;
  // Relaciones
  itemCompraRelacionadoId?: string[];
  itemCotizadoRelacionadoId?: string[];
}

// ============ INVENTARIO (Base Sirius Insumos Core) ============

export interface Insumo {
  id: string;
  codigoSirius: string; // SIRIUS-INS-XXXX
  idNumerico: number;
  nombre: string;
  unidadMedida?: string;
  stockMinimo?: number;
  estado: 'Activo' | 'Inactivo' | 'Descontinuado';
  imagenReferencia?: Array<{ url: string; filename: string }>;
  idAreaOrigen?: string;
  fichaTecnica?: string;
  referenciaComercial?: string;
  idCreadorCore?: string;
  // Relaciones
  categoriaId?: string[];
  movimientosIds?: string[];
  stockIds?: string[];
  unidadBaseId?: string[];
}

export interface CategoriaInsumo {
  id: string;
  codigoCategoria: string; // CAT-INS-XXXX
  idNumerico: number;
  tipoInsumo: string;
  descripcion?: string;
  // Relaciones
  insumosIds?: string[];
}

export interface MovimientoInsumo {
  id: string;
  codigoMovimiento: string; // MOV-INS-XXXX
  idNumerico: number;
  creada: string;
  ultimaModificacion: string;

  // Descripción
  name: string;
  tipoMovimiento: 'Ingreso' | 'Salida' | 'Ajuste';
  subtipo?: 'Compra' | 'Producción' | 'Devolución' | 'Ajuste Inventario' | 'Transferencia';
  estadoEntrada: 'En Espera' | 'Confirmado' | 'Rechazado';

  // Cantidad y Unidades
  cantidadOriginal: number;
  unidadOriginalId?: string[]; // Link a Unidades de Medida
  factorConversion?: number;
  cantidadBase?: number; // Calculado: cantidadOriginal * factorConversion
  cantidad?: number; // Campo legacy

  // Costos
  costoUnitario?: number; // En unidad original
  costoTotal?: number; // cantidadOriginal * costoUnitario
  costoUnitarioBase?: number; // costoTotal / cantidadBase

  // Trazabilidad
  insumoId: string[]; // Link a Insumo
  idResponsableCore: string; // Cédula del usuario
  documentoOrigen?: string; // ID Orden de Compra, factura, etc.
  idSolicitudCompra?: string; // Link a solicitud de compra

  // Ubicaciones
  idAreaOrigen?: string;
  idAreaDestino?: string;
  areaOrigenLinkId?: string[]; // Link a Areas
  areaDestinoLinkId?: string[]; // Link a Areas

  // Control de Lote
  lote?: string;
  fechaVencimiento?: string;
  notas?: string;

  // Relaciones
  stockInsumosId?: string[]; // Link a Stock
}

export interface StockInsumo {
  id: string;
  idStock: string; // INV-STOCK-INS-XXXX
  idNumerico: number;
  stockActual: number; // Calculado por fórmula (Ingresos - Salidas)
  ultimaActualizacion: string;
  cantidadIngresa?: number[]; // Lookup de movimientos
  cantidadSale?: number[]; // Lookup de movimientos
  costoAcumulado?: number;

  // Relaciones
  insumoId: string[]; // Link a Insumo
  movimientoInsumoIds?: string[]; // Link a Movimientos
  areaId?: string[]; // Link a Areas
}

export interface UnidadMedida {
  id: string;
  nombre: string; // Kilogramo, Litro, Unidad, etc.
  simbolo: string; // kg, L, und, g, ml
  tipo: 'Masa' | 'Volumen' | 'Conteo';
  factorBase: number; // Factor de conversión a unidad base (g, ml, und)
  unidadBaseTipo: string; // g, ml, und

  // Relaciones
  insumoIds?: string[];
  movimientosIds?: string[];
}

export interface Area {
  id: string;
  idCore: string;
  nombre: string; // BODEGA, LABORATORIO, PIROLISIS, ADMINISTRACIÓN
  responsable?: string;
  activa: boolean;

  // Relaciones
  movimientosOrigenIds?: string[];
  movimientosDestinoIds?: string[];
  stockInsumosIds?: string[];
}

// ============ REQUESTS/RESPONSES ============

export interface CrearMovimientoRequest {
  ordenCompraId: string; // ID de OC en base financiera
  items: CrearMovimientoItemRequest[];
}

export interface CrearMovimientoItemRequest {
  itemOCId: string; // ID del item de OC
  insumoId: string; // ID del insumo en catálogo
  cantidadRecibida: number;
  unidadOriginalId: string; // ID de unidad de medida
  areaDestinoId: string; // ID del área
  costoUnitario?: number;
  documentoOrigen?: string; // Número de factura
  lote?: string;
  fechaVencimiento?: string;
  observaciones?: string;
}

export interface CrearMovimientoResponse {
  success: boolean;
  movimientosCreados: Array<{
    id: string;
    codigoMovimiento: string;
    insumo: string;
    cantidad: number;
    estado: string;
  }>;
  ordenCompraActualizada?: {
    id: string;
    nuevoEstado: string;
  };
  error?: string;
}

export interface ConfirmarMovimientoRequest {
  confirmarMovimiento: boolean;
  observacionesFinales?: string;
}

export interface ConfirmarMovimientoResponse {
  success: boolean;
  movimientoId: string;
  nuevoEstado: string;
  stockActualizado: Array<{
    insumoId: string;
    area: string;
    stockAnterior: number;
    stockNuevo: number;
  }>;
  ordenCompraActualizada?: {
    id: string;
    nuevoEstado: string;
    todosMovimientosConfirmados: boolean;
  };
  error?: string;
}

export interface ListarOrdenesCompraQuery {
  estado?: 'Emitida' | 'En Tránsito' | 'Recibida' | 'Ingresada a Inventario' | 'Cancelada';
  proveedor?: string;
  desde?: string; // ISO date
  hasta?: string; // ISO date
  prioridad?: 'Alta' | 'Media' | 'Baja';
  maxRecords?: number;
}

export interface ListarOrdenesCompraResponse {
  ordenesCompra: OrdenCompraCompleta[];
  total: number;
  filtros: ListarOrdenesCompraQuery;
  timestamp: string;
}

export interface ActualizarEstadoOCRequest {
  nuevoEstado: 'En Tránsito' | 'Recibida' | 'Ingresada a Inventario' | 'Cancelada';
  comentarios?: string;
}

export interface ActualizarEstadoOCResponse {
  success: boolean;
  ordenCompraId: string;
  estadoAnterior: string;
  estadoNuevo: string;
  fechaActualizacion: string;
  actualizadoPor: string;
  error?: string;
}

export interface ConsultarStockQuery {
  area?: string;
  insumo?: string;
  bajoMinimo?: boolean; // true = solo mostrar stock bajo mínimo
  categoria?: string;
}

export interface ConsultarStockResponse {
  stock: Array<{
    id: string;
    insumo: string;
    insumoId: string;
    area: string;
    stockActual: number;
    stockMinimo?: number;
    unidadMedida?: string;
    costoAcumulado?: number;
    alerta: 'normal' | 'bajo' | 'critico';
  }>;
  total: number;
  alertas: {
    bajo: number;
    critico: number;
  };
  timestamp: string;
}

// ============ AIRTABLE RECORDS ============

export interface AirtableMovimientoRecord {
  id: string;
  fields: {
    [key: string]: unknown;
    'Código Movimiento Insumo'?: string;
    'ID'?: number;
    'Creada'?: string;
    'Name'?: string;
    'Cantidad Original'?: number;
    'Tipo Movimiento'?: 'Ingreso' | 'Salida' | 'Ajuste';
    'Subtipo'?: string;
    'Estado Entrada Insumo'?: 'En Espera' | 'Confirmado' | 'Rechazado';
    'Insumo'?: string[];
    'Area Destino Link'?: string[];
    'Costo Unitario'?: number;
    'Documento Origen'?: string;
  };
}

export interface AirtableStockRecord {
  id: string;
  fields: {
    [key: string]: unknown;
    'id_stock'?: string;
    'stock_actual'?: number;
    'Insumo ID'?: string[];
    'Area'?: string[];
    'Costo Acumulado'?: number;
  };
}

export interface AirtableOrdenCompraRecord {
  id: string;
  fields: {
    [key: string]: unknown;
    'ID Orden de Compra'?: string;
    'Fecha de Emisión'?: string;
    'Estado Orden de Compra'?: string;
    'Items Orden de Compra'?: string[];
  };
}
