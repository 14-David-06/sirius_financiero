// Tipos para la aplicación de compras

export interface AirtableField {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
}

export interface CompraItem {
  id: string;
  objeto: string;
  centroCostos: string;
  cantidad: number;
  valorItem: number;
  compraServicio: string;
  prioridad?: string;
  fechaRequerida?: string;
  formaPago?: string;
  aprobacion?: string;
  estadoGestion?: string;
  reciboRemision?: string;
  transporte?: string;
  nombreProveedor?: string[];
  nitProveedor?: string[];
  correoProveedor?: string[];
  celularProveedor?: string[];
  ciudadProveedor?: string[];
  autoretenedorProveedor?: string[];
  responsableIVAProveedor?: string[];
  responsableICAProveedor?: string[];
  tarifaActividadProveedor?: string[];
  departamentoProveedor?: string[];
  rutProveedor?: AirtableField[];
  personaProveedor?: string[];
  contribuyenteProveedor?: string[];
  facturadorElectronicoProveedor?: string[];
  declaranteRentaProveedor?: string[];
}

export interface CompraCompleta {
  id: string;
  fechaSolicitud: string;
  areaCorrespondiente: string;
  nombreSolicitante: string;
  cargoSolicitante: string;
  descripcionSolicitud: string;
  descripcionIA?: string;
  hasProvider: string;
  razonSocialProveedor?: string;
  cotizacionDoc?: string;
  documentoSolicitud?: string;
  valorTotal?: number;
  iva?: number;
  totalNeto?: number;
  estadoSolicitud: string;
  prioridadSolicitud?: string; // Nueva propiedad para la prioridad
  retencion?: number;
  baseMinimaEnPesos?: number;
  baseMinimaEnUVT?: number;
  valorUVT?: number;
  compraServicio?: string[];
  nombreProveedor?: string[];
  nitProveedor?: string[];
  autoretenedor?: string[];
  responsableIVA?: string[];
  responsableICA?: string[];
  tarifaActividad?: string[];
  ciudadProveedor?: string[];
  departamentoProveedor?: string[];
  rutProveedor?: AirtableField[];
  contribuyente?: string[];
  facturadorElectronico?: string[];
  personaProveedor?: string[];
  declaranteRenta?: string[];
  numeroSemanaBancario?: number[];
  clasificacionBancaria?: string[];
  valorBancario?: number[];
  proyeccionBancaria?: string[];
  nombresAdmin?: string;
  items: CompraItem[];
}

export interface EstadisticasData {
  totalCompras: number;
  totalItems: number;
  montoTotal: number;
  montoTotalNeto: number;
  distribucionEstados: Record<string, number>;
  distribucionAreas: Record<string, number>;
}

export interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
}

export interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export interface UserData {
  cedula: string;
  nombre: string;
  cargo: string;
  area: string;
  email: string;
}

export interface ApiResponse {
  compras: CompraCompleta[];
  estadisticas: EstadisticasData;
  totalRecords: number;
  timestamp: string;
}
