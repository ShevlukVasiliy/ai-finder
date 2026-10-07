import type { Detector, Lang, ParsedImage, PixelData } from '../types';
import { finding, notApplicable, result } from './util';

export interface ImageContext {
  image: ParsedImage;
  lang: Lang;
}

const t = (lang: Lang, ru: string, en: string) => (lang === 'ru' ? ru : en);

const AI_ISSUERS = /openai|dall[-·]?e|chatgpt|adobe firefly|firefly|google|imagen|gemini|midjourney|stability|bing image creator|microsoft designer|meta ai|ideogram|leonardo/i;

const I01: Detector<ImageContext> = {
  id: 'I-01',
  analyze({ image, lang }) {
    const c = image.meta.c2pa;
    if (!c.present) return result('I-01', lang, 0);
    const aiIssuer = c.issuers.some((i) => AI_ISSUERS.test(i));
    const value = c.aiClaim || aiIssuer ? 1 : 0.3;
    const extra = t(
      lang,
      `Манифест C2PA найден. Издатели: ${c.issuers.join(', ') || 'не распознаны'}.${c.aiClaim ? ' В манифесте указано trainedAlgorithmicMedia (создано ИИ).' : ''}`,
      `C2PA manifest found. Issuers: ${c.issuers.join(', ') || 'unrecognised'}.${c.aiClaim ? ' Manifest declares trainedAlgorithmicMedia (AI-generated).' : ''}`,
    );
    return result('I-01', lang, value, { findings: [finding('I-01.c2pa', [], { value, extra })] });
  },
};

const GEN_SOFTWARE = /stable diffusion|comfyui|automatic1111|invokeai|novelai|midjourney|dall[-·]?e|firefly|imagen|leonardo|fooocus|diffusers|flux/i;

const I02: Detector<ImageContext> = {
  id: 'I-02',
  analyze({ image, lang }) {
    const m = image.meta;
    const notes: string[] = [];
    let flags = 0;
    for (const key of ['parameters', 'workflow', 'prompt', 'Dream', 'sd-metadata', 'invokeai_metadata', 'Comment']) {
      const v = m.pngText[key];
      if (v && (key !== 'Comment' || /steps|sampler|seed|cfg/i.test(v))) {
        flags += 2;
        notes.push(t(lang, `PNG-чанк «${key}» с параметрами генерации.`, `PNG chunk “${key}” with generation parameters.`));
      }
    }
    const sw = m.exif.Software ?? '';
    if (GEN_SOFTWARE.test(sw) || GEN_SOFTWARE.test(m.pngText.Software ?? '')) {
      flags += 2;
      notes.push(t(lang, `Software = «${sw || m.pngText.Software}».`, `Software = “${sw || m.pngText.Software}”.`));
    }
    if (/trainedAlgorithmicMedia|compositeSynthetic|algorithmicMedia/i.test(m.xmp)) {
      flags += 2;
      notes.push(t(lang, 'IPTC DigitalSourceType = trainedAlgorithmicMedia.', 'IPTC DigitalSourceType = trainedAlgorithmicMedia.'));
    }
    if (m.format === 'jpeg' && !m.exif.Make && !m.exif.Model) {
      flags += 0.5;
      notes.push(t(lang, 'Нет данных камеры (Make/Model) в EXIF.', 'No camera data (Make/Model) in EXIF.'));
    }
    return result('I-02', lang, flags, { findings: [finding('I-02.metadata', [], { value: flags, extra: notes.join(' ') })] });
  },
};

const GEN_SIDES = new Set([512, 576, 640, 704, 768, 832, 896, 960, 1024, 1152, 1216, 1280, 1344, 1536, 1792, 2048]);

const I03: Detector<ImageContext> = {
  id: 'I-03',
  analyze({ image, lang }) {
    const { width: w, height: h } = image.meta;
    if (!w || !h) return notApplicable('I-03', lang);
    let flags = 0;
    if (GEN_SIDES.has(w) && GEN_SIDES.has(h)) flags += 1;
    if (w % 64 === 0 && h % 64 === 0) flags += 0.6;
    if ((w === 1024 && h === 1792) || (w === 1792 && h === 1024) || (w === h && GEN_SIDES.has(w))) flags += 0.4;
    return result('I-03', lang, flags, { findings: [finding('I-03.dimensions', [], { value: flags, extra: `${w}×${h}` })] });
  },
};

