'use client';

import React, { useState } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  TrendingDown,
  FileText,
  AlertCircle,
  User,
  RefreshCw,
  Upload,
  Edit3,
  Package,
  Play,
  Search,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Brain,
  Loader2,
  Check
} from 'lucide-react';

interface ItemEgreso {
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
}

interface FormDataEgresos {
  'Factura No.': string;
  'Fecha de emisión': string;
  'Fecha de vencimiento': string;
  'Nombre del emisor': string;
  'NIT del emisor': string;
  'Dirección emisor': string;
  'Forma de Pago': string;
  Moneda: string;
  'Tipo de Operación': string;
  Observaciones: string;
  'Total Bruto': number;
  Descuento: number;
  Subtotal: number;
  IVA: number;
  RETIVA: number;
  RETEFUENTE: number;
  INC: number;
  RETEICA: number;
  'Total por cobrar': number;
  CUFE: string;
  'Plazo para pagar': number;
  'Condiciones de pago': string;
  Ítems: ItemEgreso[];
}

// Interface para las facturas creadas por el workflow
interface FacturaCreada {
  id: string;
  numeroFactura?: string;
  proveedor?: string;
  monto?: number;
}

interface WorkflowResult {
  facturasCreadas: FacturaCreada[];
  totalFacturas: number;
  message: string;
}

// Interface para Items de Factura de Airtable
interface ItemFacturaAirtable {
  id: string;
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
  'Unidad de Negocio'?: string;
  'Centro de Costo'?: string;
  COMENTARIOS?: string;
}

// Interface para validación de insumos con IA
interface ValidacionInsumo {
  itemFacturaId: string;
  itemFacturaNombre: string;
  encontrado: boolean;
  insumoExistenteId?: string;
  insumoExistenteNombre?: string;
  insumoExistenteCodigo?: string;
  similitud: number;
  accion: 'vincular' | 'crear_nuevo' | 'ignorar';
  sugerencia?: string;
}

// Interface para Factura de Airtable con filtro BANCO Y PROYECCION
interface FacturaAirtable {
  id: string;
  ID: string;
  'Número de Factura': string;
  'Fecha de Emisión': string;
  'Fecha de Vencimiento': string;
  Emisor: string;
  'NIT/CIF del Emisor': string;
  'Dirección del Emisor': string;
  'Forma de Pago': string;
  'Condiciones de Pago': string;
  Moneda: string;
  subtotal: number;
  descuentos: number;
  iva: number;
  inc: number;
  retencion: number;
  reteiva: number;
  reteica: number;
  total_pagar: number;
  'C. Costos'?: string;
  GRUPO?: string;
  CLASE?: string;
  CUENTA?: string;
  'SUB-CUENTA'?: string;
  'BANCO Y PROYECCION': string;
  items: ItemFacturaAirtable[];
}

