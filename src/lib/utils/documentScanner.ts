// Procesamiento de imágenes para el escáner de comprobantes (solo navegador).
//
// Flujo: cargar imagen → detectar las 4 esquinas del documento → corregir la
// perspectiva con una homografía real → aplicar un filtro tipo escáner que
// normaliza la iluminación sin destruir el texto.

export interface Point { x: number; y: number }

/** Esquinas en orden: superior-izquierda, superior-derecha, inferior-derecha, inferior-izquierda. */
export type Quad = [Point, Point, Point, Point];

export type ScanFilter = 'color' | 'bw' | 'original';

export interface CornerDetection {
  corners: Quad;
  /** false cuando no se encontró un documento y se usa la imagen completa. */
  detected: boolean;
}

const MAX_SIZE = 2000;
const DETECT_SIZE = 480;

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D no disponible');
  return ctx;
}

/** Carga la imagen (respetando la orientación EXIF) y la limita a MAX_SIZE px. */
export function loadImageToCanvas(file: Blob, maxSize = MAX_SIZE): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = createCanvas(
          Math.max(1, Math.round(img.naturalWidth * scale)),
          Math.max(1, Math.round(img.naturalHeight * scale)),
        );
        const ctx = context2d(canvas);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
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

export function fullImageQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
}

// ─── Detección de bordes ─────────────────────────────────────────────────────

function boxBlur(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const size = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      }
      tmp[y * w + x] = sum / size;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      }
      out[y * w + x] = sum / size;
    }
  }
  return out;
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumBg = 0;
  let weightBg = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t];
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;
    sumBg += t * hist[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const between = weightBg * weightFg * (meanBg - meanFg) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

function quadArea(q: Quad): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** true si las esquinas forman un cuadrilátero convexo en orden horario. */
export function isConvexQuad(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return quadArea(q) > 1;
}

/**
 * Busca el documento como la región clara más grande sobre un fondo más
 * oscuro y toma sus puntos extremos como esquinas. Si no encuentra una región
 * plausible devuelve la imagen completa (nunca recorta a ciegas).
 */
export function detectDocumentCorners(source: HTMLCanvasElement): CornerDetection {
  const { width, height } = source;
  const fallback: CornerDetection = { corners: fullImageQuad(width, height), detected: false };

  const scale = Math.min(1, DETECT_SIZE / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const small = createCanvas(sw, sh);
  const sctx = context2d(small);
  sctx.drawImage(source, 0, 0, sw, sh);
  const rgba = sctx.getImageData(0, 0, sw, sh).data;

  const n = sw * sh;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  const blurred = boxBlur(gray, sw, sh, 2);
  const threshold = otsuThreshold(blurred);

  // Componente conexa clara más grande (BFS, vecindad 4).
  const labels = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let bestLabel = -1;
  let bestSize = 0;
  let label = 0;
  for (let start = 0; start < n; start++) {
    if (labels[start] !== -1 || blurred[start] <= threshold) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    labels[start] = label;
    while (head < tail) {
      const p = queue[head++];
      const x = p % sw;
      const y = (p - x) / sw;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x < sw - 1 ? p + 1 : -1,
        y > 0 ? p - sw : -1,
        y < sh - 1 ? p + sw : -1,
      ];
      for (const q of neighbors) {
        if (q >= 0 && labels[q] === -1 && blurred[q] > threshold) {
          labels[q] = label;
          queue[tail++] = q;
        }
      }
    }
    if (tail > bestSize) {
      bestSize = tail;
      bestLabel = label;
    }
    label++;
  }

  // Demasiado pequeña (no es el documento) o casi toda la imagen (sin fondo visible).
  if (bestLabel < 0 || bestSize < n * 0.15 || bestSize > n * 0.97) return fallback;

  let tl = 0, tr = 0, br = 0, bl = 0;
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  for (let p = 0; p < n; p++) {
    if (labels[p] !== bestLabel) continue;
    const x = p % sw;
    const y = (p - x) / sw;
    const sum = x + y;
    const diff = x - y;
    if (sum < minSum) { minSum = sum; tl = p; }
    if (sum > maxSum) { maxSum = sum; br = p; }
    if (diff > maxDiff) { maxDiff = diff; tr = p; }
    if (diff < minDiff) { minDiff = diff; bl = p; }
  }

  const toPoint = (p: number): Point => {
    const x = p % sw;
    const y = (p - x) / sw;
    return {
      x: Math.min(width - 1, Math.max(0, x / scale)),
      y: Math.min(height - 1, Math.max(0, y / scale)),
    };
  };
  const raw = [toPoint(tl), toPoint(tr), toPoint(br), toPoint(bl)];
  // Acerca las esquinas un 1,5% al centro para no arrastrar un filo del fondo.
  const cx = raw.reduce((s, p) => s + p.x, 0) / 4;
  const cy = raw.reduce((s, p) => s + p.y, 0) / 4;
  const corners = raw.map(p => ({ x: p.x + (cx - p.x) * 0.015, y: p.y + (cy - p.y) * 0.015 })) as Quad;

  if (!isConvexQuad(corners) || quadArea(corners) < width * height * 0.15) return fallback;
  return { corners, detected: true };
}

// ─── Corrección de perspectiva ───────────────────────────────────────────────

/** Resuelve la homografía (8 coeficientes, h8 = 1) que lleva `from` a `to`. */
function solveHomography(from: Quad, to: Quad): number[] {
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Eliminación gaussiana con pivoteo parcial sobre la matriz aumentada 8×9.
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) throw new Error('Esquinas degeneradas');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const f = a[row][col] / a[col][col];
      for (let k = col; k < 9; k++) a[row][k] -= f * a[col][k];
    }
  }
  return a.map((row, i) => row[8] / row[i]);
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Endereza el cuadrilátero `quad` de `source` a un rectángulo con su proporción real. */
export function warpPerspective(source: HTMLCanvasElement, quad: Quad, maxSize = MAX_SIZE): HTMLCanvasElement {
  const [tl, tr, br, bl] = quad;
  let outW = Math.max(distance(tl, tr), distance(bl, br));
  let outH = Math.max(distance(tl, bl), distance(tr, br));
  const scale = Math.min(1, maxSize / Math.max(outW, outH));
  outW = Math.max(2, Math.round(outW * scale));
  outH = Math.max(2, Math.round(outH * scale));

  const target: Quad = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const [h0, h1, h2, h3, h4, h5, h6, h7] = solveHomography(target, quad);

  const sw = source.width;
  const sh = source.height;
  const src = context2d(source).getImageData(0, 0, sw, sh).data;
  const dest = createCanvas(outW, outH);
  const dctx = context2d(dest);
  const out = dctx.createImageData(outW, outH);
  const dst = out.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const d = h6 * x + h7 * y + 1;
      const sx = Math.min(sw - 1, Math.max(0, (h0 * x + h1 * y + h2) / d));
      const sy = Math.min(sh - 1, Math.max(0, (h3 * x + h4 * y + h5) / d));
      // Interpolación bilineal.
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        dst[o + c] = top * (1 - fy) + bottom * fy;
      }
      dst[o + 3] = 255;
    }
  }
  dctx.putImageData(out, 0, 0);
  return dest;
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