/** Luma plane resampled (nearest) to size×size. */
export function lumaSquare(px: PixelData, size: number): Float64Array {
  const out = new Float64Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sx = Math.min(px.width - 1, Math.floor(((x + 0.5) * px.width) / size));
      const sy = Math.min(px.height - 1, Math.floor(((y + 0.5) * px.height) / size));
      const i = (sy * px.width + sx) * 4;
      out[y * size + x] = 0.299 * px.data[i]! + 0.587 * px.data[i + 1]! + 0.114 * px.data[i + 2]!;
    }
  return out;
}

function fft1d(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * wr - im[b]! * wi;
        const xi = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
      }
  }
}

/** Log-magnitude 2-D spectrum of an n×n plane (n power of two). */
export function spectrum(plane: Float64Array, n: number): Float64Array {
  const re = Float64Array.from(plane);
  const im = new Float64Array(n * n);
  const rr = new Float64Array(n);
  const ii = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    rr.set(re.subarray(y * n, y * n + n));
    ii.fill(0);
    fft1d(rr, ii);
    re.set(rr, y * n);
    im.set(ii, y * n);
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      rr[y] = re[y * n + x]!;
      ii[y] = im[y * n + x]!;
    }
    fft1d(rr, ii);
    for (let y = 0; y < n; y++) {
      re[y * n + x] = rr[y]!;
      im[y * n + x] = ii[y]!;
    }
  }
  const mag = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) mag[i] = Math.log1p(Math.hypot(re[i]!, im[i]!));
  return mag;
}

/** Peak-to-median ratio of high-pass residual spectrum at upsampling frequencies. */
export function spectralPeak(px: PixelData, n = 256): number {
  const plane = lumaSquare(px, n);
  // High-pass: remove local mean to suppress natural 1/f content.
  const hp = new Float64Array(n * n);
  for (let y = 1; y < n - 1; y++)
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      hp[i] = 4 * plane[i]! - plane[i - 1]! - plane[i + 1]! - plane[i - n]! - plane[i + n]!;
    }
  const mag = spectrum(hp, n);
  const at = (x: number, y: number) => Math.expm1(mag[(((y % n) + n) % n) * n + (((x % n) + n) % n)]!);
  // A periodic artefact is a spike relative to its immediate spectral neighbourhood.
  let peak = 0;
  for (const div of [2, 4, 8, 16]) {
    const f = n / div;
    for (const [fx, fy] of [
      [f, 0],
      [0, f],
      [f, f],
    ] as const) {
      const ring: number[] = [];
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) >= 2 && dx !== 0 && dy !== 0) ring.push(at(fx + dx, fy + dy));
      ring.sort((a, b) => a - b);
      const med = ring[Math.floor(ring.length / 2)]! || 1e-9;
      peak = Math.max(peak, at(fx, fy) / med);
    }
  }
  return peak;
}

const I04: Detector<ImageContext> = {
  id: 'I-04',
  analyze({ image, lang }) {
    const px = image.pixels;
    if (!px || px.width < 64 || px.height < 64) return notApplicable('I-04', lang);
    const value = spectralPeak(px);
    return result('I-04', lang, value, { findings: [finding('I-04.spectrum', [], { value })] });
  },
};

export interface NoiseStats {
  smoothShare: number;
  channelCorr: number;
  heatmap: number[][];
}

/** Residual noise statistics on a grid of blocks; heatmap = smoothness per block. */
export function noiseStats(px: PixelData, grid = 16): NoiseStats {
  const { width: w, height: h, data } = px;
  const bw = Math.max(3, Math.floor(w / grid));
  const bh = Math.max(3, Math.floor(h / grid));
  const heatmap: number[][] = [];
  let smooth = 0;
  let total = 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  const step = Math.max(1, Math.floor(Math.min(bw, bh) / 12));
  for (let gy = 0; gy < grid; gy++) {
    const row: number[] = [];
    for (let gx = 0; gx < grid; gx++) {
      let acc = 0;
      let n = 0;
      for (let y = gy * bh + 1; y < Math.min(h - 1, (gy + 1) * bh); y += step)
        for (let x = gx * bw + 1; x < Math.min(w - 1, (gx + 1) * bw); x += step) {
          const i = (y * w + x) * 4;
          const res = (c: number) =>
            data[i + c]! - (data[i + c - 4]! + data[i + c + 4]! + data[i + c - w * 4]! + data[i + c + w * 4]!) / 4;
          const r = res(0);
          const g = res(1);
          acc += Math.abs(g);
          sxy += r * g;
          sxx += r * r;
          syy += g * g;
          n++;
        }
      const mad = n ? acc / n : 0;
      const isSmooth = mad < 0.8;
      if (n) {
        total++;
        if (isSmooth) smooth++;
      }
      row.push(Math.max(0, Math.min(1, 1 - mad / 4)));
    }
    heatmap.push(row);
  }
  return {
    smoothShare: total ? smooth / total : 0,
    channelCorr: sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0,
    heatmap,
  };
}