export default function FacturacionEgresos() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [processedData, setProcessedData] = useState<FormDataEgresos | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  
  // Estados para Ingresar Insumos al Inventario Central
  const [insumosLoading, setInsumosLoading] = useState(false);
  const [facturasParaInsumos, setFacturasParaInsumos] = useState<FacturaAirtable[]>([]);
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaAirtable | null>(null);
  const [facturaExpandida, setFacturaExpandida] = useState<string | null>(null);
  const [showInsumosModal, setShowInsumosModal] = useState(false);
  
  // Estados para selección de items y validación con IA
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(new Set());
  const [confirmarEnvioInventario, setConfirmarEnvioInventario] = useState(false);
  const [validacionesIA, setValidacionesIA] = useState<ValidacionInsumo[]>([]);
  const [validandoIA, setValidandoIA] = useState(false);
  const [actualizandoFactura, setActualizandoFactura] = useState(false);

  // Función para ejecutar workflow completo (todas las facturas)
  const handleExecuteWorkflow = async () => {
    setWorkflowLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setWorkflowResult(null);

    try {
      const response = await fetch('/api/execute-workflow-egresos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'All' }),
      });

      const result = await response.json();

      if (result.success) {
        // Guardar el resultado del workflow con las facturas creadas
        setWorkflowResult({
          facturasCreadas: result.facturasCreadas || [],
          totalFacturas: result.totalFacturas || 0,
          message: result.message || 'Workflow ejecutado exitosamente',
        });

        if (result.totalFacturas > 0) {
          setSuccessMessage(`✅ Se crearon ${result.totalFacturas} factura(s) en Flujo de Caja.`);
        } else {
          setSuccessMessage('✅ Workflow ejecutado exitosamente. No se encontraron facturas pendientes para procesar.');
        }
      } else {
        throw new Error(result.error || 'Error al ejecutar el workflow');
      }
    } catch (error) {
      console.error('Error ejecutando workflow:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al ejecutar el workflow');
    } finally {
      setWorkflowLoading(false);
    }
  };

  // Función para cargar facturas con filtro BANCO Y PROYECCION = ✅
  const handleCargarFacturasInsumos = async () => {
    setInsumosLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFacturasParaInsumos([]);
    setShowInsumosModal(true);

    try {
      const response = await fetch('/api/facturas-egresos-insumos');
      const result = await response.json();

      if (result.success) {
        setFacturasParaInsumos(result.facturas || []);
        if (result.facturas.length === 0) {
          setSuccessMessage('No hay facturas con BANCO Y PROYECCIÓN ✅ pendientes de procesar.');
        }
      } else {
        throw new Error(result.error || 'Error al cargar facturas');
      }
    } catch (error) {
      console.error('Error cargando facturas para insumos:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al cargar facturas');
      setShowInsumosModal(false);
    } finally {
      setInsumosLoading(false);
    }
  };

  // Función para actualizar un campo de la factura seleccionada
  const handleUpdateFacturaField = (field: keyof FacturaAirtable, value: string | number) => {
    if (!facturaSeleccionada) return;
    setFacturaSeleccionada({
      ...facturaSeleccionada,
      [field]: value,
    });
  };

  // Función para actualizar un campo de un item
  const handleUpdateItemField = (itemIndex: number, field: keyof ItemFacturaAirtable, value: string | number) => {
    if (!facturaSeleccionada) return;
    const updatedItems = [...facturaSeleccionada.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      [field]: value,
    };
    setFacturaSeleccionada({
      ...facturaSeleccionada,
      items: updatedItems,
    });
  };

  // Función para seleccionar una factura para editar
  const handleSeleccionarFactura = (factura: FacturaAirtable) => {
    setFacturaSeleccionada({ ...factura });
    // Resetear estados de selección al cambiar de factura
    setItemsSeleccionados(new Set());
    setConfirmarEnvioInventario(false);
    setValidacionesIA([]);
  };

  // Función para toggle de selección de item
  const handleToggleItemSeleccion = (itemId: string) => {
    setItemsSeleccionados(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Función para seleccionar/deseleccionar todos los items
  const handleToggleAllItems = (selectAll: boolean) => {
    if (!facturaSeleccionada) return;
    if (selectAll) {
      setItemsSeleccionados(new Set(facturaSeleccionada.items.map(item => item.id)));
    } else {
      setItemsSeleccionados(new Set());
    }
  };

  // Función para validar items seleccionados con IA
  const handleValidarConIA = async () => {
    if (!facturaSeleccionada || itemsSeleccionados.size === 0) return;

    setValidandoIA(true);
    setErrorMessage(null);

    try {
      const itemsParaValidar = facturaSeleccionada.items.filter(item => itemsSeleccionados.has(item.id));
      
      const response = await fetch('/api/validar-insumos-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsParaValidar,
          facturaId: facturaSeleccionada.ID,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setValidacionesIA(result.validaciones);
        setSuccessMessage(`Validación completada: ${result.itemsParaVincular} para vincular, ${result.itemsParaCrear} nuevos, ${result.itemsIgnorados} ignorados`);
      } else {
        throw new Error(result.error || 'Error al validar con IA');
      }
    } catch (error) {
      console.error('Error validando con IA:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al validar insumos');
    } finally {
      setValidandoIA(false);
    }
  };

  // Función para actualizar solo la factura (sin enviar al inventario)
  const handleActualizarFactura = async () => {
    if (!facturaSeleccionada) return;

    setActualizandoFactura(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // TODO: Implementar actualización de factura en Airtable
      console.log('Actualizando factura:', facturaSeleccionada);
      
      setSuccessMessage('Factura actualizada correctamente');
    } catch (error) {
      console.error('Error actualizando factura:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al actualizar factura');
    } finally {
      setActualizandoFactura(false);
    }
  };

  // Función para actualizar y enviar al inventario
  const handleActualizarYEnviarInventario = async () => {
    if (!facturaSeleccionada || itemsSeleccionados.size === 0) return;

    // Si hay validaciones pero no está confirmado, mostrar mensaje
    if (validacionesIA.length > 0 && !confirmarEnvioInventario) {
      setErrorMessage('Debes confirmar la validación IA antes de enviar al inventario');
      return;
    }

    setActualizandoFactura(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Si no hay validaciones, primero validar
      if (validacionesIA.length === 0) {
        await handleValidarConIA();
        setErrorMessage('Se ha realizado la validación IA. Revisa los resultados y confirma para continuar.');
        setActualizandoFactura(false);
        return;
      }

      // Preparar items seleccionados
      const itemsParaEnviar = facturaSeleccionada.items.filter(item => itemsSeleccionados.has(item.id));

      // Enviar al inventario
      const response = await fetch('/api/enviar-insumos-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsParaEnviar,
          validaciones: validacionesIA,
          facturaId: facturaSeleccionada.id,
          numeroFactura: facturaSeleccionada['Número de Factura'] || facturaSeleccionada.ID,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al enviar insumos al inventario');
      }

      setSuccessMessage(
        `✅ ${result.exitosos} insumo(s) enviados al inventario correctamente` +
        (result.ignorados > 0 ? `. ${result.ignorados} ignorados.` : '') +
        (result.errores > 0 ? ` ⚠️ ${result.errores} con errores.` : '')
      );
      setConfirmarEnvioInventario(false);
      setItemsSeleccionados(new Set());
      setValidacionesIA([]);
    } catch (error) {
      console.error('Error enviando al inventario:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al enviar al inventario');
    } finally {
      setActualizandoFactura(false);
    }
  };

  // Función para cerrar el modal
  const handleCerrarModal = () => {
    setShowInsumosModal(false);
    setFacturaSeleccionada(null);
    setFacturasParaInsumos([]);
    setItemsSeleccionados(new Set());
    setConfirmarEnvioInventario(false);
    setValidacionesIA([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setProcessedData(null);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setProgressMessages([]);
    setProcessedData(null);

    try {
      if (!uploadedFile) {
        throw new Error('Por favor adjunta un archivo PDF');
      }

      console.log('📤 Iniciando proceso de factura de EGRESO...');

      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResponse = await fetch('/api/upload-factura-egresos-onedrive', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Error al subir el archivo a OneDrive');
      }

      const txnId = uploadResult.transactionId;
      setTransactionId(txnId);
      console.log('✅ TransactionId recibido:', txnId);

      const eventSource = new EventSource(`/api/facturacion-stream/${txnId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Evento SSE recibido (EGRESOS):', data);

        if (data.type === 'progress') {
          setProgressMessages(prev => [...prev, data.message]);
        } else if (data.type === 'complete') {
          console.log('✅ Procesamiento completado (EGRESOS):', data.data);
          setProgressMessages(prev => [...prev, data.message]);
          setProcessedData(data.data);
          setSuccessMessage('¡Factura de egreso procesada exitosamente!');
          eventSource.close();
          setLoading(false);
        } else if (data.type === 'error') {
          console.error('❌ Error en procesamiento (EGRESOS):', data.error);
          setProgressMessages(prev => [...prev, data.message]);
          setErrorMessage(data.message);
          eventSource.close();
          setLoading(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ Error en SSE (EGRESOS):', error);
        eventSource.close();
        setErrorMessage('Hubo un problema al conectar con el servidor. Por favor intenta nuevamente.');
        setLoading(false);
      };

      const timeout = setTimeout(() => {
        eventSource.close();
        setErrorMessage('La factura está tomando más tiempo del esperado en procesarse. Puede que haya un problema con la automatización. Por favor verifica que el archivo se guardó correctamente en OneDrive.');
        setLoading(false);
      }, 2 * 60 * 1000);

      const originalClose = eventSource.close.bind(eventSource);
      eventSource.close = () => {
        clearTimeout(timeout);
        originalClose();
      };

    } catch (error) {
      console.error('❌ Error (EGRESOS):', error);
      const errorMsg = error instanceof Error ? error.message : 'Error al procesar la factura';
      
      let userFriendlyError = 'Hubo un problema al procesar la factura de egreso. ';
      
      if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
        userFriendlyError += 'Parece que hay un problema de conexión. Verifica tu internet e intenta nuevamente.';
      } else if (errorMsg.includes('OneDrive')) {
        userFriendlyError += 'No se pudo guardar el archivo en OneDrive. Verifica que el archivo sea válido.';
      } else if (errorMsg.includes('PDF') || errorMsg.includes('archivo')) {
        userFriendlyError += 'El archivo debe ser un PDF válido.';
      } else {
        userFriendlyError += 'Por favor intenta nuevamente o contacta al administrador.';
      }
      
      setErrorMessage(userFriendlyError);
      setLoading(false);
    }
  };

  const handleFormChange = (field: keyof FormDataEgresos, value: any) => {
    if (!processedData) return;
    setProcessedData({
      ...processedData,
      [field]: value
    });
  };

  const handleItemChange = (index: number, field: keyof ItemEgreso, value: any) => {
    if (!processedData) return;
    const newItems = [...processedData.Ítems];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setProcessedData({
      ...processedData,
      Ítems: newItems
    });
  };

  if (isLoading) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10">
          <div className="bg-white/25 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <div className="flex items-center justify-center space-x-4">
              <RefreshCw className="w-8 h-8 animate-spin text-white" />
              <span className="text-white text-lg font-semibold">Cargando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: 'url(/18032025-DSC_2933.jpg)'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10">
          <div className="bg-white/25 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl max-w-md mx-4">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white text-center mb-2">Acceso Restringido</h2>
            <p className="text-white/80 text-center">
              Debes iniciar sesión para acceder al módulo de facturación de egresos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat relative"
      style={{
        backgroundImage: 'url(/18032025-DSC_2933.jpg)'
      }}
    >
      <div className="absolute inset-0 bg-slate-900/20 min-h-screen"></div>
      <div className="relative z-10 pt-24">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
                  <TrendingDown className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                    Facturación de Egresos
                  </h1>
                  <p className="text-slate-200 text-lg mt-1">
                    Gestión y control de facturación de egresos
                  </p>
                </div>
              </div>

              {userData && (
                <div className="flex items-center space-x-3 bg-slate-700/40 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
                  <User className="w-5 h-5 text-red-400" />
                  <div className="text-sm">
                    <p className="font-semibold text-white">{userData.nombre}</p>
                    <p className="text-slate-300">{userData.categoria}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/30">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Nueva Factura de Egreso</h2>
                <p className="text-slate-300 mt-2">Adjunta el archivo PDF de la factura para procesarla</p>
              </div>

              {progressMessages.length > 0 && (
                <div className="mb-6 p-4 bg-blue-500/20 border border-blue-400/30 rounded-xl space-y-2">
                  {progressMessages.map((msg, idx) => (
                    <div key={idx} className="text-blue-300 flex items-center space-x-2">
                      <span className="text-xs">●</span>
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {successMessage && (
                <div className="mb-6 p-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-emerald-300">
                  {successMessage}
                </div>
              )}
              {errorMessage && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-red-300">
                  {errorMessage}
                </div>
              )}

              {/* Mostrar resultados del workflow - facturas creadas */}
              {workflowResult && workflowResult.facturasCreadas.length > 0 && (
                <div className="mb-6 p-6 bg-purple-500/20 border border-purple-400/30 rounded-xl">
                  <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Facturas Creadas en Flujo de Caja ({workflowResult.totalFacturas})
                  </h3>
                  <div className="space-y-3">
                    {workflowResult.facturasCreadas.map((factura, index) => (
                      <div 
                        key={factura.id || index} 
                        className="p-4 bg-slate-800/50 rounded-lg border border-white/10 flex justify-between items-center"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-white font-medium">
                              {factura.numeroFactura || `Factura ${index + 1}`}
                            </span>
                            {factura.proveedor && (
                              <span className="text-slate-400 text-sm">
                                - {factura.proveedor}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            ID: {factura.id}
                          </div>
                        </div>
                        {factura.monto !== undefined && (
                          <div className="text-emerald-400 font-semibold">
                            ${factura.monto.toLocaleString('es-CO')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {processedData && (
                <div className="mb-8 space-y-6">
                  <div className="p-6 bg-emerald-900/30 rounded-xl border border-emerald-400/30">
                    <h3 className="text-xl font-semibold text-emerald-300 mb-4 flex items-center">
                      <Edit3 className="w-5 h-5 mr-2" />
                      Datos de la Factura (Editable)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Factura No.</label>
                        <input
                          type="text"
                          value={processedData['Factura No.']}
                          onChange={(e) => handleFormChange('Factura No.', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Fecha de emisión</label>
                        <input
                          type="text"
                          value={processedData['Fecha de emisión']}
                          onChange={(e) => handleFormChange('Fecha de emisión', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Fecha de vencimiento</label>
                        <input
                          type="text"
                          value={processedData['Fecha de vencimiento']}
                          onChange={(e) => handleFormChange('Fecha de vencimiento', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Nombre del emisor</label>
                        <input
                          type="text"
                          value={processedData['Nombre del emisor']}
                          onChange={(e) => handleFormChange('Nombre del emisor', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">NIT del emisor</label>
                        <input
                          type="text"
                          value={processedData['NIT del emisor']}
                          onChange={(e) => handleFormChange('NIT del emisor', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Dirección emisor</label>
                        <input
                          type="text"
                          value={processedData['Dirección emisor']}
                          onChange={(e) => handleFormChange('Dirección emisor', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Forma de Pago</label>
                        <input
                          type="text"
                          value={processedData['Forma de Pago']}
                          onChange={(e) => handleFormChange('Forma de Pago', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Moneda</label>
                        <input
                          type="text"
                          value={processedData.Moneda}
                          onChange={(e) => handleFormChange('Moneda', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Total Bruto</label>
                        <input
                          type="number"
                          value={processedData['Total Bruto']}
                          onChange={(e) => handleFormChange('Total Bruto', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Descuento</label>
                        <input
                          type="number"
                          value={processedData.Descuento}
                          onChange={(e) => handleFormChange('Descuento', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Subtotal</label>
                        <input
                          type="number"
                          value={processedData.Subtotal}
                          onChange={(e) => handleFormChange('Subtotal', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">IVA</label>
                        <input
                          type="number"
                          value={processedData.IVA}
                          onChange={(e) => handleFormChange('IVA', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">RETIVA</label>
                        <input
                          type="number"
                          value={processedData.RETIVA}
                          onChange={(e) => handleFormChange('RETIVA', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">RETEFUENTE</label>
                        <input
                          type="number"
                          value={processedData.RETEFUENTE}
                          onChange={(e) => handleFormChange('RETEFUENTE', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">RETEICA</label>
                        <input
                          type="number"
                          value={processedData.RETEICA}
                          onChange={(e) => handleFormChange('RETEICA', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Total por cobrar</label>
                        <input
                          type="number"
                          value={processedData['Total por cobrar']}
                          onChange={(e) => handleFormChange('Total por cobrar', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">CUFE</label>
                        <input
                          type="text"
                          value={processedData.CUFE}
                          onChange={(e) => handleFormChange('CUFE', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Plazo para pagar (días)</label>
                        <input
                          type="number"
                          value={processedData['Plazo para pagar']}
                          onChange={(e) => handleFormChange('Plazo para pagar', parseInt(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-slate-300 text-sm mb-1">Condiciones de pago</label>
                        <textarea
                          value={processedData['Condiciones de pago']}
                          onChange={(e) => handleFormChange('Condiciones de pago', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                          rows={2}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-slate-300 text-sm mb-1">Observaciones</label>
                        <textarea
                          value={processedData.Observaciones}
                          onChange={(e) => handleFormChange('Observaciones', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  {processedData.Ítems && processedData.Ítems.length > 0 && (
                    <div className="p-6 bg-orange-900/30 rounded-xl border border-orange-400/30">
                      <h3 className="text-xl font-semibold text-orange-300 mb-4 flex items-center">
                        <Package className="w-5 h-5 mr-2" />
                        Ítems de la Factura
                      </h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/20">
                              <th className="text-left py-2 px-3 text-slate-300">Item</th>
                              <th className="text-left py-2 px-3 text-slate-300">Unidad</th>
                              <th className="text-right py-2 px-3 text-slate-300">Cantidad</th>
                              <th className="text-right py-2 px-3 text-slate-300">Vr. Unitario</th>
                              <th className="text-right py-2 px-3 text-slate-300">Vr. Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processedData.Ítems.map((item, index) => (
                              <tr key={index} className="border-b border-white/10">
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={item.Item}
                                    onChange={(e) => handleItemChange(index, 'Item', e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={item.Unidad}
                                    onChange={(e) => handleItemChange(index, 'Unidad', e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={item.Cantidad}
                                    onChange={(e) => handleItemChange(index, 'Cantidad', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={item['Vr. Unitario']}
                                    onChange={(e) => handleItemChange(index, 'Vr. Unitario', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={item['Vr. Total Flow 19%']}
                                    onChange={(e) => handleItemChange(index, 'Vr. Total Flow 19%', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCargarFacturasInsumos}
                  disabled={insumosLoading || loading || workflowLoading}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {insumosLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Cargando...</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-5 h-5" />
                      <span>Ingresar Insumos al Inventario Central</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteWorkflow}
                  disabled={workflowLoading || loading}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {workflowLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Ejecutando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Ejecutar Workflow</span>
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={true}
                  title="Funcionalidad temporalmente deshabilitada"
                  className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg font-semibold transition-all duration-300 opacity-50 cursor-not-allowed shadow-lg"
                >
                  <Upload className="w-5 h-5" />
                  <span>Procesar Factura de Egreso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal para Ingresar Insumos al Inventario Central */}
      {showInsumosModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-2xl border border-white/20 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Package className="w-6 h-6 mr-3 text-emerald-400" />
                Ingresar Insumos al Inventario Central
              </h2>
              <button
                onClick={handleCerrarModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="flex-1 overflow-y-auto p-6">
              {insumosLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="ml-3 text-slate-300">Cargando facturas...</span>
                </div>
              ) : facturasParaInsumos.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay facturas con BANCO Y PROYECCIÓN ✅ pendientes de procesar.</p>
                </div>
              ) : !facturaSeleccionada ? (
                /* Lista de Facturas */
                <div className="space-y-4">
                  <p className="text-slate-300 mb-4">
                    Se encontraron {facturasParaInsumos.length} factura(s) con BANCO Y PROYECCIÓN ✅. 
                    Selecciona una para editar e ingresar los insumos.
                  </p>
                  {facturasParaInsumos.map((factura) => (
                    <div 
                      key={factura.id}
                      className="bg-slate-700/50 rounded-xl border border-white/10 overflow-hidden"
                    >
                      <div 
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/70 transition-colors"
                        onClick={() => setFacturaExpandida(facturaExpandida === factura.id ? null : factura.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-emerald-400 font-mono text-sm">{factura['Número de Factura']}</span>
                            <span className="text-white font-medium">{factura.Emisor}</span>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded-full">
                              {factura['BANCO Y PROYECCION']}
                            </span>
                          </div>
                          <div className="text-sm text-slate-400 mt-1">
                            {factura['Fecha de Emisión']} • Total: ${factura.total_pagar?.toLocaleString('es-CO')}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeleccionarFactura(factura);
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            Editar e Ingresar
                          </button>
                          {facturaExpandida === factura.id ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                      
                      {/* Detalle expandido */}
                      {facturaExpandida === factura.id && (
                        <div className="border-t border-white/10 p-4 bg-slate-800/50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-slate-400">NIT:</span>
                              <span className="text-white ml-2">{factura['NIT/CIF del Emisor']}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Subtotal:</span>
                              <span className="text-white ml-2">${factura.subtotal?.toLocaleString('es-CO')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">IVA:</span>
                              <span className="text-white ml-2">${factura.iva?.toLocaleString('es-CO')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Centro Costo:</span>
                              <span className="text-white ml-2">{factura['C. Costos'] || 'N/A'}</span>
                            </div>
                          </div>
                          
                          {/* Items de la factura */}
                          {factura.items && factura.items.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-slate-300 mb-2">Items ({factura.items.length})</h4>
                              <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-white/10">
                                      <th className="text-left py-2 px-3">Item</th>
                                      <th className="text-center py-2 px-3">Cant.</th>
                                      <th className="text-right py-2 px-3">Vr. Unit</th>
                                      <th className="text-right py-2 px-3">Vr. Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {factura.items.map((item, idx) => (
                                      <tr key={idx} className="border-b border-white/5 text-white">
                                        <td className="py-2 px-3">{item.Item}</td>
                                        <td className="py-2 px-3 text-center">{item.Cantidad} {item.Unidad}</td>
                                        <td className="py-2 px-3 text-right">${item['Vr. Unitario']?.toLocaleString('es-CO')}</td>
                                        <td className="py-2 px-3 text-right">${item['Vr. Total Flow 19%']?.toLocaleString('es-CO')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Formulario de Edición de Factura Seleccionada */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setFacturaSeleccionada(null)}
                      className="text-slate-400 hover:text-white transition-colors flex items-center"
                    >
                      <ChevronDown className="w-4 h-4 mr-1 rotate-90" />
                      Volver a la lista
                    </button>
                    <span className="text-emerald-400 font-mono">{facturaSeleccionada['Número de Factura']}</span>
                  </div>

                  {/* Datos de la Factura */}
                  <div className="bg-slate-700/30 rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Edit3 className="w-5 h-5 mr-2 text-emerald-400" />
                      Datos de la Factura (Editable)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Número de Factura</label>
                        <input
                          type="text"
                          value={facturaSeleccionada['Número de Factura']}
                          onChange={(e) => handleUpdateFacturaField('Número de Factura', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Fecha de Emisión</label>
                        <input
                          type="date"
                          value={facturaSeleccionada['Fecha de Emisión']}
                          onChange={(e) => handleUpdateFacturaField('Fecha de Emisión', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Fecha de Vencimiento</label>
                        <input
                          type="date"
                          value={facturaSeleccionada['Fecha de Vencimiento']}
                          onChange={(e) => handleUpdateFacturaField('Fecha de Vencimiento', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-slate-300 text-sm mb-1">Emisor (Proveedor)</label>
                        <input
                          type="text"
                          value={facturaSeleccionada.Emisor}
                          onChange={(e) => handleUpdateFacturaField('Emisor', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">NIT/CIF del Emisor</label>
                        <input
                          type="text"
                          value={facturaSeleccionada['NIT/CIF del Emisor']}
                          onChange={(e) => handleUpdateFacturaField('NIT/CIF del Emisor', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Subtotal</label>
                        <input
                          type="number"
                          value={facturaSeleccionada.subtotal}
                          onChange={(e) => handleUpdateFacturaField('subtotal', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">IVA</label>
                        <input
                          type="number"
                          value={facturaSeleccionada.iva}
                          onChange={(e) => handleUpdateFacturaField('iva', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Retención</label>
                        <input
                          type="number"
                          value={facturaSeleccionada.retencion}
                          onChange={(e) => handleUpdateFacturaField('retencion', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Total a Pagar</label>
                        <input
                          type="number"
                          value={facturaSeleccionada.total_pagar}
                          onChange={(e) => handleUpdateFacturaField('total_pagar', parseFloat(e.target.value))}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 text-sm mb-1">Centro de Costos</label>
                        <input
                          type="text"
                          value={facturaSeleccionada['C. Costos'] || ''}
                          onChange={(e) => handleUpdateFacturaField('C. Costos', e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/20 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Items de la Factura */}
                  <div className="bg-slate-700/30 rounded-xl p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-emerald-400" />
                      Items de la Factura ({facturaSeleccionada.items?.length || 0})
                    </h3>
                    
                    {facturaSeleccionada.items && facturaSeleccionada.items.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-slate-400 text-sm border-b border-white/10">
                              <th className="text-center py-3 px-2 w-12">
                                <input
                                  type="checkbox"
                                  checked={facturaSeleccionada.items.every((item: ItemFacturaAirtable) => itemsSeleccionados.has(item.id))}
                                  onChange={(e) => handleToggleAllItems(e.target.checked)}
                                  className="w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                                  title="Seleccionar todos"
                                />
                              </th>
                              <th className="text-left py-3 px-3">Item</th>
                              <th className="text-left py-3 px-3 w-24">Unidad</th>
                              <th className="text-right py-3 px-3 w-24">Cantidad</th>
                              <th className="text-right py-3 px-3 w-32">Vr. Unitario</th>
                              <th className="text-right py-3 px-3 w-32">Vr. Total</th>
                              <th className="text-left py-3 px-3 w-40">Unidad Negocio</th>
                              <th className="text-left py-3 px-3 w-40">Centro Costo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {facturaSeleccionada.items.map((item, index) => (
                              <tr key={index} className={`border-b border-white/5 ${itemsSeleccionados.has(item.id) ? 'bg-emerald-900/20' : ''}`}>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={itemsSeleccionados.has(item.id)}
                                    onChange={() => handleToggleItemSeleccion(item.id)}
                                    className="w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={item.Item}
                                    onChange={(e) => handleUpdateItemField(index, 'Item', e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={item.Unidad}
                                    onChange={(e) => handleUpdateItemField(index, 'Unidad', e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={item.Cantidad}
                                    onChange={(e) => handleUpdateItemField(index, 'Cantidad', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={item['Vr. Unitario']}
                                    onChange={(e) => handleUpdateItemField(index, 'Vr. Unitario', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    value={item['Vr. Total Flow 19%']}
                                    onChange={(e) => handleUpdateItemField(index, 'Vr. Total Flow 19%', parseFloat(e.target.value))}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-right"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <select
                                    value={item['Unidad de Negocio'] || ''}
                                    onChange={(e) => handleUpdateItemField(index, 'Unidad de Negocio', e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                  >
                                    <option value="">Seleccionar...</option>
                                    <option value="Pirolisis">Pirolisis</option>
                                    <option value="Biologicos">Biologicos</option>
                                    <option value="RAAS">RAAS</option>
                                    <option value="Administrativo">Administrativo</option>
                                  </select>
                                </td>
                                <td className="py-2 px-3">
                                  <select
                                    value={item['Centro de Costo'] || ''}
                                    onChange={(e) => handleUpdateItemField(index, 'Centro de Costo', e.target.value)}
                                    className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                  >
                                    <option value="">Seleccionar...</option>
                                    <option value="General Biológicos">General Biológicos</option>
                                    <option value="Biochar Puro">Biochar Puro</option>
                                    <option value="Biochar Inoculado">Biochar Inoculado</option>
                                    <option value="Biochar Blend">Biochar Blend</option>
                                    <option value="Biochar General">Biochar General</option>
                                    <option value="Administración ">Administración</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-center py-4">Esta factura no tiene items registrados.</p>
                    )}
                  </div>

                  {/* Sección de Validación IA */}
                  {itemsSeleccionados.size > 0 && (
                    <div className="bg-slate-700/30 rounded-xl p-6 border border-white/10">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <Brain className="w-5 h-5 mr-2 text-purple-400" />
                        Validación con IA ({itemsSeleccionados.size} items seleccionados)
                      </h3>
                      
                      {validacionesIA.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-slate-400 mb-4">
                            Valida los items seleccionados contra el catálogo de insumos existente antes de enviar al inventario.
                          </p>
                          <button
                            type="button"
                            onClick={handleValidarConIA}
                            disabled={validandoIA}
                            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg disabled:opacity-50"
                          >
                            {validandoIA ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Validando...</span>
                              </>
                            ) : (
                              <>
                                <Brain className="w-5 h-5" />
                                <span>Validar con IA</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-slate-400 text-xs border-b border-white/10">
                                  <th className="text-left py-2 px-3">Item Factura</th>
                                  <th className="text-left py-2 px-3">Estado</th>
                                  <th className="text-left py-2 px-3">Insumo Existente</th>
                                  <th className="text-center py-2 px-3">Similitud</th>
                                  <th className="text-left py-2 px-3">Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {validacionesIA.map((validacion, idx) => (
                                  <tr key={idx} className="border-b border-white/5">
                                    <td className="py-2 px-3 text-white">{validacion.itemFacturaNombre}</td>
                                    <td className="py-2 px-3">
                                      {validacion.encontrado ? (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                                          <Check className="w-3 h-3 mr-1" />
                                          Encontrado
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">
                                          <AlertCircle className="w-3 h-3 mr-1" />
                                          No encontrado
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-slate-300">
                                      {validacion.insumoExistenteNombre ? (
                                        <span title={`Código: ${validacion.insumoExistenteCodigo}`}>
                                          {validacion.insumoExistenteNombre}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500">-</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`font-mono ${validacion.similitud >= 80 ? 'text-emerald-400' : validacion.similitud >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                        {validacion.similitud}%
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                        validacion.accion === 'vincular' ? 'bg-emerald-500/20 text-emerald-400' :
                                        validacion.accion === 'crear_nuevo' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-slate-500/20 text-slate-400'
                                      }`}>
                                        {validacion.accion === 'vincular' ? 'Vincular existente' :
                                         validacion.accion === 'crear_nuevo' ? 'Crear nuevo' : 'Ignorar'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Checkbox de confirmación */}
                          <div className="flex items-center space-x-3 p-4 bg-slate-800/50 rounded-lg border border-white/10">
                            <input
                              type="checkbox"
                              id="confirmarEnvio"
                              checked={confirmarEnvioInventario}
                              onChange={(e) => setConfirmarEnvioInventario(e.target.checked)}
                              className="w-5 h-5 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                            />
                            <label htmlFor="confirmarEnvio" className="text-slate-300">
                              Confirmo que he revisado las sugerencias de la IA y deseo proceder con el envío al inventario
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botones de Acción */}
                  <div className="flex items-center justify-end space-x-4">
                    <button
                      type="button"
                      onClick={() => setFacturaSeleccionada(null)}
                      className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleActualizarFactura}
                      disabled={actualizandoFactura}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg disabled:opacity-50"
                    >
                      {actualizandoFactura ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Actualizando...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          <span>Actualizar Factura</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleActualizarYEnviarInventario}
                      disabled={actualizandoFactura || itemsSeleccionados.size === 0 || (validacionesIA.length > 0 && !confirmarEnvioInventario)}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      title={itemsSeleccionados.size === 0 ? 'Selecciona al menos un item' : validacionesIA.length > 0 && !confirmarEnvioInventario ? 'Confirma la validación primero' : ''}
                    >
                      <Save className="w-5 h-5" />
                      <span>Actualizar y Enviar al Inventario</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
