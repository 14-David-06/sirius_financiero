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
  Package
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

export default function FacturacionEgresos() {
  const { isAuthenticated, userData, isLoading } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [processedData, setProcessedData] = useState<FormDataEgresos | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

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
                        id="file-upload-egreso"
                      />
                      <label
                        htmlFor="file-upload-egreso"
                        className="flex items-center justify-center space-x-2 w-full bg-slate-800/50 border-2 border-dashed border-white/20 hover:border-red-400/50 rounded-lg px-4 py-8 text-slate-300 hover:text-red-400 transition-all cursor-pointer"
                      >
                        <Upload className="w-6 h-6" />
                        <span className="text-lg">{uploadedFile ? 'Cambiar archivo PDF' : 'Click para adjuntar archivo PDF'}</span>
                      </label>
                    </div>
                    {uploadedFile && (
                      <p className="mt-2 text-sm text-red-400 flex items-center">
                        <FileText className="w-4 h-4 mr-2" />
                        Archivo seleccionado: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>

                  {uploadedFile && (
                    <div className="mt-4 bg-slate-800/50 rounded-lg p-4 border border-white/10">
                      <h4 className="text-md font-semibold text-white mb-3 flex items-center">
                        <FileText className="w-5 h-5 mr-2 text-red-400" />
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

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={loading || !uploadedFile}
                  className="inline-flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
                      <Upload className="w-5 h-5" />
                      <span>Procesar Factura de Egreso</span>
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
