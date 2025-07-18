export default function MonitoreoSolicitudes() {
  // Datos de ejemplo para las métricas
  const metricas = {
    totalSolicitudes: 147,
    montoTotal: 450000,
    promedioTiempo: 3.2,
    tasaAprobacion: 78.5,
    solicitudesPendientes: 23,
    solicitudesAprobadas: 89,
    solicitudesRechazadas: 35,
  };

  const solicitudesRecientes = [
    { id: 'SOL-147', proveedor: 'Tech Solutions', monto: 25000, estado: 'aprobado', tiempo: '2h' },
    { id: 'SOL-146', proveedor: 'Office Supplies', monto: 3500, estado: 'pendiente', tiempo: '1d' },
    { id: 'SOL-145', proveedor: 'Industrial Corp', monto: 89000, estado: 'en_proceso', tiempo: '3h' },
    { id: 'SOL-144', proveedor: 'Services Plus', monto: 12000, estado: 'rechazado', tiempo: '5d' },
  ];

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'aprobado':
        return 'bg-green-100 text-green-800';
      case 'rechazado':
        return 'bg-red-100 text-red-800';
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'en_proceso':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: 'url(https://res.cloudinary.com/dvnuttrox/image/upload/v1752165981/20032025-DSCF8381_2_1_jzs49t.jpg)'
      }}
    >
      <div className="min-h-screen py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">
              📊 Monitoreo de Solicitudes
            </h1>
            <p className="text-white/90 text-lg drop-shadow-md">
              Supervisa el estado y rendimiento de todas las solicitudes de compra
            </p>
          </div>

          {/* Métricas principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{metricas.totalSolicitudes}</div>
                <p className="text-white/80 font-medium">Total Solicitudes</p>
                <p className="text-green-300 text-sm mt-1">+12% vs mes anterior</p>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">${metricas.montoTotal.toLocaleString()}</div>
                <p className="text-white/80 font-medium">Monto Total</p>
                <p className="text-green-300 text-sm mt-1">+8% vs mes anterior</p>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{metricas.promedioTiempo}d</div>
                <p className="text-white/80 font-medium">Tiempo Promedio</p>
                <p className="text-red-300 text-sm mt-1">-15% vs mes anterior</p>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">{metricas.tasaAprobacion}%</div>
                <p className="text-white/80 font-medium">Tasa de Aprobación</p>
                <p className="text-green-300 text-sm mt-1">+5% vs mes anterior</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Distribución por estado */}
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6 drop-shadow-md">
                Distribución por Estado
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-500/20 rounded-xl border border-green-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="font-medium text-white">Aprobadas</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{metricas.solicitudesAprobadas}</p>
                    <p className="text-green-300 text-sm">60.5%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-500/20 rounded-xl border border-yellow-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="font-medium text-white">Pendientes</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{metricas.solicitudesPendientes}</p>
                    <p className="text-yellow-300 text-sm">15.6%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-red-500/20 rounded-xl border border-red-400/30">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    <span className="font-medium text-white">Rechazadas</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{metricas.solicitudesRechazadas}</p>
                    <p className="text-red-300 text-sm">23.8%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen rápido */}
            <div className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6 drop-shadow-md">
                Resumen Rápido
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">En Proceso</span>
                    <span className="text-blue-300 font-bold">12</span>
                  </div>
                </div>
                <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Nuevas Hoy</span>
                    <span className="text-green-300 font-bold">8</span>
                  </div>
                </div>
                <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Pendientes {'>'}5 días</span>
                    <span className="text-yellow-300 font-bold">3</span>
                  </div>
                </div>
                <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Promedio de Aprobación</span>
                    <span className="text-purple-300 font-bold">2.8 días</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actividad reciente */}
          <div className="mt-8 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/20">
              <h3 className="text-xl font-bold text-white drop-shadow-md">
                Actividad Reciente
              </h3>
            </div>
            <div className="divide-y divide-white/20">
              {solicitudesRecientes.map((solicitud) => (
                <div key={solicitud.id} className="px-6 py-4 hover:bg-white/5 transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                      <div>
                        <p className="font-medium text-white">
                          {solicitud.id} - {solicitud.proveedor}
                        </p>
                        <p className="text-white/70 text-sm">
                          ${solicitud.monto.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(solicitud.estado)}`}>
                        {solicitud.estado.charAt(0).toUpperCase() + solicitud.estado.slice(1)}
                      </span>
                      <span className="text-white/70 text-sm">
                        hace {solicitud.tiempo}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
