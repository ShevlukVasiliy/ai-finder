import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { commentLines, detectCodeLanguage, identifiers, looksLikeCode } from '../../src/core/detectors/code';
import { ijgQuality, IJG_LUMA, noiseStats, spectralPeak, watermarkStrength } from '../../src/core/detectors/image';
import { parseImageMeta } from '../../src/core/parsers/image';
import { getRegistry } from '../../src/core/registry';
import type { DocumentMeta, ImageMeta, PixelData } from '../../src/core/types';

const fx = (n: string) => new Uint8Array(readFileSync(join(__dirname, '..', 'fixtures', n)));
const img = (id: string, meta: ImageMeta, pixels?: PixelData) => getRegistry().image.find((d) => d.id === id)!.analyze({ image: { meta, pixels }, lang: 'ru' });
const code = (id: string, src: string, language = 'python') =>
  getRegistry().code.find((d) => d.id === id)!.analyze({ code: { code: src, language, lines: src.split('\n') }, lang: 'en' });
const doc = (id: string, meta: Partial<DocumentMeta>, text = 'word '.repeat(600)) =>
  getRegistry().document.find((d) => d.id === id)!.analyze({
    doc: { text, meta: { format: 'docx', styles: ['Normal'], rsids: 5, fonts: ['Calibri'], colors: [], htmlFragments: 0, positions: [], ...meta } },
    lang: 'en',
  });

function noise(w: number, h: number, seed = 1, amp = 40): PixelData {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const base = 128 + (rnd() - 0.5) * amp;
    data[i * 4] = base + (rnd() - 0.5) * amp;
    data[i * 4 + 1] = base + (rnd() - 0.5) * amp;
    data[i * 4 + 2] = base + (rnd() - 0.5) * amp;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}
const flat = (w: number, h: number): PixelData => ({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(120) });

describe('image detectors', () => {
  it('I-01 C2PA with AI claim scores 1; absent scores 0', () => {
    expect(img('I-01', parseImageMeta(fx('c2pa.png'))).score).toBe(1);
    expect(img('I-01', parseImageMeta(fx('plain.png'))).score).toBe(0);
  });

  it('I-02 flags SD parameters, generator software and IPTC source type', () => {
    expect(img('I-02', parseImageMeta(fx('sd.png'))).score).toBe(1);
    expect(img('I-02', parseImageMeta(fx('generated.jpg'))).score).toBe(1);
    expect(img('I-02', parseImageMeta(fx('camera.jpg'))).score).toBe(0);
  });

  it('I-03 typical generator sizes', () => {
    expect(img('I-03', parseImageMeta(fx('sd.png'))).score).toBe(1);
    expect(img('I-03', parseImageMeta(fx('camera.jpg'))).score).toBeLessThan(0.5);
    expect(img('I-03', { ...parseImageMeta(fx('plain.png')), width: 0 }).applicable).toBe(false);
  });

  it('I-04 spectrum: periodic upsampling grid gives a peak', () => {
    // Checkerboard-like artefact with period 4 (typical of transposed convolutions).
    const p = noise(256, 256, 3, 20);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (x % 4 === 0) for (let c = 0; c < 3; c++) p.data[(y * 256 + x) * 4 + c]! += 25;
    expect(spectralPeak(p)).toBeGreaterThan(2 * spectralPeak(noise(256, 256, 7)));
    expect(img('I-04', parseImageMeta(fx('plain.png'))).applicable).toBe(false);
  });

  it('I-05 smooth image vs grainy photo', () => {
    expect(noiseStats(flat(128, 128)).smoothShare).toBe(1);
    expect(noiseStats(noise(128, 128)).smoothShare).toBe(0);
    expect(img('I-05', parseImageMeta(fx('plain.png')), flat(64, 64)).score).toBe(1);
  });

  it('I-06 JPEG standard IJG table without camera', () => {
    expect(ijgQuality(IJG_LUMA)).toBe(50);
    expect(ijgQuality(IJG_LUMA.map((v) => v + 1))).toBeNull();
    expect(img('I-06', parseImageMeta(fx('generated.jpg'))).score).toBeGreaterThan(0.5);
    expect(img('I-06', parseImageMeta(fx('camera.jpg'))).score).toBe(0);
    expect(img('I-06', parseImageMeta(fx('sd.png'))).applicable).toBe(false);
  });

  it('I-07 detects invisible-watermark style quantisation', () => {
    // Build U channel where every 4×4 LL block DC lands on (k+0.25)*36.
    const w = 128;
    const h = 128;
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      // R=G=0 → U = 0.436*B + 128; choose B so that per-block DC = 4*LL_mean = 4*2*U = 8U ≡ 9 (mod 36)
      const target = (Math.floor(i / 97) % 5) * 36 + 9; // DC value
      const u = target / 8;
      const b = Math.round((u - 128) / 0.436);
      data.set([0, 0, Math.max(0, Math.min(255, b)), 255], i * 4);
    }
    const wm: PixelData = { width: w, height: h, data };
    const ws = watermarkStrength(wm);
    expect(ws).toBeGreaterThanOrEqual(0);
    expect(watermarkStrength(noise(128, 128))).toBeLessThan(0.6);
    expect(watermarkStrength(flat(8, 8))).toBe(0);
    expect(img('I-07', parseImageMeta(fx('plain.png')), noise(128, 128)).score).toBeLessThan(0.5);
  });

  it('property: pixel detectors stay in [0,1] on random images', () => {
    fc.assert(
      fc.property(fc.integer({ min: 64, max: 96 }), fc.integer({ min: 64, max: 96 }), fc.integer(), (w, h, seed) => {
        const px = noise(w, h, Math.abs(seed) + 1, 80);
        const meta = { ...parseImageMeta(fx('plain.png')), width: w, height: h };
        return ['I-04', 'I-05', 'I-07'].every((id) => {
          const r = img(id, meta, px);
          return r.score >= 0 && r.score <= 1;
        });
      }),
      { numRuns: 10 },
    );
  });
});

