'use client';

import { useState, useEffect } from 'react';

interface ItemOC {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  valorUnitario: number;
  valorTotal: number;
}

interface OrdenCompra {
  id: string;
  idOrdenCompra: string;
  fechaEmision: string;
  estado: string;
  prioridad: string;
  nombreSolicitante: string;
  area: string;
  proveedor: string[];
  subtotal: number;
  iva: number;
  totalNeto: number;
  documentoUrl: string;
  items: ItemOC[];
}

interface ItemRecepcion {
  itemOCId: string;
  insumoId: string;
  areaDestinoId: string;
  cantidadPedida: number;
  cantidadRecibida: number;
  notaDiferencia?: string;
}

interface Movimiento {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  subtipo: string;
  estado: string;
  cantidadOriginal: number;
  cantidadBase: number;
  areaDestino: string[];
  costoUnitario: number;
  costoTotal: number;
  documentoOrigen: string;
  insumo: string[];
  notas: string;
  responsable: string;
  fechaCreacion: string;
}

interface Area {
  id: string;
  nombre: string;
}

export default function RecepcionAlmacen() {
  const [vistaActiva, setVistaActiva] = useState<'recepciones' | 'confirmaciones'>('recepciones');
  const [ordenesPendientes, setOrdenesPendientes] = useState<OrdenCompra[]>([]);
  const [movimientosEnEspera, setMovimientosEnEspera] = useState<Movimiento[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompra | null>(null);
  const [itemsRecepcion, setItemsRecepcion] = useState<ItemRecepcion[]>([]);
  const [notasGenerales, setNotasGenerales] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, [vistaActiva]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      if (vistaActiva === 'recepciones') {
        // Cargar órdenes pendientes
        const resOrdenes = await fetch('/api/warehouse/ordenes-pendientes');
        if (resOrdenes.ok) {
          const data = await resOrdenes.json();
          setOrdenesPendientes(data.ordenes || []);
        }

        // Cargar áreas (desde inventario central)
        const resAreas = await fetch('/api/inventario-central?seccion=areas');
        if (resAreas.ok) {
          const data = await resAreas.json();
          setAreas((data.areas || []).filter((a: any) => a.activa));
        }
      } else {
        // Cargar movimientos en espera
        const resMovimientos = await fetch('/api/warehouse/movimientos');
        if (resMovimientos.ok) {
          const data = await resMovimientos.json();
          setMovimientosEnEspera(data.movimientos || []);
        }
      }
    } catch (err) {
      setError('Error al cargar datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const seleccionarOrden = (orden: OrdenCompra) => {
    setOrdenSeleccionada(orden);
    // Inicializar items de recepción con valores por defecto
    const itemsIniciales: ItemRecepcion[] = orden.items.map(item => ({
      itemOCId: item.id,
      insumoId: '', // Deberá ser ingresado manualmente o vinculado
      areaDestinoId: areas[0]?.id || '',
      cantidadPedida: item.cantidad,
      cantidadRecibida: item.cantidad, // Por defecto, recibe la cantidad completa
      notaDiferencia: '',
    }));
    setItemsRecepcion(itemsIniciales);
    setNotasGenerales('');
  };

  const actualizarItemRecepcion = (index: number, campo: keyof ItemRecepcion, valor: any) => {
    const nuevosItems = [...itemsRecepcion];
    nuevosItems[index] = { ...nuevosItems[index], [campo]: valor };
    setItemsRecepcion(nuevosItems);
  };

  const confirmarRecepcion = async () => {
    if (!ordenSeleccionada) return;

    // Validar que todos los items tengan insumo asignado
    const itemsSinInsumo = itemsRecepcion.filter(i => !i.insumoId);
    if (itemsSinInsumo.length > 0) {
      setError('Todos los items deben tener un insumo asignado');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/warehouse/recepciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordenCompraId: ordenSeleccionada.id,
          items: itemsRecepcion,
          notasGenerales,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Recepción creada exitosamente. ${data.movimientosCreados.length} movimientos creados en estado "En Espera".`);
        setOrdenSeleccionada(null);
        setItemsRecepcion([]);
        setNotasGenerales('');
        cargarDatos();
      } else {
        setError(data.error || 'Error al crear la recepción');
      }
    } catch (err) {
      setError('Error al procesar la recepción');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const confirmarMovimiento = async (movimientoId: string) => {
    if (!confirm('¿Confirmar el ingreso de este movimiento al inventario?')) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/warehouse/movimientos/${movimientoId}/confirmar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmarMovimiento: true,
          observacionesFinales: 'Confirmado desde panel de almacén',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Movimiento confirmado. Stock actualizado exitosamente.');
        cargarDatos();
      } else {
        setError(data.error || 'Error al confirmar el movimiento');
      }
    } catch (err) {
      setError('Error al confirmar el movimiento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const rechazarMovimiento = async (movimientoId: string) => {
    const motivoRechazo = prompt('Ingrese el motivo del rechazo:');
    if (!motivoRechazo || !motivoRechazo.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/warehouse/movimientos/${movimientoId}/rechazar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoRechazo }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Movimiento rechazado. No se afectó el stock.');
        cargarDatos();
      } else {
        setError(data.error || 'Error al rechazar el movimiento');
      }
    } catch (err) {
      setError('Error al rechazar el movimiento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            📦 Recepción de Almacén
          </h1>
          <p className="text-gray-600">
            Gestión de recepción de mercancía y confirmación de ingresos al inventario
          </p>
        </header>

        {/* Navegación de vistas */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setVistaActiva('recepciones')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              vistaActiva === 'recepciones'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Recibir Mercancía
          </button>
          <button
            onClick={() => setVistaActiva('confirmaciones')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              vistaActiva === 'confirmaciones'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Confirmar Ingresos
          </button>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">×</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
            <button onClick={() => setSuccess(null)} className="float-right font-bold">×</button>
          </div>
        )}

        {/* Vista: Recibir Mercancía */}
        {vistaActiva === 'recepciones' && !ordenSeleccionada && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Órdenes de Compra Pendientes</h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando órdenes...</p>
              </div>
            ) : ordenesPendientes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-xl">✅ No hay órdenes pendientes de recepción</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {ordenesPendientes.map(orden => (
                  <div
                    key={orden.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => seleccionarOrden(orden)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-blue-600">{orden.idOrdenCompra}</h3>
                        <p className="text-sm text-gray-600">
                          {orden.nombreSolicitante} • {orden.area}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          orden.prioridad === 'Alta' ? 'bg-red-100 text-red-700' :
                          orden.prioridad === 'Media' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {orden.prioridad}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">{new Date(orden.fechaEmision).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                      <span className="text-sm text-gray-600">{orden.items.length} items</span>
                      <span className="text-lg font-bold text-gray-800">
                        ${orden.totalNeto.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vista: Detalle de Recepción */}
        {vistaActiva === 'recepciones' && ordenSeleccionada && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Recibir: {ordenSeleccionada.idOrdenCompra}
              </h2>
              <button
                onClick={() => setOrdenSeleccionada(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                ← Volver
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p><strong>Solicitante:</strong> {ordenSeleccionada.nombreSolicitante}</p>
              <p><strong>Área:</strong> {ordenSeleccionada.area}</p>
              <p><strong>Proveedor:</strong> {ordenSeleccionada.proveedor[0] || 'N/A'}</p>
            </div>

            <div className="space-y-4 mb-6">
              {ordenSeleccionada.items.map((item, index) => (
                <div key={item.id} className="border border-gray-300 rounded-lg p-4">
                  <h4 className="font-bold text-gray-800 mb-3">{item.descripcion}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Cantidad Pedida
                      </label>
                      <input
                        type="number"
                        value={item.cantidad}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Cantidad Recibida *
                      </label>
                      <input
                        type="number"
                        value={itemsRecepcion[index]?.cantidadRecibida || 0}
                        onChange={(e) => actualizarItemRecepcion(index, 'cantidadRecibida', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        ID Insumo *
                      </label>
                      <input
                        type="text"
                        value={itemsRecepcion[index]?.insumoId || ''}
                        onChange={(e) => actualizarItemRecepcion(index, 'insumoId', e.target.value)}
                        placeholder="recXXXXXXXXXXXXX"
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">
                        Área Destino *
                      </label>
                      <select
                        value={itemsRecepcion[index]?.areaDestinoId || ''}
                        onChange={(e) => actualizarItemRecepcion(index, 'areaDestinoId', e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {areas.map(area => (
                          <option key={area.id} value={area.id}>{area.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {itemsRecepcion[index]?.cantidadRecibida !== item.cantidad && (
                    <div className="mt-3">
                      <label className="block text-sm font-semibold text-orange-600 mb-1">
                        Nota de Diferencia
                      </label>
                      <input
                        type="text"
                        value={itemsRecepcion[index]?.notaDiferencia || ''}
                        onChange={(e) => actualizarItemRecepcion(index, 'notaDiferencia', e.target.value)}
                        placeholder="Explique la diferencia..."
                        className="w-full px-3 py-2 border border-orange-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-1">
                Notas Generales (opcional)
              </label>
              <textarea
                value={notasGenerales}
                onChange={(e) => setNotasGenerales(e.target.value)}
                placeholder="Observaciones sobre la recepción..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>

            <button
              onClick={confirmarRecepcion}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Recepción'}
            </button>
          </div>
        )}

        {/* Vista: Confirmar Ingresos */}
        {vistaActiva === 'confirmaciones' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Movimientos en Espera de Confirmación</h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Cargando movimientos...</p>
              </div>
            ) : movimientosEnEspera.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-xl">✅ No hay movimientos pendientes de confirmación</p>
              </div>
            ) : (
              <div className="space-y-4">
                {movimientosEnEspera.map(mov => (
                  <div key={mov.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-purple-600">{mov.codigo || mov.nombre}</h3>
                        <p className="text-sm text-gray-600">
                          {mov.tipo} - {mov.subtipo} • {mov.documentoOrigen}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                        {mov.estado}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                      <div>
                        <p className="text-gray-500">Cantidad</p>
                        <p className="font-semibold">{mov.cantidadOriginal}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Costo Total</p>
                        <p className="font-semibold">${mov.costoTotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Responsable</p>
                        <p className="font-semibold">{mov.responsable}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Fecha</p>
                        <p className="font-semibold">{new Date(mov.fechaCreacion).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {mov.notas && (
                      <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        <strong>Notas:</strong> {mov.notas}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => confirmarMovimiento(mov.id)}
                        disabled={loading}
                        className="flex-1 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓ Confirmar Ingreso
                      </button>
                      <button
                        onClick={() => rechazarMovimiento(mov.id)}
                        disabled={loading}
                        className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        ✗ Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
