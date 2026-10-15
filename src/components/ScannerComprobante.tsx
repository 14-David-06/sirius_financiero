'use client';

import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Camera, Upload, X, FileText, Loader2, CheckCircle, Eye, Trash2, Plus, Crop } from 'lucide-react';
import ScannerCornerEditor from './ScannerCornerEditor';
import {
  detectDocumentCorners,
  loadImageToCanvas,
  renderScan,
  type Quad,
  type ScanFilter,
} from '@/lib/utils/documentScanner';

interface ScannerComprobanteProps {
  onPdfReady: (pdfBlob: Blob, fileName: string) => void;
  onClear?: () => void;
  maxImages?: number;
  disabled?: boolean;
}

interface ScannedImage {
  id: string;
  originalDataUrl: string;
  scannedDataUrl: string;
  fileName: string;
  width: number;
  height: number;
  corners: Quad;
  autoCorners: Quad;
  detected: boolean;
  filter: ScanFilter;
}

const FILTER_LABELS: Record<ScanFilter, string> = {
  color: 'Color',
  bw: 'B/N',
  original: 'Sin filtro',
};

// ─── PDF generation ──────────────────────────────────────────────────────────

async function generatePdf(images: ScannedImage[]): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const img of images) {
    const base64 = img.scannedDataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

    let embeddedImage;
    if (img.scannedDataUrl.startsWith('data:image/png')) {
      embeddedImage = await pdfDoc.embedPng(bytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(bytes);
    }

    const pageWidth = 595;
    const pageHeight = 842;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const { width: imgW, height: imgH } = embeddedImage;
    const scale = Math.min(pageWidth / imgW, pageHeight / imgH, 1);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageWidth - drawW) / 2;
    const y = (pageHeight - drawH) / 2;

    page.drawImage(embeddedImage, { x, y, width: drawW, height: drawH });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScannerComprobante({
  onPdfReady,
  onClear,
  maxImages = 5,
  disabled = false,
}: ScannerComprobanteProps) {
  const [mode, setMode] = useState<'scan' | 'upload'>('scan'); // Modo: escanear imágenes o cargar PDF
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedPdfName, setUploadedPdfName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Imagen fuente (ya redimensionada) por id, para poder re-recortar o cambiar filtro.
  const sourcesRef = useRef(new Map<string, HTMLCanvasElement>());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;

    const toProcess = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, remaining);

    if (toProcess.length === 0) {
      setError('Solo se aceptan archivos de imagen (JPG, PNG, WEBP, HEIC)');
      return;
    }

    setError(null);
    setProcessing(true);
    setPdfReady(false);
    setPdfPreviewUrl(null);

    try {
      const results: ScannedImage[] = [];
      for (const file of toProcess) {
        const source = await loadImageToCanvas(file);
        const { corners, detected } = detectDocumentCorners(source);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sourcesRef.current.set(id, source);
        results.push({
          id,
          originalDataUrl: source.toDataURL('image/jpeg', 0.85),
          scannedDataUrl: renderScan(source, corners, 'color'),
          fileName: file.name,
          width: source.width,
          height: source.height,
          corners,
          autoCorners: corners,
          detected,
          filter: 'color',
        });
      }
      setImages(prev => [...prev, ...results]);
      // Con una sola foto, abrir el editor para revisar el recorte (como CamScanner).
      if (results.length === 1) setEditingId(results[0].id);
    } catch {
      setError('Error al procesar la imagen. Intente con otro archivo.');
    } finally {
      setProcessing(false);
    }
  }, [images.length, maxImages]);

  const updateScan = (id: string, changes: { corners?: Quad; filter?: ScanFilter }) => {
    const source = sourcesRef.current.get(id);
    const current = images.find(img => img.id === id);
    if (!source || !current) return;
    const corners = changes.corners ?? current.corners;
    const filter = changes.filter ?? current.filter;
    try {
      const scannedDataUrl = renderScan(source, corners, filter);
      setImages(prev => prev.map(img => (img.id === id ? { ...img, corners, filter, scannedDataUrl } : img)));
      setPdfReady(false);
      setPdfPreviewUrl(null);
    } catch {
      setError('No se pudo recortar con esas esquinas. Ajústelas de nuevo.');
    }
  };

  const removeImage = (id: string) => {
    sourcesRef.current.delete(id);
    setImages(prev => prev.filter(img => img.id !== id));
    setPdfReady(false);
    setPdfPreviewUrl(null);
    if (images.length <= 1) {
      onClear?.();
    }
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      const blob = await generatePdf(images);
      const fileName = `comprobante-${Date.now()}.pdf`;
      const previewUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(previewUrl);
      setPdfReady(true);
      onPdfReady(blob, fileName);
    } catch {
      setError('Error al generar el PDF. Intente de nuevo.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePdfUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF');
      return;
    }

    setError(null);
    setProcessing(true);
    setPdfReady(false);
    setPdfPreviewUrl(null);

    try {
      const blob = file;
      const previewUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(previewUrl);
      setPdfReady(true);
      setUploadedPdfName(file.name);
      onPdfReady(blob, file.name);
    } catch {
      setError('Error al cargar el PDF. Intente de nuevo.');
    } finally {
      setProcessing(false);
    }
  }, [onPdfReady]);

  const handleClear = () => {
    sourcesRef.current.clear();
    setEditingId(null);
    setImages([]);
    setPdfReady(false);
    setUploadedPdfName(null);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setError(null);
    onClear?.();
  };

  const canAddMore = images.length < maxImages && !disabled;
  const editingImage = images.find(img => img.id === editingId);

  return (
    <div className="space-y-4">
      {editingImage && (
        <ScannerCornerEditor
          key={editingImage.id}
          imageUrl={editingImage.originalDataUrl}
          width={editingImage.width}
          height={editingImage.height}
          initialCorners={editingImage.corners}
          autoCorners={editingImage.autoCorners}
          onConfirm={corners => {
            updateScan(editingImage.id, { corners });
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Selector de modo */}
      {!pdfReady && images.length === 0 && (
        <div className="flex gap-2 p-1 bg-slate-800/40 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode('scan');
              handleClear();
            }}
            disabled={disabled}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'scan'
                ? 'bg-blue-600/50 text-white shadow-lg'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            📷 Escanear Imágenes
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('upload');
              handleClear();
            }}
            disabled={disabled}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'upload'
                ? 'bg-purple-600/50 text-white shadow-lg'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            📄 Cargar PDF
          </button>
        </div>
      )}

      {/* Botones de captura (modo escanear) */}
      {mode === 'scan' && canAddMore && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || processing}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-blue-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-4 h-4" />
            Cámara
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || processing}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-purple-300 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            Subir imagen
          </button>
          {images.length > 0 && (
            <span className="flex items-center text-xs text-white/40 ml-auto">
              {images.length}/{maxImages} imágenes
            </span>
          )}
        </div>
      )}

      {/* Botón de carga de PDF (modo upload) */}
      {mode === 'upload' && !pdfReady && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={disabled || processing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-purple-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="w-5 h-5" />
            Seleccionar archivo PDF
          </button>
        </div>
      )}

      {/* Inputs ocultos */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => handlePdfUpload(e.target.files)}
      />

      {/* Indicador de procesamiento */}
      {processing && (
        <div className="flex items-center gap-2 text-blue-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Escaneando documento...
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm flex items-center gap-1">
          <X className="w-4 h-4" />
          {error}
        </p>
      )}

      {/* Galería de imágenes procesadas */}
      {images.length > 0 && (
        <div className="space-y-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="bg-slate-800/40 border border-white/10 rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  Documento #{idx + 1}
                  {img.detected ? (
                    <span className="ml-1 px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px]">
                      Bordes detectados
                    </span>
                  ) : (
                    <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px]">
                      Imagen completa
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(img.id)}
                    disabled={disabled}
                    className="flex items-center gap-1 text-blue-300 hover:text-blue-200 text-xs transition-colors disabled:opacity-50"
                  >
                    <Crop className="w-4 h-4" />
                    Ajustar bordes
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    disabled={disabled}
                    className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-1 mb-2">
                {(Object.keys(FILTER_LABELS) as ScanFilter[]).map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => updateScan(img.id, { filter })}
                    disabled={disabled || img.filter === filter}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                      img.filter === filter
                        ? 'bg-blue-600/50 text-white'
                        : 'bg-slate-700/50 text-white/50 hover:text-white/80'
                    }`}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-white/40 mb-1">Original</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.originalDataUrl}
                    alt="Original"
                    className="w-full rounded-lg object-contain max-h-32"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-green-400 mb-1">Escaneado ✓</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.scannedDataUrl}
                    alt="Escaneado"
                    className="w-full rounded-lg object-contain max-h-32"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Agregar más */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || processing}
              className="w-full py-2 border border-dashed border-white/20 hover:border-white/40 rounded-xl text-white/40 hover:text-white/60 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar más páginas
            </button>
          )}

          {/* Acciones */}
          <div className="flex gap-2">
            {!pdfReady ? (
              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={disabled || generatingPdf || images.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generar PDF ({images.length} pág.)
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm px-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                PDF listo ({images.length > 0 ? `${images.length} página${images.length > 1 ? 's' : ''}` : uploadedPdfName || 'PDF cargado'})
              </div>
            )}
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="px-3 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-red-400 text-sm transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vista previa del PDF */}
          {pdfPreviewUrl && (
            <div className="mt-2">
              <p className="text-xs text-white/50 flex items-center gap-1 mb-1">
                <Eye className="w-3 h-3" />
                Vista previa del PDF
              </p>
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-48 rounded-lg border border-white/10"
                title="Vista previa del comprobante"
              />
            </div>
          )}
        </div>
      )}

      {/* Vista previa PDF cargado directamente */}
      {mode === 'upload' && pdfReady && uploadedPdfName && (
        <div className="space-y-3">
          <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/80 font-medium">PDF Cargado</span>
              </div>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60 mb-3">
              <FileText className="w-4 h-4 text-purple-400" />
              <span className="truncate">{uploadedPdfName}</span>
            </div>
            {pdfPreviewUrl && (
              <div>
                <p className="text-xs text-white/50 flex items-center gap-1 mb-2">
                  <Eye className="w-3 h-3" />
                  Vista previa del PDF
                </p>
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-48 rounded-lg border border-white/10"
                  title="Vista previa del PDF"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {images.length === 0 && !processing && !pdfReady && (
        <div className="text-center py-4 text-white/30 text-xs">
          {mode === 'scan'
            ? 'Use los botones de arriba para capturar o subir imágenes del comprobante'
            : 'Seleccione un archivo PDF desde su dispositivo'}
        </div>
      )}
    </div>
  );
}
