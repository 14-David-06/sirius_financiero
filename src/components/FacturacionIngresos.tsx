'use client';

import React, { useState } from 'react';
import { useAuthSession } from '@/lib/hooks/useAuthSession';
import { 
  TrendingUp,
  FileText,
  AlertCircle,
  DollarSign,
  Calendar,
  User,
  RefreshCw,
  Upload,
  Save,
  X
} from 'lucide-react';

interface FormData {
  grupo: string;
  clase: string;
  cuenta: string;
  fechaEmision: string;
  facturaNo: string;
  nombreComprador: string;
  condicionesPago: string;
  plazoParaPagar: string;
  fechaVencimiento: string;
  totalBruto: string;
  descuento: string;
  subtotal: string;
  iva: string;
  totalPorCobrar: string;
  reteica: string;
  reteiva: string;
  retefuente: string;
  observaciones: string;
  cufe: string;
  idDocumento: string;
}

export default function FacturacionIngresos() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [processedData, setProcessedData] = useState<any>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    grupo: 'Ingreso',
    clase: 'Operacional',
    cuenta: 'Ingreso de Actividades Ordinarias',
    fechaEmision: '',
    facturaNo: '',
    nombreComprador: '',
    condicionesPago: 'Credito 15 dias',
    plazoParaPagar: '15',
    fechaVencimiento: '',
    totalBruto: '',
    descuento: '0',
    subtotal: '',
    iva: '0',
    totalPorCobrar: '',
    reteica: '0',
    reteiva: '0',
    retefuente: '0',
    observaciones: '',
    cufe: '',
    idDocumento: '',
  });

  // Calcular automáticamente los totales
  const calcularTotales = (data: Partial<FormData>) => {
    const totalBruto = parseFloat(data.totalBruto || '0');
    const descuento = parseFloat(data.descuento || '0');
    const iva = parseFloat(data.iva || '0');
    
    const subtotal = totalBruto - descuento;
    const totalPorCobrar = subtotal + iva;
    
    return {
      subtotal: subtotal.toString(),
      totalPorCobrar: totalPorCobrar.toString(),
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    
    // Recalcular totales si cambia algún valor relacionado
    if (['totalBruto', 'descuento', 'iva'].includes(name)) {
      const totales = calcularTotales(newFormData);
      newFormData.subtotal = totales.subtotal;
      newFormData.totalPorCobrar = totales.totalPorCobrar;
    }
    
    setFormData(newFormData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
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
      // Validar que haya archivo
      if (!uploadedFile) {
        throw new Error('Por favor adjunta un archivo PDF');
      }

      console.log('📤 Iniciando proceso de factura...');

      // Subir archivo a OneDrive
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResponse = await fetch('/api/upload-factura-onedrive', {
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

      // Conectar a Server-Sent Events para recibir actualizaciones
      const eventSource = new EventSource(`/api/facturacion-stream/${txnId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Evento SSE recibido:', data);

        if (data.type === 'progress') {
          // Agregar mensaje de progreso
          setProgressMessages(prev => [...prev, data.message]);
        } else if (data.type === 'complete') {
          // Procesamiento completado
          console.log('✅ Procesamiento completado:', data.data);
          setProgressMessages(prev => [...prev, data.message]);
          setProcessedData(data.data);
          setSuccessMessage('¡Factura procesada exitosamente!');
          eventSource.close();
          setLoading(false);
        } else if (data.type === 'error') {
          // Error en el procesamiento
          console.error('❌ Error en procesamiento:', data.error);
          setProgressMessages(prev => [...prev, data.message]);
          setErrorMessage(data.message);
          eventSource.close();
          setLoading(false);
        }
      };

      eventSource.onerror = (error) => {
        console.error('❌ Error en SSE:', error);
        eventSource.close();
        setErrorMessage('Hubo un problema al conectar con el servidor. Por favor intenta nuevamente.');
        setLoading(false);
      };

      // Timeout de 2 minutos (más razonable)
      const timeout = setTimeout(() => {
        eventSource.close();
        setErrorMessage('La factura está tomando más tiempo del esperado en procesarse. Puede que haya un problema con la automatización. Por favor verifica que el archivo se guardó correctamente en OneDrive.');
        setLoading(false);
      }, 2 * 60 * 1000);

      // Limpiar timeout si se completa antes
      const originalClose = eventSource.close.bind(eventSource);
      eventSource.close = () => {
        clearTimeout(timeout);
        originalClose();
      };

    } catch (error) {
      console.error('❌ Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error al procesar la factura';
      
      // Convertir errores técnicos a lenguaje simple
      let userFriendlyError = 'Hubo un problema al procesar la factura. ';
      
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
              Debes iniciar sesión para acceder al módulo de facturación de ingresos.
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
          {/* Header */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 mb-6 border border-white/30">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                    Facturación de Ingresos
                  </h1>
                  <p className="text-slate-200 text-lg mt-1">
                    Gestión y control de facturación de ingresos
                  </p>
                </div>
              </div>

              {userData && (
                <div className="flex items-center space-x-3 bg-slate-700/40 backdrop-blur-sm px-6 py-3 rounded-xl border border-white/20">
                  <User className="w-5 h-5 text-emerald-400" />
                  <div className="text-sm">
                    <p className="font-semibold text-white">{userData.nombre}</p>
                    <p className="text-slate-300">{userData.categoria}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contenido Principal */}
          <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/30">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              {/* Header del formulario */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">Nueva Factura de Ingreso</h2>
                <p className="text-slate-300 mt-2">Adjunta el archivo PDF de la factura para procesarla</p>
              </div>

              {/* Mensajes de progreso */}
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

              {/* Mensajes de éxito/error */}
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

              {/* Formulario pre-llenado con datos procesados */}
              {processedData && (
                <div className="mb-8 p-6 bg-emerald-900/30 rounded-xl border border-emerald-400/30">
                  <h3 className="text-xl font-semibold text-emerald-300 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Datos Extraídos de la Factura
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {Object.entries(processedData).map(([key, value]) => (
                      <div key={key} className="bg-slate-800/50 p-3 rounded-lg">
                        <span className="text-slate-400 block mb-1">{key}:</span>
                        <span className="text-white font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                {/* Sección 1: Adjuntar Factura */}
                <div className="mb-8 p-6 bg-slate-700/30 rounded-xl border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">Adjuntar Factura (PDF)</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="flex items-center justify-center space-x-2 w-full bg-slate-800/50 border-2 border-dashed border-white/20 hover:border-emerald-400/50 rounded-lg px-4 py-8 text-slate-300 hover:text-emerald-400 transition-all cursor-pointer"
                        >
                          <Upload className="w-6 h-6" />
                          <span className="text-lg">{uploadedFile ? 'Cambiar archivo PDF' : 'Click para adjuntar archivo PDF'}</span>
                        </label>
                      </div>
                      {uploadedFile && (
                        <p className="mt-2 text-sm text-emerald-400 flex items-center">
                          <FileText className="w-4 h-4 mr-2" />
                          Archivo seleccionado: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
                        </p>
                      )}
                    </div>

                    {/* Previsualizador de PDF */}
                    {uploadedFile && (
                      <div className="mt-4 bg-slate-800/50 rounded-lg p-4 border border-white/10">
                        <h4 className="text-md font-semibold text-white mb-3 flex items-center">
                          <FileText className="w-5 h-5 mr-2 text-emerald-400" />
                          Previsualización del Documento
                        </h4>
                        <div className="bg-slate-900/50 rounded-lg overflow-hidden border border-white/10">
                          <iframe
                            src={URL.createObjectURL(uploadedFile)}
                            className="w-full h-[600px]"
                            title="Previsualización de PDF"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón de acción */}
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={loading || !uploadedFile}
                    className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>
                          {progressMessages.length > 0 
                            ? progressMessages[progressMessages.length - 1].replace(/[☁️✅🔔⏳●]/g, '').trim()
                            : 'Procesando...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Procesar Factura</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
        </div>
      </div>
    </div>
  );
}
