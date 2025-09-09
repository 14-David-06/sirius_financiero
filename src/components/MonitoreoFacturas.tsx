"use client";

import React, { useState } from 'react';

export default function MonitoreoFacturas() {
  const [modo, setModo] = useState<'none' | 'egresos' | 'ingresos'>('none');

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Header (match other pages visual) */}
      <div className="text-center mb-8 bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
          Monitoreo de Facturas — Egresos e Ingresos · Sirius Financiero
        </h1>
        <p className="text-white/80 mt-2">
          Visión consolidada y seguimiento en tiempo real de facturas de salida (egresos) y de
          entrada (ingresos).
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
            <p className="text-white/80 text-sm">Seguimiento de facturas de clientes: cobros pendientes, fechas de pago y alertas.</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            {/* Placeholder: reemplazar con tabla o componentes reales */}
            <p className="text-white/80">(Vista de ingresos) — Contenido personalizado según la selección.</p>
          </div>
        </section>
      )}
    </div>
  );
}