/**
 * Estima el color del papel en cada zona: reduce la imagen, borra el texto
 * con un filtro de máximo y la vuelve a ampliar suavizada.
 */
function estimatePaperBackground(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const { width, height } = canvas;
  const sw = Math.max(4, Math.round(width / 16));
  const sh = Math.max(4, Math.round(height / 16));
  const small = createCanvas(sw, sh);
  const sctx = context2d(small);
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const img = sctx.getImageData(0, 0, sw, sh);
  let data = img.data;
  for (let pass = 0; pass < 2; pass++) {
    const next = new Uint8ClampedArray(data);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        for (let c = 0; c < 3; c++) {
          let max = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = Math.min(sw - 1, Math.max(0, x + dx));
              const ny = Math.min(sh - 1, Math.max(0, y + dy));
              max = Math.max(max, data[(ny * sw + nx) * 4 + c]);
            }
          }
          next[(y * sw + x) * 4 + c] = max;
        }
      }
    }
    data = next;
  }
  img.data.set(data);
  sctx.putImageData(img, 0, 0);

  const big = createCanvas(width, height);
  const bctx = context2d(big);
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, width, height);
  return bctx.getImageData(0, 0, width, height).data;
}

export function applyScanFilter(canvas: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  const out = createCanvas(canvas.width, canvas.height);
  const ctx = context2d(out);
  ctx.drawImage(canvas, 0, 0);
  if (filter === 'original') return out;

  const image = ctx.getImageData(0, 0, out.width, out.height);
  const data = image.data;
  const bg = estimatePaperBackground(canvas);

  for (let i = 0; i < data.length; i += 4) {
    // Normaliza la iluminación: el papel queda blanco y el texto conserva su tono.
    const r = Math.min(255, (data[i] * 255 * 1.06) / Math.max(1, bg[i]));
    const g = Math.min(255, (data[i + 1] * 255 * 1.06) / Math.max(1, bg[i + 1]));
    const b = Math.min(255, (data[i + 2] * 255 * 1.06) / Math.max(1, bg[i + 2]));

    if (filter === 'bw') {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Rampa suave en lugar de umbral duro para no perder trazos finos.
      const v = Math.min(255, Math.max(0, ((lum - 90) * 255) / (215 - 90)));
      data[i] = data[i + 1] = data[i + 2] = v;
    } else {
      // Oscurece el texto un poco sin tocar el papel blanco.
      data[i] = 255 * (r / 255) ** 1.5;
      data[i + 1] = 255 * (g / 255) ** 1.5;
      data[i + 2] = 255 * (b / 255) ** 1.5;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

/** Recorta, endereza y filtra; devuelve un JPEG listo para el PDF. */
export function renderScan(source: HTMLCanvasElement, corners: Quad, filter: ScanFilter): string {
  const warped = warpPerspective(source, corners);
  return applyScanFilter(warped, filter).toDataURL('image/jpeg', 0.88);
}
