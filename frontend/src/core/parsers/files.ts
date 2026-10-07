import { AnalysisError, LIMITS } from '../analyze';
import { detectCodeLanguage } from '../detectors/code';
import { noiseStats } from '../detectors/image';
import type { AnalysisInput, LangSetting, PixelData } from '../types';
import { parseDocx, parseOdt, parsePdf, parsePlain, parseRtf } from './documents';
import { parseImageMeta } from './image';

export const DOC_EXT = ['docx', 'pdf', 'txt', 'md', 'odt', 'rtf'];
export const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
export const CODE_EXT = ['py', 'js', 'mjs', 'jsx', 'ts', 'tsx', 'go', 'java', 'cs', 'php', 'rb', 'rs', 'kt', 'swift', 'c', 'h', 'cpp', 'cc', 'hpp', 'sh', 'sql', 'scala'];
export const ACCEPT = [...DOC_EXT, ...IMAGE_EXT, ...CODE_EXT].map((e) => `.${e}`).join(',');

export function extOf(name: string): string {
  return /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
}

export type PixelDecoder = (bytes: Uint8Array, mime: string) => Promise<PixelData | undefined>;

/** Browser pixel decoding through createImageBitmap + canvas, downscaled to ≤1024 px. */
export const browserDecoder: PixelDecoder = async (bytes, mime) => {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') return undefined;
  try {
    const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
    const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bmp, 0, 0, w, h);
    return { width: w, height: h, data: ctx.getImageData(0, 0, w, h).data };
  } catch {
    return undefined;
  }
};

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export interface FileLike {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function fileToInput(
  file: FileLike,
  lang: LangSetting = 'auto',
  deps: { decode?: PixelDecoder; pdfjs?: () => Promise<typeof import('pdfjs-dist')> } = {},
): Promise<AnalysisInput> {
  if (file.size > LIMITS.maxFileBytes) throw new AnalysisError('too_large', 'File is larger than 20 MB');
  const ext = extOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const asText = () => new TextDecoder('utf-8').decode(bytes);
  try {
    if (IMAGE_EXT.includes(ext)) {
      const meta = parseImageMeta(bytes);
      const pixels = await (deps.decode ?? browserDecoder)(bytes, file.type || `image/${ext}`);
      return { kind: 'image', lang, image: { meta, pixels, heatmap: pixels ? noiseStats(pixels).heatmap : undefined } };
    }
    if (ext === 'docx') return { kind: 'document', lang, document: parseDocx(bytes) };
    if (ext === 'odt') return { kind: 'document', lang, document: parseOdt(bytes) };
    if (ext === 'rtf') return { kind: 'document', lang, document: parseRtf(asText()) };
    if (ext === 'txt' || ext === 'md') return { kind: 'document', lang, document: parsePlain(asText(), ext) };
    if (ext === 'pdf') return { kind: 'document', lang, document: await parsePdf(bytes, await (deps.pdfjs ?? loadPdfJs)()) };
    if (CODE_EXT.includes(ext)) {
      const code = asText();
      return { kind: 'code', lang, code: { code, language: detectCodeLanguage(code, file.name), lines: code.split('\n') } };
    }
  } catch (e) {
    if (e instanceof AnalysisError) throw e;
    throw new AnalysisError('invalid', `Cannot read ${file.name}: ${(e as Error).message}`);
  }
  throw new AnalysisError('unsupported', `Unsupported format: .${ext || '?'}`);
}
