'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Camera, Upload, X, FileText, Loader2, CheckCircle, Eye, Trash2, Plus } from 'lucide-react';

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
}

// ─── Image processing helpers ───────────────────────────────────────────────

function resizeCanvas(
  source: HTMLCanvasElement,
  maxSize = 2000
): HTMLCanvasElement {
  const { width, height } = source;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}



function enhanceDocument(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;

  const contrastFactor = 1.5;
  const brightnessFactor = 10;

  for (let i = 0; i < data.length; i += 4) {
    let r = (data[i] - 128) * contrastFactor + 128 + brightnessFactor;
    let g = (data[i + 1] - 128) * contrastFactor + 128 + brightnessFactor;
    let b = (data[i + 2] - 128) * contrastFactor + 128 + brightnessFactor;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    const avg = (r + g + b) / 3;
    let val: number;
    if (avg > 180) {
      val = 255;
    } else if (avg < 80) {
      val = 0;
    } else {
      val = avg;
    }

    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

async function processImage(file: File): Promise<{ original: string; scanned: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        // Draw original
        const raw = document.createElement('canvas');
        raw.width = img.naturalWidth;
        raw.height = img.naturalHeight;
        const rawCtx = raw.getContext('2d')!;
        rawCtx.drawImage(img, 0, 0);

        const resized = resizeCanvas(raw);
        const enhanced = enhanceDocument(resized);

        resolve({
          original: resized.toDataURL('image/jpeg', 0.8),
          scanned: enhanced.toDataURL('image/jpeg', 0.85),
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen'));
    };
    img.src = url;
  });
}

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
  const [images, setImages] = useState<ScannedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
        const { original, scanned } = await processImage(file);
        results.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          originalDataUrl: original,
          scannedDataUrl: scanned,
          fileName: file.name,
        });
      }
      setImages(prev => [...prev, ...results]);
    } catch {
      setError('Error al procesar la imagen. Intente con otro archivo.');
    } finally {
      setProcessing(false);
    }
  }, [images.length, maxImages]);

  const removeImage = (id: string) => {
    const next = images.filter(img => img.id !== id);
    setImages(next);
    if (next.length === 0) {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
      setPdfReady(false);
      onClear?.();
    }
  };

  const handleGeneratePdf = useCallback(async (imagesToProcess: ScannedImage[]) => {
    if (imagesToProcess.length === 0) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      const blob = await generatePdf(imagesToProcess);
      const fileName = `comprobante-${Date.now()}.pdf`;
      const previewUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return previewUrl;
      });
      setPdfReady(true);
      onPdfReady(blob, fileName);
    } catch {
      setError('Error al generar el PDF. Intente de nuevo.');
    } finally {
      setGeneratingPdf(false);
    }
  }, [onPdfReady]);

  // Auto-generar PDF cada vez que cambia la lista de imágenes
  useEffect(() => {
    if (images.length === 0) return;
    handleGeneratePdf(images);
  }, [images]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClear = () => {
    setImages([]);
    setPdfReady(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    setError(null);
    onClear?.();
  };

  const canAddMore = images.length < maxImages && !disabled;

  return (
    <div className="space-y-4">
      {/* Botones de captura */}
      {canAddMore && (
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
                  <span className="ml-1 px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px]">
                    Auto-escaneado
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  disabled={disabled}
                  className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
            {generatingPdf ? (
              <div className="flex-1 flex items-center gap-2 py-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 text-sm px-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando PDF...
              </div>
            ) : pdfReady ? (
              <div className="flex-1 flex items-center gap-2 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm px-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                PDF listo ({images.length} página{images.length > 1 ? 's' : ''})
              </div>
            ) : null}
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

      {/* Estado vacío */}
      {images.length === 0 && !processing && (
        <div className="text-center py-4 text-white/30 text-xs">
          Use los botones de arriba para capturar o subir imágenes del comprobante
        </div>
      )}
    </div>
  );
}
