/**
 * Fits the logistic combination weights for text detectors and writes rules/weights.yaml.
 * Data: own hand-written corpus (modern chat-assistant genre) + ~17.6k public texts (scripts/build_dataset.py).
 * Classical statistics only (no LLMs). Run: pnpm --dir frontend calibrate
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../frontend/src/core/analyze';
import { fitLogistic, fpr, rocAuc } from '../frontend/src/core/metrics';
import { loadModels } from '../frontend/src/core/ngram';
import { getRules } from '../frontend/src/core/rules';
import { CORPUS, EXTERNAL_TEST, EXTERNAL_TRAIN, type Sample } from '../frontend/tests/quality/corpus';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await loadModels();
const t0 = Date.now();

const ids = getRules()
  .detectors.filter((d) => d.kind === 'text' && d.calibrate !== false)
  .map((d) => d.id);
const features = (s: Sample) => {
  const r = analyze({ kind: 'text', text: s.text, lang: s.lang });
  return ids.map((id) => r.results.find((x) => x.id === id)?.score ?? 0);
};

const train = [...CORPUS, ...EXTERNAL_TRAIN];
const X = train.map(features);
const y = train.map((s) => (s.ai ? 1 : 0));
// The own corpus is the only source of chat-assistant answers: let it carry ~10 % of the total weight.
const ownW = EXTERNAL_TRAIN.length ? (0.1 * EXTERNAL_TRAIN.length) / CORPUS.length : 1;
const sw = train.map((s) => (s.origin === 'own' ? ownW : 1));
const t1 = Date.now();

const { bias, weights } = fitLogistic(X, y, { l2: 0.002, lr: 1, epochs: 1500, sampleWeights: sw });
const t2 = Date.now();

// Pick the bias so that at most 5 % of human training texts reach the "AI" verdict (score ≥ 65).
const z = X.map((x) => x.reduce((a, v, j) => a + v * weights[j]!, 0));
const humanZ = z.filter((_, i) => !y[i]).sort((a, b) => a - b);
const q95 = humanZ[Math.floor(humanZ.length * 0.95)] ?? 0;
const logit65 = Math.log(65 / 35);
const calibratedBias = Math.min(bias, logit65 - q95);

const lines = ['# Коэффициенты логистической модели. Сгенерировано scripts/calibrate.ts — не редактировать вручную.', 'text:', `  bias: ${calibratedBias.toFixed(4)}`, '  weights:'];
ids.forEach((id, j) => {
  lines.push(`    ${id}: ${weights[j]!.toFixed(4)}`); // zeros too: missing ids fall back to priors
});
writeFileSync(join(root, 'rules', 'weights.yaml'), `${lines.join('\n')}\n`);

const prob = (x: number[]) => 100 / (1 + Math.exp(-(x.reduce((a, v, j) => a + v * weights[j]!, 0) + calibratedBias)));
console.log(`train: ${train.length} texts (own ${CORPUS.length} × w=${ownW.toFixed(1)}), features ${((t1 - t0) / 1000).toFixed(1)}s, fit ${((t2 - t1) / 1000).toFixed(1)}s`);
console.log(ids.map((id, j) => `${id}=${weights[j]!.toFixed(2)}`).join(' '));

const test = EXTERNAL_TEST.map((s) => ({ s, p: prob(features(s)) }));
const report = (label: string, rows: typeof test) => {
  const sc = rows.map((r) => r.p);
  const lb = rows.map((r) => r.s.ai);
  const tpr = rows.filter((r) => r.s.ai && r.p >= 65).length / Math.max(1, rows.filter((r) => r.s.ai).length);
  console.log(`${label.padEnd(28)} n=${String(rows.length).padStart(5)}  AUC ${rocAuc(sc, lb).toFixed(3)}  FPR@65 ${fpr(sc, lb, 65).toFixed(3)}  TPR@65 ${tpr.toFixed(3)}`);
};
console.log('held-out:');
for (const lang of ['ru', 'en'] as const) report(lang, test.filter((r) => r.s.lang === lang));
const bySource = new Map<string, typeof test>();
for (const r of test) {
  const k = `${r.s.lang}/${r.s.source.split('/')[0]}`;
  bySource.set(k, [...(bySource.get(k) ?? []), r]);
}
for (const [k, rows] of [...bySource].sort()) report(k, rows);
console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
