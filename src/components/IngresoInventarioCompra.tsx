'use client';

import { useState, useRef, useEffect } from 'react';
import { CompraCompleta, CompraItem } from '@/types/compras';
import FormularioCotizacion from './FormularioCotizacion';
import {
  X,
  Package,
  Brain,
  Loader2,
  Check,
  AlertCircle,
  Send,
  FileText,
  ChevronDown,
  Mic,
  Square,
  Trash2,
  Plus,
  Edit3,
  MapPin,
} from 'lucide-react';

// Interface para validación de insumos con IA (misma que usa enviar-insumos-inventario)
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

// Interface compatible con las APIs de inventario
interface ItemParaInventario {
  id: string;
  Item: string;
  Unidad: string;
  Cantidad: number;
  'Vr. Unitario': number;
  'Vr. Total Flow 19%': number;
  'Centro de Costo'?: string;
}

// Item dictado por voz (sin cotización)
interface ItemDictado {
  id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  area: string;
}

type TipoIngreso = 'sin-cotizacion' | 'con-cotizacion';

interface IngresoInventarioCompraProps {
  compra: CompraCompleta;
  onClose: () => void;
  onCompleted: () => void;
  onCotizacionSaved: () => void;
}

// Transformar items de compra al formato que esperan las APIs de inventario
function transformarItemsParaInventario(items: CompraItem[]): ItemParaInventario[] {
  return items.map((item) => ({
    id: item.id,
    Item: item.objeto,
    Unidad: 'Unidad',
    Cantidad: item.cantidad || 1,
    'Vr. Unitario': item.valorItem || 0,
    'Vr. Total Flow 19%': (item.valorItem || 0) * (item.cantidad || 1),
    'Centro de Costo': item.centroCostos || undefined,
  }));
}

