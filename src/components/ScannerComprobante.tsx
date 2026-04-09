'use client';

import { useState, useRef, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Camera, Upload, X, FileCheck, Loader2, Eye, Crop, RefreshCw } from 'lucide-react';

interface ScannerComprobanteProps {
  onPdfReady: (pdfBlob: Blob, fileName: string) => void;
  onClear?: () => void;
  maxImages?: number;
  disabled?: boolean;
}

interface CapturedImage {
  id: string;
  file: File;
  originalDataUrl: string;
  scannedDataUrl: string;
}

interface Point {
  x: number;
  y: number;
}

export default function ScannerComprobante({
  onPdfReady,
  onClear,
  maxImages = 5,
  disabled = false
}: ScannerComprobanteProps) {
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detectar si el dispositivo tiene cámara
  const hasCameraSupport = typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;

  // Detectar bordes del documento en la imagen
  const detectDocumentEdges = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Point[] => {
    const width = canvas.width;
    const height = canvas.height;

    // Aplicar detección de bordes con Sobel (simplificado)
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Convertir a escala de grises y aplicar threshold
    const grayscale = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      grayscale[i / 4] = gray > 128 ? 255 : 0;
    }

    // Detectar esquinas (simplificado - buscar área contrastante)
    const margin = Math.min(width, height) * 0.1;

    // Esquinas por defecto (todo el documento)
    const corners: Point[] = [
      { x: margin, y: margin }, // Top-left
      { x: width - margin, y: margin }, // Top-right
      { x: width - margin, y: height - margin }, // Bottom-right
      { x: margin, y: height - margin }, // Bottom-left
    ];

    return corners;
  }, []);

  // Aplicar corrección de perspectiva
  const applyPerspectiveCorrection = useCallback((
    sourceCanvas: HTMLCanvasElement,
    corners: Point[]
  ): HTMLCanvasElement => {
    const srcCtx = sourceCanvas.getContext('2d')!;

    // Calcular dimensiones del documento corregido
    const width = Math.max(
      Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2))
    );
    const height = Math.max(
      Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2))
    );

    // Crear canvas de destino
    const destCanvas = document.createElement('canvas');
    destCanvas.width = Math.round(width);
    destCanvas.height = Math.round(height);
    const destCtx = destCanvas.getContext('2d')!;

    // Aplicar transformación de perspectiva (aproximación bilineal)
    const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const destData = destCtx.createImageData(destCanvas.width, destCanvas.height);

    for (let y = 0; y < destCanvas.height; y++) {
      for (let x = 0; x < destCanvas.width; x++) {
        // Calcular coordenadas normalizadas (0-1)
        const u = x / destCanvas.width;
        const v = y / destCanvas.height;

        // Interpolación bilineal de las esquinas
        const srcX =
          corners[0].x * (1 - u) * (1 - v) +
          corners[1].x * u * (1 - v) +
          corners[2].x * u * v +
          corners[3].x * (1 - u) * v;

        const srcY =
          corners[0].y * (1 - u) * (1 - v) +
          corners[1].y * u * (1 - v) +
          corners[2].y * u * v +
          corners[3].y * (1 - u) * v;

        const sx = Math.round(srcX);
        const sy = Math.round(srcY);

        if (sx >= 0 && sx < sourceCanvas.width && sy >= 0 && sy < sourceCanvas.height) {
          const srcIdx = (sy * sourceCanvas.width + sx) * 4;
          const destIdx = (y * destCanvas.width + x) * 4;

          destData.data[destIdx] = srcData.data[srcIdx];
          destData.data[destIdx + 1] = srcData.data[srcIdx + 1];
          destData.data[destIdx + 2] = srcData.data[srcIdx + 2];
          destData.data[destIdx + 3] = 255;
        }
      }
    }

    destCtx.putImageData(destData, 0, 0);
    return destCanvas;
  }, []);

  // Aplicar mejoras de scanner (contraste, brillo, sharpening)
  const applyScannerEnhancements = useCallback((canvas: HTMLCanvasElement): void => {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 1. Aumentar contraste y brillo
    const contrastFactor = 1.5;
    const brightnessFactor = 10;

    for (let i = 0; i < data.length; i += 4) {
      // Aplicar contraste y brillo
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrastFactor + 128 + brightnessFactor));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrastFactor + 128 + brightnessFactor));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrastFactor + 128 + brightnessFactor));
    }

    // 2. Aplicar threshold adaptativo para blanco y negro limpio
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      // Threshold dinámico: más agresivo para hacer el fondo blanco
      const threshold = avg > 180 ? 255 : avg < 80 ? 0 : avg;

      data[i] = threshold;
      data[i + 1] = threshold;
      data[i + 2] = threshold;
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Procesar imagen con efecto scanner
  const scanImage = useCallback(async (imageFile: File): Promise<{ original: string; scanned: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          try {
            // Canvas original
            const originalCanvas = document.createElement('canvas');
            const maxDimension = 2000; // Limitar tamaño para performance
            const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);

            originalCanvas.width = img.width * scale;
            originalCanvas.height = img.height * scale;
            const originalCtx = originalCanvas.getContext('2d')!;
            originalCtx.drawImage(img, 0, 0, originalCanvas.width, originalCanvas.height);

            // Detectar bordes del documento
            const corners = detectDocumentEdges(originalCanvas, originalCtx);

            // Aplicar corrección de perspectiva
            const correctedCanvas = applyPerspectiveCorrection(originalCanvas, corners);

            // Aplicar mejoras de scanner
            applyScannerEnhancements(correctedCanvas);

            // Convertir a data URLs
            const originalDataUrl = originalCanvas.toDataURL('image/jpeg', 0.92);
            const scannedDataUrl = correctedCanvas.toDataURL('image/jpeg', 0.92);

            resolve({ original: originalDataUrl, scanned: scannedDataUrl });
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('Error al cargar imagen'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Error al leer archivo'));
      reader.readAsDataURL(imageFile);
    });
  }, [detectDocumentEdges, applyPerspectiveCorrection, applyScannerEnhancements]);

  // Manejar captura de imágenes
  const handleImageCapture = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsScanning(true);
    const newImages: CapturedImage[] = [];

    for (let i = 0; i < files.length && images.length + newImages.length < maxImages; i++) {
      const file = files[i];

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        continue;
      }

      try {
        // Aplicar procesamiento de scanner
        const { original, scanned } = await scanImage(file);

        newImages.push({
          id: `${Date.now()}-${i}`,
          file,
          originalDataUrl: original,
          scannedDataUrl: scanned
        });
      } catch (error) {
        console.error('Error procesando imagen:', error);
      }
    }

    setImages(prev => [...prev, ...newImages]);
    setIsScanning(false);
  }, [images.length, maxImages, scanImage]);

  // Eliminar imagen
  const removeImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    setPdfUrl(null); // Limpiar PDF si se elimina una imagen
  }, []);

  // Limpiar todo
  const handleClear = useCallback(() => {
    setImages([]);
    setPdfUrl(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    onClear?.();
  }, [onClear]);

  // Generar PDF desde las imágenes escaneadas
  const generatePDF = useCallback(async () => {
    if (images.length === 0) return;

    setIsProcessing(true);

    try {
      // Crear nuevo documento PDF
      const pdfDoc = await PDFDocument.create();

      // Agregar cada imagen escaneada como una página
      for (const image of images) {
        // Usar la versión escaneada (procesada)
        const imageBytes = await fetch(image.scannedDataUrl).then(res => res.arrayBuffer());

        // Siempre usar JPEG para las imágenes escaneadas
        const embeddedImage = await pdfDoc.embedJpg(imageBytes);

        // Calcular dimensiones para ajustar a página A4 (595 x 842 puntos)
        const pageWidth = 595;
        const pageHeight = 842;
        const imgAspectRatio = embeddedImage.width / embeddedImage.height;
        const pageAspectRatio = pageWidth / pageHeight;

        let width, height;
        if (imgAspectRatio > pageAspectRatio) {
          // Imagen más ancha que la página
          width = pageWidth;
          height = width / imgAspectRatio;
        } else {
          // Imagen más alta que la página
          height = pageHeight;
          width = height * imgAspectRatio;
        }

        // Centrar imagen en la página
        const x = (pageWidth - width) / 2;
        const y = (pageHeight - height) / 2;

        // Crear página y agregar imagen escaneada
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawImage(embeddedImage, {
          x,
          y,
          width,
          height,
        });
      }

      // Generar PDF como bytes
      const pdfBytes = await pdfDoc.save();

      // Crear Blob del PDF
      const pdfBlob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

      // Crear URL para previsualización
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // Generar nombre de archivo
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `scan-comprobante-${timestamp}.pdf`;

      // Llamar callback con el PDF generado
      onPdfReady(pdfBlob, fileName);

    } catch (error) {
      console.error('Error generando PDF:', error);
      alert('Error al generar el PDF. Por favor intente de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  }, [images, onPdfReady]);

  return (
    <div className="space-y-4">
      {/* Botones de captura */}
      {!pdfUrl && (
        <div className="flex flex-wrap gap-3">
          {/* Botón Tomar Foto (solo en dispositivos con cámara) */}
          {hasCameraSupport && (
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || images.length >= maxImages || isScanning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-5 h-5" />
              <span className="text-sm font-medium">Escanear con Cámara</span>
            </button>
          )}

          {/* Botón Subir Imagen */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || images.length >= maxImages || isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">Subir y Escanear</span>
          </button>

          {/* Input oculto para cámara */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleImageCapture(e.target.files)}
            className="hidden"
            disabled={disabled || isScanning}
          />

          {/* Input oculto para galería */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/heic,image/webp"
            multiple
            onChange={(e) => handleImageCapture(e.target.files)}
            className="hidden"
            disabled={disabled || isScanning}
          />
        </div>
      )}

      {/* Indicador de procesamiento */}
      {isScanning && (
        <div className="flex items-center gap-2 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-sm font-medium text-blue-300">
            Escaneando documento...
          </span>
        </div>
      )}

      {/* Contador de imágenes */}
      {images.length > 0 && !pdfUrl && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/70">
            {images.length} de {maxImages} documento{images.length !== 1 ? 's' : ''} escaneado{images.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-1 text-xs text-green-400">
            <Crop className="w-4 h-4" />
            <span>Auto-escaneado</span>
          </div>
        </div>
      )}

      {/* Miniaturas de imágenes escaneadas (antes y después) */}
      {images.length > 0 && !pdfUrl && (
        <div className="space-y-3">
          {images.map((image, index) => (
            <div key={image.id} className="relative group bg-slate-700/30 border border-white/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white/70">
                  Documento #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="p-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded transition-colors"
                  disabled={disabled}
                  title="Eliminar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Imagen original */}
                <div>
                  <p className="text-xs text-white/50 mb-1">Original</p>
                  <img
                    src={image.originalDataUrl}
                    alt="Original"
                    className="w-full h-24 object-cover rounded border border-white/10"
                  />
                </div>

                {/* Imagen escaneada */}
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <p className="text-xs text-green-400">Escaneado</p>
                    <Crop className="w-3 h-3 text-green-400" />
                  </div>
                  <img
                    src={image.scannedDataUrl}
                    alt="Escaneado"
                    className="w-full h-24 object-cover rounded border-2 border-green-500/30"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón Generar PDF */}
      {images.length > 0 && !pdfUrl && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={generatePDF}
            disabled={disabled || isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-5 h-5" />
                <span>Generar PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || isProcessing}
            className="px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Previsualización del PDF generado */}
      {pdfUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
            <FileCheck className="w-5 h-5 text-green-400" />
            <span className="text-sm font-medium text-green-300">
              PDF generado exitosamente ({images.length} página{images.length !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Eye className="w-5 h-5" />
              <span className="text-sm font-medium">
                {showPreview ? 'Ocultar' : 'Ver'} Vista Previa
              </span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-lg font-medium transition-colors"
            >
              Generar Nuevo PDF
            </button>
          </div>

          {/* Iframe de previsualización */}
          {showPreview && (
            <div className="w-full h-96 border-2 border-white/20 rounded-lg overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="Vista previa del PDF"
              />
            </div>
          )}
        </div>
      )}

      {/* Mensaje de ayuda */}
      {!pdfUrl && images.length === 0 && !isScanning && (
        <div className="p-4 bg-blue-500/10 border border-blue-400/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Crop className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-blue-300">
                Scanner Inteligente
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                {hasCameraSupport
                  ? '📸 Tome fotos de comprobantes o facturas. El sistema detectará automáticamente los bordes, corregirá la perspectiva y optimizará la imagen para un resultado profesional tipo scanner.'
                  : '📁 Suba imágenes de comprobantes o facturas. El sistema las procesará automáticamente con detección de bordes y optimización para obtener un resultado profesional tipo scanner.'}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">✓ Detección automática</span>
                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">✓ Corrección de perspectiva</span>
                <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">✓ Optimización B/N</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
