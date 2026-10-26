'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle, Eye, Trash2, Image as ImageIcon } from 'lucide-react';

interface ScannerComprobanteProps {
  onPdfReady: (pdfBlob: Blob, fileName: string) => void;
  onClear?: () => void;
  maxImages?: number;
  disabled?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScannerComprobante({
  onPdfReady,
  onClear,
  maxImages = 5,
  disabled = false,
}: ScannerComprobanteProps) {
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [fileReady, setFileReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Determinar el tipo de archivo
    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      setError('Solo se aceptan archivos PDF o imágenes (JPG, PNG, WEBP)');
      return;
    }

    setError(null);
    setProcessing(true);
    setFileReady(false);

    try {
      const blob = file;
      const preview = URL.createObjectURL(blob);

      setFileType(isPdf ? 'pdf' : 'image');
      setFileName(file.name);
      setPreviewUrl(preview);
      setFileReady(true);

      onPdfReady(blob, file.name);
    } catch {
      setError('Error al cargar el archivo. Intente de nuevo.');
    } finally {
      setProcessing(false);
    }
  }, [onPdfReady]);

  const handleClear = () => {
    setFileType(null);
    setFileName(null);
    setFileReady(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    onClear?.();
  };

  return (
    <div className="space-y-4">
      {/* Botón de carga de archivo */}
      {!fileReady && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || processing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-purple-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-5 h-5" />
            Seleccionar imagen o PDF
          </button>
        </div>
      )}

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => handleFileUpload(e.target.files)}
      />

      {/* Indicador de procesamiento */}
      {processing && (
        <div className="flex items-center gap-2 text-blue-300 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando archivo...
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm flex items-center gap-1">
          <X className="w-4 h-4" />
          {error}
        </p>
      )}

      {/* Vista previa del archivo cargado */}
      {fileReady && fileName && (
        <div className="space-y-3">
          <div className="bg-slate-800/40 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white/80 font-medium">
                  {fileType === 'pdf' ? 'PDF Cargado' : 'Imagen Cargada'}
                </span>
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
              {fileType === 'pdf' ? (
                <FileText className="w-4 h-4 text-purple-400" />
              ) : (
                <ImageIcon className="w-4 h-4 text-blue-400" />
              )}
              <span className="truncate">{fileName}</span>
            </div>
            {previewUrl && (
              <div>
                <p className="text-xs text-white/50 flex items-center gap-1 mb-2">
                  <Eye className="w-3 h-3" />
                  Vista previa
                </p>
                {fileType === 'pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-48 rounded-lg border border-white/10"
                    title="Vista previa del PDF"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt="Vista previa"
                    className="w-full rounded-lg object-contain max-h-48 border border-white/10"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!fileReady && !processing && (
        <div className="text-center py-4 text-white/30 text-xs">
          Seleccione una imagen o archivo PDF desde su dispositivo
        </div>
      )}
    </div>
  );
}