export default function IngresoInventarioCompra({
  compra,
  onClose,
  onCompleted,
  onCotizacionSaved,
}: IngresoInventarioCompraProps) {
  // Tipo de ingreso: con o sin cotización
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngreso>('sin-cotizacion');
  const [showFormCotizacion, setShowFormCotizacion] = useState(false);
  const [cotizacionCargada, setCotizacionCargada] = useState(!!compra.cotizacionDoc);

  // Área destino (desde Nomina Core)
  const [areasDisponibles, setAreasDisponibles] = useState<string[]>([]);
  const [areaDestino, setAreaDestino] = useState<string>('');
  const [cargandoAreas, setCargandoAreas] = useState(true);

  // Cargar áreas desde Nomina Core al montar
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await fetch('/api/areas-nomina');
        const data = await response.json();
        if (data.success && data.areas) {
          setAreasDisponibles(data.areas);
          // Pre-seleccionar el área de la compra si existe
          if (compra.areaCorrespondiente) {
            const match = data.areas.find(
              (a: string) => a.toLowerCase() === compra.areaCorrespondiente?.toLowerCase()
            );
            if (match) setAreaDestino(match);
          }
        }
      } catch (error) {
        console.error('Error cargando áreas:', error);
      } finally {
        setCargandoAreas(false);
      }
    };
    fetchAreas();
  }, [compra.areaCorrespondiente]);

  // Audio recording (modo sin cotización)
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscription, setAudioTranscription] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isClasificando, setIsClasificando] = useState(false);
  const [itemsDictados, setItemsDictados] = useState<ItemDictado[]>([]);
  const [itemsDictadosSeleccionados, setItemsDictadosSeleccionados] = useState<Set<string>>(new Set());

  // Items transformados al formato de inventario (modo con cotización)
  const [itemsInventario] = useState<ItemParaInventario[]>(
    transformarItemsParaInventario(compra.items)
  );

  // Selección de items
  const [itemsSeleccionados, setItemsSeleccionados] = useState<Set<string>>(
    new Set(compra.items.map((i) => i.id))
  );

  // Validación IA
  const [validacionesIA, setValidacionesIA] = useState<ValidacionInsumo[]>([]);
  const [validandoIA, setValidandoIA] = useState(false);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);

  // Envío
  const [enviando, setEnviando] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Audio Recording (modo sin cotización) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        transcribeAudio(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setErrorMessage('Error accediendo al micrófono. Verifique los permisos del navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const newText = audioTranscription
          ? audioTranscription + '. ' + result.transcription
          : result.transcription;
        setAudioTranscription(newText);
        // Auto-clasificar
        await clasificarItems(newText);
      } else {
        setErrorMessage('Error al transcribir el audio: ' + (result.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error transcribiendo audio:', error);
      setErrorMessage('Error al transcribir el audio. Inténtelo de nuevo.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const clasificarItems = async (texto: string) => {
    setIsClasificando(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/clasificar-items-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcripcion: texto }),
      });

      const result = await response.json();

      if (result.success && result.items) {
        setItemsDictados(result.items);
        setItemsDictadosSeleccionados(new Set(result.items.map((i: ItemDictado) => i.id)));
        setSuccessMessage(`${result.totalItems} item(s) identificados del audio`);
        // Reset validación previa
        setValidacionesIA([]);
        setConfirmarEnvio(false);
      } else {
        setErrorMessage(result.error || 'Error al clasificar items');
      }
    } catch (error) {
      console.error('Error clasificando items:', error);
      setErrorMessage('Error al clasificar los items del audio');
    } finally {
      setIsClasificando(false);
    }
  };

  const limpiarAudio = () => {
    setAudioTranscription('');
    setItemsDictados([]);
    setItemsDictadosSeleccionados(new Set());
    setValidacionesIA([]);
    setConfirmarEnvio(false);
  };

  const handleUpdateItemDictado = (id: string, field: keyof ItemDictado, value: string | number) => {
    setItemsDictados((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItemDictado = (id: string) => {
    setItemsDictados((prev) => prev.filter((item) => item.id !== id));
    setItemsDictadosSeleccionados((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleAddItemDictado = () => {
    const newItem: ItemDictado = {
      id: `manual-${Date.now()}`,
      nombre: '',
      cantidad: 1,
      unidad: 'Unidad',
      area: '',
    };
    setItemsDictados((prev) => [...prev, newItem]);
    setItemsDictadosSeleccionados((prev) => new Set([...prev, newItem.id]));
  };

  const handleToggleItemDictado = (id: string) => {
    setItemsDictadosSeleccionados((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
    setValidacionesIA([]);
    setConfirmarEnvio(false);
  };

  // --- Items de solicitud (modo con cotización) ---
  const handleToggleItem = (itemId: string) => {
    setItemsSeleccionados((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
    // Reset validación al cambiar selección
    setValidacionesIA([]);
    setConfirmarEnvio(false);
  };

  const handleToggleAll = (selectAll: boolean) => {
    if (selectAll) {
      setItemsSeleccionados(new Set(itemsInventario.map((i) => i.id)));
    } else {
      setItemsSeleccionados(new Set());
    }
    setValidacionesIA([]);
    setConfirmarEnvio(false);
  };

  const handleValidarConIA = async () => {
    setValidandoIA(true);
    setErrorMessage(null);

    try {
      let itemsParaValidar: ItemParaInventario[];

      if (tipoIngreso === 'sin-cotizacion') {
        // Transformar items dictados al formato de inventario
        itemsParaValidar = itemsDictados
          .filter((item) => itemsDictadosSeleccionados.has(item.id))
          .map((item) => ({
            id: item.id,
            Item: item.nombre,
            Unidad: item.unidad,
            Cantidad: item.cantidad,
            'Vr. Unitario': 0,
            'Vr. Total Flow 19%': 0,
            'Centro de Costo': item.area || undefined,
          }));
      } else {
        itemsParaValidar = itemsInventario.filter((item) =>
          itemsSeleccionados.has(item.id)
        );
      }

      if (itemsParaValidar.length === 0) return;

      const response = await fetch('/api/validar-insumos-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsParaValidar,
          facturaId: compra.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setValidacionesIA(result.validaciones);
        setSuccessMessage(
          `Validación completada: ${result.itemsParaVincular} para vincular, ${result.itemsParaCrear} nuevos, ${result.itemsIgnorados} ignorados`
        );
      } else {
        throw new Error(result.error || 'Error al validar con IA');
      }
    } catch (error) {
      console.error('Error validando con IA:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Error al validar insumos'
      );
    } finally {
      setValidandoIA(false);
    }
  };

  const handleEnviarInventario = async () => {
    const tieneItems = tipoIngreso === 'sin-cotizacion'
      ? itemsDictadosSeleccionados.size > 0
      : itemsSeleccionados.size > 0;

    if (!tieneItems) return;

    // Si no hay validaciones, primero validar
    if (validacionesIA.length === 0) {
      await handleValidarConIA();
      return;
    }

    // Verificar confirmación
    if (!confirmarEnvio) {
      setErrorMessage(
        'Debes confirmar la validación IA antes de enviar al inventario'
      );
      return;
    }

    setEnviando(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let itemsParaEnviar: ItemParaInventario[];

      if (tipoIngreso === 'sin-cotizacion') {
        itemsParaEnviar = itemsDictados
          .filter((item) => itemsDictadosSeleccionados.has(item.id))
          .map((item) => ({
            id: item.id,
            Item: item.nombre,
            Unidad: item.unidad,
            Cantidad: item.cantidad,
            'Vr. Unitario': 0,
            'Vr. Total Flow 19%': 0,
            'Centro de Costo': item.area || undefined,
          }));
      } else {
        itemsParaEnviar = itemsInventario.filter((item) =>
          itemsSeleccionados.has(item.id)
        );
      }

      const response = await fetch('/api/enviar-insumos-inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsParaEnviar,
          validaciones: validacionesIA,
          facturaId: compra.id,
          numeroFactura: `COMPRA-${compra.id.slice(-6)}`,
          areaDestino,
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

      // Notificar al padre y cerrar después de un momento
      setTimeout(() => {
        onCompleted();
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Error enviando al inventario:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Error al enviar al inventario'
      );
    } finally {
      setEnviando(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-white/20 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-white/10 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-white">
                Ingresar Insumos al Inventario
              </h2>
              <p className="text-white/60 text-sm">
                Solicitud de {compra.nombreSolicitante} •{' '}
                {compra.areaCorrespondiente}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Mensajes */}
          {successMessage && (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-4 text-emerald-300 text-sm">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Selector tipo de ingreso */}
          <div className="bg-slate-700/30 rounded-xl p-4 border border-white/10">
            <label className="block text-white font-semibold text-sm mb-2">
              Tipo de Ingreso
            </label>
            <div className="relative">
              <select
                value={tipoIngreso}
                onChange={(e) => setTipoIngreso(e.target.value as TipoIngreso)}
                className="w-full sm:w-72 appearance-none bg-slate-800/60 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-400 transition-colors cursor-pointer pr-10"
              >
                <option value="sin-cotizacion" className="text-gray-900 bg-white">
                  📦 Sin Cotización (directo)
                </option>
                <option value="con-cotizacion" className="text-gray-900 bg-white">
                  📄 Con Cotización
                </option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            </div>

            {/* Sub-sección para cotización */}
            {tipoIngreso === 'con-cotizacion' && (
              <div className="mt-4 p-4 bg-slate-800/40 rounded-lg border border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-white/80 text-sm">
                      {cotizacionCargada
                        ? '✅ Cotización cargada — puedes continuar con el ingreso al inventario'
                        : 'Debes cargar una cotización antes de continuar'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFormCotizacion(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-semibold transition-all duration-300 text-xs"
                  >
                    📤 {cotizacionCargada ? 'Actualizar Cotización' : 'Cargar Cotización'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selector de Área Destino */}
          <div className="bg-slate-700/30 rounded-xl p-4 border border-white/10">
            <label className="block text-white font-semibold text-sm mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              Área Destino
            </label>
            <p className="text-slate-400 text-xs mb-3">
              Selecciona el área a la que van destinados los insumos. Esta información se registrará en cada movimiento del inventario.
            </p>
            <div className="relative">
              {cargandoAreas ? (
                <div className="flex items-center gap-2 text-white/60 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando áreas...
                </div>
              ) : (
                <>
                  <select
                    value={areaDestino}
                    onChange={(e) => setAreaDestino(e.target.value)}
                    className="w-full sm:w-72 appearance-none bg-slate-800/60 border border-white/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400 transition-colors cursor-pointer pr-10"
                  >
                    <option value="" className="text-gray-900 bg-white">
                      -- Selecciona un área --
                    </option>
                    {areasDisponibles.map((area) => (
                      <option key={area} value={area} className="text-gray-900 bg-white">
                        {area}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                </>
              )}
            </div>
            {!areaDestino && !cargandoAreas && (
              <p className="text-amber-400/80 text-xs mt-2">
                ⚠️ Debes seleccionar un área para poder enviar al inventario
              </p>
            )}
          </div>

          {/* Info de la compra */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/60 text-xs">Estado</p>
              <p className="text-white font-semibold text-sm">
                {compra.estadoSolicitud}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/60 text-xs">Items</p>
              <p className="text-white font-semibold text-sm">
                {compra.items.length}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/60 text-xs">Valor Total</p>
              <p className="text-white font-semibold text-sm">
                {formatCurrency(compra.valorTotal || 0)}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-white/60 text-xs">Cotización</p>
              <p className="text-white font-semibold text-sm">
                {compra.cotizacionDoc ? '✅ Cargada' : '❌ Sin cotización'}
              </p>
            </div>
          </div>

          {/* === MODO SIN COTIZACIÓN: Audio + Items dictados === */}
          {tipoIngreso === 'sin-cotizacion' && (
            <div className="space-y-4">
              {/* Grabación de audio */}
              <div className="bg-slate-700/30 rounded-xl p-5 border border-white/10">
                <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-red-400" />
                  Dictar Insumos por Voz
                </h3>
                <p className="text-slate-400 text-xs mb-4">
                  Graba un mensaje indicando qué insumos llegaron, en qué cantidades y para qué área van. Ejemplo: &ldquo;Llegaron 20 kilos de cal para producción, 3 cajas de guantes para el laboratorio y 5 galones de desinfectante para administración&rdquo;
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={isTranscribing || isClasificando}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Mic className="w-4 h-4" />
                      Grabar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-800 hover:bg-red-900 text-white rounded-xl font-semibold transition-all duration-300 animate-pulse text-sm"
                    >
                      <Square className="w-4 h-4" />
                      Detener
                    </button>
                  )}

                  {audioTranscription && (
                    <button
                      type="button"
                      onClick={limpiarAudio}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-medium transition-all duration-300 text-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpiar
                    </button>
                  )}

                  {(isTranscribing || isClasificando) && (
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isTranscribing ? 'Transcribiendo...' : 'Identificando items...'}</span>
                    </div>
                  )}
                </div>

                {/* Textarea editable con transcripción */}
                <textarea
                  value={audioTranscription}
                  onChange={(e) => setAudioTranscription(e.target.value)}
                  placeholder="El texto transcrito aparecerá aquí. También puedes escribir directamente..."
                  className="w-full p-3 bg-slate-800/60 border border-white/15 rounded-lg text-white placeholder-white/40 text-sm focus:outline-none focus:border-emerald-400 transition-colors min-h-[80px] resize-vertical"
                />

                {/* Botón para re-clasificar si se editó manualmente */}
                {audioTranscription && itemsDictados.length === 0 && !isClasificando && (
                  <button
                    type="button"
                    onClick={() => clasificarItems(audioTranscription)}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all text-xs"
                  >
                    <Brain className="w-4 h-4" />
                    Identificar Items
                  </button>
                )}
              </div>

              {/* Tabla editable de items dictados */}
              {itemsDictados.length > 0 && (
                <div className="bg-slate-700/30 rounded-xl border border-white/10 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-emerald-400" />
                      Items Identificados ({itemsDictadosSeleccionados.size} de {itemsDictados.length} seleccionados)
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddItemDictado}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar item
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 text-xs border-b border-white/10 bg-slate-800/30">
                          <th className="py-2 px-2 text-center w-8"></th>
                          <th className="text-left py-2 px-2">Insumo</th>
                          <th className="text-center py-2 px-2 w-20">Cant.</th>
                          <th className="text-center py-2 px-2 w-24">Unidad</th>
                          <th className="text-left py-2 px-2">Área / Destino</th>
                          <th className="py-2 px-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsDictados.map((item) => {
                          const selected = itemsDictadosSeleccionados.has(item.id);
                          return (
                            <tr key={item.id} className={`border-b border-white/5 ${selected ? 'bg-emerald-500/10' : ''}`}>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => handleToggleItemDictado(item.id)}
                                  className="w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={item.nombre}
                                  onChange={(e) => handleUpdateItemDictado(item.id, 'nombre', e.target.value)}
                                  className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-emerald-400"
                                  placeholder="Nombre del insumo"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  value={item.cantidad}
                                  onChange={(e) => handleUpdateItemDictado(item.id, 'cantidad', Number(e.target.value) || 0)}
                                  min={0}
                                  className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-emerald-400"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <select
                                  value={item.unidad}
                                  onChange={(e) => handleUpdateItemDictado(item.id, 'unidad', e.target.value)}
                                  className="w-full bg-slate-800/50 border border-white/10 rounded px-1 py-1 text-white text-sm focus:outline-none focus:border-emerald-400"
                                >
                                  <option value="Unidad">Unidad</option>
                                  <option value="Kg">Kg</option>
                                  <option value="Lt">Lt</option>
                                  <option value="Galon">Galón</option>
                                  <option value="Caja">Caja</option>
                                  <option value="Bulto">Bulto</option>
                                  <option value="Rollo">Rollo</option>
                                  <option value="Paquete">Paquete</option>
                                  <option value="Global">Global</option>
                                </select>
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={item.area}
                                  onChange={(e) => handleUpdateItemDictado(item.id, 'area', e.target.value)}
                                  className="w-full bg-slate-800/50 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-emerald-400"
                                  placeholder="Ej: Producción"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemDictado(item.id)}
                                  className="text-red-400/60 hover:text-red-400 transition-colors"
                                  title="Eliminar item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === MODO CON COTIZACIÓN: Tabla de items de la solicitud === */}
          {tipoIngreso === 'con-cotizacion' && (
            <div className="bg-slate-700/30 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                Items de la Solicitud ({itemsSeleccionados.size} de{' '}
                {itemsInventario.length} seleccionados)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleAll(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Seleccionar todos
                </button>
                <span className="text-white/30">|</span>
                <button
                  onClick={() => handleToggleAll(false)}
                  className="text-xs text-white/60 hover:text-white/80 transition-colors"
                >
                  Deseleccionar
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs border-b border-white/10 bg-slate-800/30">
                    <th className="py-2 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={
                          itemsSeleccionados.size === itemsInventario.length
                        }
                        onChange={(e) => handleToggleAll(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                      />
                    </th>
                    <th className="text-left py-2 px-3">Descripción</th>
                    <th className="text-center py-2 px-3">Cantidad</th>
                    <th className="text-center py-2 px-3">Centro Costos</th>
                    <th className="text-right py-2 px-3">Valor Unitario</th>
                    <th className="text-right py-2 px-3">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsInventario.map((item) => {
                    const selected = itemsSeleccionados.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-emerald-500/10'
                            : 'hover:bg-white/5'
                        }`}
                        onClick={() => handleToggleItem(item.id)}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleItem(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                          />
                        </td>
                        <td className="py-2 px-3 text-white">
                          {item.Item}
                        </td>
                        <td className="py-2 px-3 text-center text-white">
                          {item.Cantidad}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-300 text-xs">
                          {item['Centro de Costo'] || '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-white">
                          {formatCurrency(item['Vr. Unitario'])}
                        </td>
                        <td className="py-2 px-3 text-right text-white font-medium">
                          {formatCurrency(item['Vr. Total Flow 19%'])}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Sección de Validación IA (ambos modos) */}
          {((tipoIngreso === 'sin-cotizacion' && itemsDictadosSeleccionados.size > 0) ||
            (tipoIngreso === 'con-cotizacion' && itemsSeleccionados.size > 0)) && (
            <div className="bg-slate-700/30 rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-400" />
                Validación con IA ({tipoIngreso === 'sin-cotizacion' ? itemsDictadosSeleccionados.size : itemsSeleccionados.size} items
                seleccionados)
              </h3>

              {validacionesIA.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-slate-400 mb-4">
                    Valida los items seleccionados contra el catálogo de insumos
                    existente antes de enviar al inventario.
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
                        <span>Validando con IA...</span>
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
                          <th className="text-left py-2 px-3">
                            Item Solicitud
                          </th>
                          <th className="text-left py-2 px-3">Estado</th>
                          <th className="text-left py-2 px-3">
                            Insumo Existente
                          </th>
                          <th className="text-center py-2 px-3">Similitud</th>
                          <th className="text-left py-2 px-3">Acción</th>
                          <th className="text-left py-2 px-3">Sugerencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validacionesIA.map((validacion, idx) => (
                          <tr key={idx} className="border-b border-white/5">
                            <td className="py-2 px-3 text-white">
                              {validacion.itemFacturaNombre}
                            </td>
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
                                <span
                                  title={`Código: ${validacion.insumoExistenteCodigo}`}
                                >
                                  {validacion.insumoExistenteNombre}
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`font-mono ${
                                  validacion.similitud >= 80
                                    ? 'text-emerald-400'
                                    : validacion.similitud >= 50
                                      ? 'text-amber-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {validacion.similitud}%
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  validacion.accion === 'vincular'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : validacion.accion === 'crear_nuevo'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-slate-500/20 text-slate-400'
                                }`}
                              >
                                {validacion.accion === 'vincular'
                                  ? 'Vincular existente'
                                  : validacion.accion === 'crear_nuevo'
                                    ? 'Crear nuevo'
                                    : 'Ignorar'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-xs max-w-[200px] truncate">
                              {validacion.sugerencia || '-'}
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
                      id="confirmarEnvioCompra"
                      checked={confirmarEnvio}
                      onChange={(e) => setConfirmarEnvio(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-500 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                    />
                    <label
                      htmlFor="confirmarEnvioCompra"
                      className="text-slate-300"
                    >
                      Confirmo que he revisado las sugerencias de la IA y deseo
                      proceder con el envío al inventario
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEnviarInventario}
              disabled={
                enviando ||
                !areaDestino ||
                (tipoIngreso === 'sin-cotizacion' && itemsDictadosSeleccionados.size === 0) ||
                (tipoIngreso === 'con-cotizacion' && itemsSeleccionados.size === 0) ||
                (validacionesIA.length > 0 && !confirmarEnvio) ||
                (tipoIngreso === 'con-cotizacion' && !cotizacionCargada)
              }
              title={
                !areaDestino
                  ? 'Debes seleccionar un área destino'
                  : tipoIngreso === 'con-cotizacion' && !cotizacionCargada
                    ? 'Debes cargar una cotización primero'
                    : (tipoIngreso === 'sin-cotizacion' && itemsDictadosSeleccionados.size === 0) ||
                        (tipoIngreso === 'con-cotizacion' && itemsSeleccionados.size === 0)
                      ? 'Selecciona al menos un item'
                      : validacionesIA.length > 0 && !confirmarEnvio
                        ? 'Confirma la validación primero'
                        : ''
              }
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-semibold transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : validacionesIA.length === 0 ? (
                <>
                  <Brain className="w-4 h-4" />
                  <span>Validar y Enviar al Inventario</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar al Inventario</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Formulario de Cotización (se renderiza encima) */}
      {showFormCotizacion && (
        <FormularioCotizacion
          compra={compra}
          onClose={() => setShowFormCotizacion(false)}
          onSaved={() => {
            setCotizacionCargada(true);
            setShowFormCotizacion(false);
            onCotizacionSaved();
          }}
        />
      )}
    </div>
  );
}
