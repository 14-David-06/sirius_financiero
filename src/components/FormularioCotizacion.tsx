'use client';

import { useState, useEffect, useCallback } from 'react';
import { CompraCompleta, CompraItem } from '@/types/compras';

interface Proveedor {
  id: string;
  nombre: string;
  nit: string;
  ciudad: string;
}

interface ItemCotizadoForm {
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  valorUnitario: number;
  valorTotal: number;
  comentarios: string;
  itemCompraId: string;
}

interface ExtractedData {
  proveedor: {
    nombre: string | null;
    nit: string | null;
    ciudad: string | null;
    telefono: string | null;
    correo: string | null;
  };
  cotizacion: {
    numero: string | null;
    fecha: string | null;
    validez: string | null;
    formaPago: string | null;
    tiempoEntrega: string | null;
    comentarios: string | null;
  };
  items: Array<{
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    valorUnitario: number;
    valorTotal: number;
    comentarios: string | null;
  }>;
  valorTotal: number | null;
}

interface FormularioCotizacionProps {
  compra: CompraCompleta;
  onClose: () => void;
  onSaved: () => void;
}

const UNIDADES_MEDIDA = [
  'Unidad', 'Kg', 'Lt', 'Galon', 'm2', 'm3',
  'Caja', 'Bulto', 'Rollo', 'Paquete', 'Global', 'Servicio'
];

const ESTADOS_COTIZACION = ['Pendiente', 'Enviada', 'Recibida', 'Aceptada', 'Rechazada'];

