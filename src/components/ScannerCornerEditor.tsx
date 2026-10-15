'use client';

import { useRef, useState } from 'react';
import { Check, Maximize, Wand2, X } from 'lucide-react';
import { fullImageQuad, isConvexQuad, type Point, type Quad } from '@/lib/utils/documentScanner';

interface ScannerCornerEditorProps {
  imageUrl: string;
  width: number;
  height: number;
  initialCorners: Quad;
  autoCorners: Quad;
  onConfirm: (corners: Quad) => void;
  onCancel: () => void;
}

export default function ScannerCornerEditor({
  imageUrl,
  width,
  height,
  initialCorners,
  autoCorners,
  onConfirm,
  onCancel,
}: ScannerCornerEditorProps) {
  const [corners, setCorners] = useState<Quad>(initialCorners);
  const [active, setActive] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const valid = isConvexQuad(corners);

  const toImagePoint = (clientX: number, clientY: number): Point => {
    const rect = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(width - 1, Math.max(0, ((clientX - rect.left) / rect.width) * width)),
      y: Math.min(height - 1, Math.max(0, ((clientY - rect.top) / rect.height) * height)),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (active === null) return;
    const point = toImagePoint(e.clientX, e.clientY);
    setCorners(prev => prev.map((p, i) => (i === active ? point : p)) as Quad);
  };

  const points = corners.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4 gap-4">
      <p className="text-white/80 text-sm text-center">
        Arrastre las esquinas hasta los bordes del comprobante
      </p>

      <div
        ref={boxRef}
        className="relative inline-block touch-none select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Ajustar bordes"
          draggable={false}
          className="block max-h-[65vh] max-w-full rounded-lg"
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <polygon
            points={points}
            fill={valid ? 'rgba(59,130,246,0.18)' : 'rgba(239,68,68,0.18)'}
            stroke={valid ? '#3b82f6' : '#ef4444'}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {corners.map((p, i) => (
          <div
            key={i}
            onPointerDown={e => {
              e.preventDefault();
              boxRef.current?.setPointerCapture(e.pointerId);
              setActive(i);
            }}
            className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-lg touch-none ${
              active === i ? 'bg-blue-400 scale-110' : 'bg-blue-600/70'
            } cursor-grab`}
            style={{ left: `${(p.x / width) * 100}%`, top: `${(p.y / height) * 100}%` }}
          />
        ))}
      </div>

      {!valid && (
        <p className="text-red-400 text-xs">Las esquinas se cruzan; acomódelas para continuar.</p>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          onClick={() => setCorners(autoCorners)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/70 hover:bg-slate-600/70 rounded-lg text-white/80 text-sm"
        >
          <Wand2 className="w-4 h-4" />
          Auto
        </button>
        <button
          type="button"
          onClick={() => setCorners(fullImageQuad(width, height))}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/70 hover:bg-slate-600/70 rounded-lg text-white/80 text-sm"
        >
          <Maximize className="w-4 h-4" />
          Imagen completa
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-600/30 hover:bg-red-600/50 rounded-lg text-red-300 text-sm"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onConfirm(corners)}
          disabled={!valid}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600/50 hover:bg-emerald-600/70 rounded-lg text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          Aplicar
        </button>
      </div>
    </div>
  );
}
