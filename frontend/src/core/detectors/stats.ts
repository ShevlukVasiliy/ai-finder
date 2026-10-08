import { deflateSync, strToU8 } from 'fflate';
import { crossEntropy, getModel } from '../ngram';
import { cv, mean, proseSentences } from '../text/segment';
import type { Detector, TextContext } from '../types';
import { finding, notApplicable, result } from './util';

const P01: Detector<TextContext> = {
  id: 'P-01',
  analyze(ctx) {
    const model = getModel(ctx.lang);
    const ss = proseSentences(ctx).filter((s) => s.words.length >= 4);
    if (!model || ss.length < 6) return notApplicable('P-01', ctx.lang);
    const ce = ss.map((s) => crossEntropy(model, s.text));
    const value = cv(ce);
    const m = mean(ce);
    // The most predictable sentences are the ones to rewrite.
    const spans = ss
      .map((s, i) => ({ s, e: ce[i]! }))
      .sort((a, b) => a.e - b.e)
      .slice(0, 3)
      .sort((a, b) => a.s.start - b.s.start)
      .map((x) => ({ start: x.s.start, end: x.s.end, detector: 'P-01' }));
    return result('P-01', ctx.lang, value, {
      findings: [finding('P-01.low_perplexity', spans, { value, mean: m })],
    });
  },
};

export function compressionRatio(text: string): number {
  const bytes = strToU8(text.replace(/\s+/g, ' '));
  if (!bytes.length) return 0;
  return deflateSync(bytes, { level: 9 }).length / bytes.length;
}

const P02: Detector<TextContext> = {
  id: 'P-02',
  analyze(ctx) {
    if (ctx.text.length < 600) return notApplicable('P-02', ctx.lang);
    // Fixed-size window: ratio depends strongly on input length.
    const sample = ctx.text.slice(0, 3000);
    const value = compressionRatio(sample);
    return result('P-02', ctx.lang, value, { findings: [finding('P-02.compressible', [], { value })] });
  },
};

export const DETECTORS = [P01, P02];
