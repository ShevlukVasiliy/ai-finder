import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze, AnalysisError } from '../../src/core/analyze';
import { extOf, fileToInput, type FileLike } from '../../src/core/parsers/files';
import { parseDocx, parseOdt, parsePlain, parseRtf } from '../../src/core/parsers/documents';
import { parseExif, parseImageMeta } from '../../src/core/parsers/image';

const fx = (n: string) => new Uint8Array(readFileSync(join(__dirname, '..', 'fixtures', n)));
const file = (name: string, data: Uint8Array, size = data.length): FileLike => ({
  name,
  size,
  type: '',
  arrayBuffer: async () => data.slice().buffer,
});

describe('document parsers', () => {
  it('DOCX: text, positions and generator metadata', () => {
    const d = parseDocx(fx('ai.docx'));
    expect(d.text).toContain('В современном мире');
    expect(d.meta.application).toBe('python-docx');
    expect(d.meta.author).toBe('python-docx');
    expect(d.meta.totalTimeMin).toBe(1);
    expect(d.meta.revisions).toBe(1);
    expect(d.meta.rsids).toBe(1);
    expect(d.meta.styles).toEqual(['Normal (Web)']);
    expect(d.meta.positions[0]).toMatchObject({ page: 1, paragraph: 1, start: 0 });
    expect(() => parseDocx(fx('sample.odt'))).toThrow();
  });

  it('DOCX: human document has natural metadata', () => {
    const d = parseDocx(fx('human.docx'));
    expect(d.meta.application).toBe('Microsoft Office Word');
    expect(d.meta.totalTimeMin).toBe(95);
  });

  it('ODT', () => {
    const d = parseOdt(fx('sample.odt'));
    expect(d.text).toContain("fast-paced world");
    expect(d.meta.creator).toBe('LibreOffice/7.6');
    expect(d.meta.totalTimeMin).toBe(85);
    expect(d.meta.revisions).toBe(7);
    expect(() => parseOdt(fx('ai.docx'))).toThrow();
  });

  it('RTF with unicode escapes', () => {
    const d = parseRtf(new TextDecoder().decode(fx('sample.rtf')));
    expect(d.text).toContain('В современном мире');
    expect(d.meta.author).toBe('Pandoc');
    expect(d.meta.application).toContain('Pandoc');
    expect(d.meta.positions.length).toBe(3);
    expect(parseRtf("{\\rtf1 \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2\\par}").text).toBe('Привет');
  });

  it('TXT/MD strip BOM and map paragraphs', () => {
    const t = parsePlain(new TextDecoder().decode(fx('sample.txt')), 'txt');
    expect(t.text.startsWith('В')).toBe(true);
    expect(t.meta.positions).toHaveLength(3);
    expect(parsePlain('a\r\n\r\nb', 'md').meta.positions).toHaveLength(2);
  });
});

describe('image metadata parser', () => {
  it('PNG with Stable Diffusion parameters', () => {
    const m = parseImageMeta(fx('sd.png'));
    expect(m.format).toBe('png');
    expect([m.width, m.height]).toEqual([512, 512]);
    expect(m.pngText.parameters).toContain('Steps: 20');
    expect(m.pngText.Software).toBe('ComfyUI');
  });

  it('PNG with C2PA manifest', () => {
    const m = parseImageMeta(fx('c2pa.png'));
    expect(m.c2pa.present).toBe(true);
    expect(m.c2pa.issuers).toContain('OpenAI');
    expect(m.c2pa.aiClaim).toBe(true);
  });

  it('JPEG camera vs generated', () => {
    const cam = parseImageMeta(fx('camera.jpg'));
    expect(cam.exif).toMatchObject({ Make: 'Apple', Model: 'iPhone 13' });
    expect([cam.width, cam.height]).toEqual([4032, 3024]);
    expect(cam.jpegQuantTables[0]).toHaveLength(64);
    const gen = parseImageMeta(fx('generated.jpg'));
    expect(gen.exif.Software).toBe('Adobe Firefly');
    expect(gen.xmp).toContain('trainedAlgorithmicMedia');
  });

  it('WebP', () => {
    const m = parseImageMeta(fx('sample.webp'));
    expect(m).toMatchObject({ format: 'webp', width: 1536, height: 1024 });
    expect(m.exif.Software).toBe('Midjourney');
  });

  it('rejects unknown formats and tolerates tiny EXIF', () => {
    expect(() => parseImageMeta(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toThrow();
    expect(parseExif(new Uint8Array(4))).toEqual({});
  });
});

describe('fileToInput', () => {
  it('dispatches by extension', async () => {
    expect((await fileToInput(file('a.docx', fx('ai.docx')))).kind).toBe('document');
    expect((await fileToInput(file('a.odt', fx('sample.odt')))).kind).toBe('document');
    expect((await fileToInput(file('a.rtf', fx('sample.rtf')))).kind).toBe('document');
    expect((await fileToInput(file('a.md', fx('sample.md')))).document?.meta.format).toBe('md');
    expect((await fileToInput(file('a.txt', fx('sample.txt')))).kind).toBe('document');
    const code = await fileToInput(file('ai.py', fx('ai.py')));
    expect(code.code?.language).toBe('python');
    const img = await fileToInput(file('sd.png', fx('sd.png')), 'auto', { decode: async () => ({ width: 64, height: 64, data: new Uint8Array(64 * 64 * 4).fill(128) }) });
    expect(img.kind).toBe('image');
    expect(img.image?.heatmap?.length).toBe(16);
  });

  it('PDF via injected pdf.js', async () => {
    const input = await fileToInput(file('a.pdf', fx('sample.pdf')), 'en', { pdfjs: () => import('pdfjs-dist/legacy/build/pdf.mjs') as never });
    expect(input.document?.meta.creator).toContain('ReportLab');
    expect(input.document?.text).toContain('fast-paced world');
    expect(input.document?.meta.positions.some((p) => p.page === 2)).toBe(true);
  });

  it('errors: too large, unsupported, invalid', async () => {
    await expect(fileToInput(file('a.txt', new Uint8Array(1), 21 * 1024 * 1024))).rejects.toMatchObject({ code: 'too_large' });
    await expect(fileToInput(file('a.exe', new Uint8Array(1)))).rejects.toMatchObject({ code: 'unsupported' });
    await expect(fileToInput(file('a.docx', new Uint8Array([1, 2, 3])))).rejects.toBeInstanceOf(AnalysisError);
    expect(extOf('noext')).toBe('');
  });

  it('documents run through the full pipeline (D-05)', async () => {
    const r = analyze(await fileToInput(file('a.docx', fx('ai.docx'))));
    expect(r.kind).toBe('document');
    expect(r.results.find((x) => x.id === 'D-01')!.score).toBeGreaterThan(0.5);
    expect(r.results.find((x) => x.id === 'D-05')).toBeTruthy();
    expect(r.advice.some((a) => a.id === 'D-01.metadata')).toBe(true);
    const h = analyze(await fileToInput(file('h.docx', fx('human.docx'))));
    expect(h.results.find((x) => x.id === 'D-01')!.score).toBeLessThan(0.5);
  });
});
