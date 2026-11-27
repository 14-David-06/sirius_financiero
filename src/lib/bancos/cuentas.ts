/**
 * Cuentas bancarias de Sirius. Cada una tiene su propia tabla en Airtable y su propia
 * carpeta de extractos en OneDrive, así que se consultan y se cargan por separado.
 * Módulo sin dependencias de servidor: lo usan tanto la UI como las rutas API.
 */

export type BancoId = 'bancolombia' | 'bbva';

export interface CuentaBancaria {
  id: BancoId;
  nombre: string;
  proposito: string;
  /** Nombre de la tabla en Airtable, para orientar al usuario */
  tabla: string;
  /** Carpeta de OneDrive (cuenta ADM) donde quedan los extractos */
  carpeta: string;
}

export const CUENTAS_BANCARIAS: Record<BancoId, CuentaBancaria> = {
  bancolombia: {
    id: 'bancolombia',
    nombre: 'Bancolombia',
    proposito: 'Capital de trabajo',
    tabla: 'Movimientos_Bancarios_Bancolombia',
    carpeta: 'Documentos Soporte/2026/Movimientos Bancolombia',
  },
  bbva: {
    id: 'bbva',
    nombre: 'BBVA',
    proposito: 'CAPEX',
    tabla: 'Movimientos_Bancarios_BBVA',
    carpeta: 'Documentos Soporte/2026/Movimientos BBVA',
  },
};

export const BANCOS: BancoId[] = ['bancolombia', 'bbva'];

export const esBancoId = (valor: unknown): valor is BancoId => valor === 'bancolombia' || valor === 'bbva';