export default function FormularioCotizacion({ compra, onClose, onSaved }: FormularioCotizacionProps) {
  // Fase del modal
  const [phase, setPhase] = useState<'upload' | 'form'>('upload');
  
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');
  
  // Form state
  const [fileUrl, setFileUrl] = useState('');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorId, setProveedorId] = useState('');
  const [proveedorSearch, setProveedorSearch] = useState('');
  const [showProveedorDropdown, setShowProveedorDropdown] = useState(false);
  const [idCotizacion, setIdCotizacion] = useState('');
  const [fecha, setFecha] = useState('');
  const [estado, setEstado] = useState('Recibida');
  const [comentarios, setComentarios] = useState('');
  const [items, setItems] = useState<ItemCotizadoForm[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Cargar proveedores
  useEffect(() => {
    fetch('/api/proveedores')
      .then(res => res.json())
      .then(data => {
        if (data.proveedores) setProveedores(data.proveedores);
      })
      .catch(err => console.error('Error cargando proveedores:', err));
  }, []);

  const filteredProveedores = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(proveedorSearch.toLowerCase()) ||
    p.nit.includes(proveedorSearch)
  );

  const valorTotal = items.reduce((sum, item) => sum + (item.valorTotal || 0), 0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setExtractionError('Solo se permiten archivos PDF, JPG, PNG o WebP');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setExtractionError('El archivo no puede superar 10MB');
      return;
    }

    setSelectedFile(file);
    setExtractionError('');
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setExtractionError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('compraId', compra.id);
      formData.append('proveedorNombre', compra.razonSocialProveedor || compra.nombreProveedor?.[0] || 'SinProveedor');
      formData.append('solicitanteNombre', compra.nombreSolicitante || 'SinNombre');

      const response = await fetch('/api/cotizaciones/extract', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al procesar el archivo');
      }

      setFileUrl(result.fileUrl);

      // Prellenar formulario con datos extraídos
      if (result.extractedData) {
        prefillForm(result.extractedData);
      } else {
        // Si no se pudo extraer, inicializar vacío
        initEmptyForm();
      }

      setPhase('form');
    } catch (error) {
      setExtractionError(error instanceof Error ? error.message : 'Error al procesar el archivo');
    } finally {
      setIsExtracting(false);
    }
  };

  const prefillForm = (data: ExtractedData) => {
    // ID de cotización
    const cotNum = data.cotizacion?.numero || '';
    setIdCotizacion(cotNum || `COT-${compra.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);

    // Fecha
    setFecha(data.cotizacion?.fecha || new Date().toISOString().split('T')[0]);

    // Estado
    setEstado('Recibida');

    // Comentarios - combinar info útil
    const commentParts: string[] = [];
    if (data.cotizacion?.validez) commentParts.push(`Validez: ${data.cotizacion.validez}`);
    if (data.cotizacion?.formaPago) commentParts.push(`Forma de pago: ${data.cotizacion.formaPago}`);
    if (data.cotizacion?.tiempoEntrega) commentParts.push(`Tiempo entrega: ${data.cotizacion.tiempoEntrega}`);
    if (data.cotizacion?.comentarios) commentParts.push(data.cotizacion.comentarios);
    setComentarios(commentParts.join('\n'));

    // Buscar proveedor por NIT o nombre
    if (data.proveedor?.nit || data.proveedor?.nombre) {
      const match = proveedores.find(p => {
        if (data.proveedor?.nit && p.nit === data.proveedor.nit) return true;
        if (data.proveedor?.nombre && p.nombre.toLowerCase().includes(data.proveedor.nombre.toLowerCase())) return true;
        return false;
      });
      if (match) {
        setProveedorId(match.id);
        setProveedorSearch(match.nombre);
      } else if (data.proveedor?.nombre) {
        setProveedorSearch(data.proveedor.nombre);
      }
    }

    // Items
    if (data.items?.length > 0) {
      setItems(data.items.map(item => ({
        descripcion: item.descripcion || '',
        cantidad: item.cantidad || 0,
        unidadMedida: UNIDADES_MEDIDA.includes(item.unidadMedida) ? item.unidadMedida : 'Unidad',
        valorUnitario: item.valorUnitario || 0,
        valorTotal: item.valorTotal || (item.cantidad || 0) * (item.valorUnitario || 0),
        comentarios: item.comentarios || '',
        itemCompraId: '',
      })));
    } else {
      initEmptyForm();
    }
  };

  const initEmptyForm = () => {
    setIdCotizacion(`COT-${compra.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);
    setFecha(new Date().toISOString().split('T')[0]);
    setEstado('Recibida');
    setItems([{
      descripcion: '',
      cantidad: 0,
      unidadMedida: 'Unidad',
      valorUnitario: 0,
      valorTotal: 0,
      comentarios: '',
      itemCompraId: '',
    }]);
  };

  const updateItem = (index: number, field: keyof ItemCotizadoForm, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalcular valor total si cambian cantidad o unitario
      if (field === 'cantidad' || field === 'valorUnitario') {
        updated[index].valorTotal = Number(updated[index].cantidad) * Number(updated[index].valorUnitario);
      }
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      descripcion: '',
      cantidad: 0,
      unidadMedida: 'Unidad',
      valorUnitario: 0,
      valorTotal: 0,
      comentarios: '',
      itemCompraId: '',
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Validaciones
    if (!idCotizacion.trim()) {
      setSaveError('El ID de cotización es requerido');
      return;
    }
    if (!fecha) {
      setSaveError('La fecha es requerida');
      return;
    }
    if (items.some(item => !item.descripcion.trim())) {
      setSaveError('Todos los items deben tener una descripción');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const response = await fetch('/api/cotizaciones/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compraId: compra.id,
          proveedorId: proveedorId || undefined,
          idCotizacion,
          fecha,
          valorTotal,
          documentoUrl: fileUrl,
          solicitante: compra.nombreSolicitante,
          estado,
          comentarios: comentarios || undefined,
          items: items.map(item => ({
            ...item,
            itemCompraId: item.itemCompraId || undefined,
            comentarios: item.comentarios || undefined,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al guardar la cotización');
      }

      onSaved();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  };

  // Click outside para cerrar dropdown
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (showProveedorDropdown) setShowProveedorDropdown(false);
  }, [showProveedorDropdown]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={handleBackdropClick}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-amber-900/30 to-orange-900/30">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              📋 {phase === 'upload' ? 'Cargar Cotización' : 'Formulario de Cotización'}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              Solicitud de: <span className="text-amber-400">{compra.nombreSolicitante}</span> — {compra.areaCorrespondiente}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* === FASE 1: UPLOAD === */}
          {phase === 'upload' && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-lg font-semibold text-white mb-2">Selecciona el documento de cotización</h3>
                <p className="text-white/60 text-sm mb-6">
                  La IA extraerá automáticamente los datos del documento para pre-llenar el formulario
                </p>

                <input
                  type="file"
                  id="cotizacion-file"
                  onChange={handleFileSelect}
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                />
                <label
                  htmlFor="cotizacion-file"
                  className="cursor-pointer inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
                >
                  📤 Seleccionar archivo
                </label>

                {selectedFile && (
                  <div className="mt-4 bg-white/10 rounded-lg p-3 inline-flex items-center gap-3">
                    <span className="text-2xl">{selectedFile.type === 'application/pdf' ? '📄' : '🖼️'}</span>
                    <div className="text-left">
                      <p className="text-white text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-white/50 text-xs">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                )}

                {extractionError && (
                  <p className="mt-4 text-red-400 text-sm">{extractionError}</p>
                )}
              </div>

              {/* Items de la solicitud de compra original */}
              {compra.items?.length > 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white/80 mb-3">📦 Items de la solicitud original ({compra.items.length})</h4>
                  <div className="space-y-2">
                    {compra.items.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 text-sm bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-white/40 font-mono text-xs">{idx + 1}</span>
                        <span className="text-white flex-1">{item.objeto}</span>
                        <span className="text-white/60">×{item.cantidad}</span>
                        <span className="text-amber-400 font-medium">{formatCurrency(item.valorItem)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botón para omitir extracción */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExtract}
                  disabled={!selectedFile || isExtracting}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isExtracting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Extrayendo datos con IA...
                    </>
                  ) : (
                    <>🤖 Subir y Extraer Datos</>
                  )}
                </button>
                <button
                  onClick={() => { initEmptyForm(); setPhase('form'); }}
                  className="text-white/50 hover:text-white text-sm underline"
                >
                  Llenar manualmente
                </button>
              </div>
            </div>
          )}

          {/* === FASE 2: FORMULARIO === */}
          {phase === 'form' && (
            <div className="space-y-6">
              
              {/* Info del documento subido */}
              {fileUrl && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-green-400">✅</span>
                  <span className="text-green-300 text-sm flex-1">Documento cargado correctamente</span>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 text-sm underline hover:text-green-300">
                    Ver documento
                  </a>
                </div>
              )}

              {/* Datos de la cotización */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                <h3 className="text-white font-semibold flex items-center gap-2">📝 Datos de la Cotización</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* ID Cotización */}
                  <div>
                    <label className="block text-white/60 text-xs mb-1">ID Cotización *</label>
                    <input
                      type="text"
                      value={idCotizacion}
                      onChange={e => setIdCotizacion(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                      placeholder="COT-001"
                    />
                  </div>

                  {/* Fecha */}
                  <div>
                    <label className="block text-white/60 text-xs mb-1">Fecha *</label>
                    <input
                      type="date"
                      value={fecha}
                      onChange={e => setFecha(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                    />
                  </div>

                  {/* Estado */}
                  <div>
                    <label className="block text-white/60 text-xs mb-1">Estado</label>
                    <select
                      value={estado}
                      onChange={e => setEstado(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                    >
                      {ESTADOS_COTIZACION.map(e => (
                        <option key={e} value={e} className="bg-gray-900">{e}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Proveedor con búsqueda */}
                <div className="relative">
                  <label className="block text-white/60 text-xs mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={proveedorSearch}
                    onChange={e => {
                      setProveedorSearch(e.target.value);
                      setShowProveedorDropdown(true);
                      if (!e.target.value) setProveedorId('');
                    }}
                    onFocus={() => setShowProveedorDropdown(true)}
                    placeholder="Buscar por nombre o NIT..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                  {proveedorId && (
                    <span className="absolute right-3 top-7 text-green-400 text-sm">✓</span>
                  )}
                  {showProveedorDropdown && proveedorSearch && filteredProveedores.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-white/20 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {filteredProveedores.slice(0, 20).map(p => (
                        <button
                          key={p.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setProveedorId(p.id);
                            setProveedorSearch(p.nombre);
                            setShowProveedorDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-white/10 text-sm flex items-center justify-between ${
                            proveedorId === p.id ? 'bg-amber-500/20 text-amber-300' : 'text-white'
                          }`}
                        >
                          <span>{p.nombre}</span>
                          <span className="text-white/40 text-xs">{p.nit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comentarios */}
                <div>
                  <label className="block text-white/60 text-xs mb-1">Comentarios / Condiciones</label>
                  <textarea
                    value={comentarios}
                    onChange={e => setComentarios(e.target.value)}
                    rows={3}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                    placeholder="Validez, forma de pago, tiempo de entrega..."
                  />
                </div>
              </div>

              {/* Items cotizados */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold flex items-center gap-2">📦 Items Cotizados ({items.length})</h3>
                  <button
                    onClick={addItem}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                  >
                    + Agregar Item
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/40 text-xs font-mono">Item #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-red-400/60 hover:text-red-400 text-xs"
                        >
                          ✕ Eliminar
                        </button>
                      )}
                    </div>

                    {/* Fila 1: Descripción */}
                    <div>
                      <label className="block text-white/60 text-xs mb-1">Descripción *</label>
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={e => updateItem(idx, 'descripcion', e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                        placeholder="Descripción del producto o servicio"
                      />
                    </div>

                    {/* Fila 2: Cantidad, Unidad, Valor Unitario, Total */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-white/60 text-xs mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={item.cantidad || ''}
                          onChange={e => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-white/60 text-xs mb-1">Unidad</label>
                        <select
                          value={item.unidadMedida}
                          onChange={e => updateItem(idx, 'unidadMedida', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                        >
                          {UNIDADES_MEDIDA.map(u => (
                            <option key={u} value={u} className="bg-gray-900">{u}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-white/60 text-xs mb-1">Valor Unitario</label>
                        <input
                          type="number"
                          value={item.valorUnitario || ''}
                          onChange={e => updateItem(idx, 'valorUnitario', parseFloat(e.target.value) || 0)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-white/60 text-xs mb-1">Total</label>
                        <input
                          type="text"
                          value={formatCurrency(item.valorTotal)}
                          readOnly
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-amber-400 text-sm font-medium cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Fila 3: Vincular a item de compra + comentarios */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-white/60 text-xs mb-1">Vincular a Item de Solicitud</label>
                        <select
                          value={item.itemCompraId}
                          onChange={e => updateItem(idx, 'itemCompraId', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                        >
                          <option value="" className="bg-gray-900">— Sin vincular —</option>
                          {compra.items?.map(ci => (
                            <option key={ci.id} value={ci.id} className="bg-gray-900">
                              {ci.objeto} (×{ci.cantidad})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-white/60 text-xs mb-1">Comentarios</label>
                        <input
                          type="text"
                          value={item.comentarios}
                          onChange={e => updateItem(idx, 'comentarios', e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                          placeholder="Observaciones del item"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Error */}
              {saveError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm">❌ {saveError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === 'form' && (
          <div className="border-t border-white/10 p-4 bg-gray-900/80 flex items-center justify-between">
            <div className="text-white">
              <span className="text-white/60 text-sm">Valor Total: </span>
              <span className="text-xl font-bold text-amber-400">{formatCurrency(valorTotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPhase('upload')}
                className="text-white/50 hover:text-white px-4 py-2 text-sm"
              >
                ← Volver
              </button>
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-2 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>💾 Guardar Cotización</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
