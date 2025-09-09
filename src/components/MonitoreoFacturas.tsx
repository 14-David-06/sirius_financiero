"use client";

import React, { useState, useEffect, useCallback } from 'react';

interface FacturacionIngreso {
  id: string;
  'Factura No.': string;
  'Fecha Emision': string;
  'Nombre del Comprador': string;
  'NIT Comprador': string;
  'Total por Cobrar': number;
  'Estado_Factura': string[];
  'Fecha de Vencimiento': string;
  'Total_recibir': number;
  'Un.Negocio': string[];
  'Condiciones de pago': string;
  'Plazo para pagar': number;
  'Observaciones': string;
  'GRUPO': string;
  'CLASE': string;
  'CUENTA': string;
  'Hecho': string;
}

export default function MonitoreoFacturas() {
  const [modo, setModo] = useState<'none' | 'egresos' | 'ingresos'>('none');
  const [data, setData] = useState<FacturacionIngreso[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    minAmount: '',
    maxAmount: '',
    buyerName: '',
    businessUnit: '',
    grupo: '',
    clase: '',
    cuenta: '',
    sortField: 'Factura No.',
    sortDirection: 'asc',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filtersArray = [];
      if (filters.startDate && filters.endDate) {
        filtersArray.push(`{Fecha Emision} >= '${filters.startDate}'`);
        filtersArray.push(`{Fecha Emision} <= '${filters.endDate}'`);
      }
      if (filters.status) {
        filtersArray.push(`FIND('${filters.status}', {Estado_Factura}) > 0`);
      }
      if (filters.minAmount) {
        filtersArray.push(`{Total por Cobrar} >= ${filters.minAmount}`);
      }
      if (filters.maxAmount) {
        filtersArray.push(`{Total por Cobrar} <= ${filters.maxAmount}`);
      }
      if (filters.buyerName) {
        filtersArray.push(`FIND('${filters.buyerName}', {Nombre del Comprador}) > 0`);
      }
      if (filters.businessUnit) {
        filtersArray.push(`FIND('${filters.businessUnit}', {Un.Negocio}) > 0`);
      }
      if (filters.grupo) {
        filtersArray.push(`{GRUPO} = '${filters.grupo}'`);
      }
      if (filters.clase) {
        filtersArray.push(`{CLASE} = '${filters.clase}'`);
      }
      if (filters.cuenta) {
        filtersArray.push(`{CUENTA} = '${filters.cuenta}'`);
      }
      const filterByFormula = filtersArray.length > 0 ? `AND(${filtersArray.join(', ')})` : '';
      const queryParams = new URLSearchParams();
      if (filterByFormula) {
        queryParams.append('filterByFormula', filterByFormula);
      }
      queryParams.append('maxRecords', '1000'); // Traer más registros por defecto
      queryParams.append('sortField', filters.sortField);
      queryParams.append('sortDirection', filters.sortDirection);
      const response = await fetch(`/api/facturacion-ingresos?${queryParams.toString()}`);
      const result = await response.json();
      setData(result.records || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (modo === 'ingresos') {
      fetchData();
    }
  }, [modo, fetchData]);

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Header (match other pages visual) */}
      <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
          Monitoreo de Facturas — Egresos e Ingresos · Sirius Financiero
        </h1>
        <p className="text-white/80 mt-2">
          Visión consolidada y seguimiento en tiempo real de facturas de salida (egresos) y entrada (ingresos).
        </p>
      </div>

      {/* Selector card */}
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl mb-8">
        <label className="block text-sm font-medium text-white mb-3">Seleccionar tipo de monitoreo</label>
        <div className="max-w-md">
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as 'none' | 'egresos' | 'ingresos')}
            className="w-full p-4 bg-white/15 border border-white/30 rounded-2xl text-white placeholder-white/70 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 transition-all"
          >
            <option value="none" className="text-gray-900 bg-white">— Elija una opción —</option>
            <option value="egresos" className="text-gray-900 bg-white">Monitorear Facturas de Egresos</option>
            <option value="ingresos" className="text-gray-900 bg-white">Monitorear Facturas de Ingresos</option>
          </select>
        </div>
      </div>

      {/* Contenido personalizado según selección (tarjetas con el mismo look) */}
      {modo === 'none' && (
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          <p className="text-white/80">Seleccione una opción del menú para ver el monitoreo correspondiente.</p>
        </div>
      )}

      {modo === 'egresos' && (
        <section className="space-y-6">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">Monitoreo de Facturas de Egresos</h2>
            <p className="text-white/80 text-sm">Control y seguimiento de las facturas de salida: pagos, vencimientos y conciliación.</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            {/* Placeholder: reemplazar con tabla o componentes reales */}
            <p className="text-white/80">(Vista de egresos) — Contenido personalizado según la selección.</p>
          </div>
        </section>
      )}

      {modo === 'ingresos' && (
        <section className="space-y-6">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">Monitoreo de Facturas de Ingresos</h2>
          </div>

          {/* Filters */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-lg font-medium text-white mb-4">Filtros Estratégicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white mb-1">Fecha Inicio</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Fecha Fin</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Estado Factura</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="">Todos</option>
                  <option value="Pagada">Pagada</option>
                  <option value="Parcial">Parcial</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Monto Mínimo</label>
                <input
                  type="number"
                  value={filters.minAmount}
                  onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Monto Máximo</label>
                <input
                  type="number"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Nombre del Comprador</label>
                <input
                  type="text"
                  value={filters.buyerName}
                  onChange={(e) => setFilters({ ...filters, buyerName: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                  placeholder="Buscar por comprador"
                />
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Unidad de Negocio</label>
                <select
                  value={filters.businessUnit}
                  onChange={(e) => setFilters({ ...filters, businessUnit: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="">Todas</option>
                  <option value="Biologico">Biológico</option>
                  <option value="Pirolisis">Pirolisis</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Grupo</label>
                <select
                  value={filters.grupo}
                  onChange={(e) => setFilters({ ...filters, grupo: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="">Todos</option>
                  <option value="Ingreso">Ingreso</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Clase</label>
                <select
                  value={filters.clase}
                  onChange={(e) => setFilters({ ...filters, clase: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="">Todas</option>
                  <option value="Operacional">Operacional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Cuenta</label>
                <select
                  value={filters.cuenta}
                  onChange={(e) => setFilters({ ...filters, cuenta: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="">Todas</option>
                  <option value="Ingreso de Actividades Ordinarias">Ingreso de Actividades Ordinarias</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Cargando...' : 'Aplicar Filtros'}
                </button>
                <button
                  onClick={() => setFilters({
                    startDate: '',
                    endDate: '',
                    status: '',
                    minAmount: '',
                    maxAmount: '',
                    buyerName: '',
                    businessUnit: '',
                    grupo: '',
                    clase: '',
                    cuenta: '',
                    sortField: 'Factura No.',
                    sortDirection: 'asc',
                  })}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Limpiar Filtros
                </button>
              </div>
              <div className="text-white/80 text-sm">
                Ordenado por: {filters.sortField} ({filters.sortDirection === 'asc' ? '↑' : '↓'})
              </div>
            </div>
          </div>

          {/* Sorting Controls */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-lg font-medium text-white mb-4">Ordenamiento</h3>
            <div className="flex gap-4 items-center">
              <div>
                <label className="block text-sm text-white mb-1">Ordenar por</label>
                <select
                  value={filters.sortField}
                  onChange={(e) => setFilters({ ...filters, sortField: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="Factura No.">Factura No.</option>
                  <option value="Fecha Emision">Fecha Emisión</option>
                  <option value="Total por Cobrar">Total por Cobrar</option>
                  <option value="Nombre del Comprador">Nombre del Comprador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white mb-1">Dirección</label>
                <select
                  value={filters.sortDirection}
                  onChange={(e) => setFilters({ ...filters, sortDirection: e.target.value })}
                  className="w-full p-2 bg-white/15 border border-white/30 rounded-lg text-white"
                >
                  <option value="asc">Ascendente (A-Z, 1-9)</option>
                  <option value="desc">Descendente (Z-A, 9-1)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="mb-4">
              <p className="text-white/80">Total de registros: {data.length}</p>
            </div>
            {loading ? (
              <p className="text-white/80">Cargando datos...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-white text-sm">
                  <thead>
                    <tr className="border-b border-white/30">
                      <th className="text-left p-2">Factura No.</th>
                      <th className="text-left p-2">Fecha Emisión</th>
                      <th className="text-left p-2">Comprador</th>
                      <th className="text-left p-2">NIT</th>
                      <th className="text-left p-2">Un. Negocio</th>
                      <th className="text-left p-2">Total por Cobrar</th>
                      <th className="text-left p-2">Estado</th>
                      <th className="text-left p-2">Fecha Vencimiento</th>
                      <th className="text-left p-2">Total Recibir</th>
                      <th className="text-left p-2">Condiciones</th>
                      <th className="text-left p-2">Hecho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((record) => (
                      <tr key={record.id} className="border-b border-white/10">
                        <td className="p-2">{record['Factura No.']}</td>
                        <td className="p-2">{record['Fecha Emision']}</td>
                        <td className="p-2">{record['Nombre del Comprador']}</td>
                        <td className="p-2">{record['NIT Comprador']}</td>
                        <td className="p-2">{record['Un.Negocio']?.join(', ')}</td>
                        <td className="p-2">${record['Total por Cobrar']?.toLocaleString()}</td>
                        <td className="p-2">{record['Estado_Factura']?.join(', ')}</td>
                        <td className="p-2">{record['Fecha de Vencimiento']}</td>
                        <td className="p-2">${record['Total_recibir']?.toLocaleString()}</td>
                        <td className="p-2">{record['Condiciones de pago']}</td>
                        <td className="p-2">{record['Hecho']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
