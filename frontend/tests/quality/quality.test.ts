import { beforeAll, describe, expect, it } from 'vitest';
import { analyze } from '../../src/core/analyze';
import { fitLogistic, fpr, rocAuc } from '../../src/core/metrics';
import { loadModels } from '../../src/core/ngram';
import { getRules } from '../../src/core/rules';
import { CORPUS } from './corpus';

beforeAll(() => loadModels());

describe('quality regression on the labelled corpus', () => {
  it('shipped weights: ROC-AUC ≥ 0.8 and human FPR ≤ 10 %', () => {
    const scores = CORPUS.map((s) => analyze({ kind: 'text', text: s.text, lang: s.lang }).score);
    const labels = CORPUS.map((s) => s.ai);
    expect(rocAuc(scores, labels)).toBeGreaterThanOrEqual(0.8);
    expect(fpr(scores, labels, 50)).toBeLessThanOrEqual(0.1);
  });

  it('leave-one-out cross-validation: ROC-AUC ≥ 0.8', () => {
    const ids = getRules().detectors.filter((d) => d.kind === 'text').map((d) => d.id);
    const X = CORPUS.map((s) => {
      const r = analyze({ kind: 'text', text: s.text, lang: s.lang });
      return ids.map((id) => r.results.find((x) => x.id === id)?.score ?? 0);
    });
    const y = CORPUS.map((s) => (s.ai ? 1 : 0));
    const preds = X.map((x, i) => {
      const { bias, weights } = fitLogistic(X.filter((_, j) => j !== i), y.filter((_, j) => j !== i), { epochs: 800, l2: 0.01 });
      return bias + x.reduce((a, v, j) => a + v * weights[j]!, 0);
    });
    expect(rocAuc(preds, y.map(Boolean))).toBeGreaterThanOrEqual(0.8);
  }, 120000);

  it('advice works: removing flagged markers lowers the score', () => {
    for (const s of CORPUS.filter((x) => x.ai).slice(0, 6)) {
      const before = analyze({ kind: 'text', text: s.text, lang: s.lang });
      let edited = s.text;
      for (const a of before.advice.filter((x) => x.detectors.includes('L-01')))
        for (const sp of [...a.spans].sort((p, q) => q.start - p.start)) edited = edited.slice(0, sp.start) + edited.slice(sp.end);
      expect(analyze({ kind: 'text', text: edited, lang: s.lang }).score).toBeLessThanOrEqual(before.score);
    }
  });
});