describe('code detectors', () => {
  const ai = new TextDecoder().decode(fx('ai.py'));
  const human = new TextDecoder().decode(fx('human.py'));
  it.each(['C-01', 'C-02', 'C-03', 'C-05'])('%s: AI code above human code', (id) => {
    expect(code(id, ai).score).toBeGreaterThan(code(id, human).score);
  });
  it('C-04 flags too-perfect formatting on longer files', () => {
    expect(code('C-04', ai).applicable).toBe(true);
    expect(code('C-04', human).applicable).toBe(false);
  });
  it('C-05 finds chat markers in JS too', () => {
    expect(code('C-05', "// Here's the updated code\nconst k = 'YOUR_API_KEY';", 'javascript').value).toBe(2);
  });
  it('helpers', () => {
    expect(detectCodeLanguage('', 'x.go')).toBe('go');
    expect(detectCodeLanguage('package main\nfunc main() {}')).toBe('go');
    expect(detectCodeLanguage('<?php echo 1;')).toBe('php');
    expect(detectCodeLanguage('public class A { }')).toBe('java');
    expect(detectCodeLanguage('using System;')).toBe('csharp');
    expect(detectCodeLanguage('let x: string = "a"')).toBe('typescript');
    expect(detectCodeLanguage('const a = () => 1')).toBe('javascript');
    expect(detectCodeLanguage('#include <stdio.h>')).toBe('cpp');
    expect(detectCodeLanguage('just words')).toBe('unknown');
    expect(detectCodeLanguage(ai)).toBe('python');
    expect(looksLikeCode(ai)).toBe(true);
    expect(looksLikeCode('Просто текст.\nЕщё строка.\nИ третья.')).toBe(false);
    expect(identifiers(ai)).toContain('calculate_total_price');
    expect(commentLines({ code: 'x = 1 // set x\n// hi', language: 'javascript', lines: ['x = 1 // set x', '// hi'] })).toHaveLength(2);
  });
  it.each(['C-01', 'C-02', 'C-03', 'C-04', 'C-05'])('%s handles empty input', (id) => {
    const r = code(id, '');
    expect(r.score).toBe(0);
  });
});

describe('document detectors', () => {
  it('D-01 generator metadata', () => {
    expect(doc('D-01', { application: 'python-docx' }).score).toBeGreaterThan(0.5);
    expect(doc('D-01', { application: 'Microsoft Office Word', author: 'Ann' }).score).toBe(0);
    expect(doc('D-01', {}).findings[0]?.params.extra).toBeUndefined();
    expect(doc('D-01', { format: 'txt' }).applicable).toBe(false);
    expect(doc('D-01', { author: 'A', created: 'x', modified: 'x' }).value).toBe(0.5);
  });
  it('D-02 words per minute', () => {
    expect(doc('D-02', { totalTimeMin: 2, revisions: 1 }).score).toBeGreaterThan(0.8);
    expect(doc('D-02', { totalTimeMin: 600, revisions: 30 }).score).toBe(0);
    expect(doc('D-02', {}).applicable).toBe(false);
    expect(doc('D-02', { format: 'pdf', totalTimeMin: 1 }).applicable).toBe(false);
  });
  it('D-03 single rsid and style', () => {
    expect(doc('D-03', { rsids: 1, styles: ['Normal'], fonts: [] }).score).toBe(1);
    expect(doc('D-03', { rsids: 30, styles: ['Normal', 'Heading 1'] }).score).toBe(0);
    expect(doc('D-03', {}, 'short').applicable).toBe(false);
  });
  it('D-04 chat formatting', () => {
    expect(doc('D-04', { styles: ['Normal (Web)'], htmlFragments: 1, fonts: ['Söhne'] }, '**bold** text\n## Head').score).toBe(1);
    expect(doc('D-04', {}).score).toBe(0);
    expect(doc('D-04', { format: 'md' }).applicable).toBe(false);
  });
});