const I05: Detector<ImageContext> = {
  id: 'I-05',
  analyze({ image, lang }) {
    const px = image.pixels;
    if (!px || px.width < 32 || px.height < 32) return notApplicable('I-05', lang);
    const st = noiseStats(px);
    // Very high cross-channel residual correlation also hints at synthetic noise.
    const value = st.smoothShare + (st.channelCorr > 0.97 ? 0.15 : 0);
    return result('I-05', lang, value, { findings: [finding('I-05.noise', [], { value: st.smoothShare })] });
  },
};

/** IJG (libjpeg) standard luminance table at quality 50. */
export const IJG_LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22,
  37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

/** Returns the IJG quality that reproduces this table exactly, or null. Order-insensitive (zigzag vs natural). */
export function ijgQuality(table: number[]): number | null {
  const sorted = [...table].sort((a, b) => a - b).join(',');
  for (let q = 1; q <= 100; q++) {
    const scale = q < 50 ? 5000 / q : 200 - q * 2;
    const t = IJG_LUMA.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100))));
    if ([...t].sort((a, b) => a - b).join(',') === sorted) return q;
  }
  return null;
}

const I06: Detector<ImageContext> = {
  id: 'I-06',
  analyze({ image, lang }) {
    const m = image.meta;
    if (m.format !== 'jpeg' || !m.jpegQuantTables.length) return notApplicable('I-06', lang);
    const q = ijgQuality(m.jpegQuantTables[0]!);
    const notes: string[] = [];
    let flags = 0;
    const camera = Boolean(m.exif.Make || m.exif.Model);
    if (q !== null && !camera) {
      flags += 1;
      notes.push(t(lang, `Стандартная таблица квантования libjpeg (качество ${q}) без данных камеры: файл сохранён программой.`, `Standard libjpeg quantisation table (quality ${q}) without camera data: saved by software.`));
    }
    if (q !== null && q >= 95) {
      flags += 0.5;
      notes.push(t(lang, 'Очень высокое качество сжатия, следов повторного сжатия нет.', 'Very high quality, no traces of recompression.'));
    }
    return result('I-06', lang, flags, { findings: [finding('I-06.jpeg', [], { value: flags, extra: notes.join(' ') })] });
  },
};

/**
 * invisible-watermark DWT-DCT check: the embedder quantises the DC coefficient of 4×4 DCT blocks
 * of the Haar LL band (U channel) to (k + 0.25 | 0.75) * scale. We measure how strongly values cluster there.
 */
export function watermarkStrength(px: PixelData, scale = 36): number {
  const { width: w, height: h, data } = px;
  const hw = Math.floor(w / 2);
  const hh = Math.floor(h / 2);
  if (hw < 8 || hh < 8) return 0;
  // U channel (YUV, BT.601) → Haar LL = (a+b+c+d)/2.
  const u = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return -0.14713 * data[i]! - 0.28886 * data[i + 1]! + 0.436 * data[i + 2]! + 128;
  };
  let near = 0;
  let total = 0;
  for (let by = 0; by + 4 <= hh; by += 4)
    for (let bx = 0; bx + 4 <= hw; bx += 4) {
      let sum = 0;
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const X = (bx + x) * 2;
          const Y = (by + y) * 2;
          sum += (u(X, Y) + u(X + 1, Y) + u(X, Y + 1) + u(X + 1, Y + 1)) / 2;
        }
      const dc = sum / 4; // orthonormal 4×4 DCT DC coefficient
      const frac = (((dc / scale) % 1) + 1) % 1;
      if (Math.abs(frac - 0.25) < 0.1 || Math.abs(frac - 0.75) < 0.1) near++;
      total++;
    }
  return total ? near / total : 0;
}

const I07: Detector<ImageContext> = {
  id: 'I-07',
  analyze({ image, lang }) {
    const px = image.pixels;
    if (!px || px.width < 64 || px.height < 64) return notApplicable('I-07', lang);
    const value = watermarkStrength(px);
    return result('I-07', lang, value, { findings: [finding('I-07.watermark', [], { value })] });
  },
};

export const DETECTORS = [I01, I02, I03, I04, I05, I06, I07];
