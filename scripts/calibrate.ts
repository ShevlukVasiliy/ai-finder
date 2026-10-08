/**
 * Fits the logistic combination weights for text detectors on the labelled corpus
 * and writes rules/weights.yaml. Classical statistics only (no LLMs).
 * Run: pnpm --dir frontend calibrate
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../frontend/src/core/analyze';
import { fitLogistic, fpr, rocAuc } from '../frontend/src/core/metrics';
import { loadModels } from '../frontend/src/core/ngram';
import { getRules } from '../frontend/src/core/rules';
import { EXTERNAL_TEST, TRAINING as CORPUS } from '../frontend/tests/quality/corpus';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await loadModels();

const ids = getRules()
  .detectors.filter((d) => d.kind === 'text')
  .map((d) => d.id);
const X: number[][] = [];
const y: number[] = [];
for (const s of CORPUS) {
  const r = analyze({ kind: 'text', text: s.text, lang: s.lang });
  X.push(ids.map((id) => r.results.find((x) => x.id === id)?.score ?? 0));
  y.push(s.ai ? 1 : 0);
}

const { bias, weights } = fitLogistic(X, y, { l2: 0.01, lr: 0.5, epochs: 6000 });
// Shift the bias so that the decision threshold (score 50) keeps human FPR minimal.
const z = X.map((x) => x.reduce((a, v, j) => a + v * weights[j]!, 0));
const humanZ = z.filter((_, i) => !y[i]).sort((a, b) => a - b);
const aiZ = z.filter((_, i) => y[i]).sort((a, b) => a - b);
const humanMax = humanZ[humanZ.length - 1] ?? 0;
const aiMin = aiZ[0] ?? 0;
// Midpoint between the top human and the lowest AI sample when separable, else 95th percentile of humans.
const cut = aiMin > humanMax ? (humanMax + aiMin) / 2 : (humanZ[Math.floor(humanZ.length * 0.95)] ?? 0) + 0.01;
const calibratedBias = Math.min(bias, -cut);

const lines = ['# Коэффициенты логистической модели. Сгенерировано scripts/calibrate.ts — не редактировать вручную.', 'text:', `  bias: ${calibratedBias.toFixed(4)}`, '  weights:'];
ids.forEach((id, j) => {
  if (weights[j]! > 1e-3) lines.push(`    ${id}: ${weights[j]!.toFixed(4)}`);
});
writeFileSync(join(root, 'rules', 'weights.yaml'), `${lines.join('\n')}\n`);

const probs = z.map((v) => 100 / (1 + Math.exp(-(v + calibratedBias))));
const labels = y.map(Boolean);
console.log(`samples: ${CORPUS.length}`);
console.log(`ROC-AUC: ${rocAuc(probs, labels).toFixed(3)}  FPR@50: ${fpr(probs, labels, 50).toFixed(3)}  FPR@65: ${fpr(probs, labels, 65).toFixed(3)}`);
console.log(ids.map((id, j) => `${id}=${weights[j]!.toFixed(2)}`).join(' '));

// Held-out check on the external sample (not used for fitting).
const hz = EXTERNAL_TEST.map((s) => {
  const r = analyze({ kind: 'text', text: s.text, lang: s.lang });
  const x = ids.map((id) => r.results.find((q) => q.id === id)?.score ?? 0);
  return 100 / (1 + Math.exp(-(x.reduce((a, v, j) => a + v * weights[j]!, 0) + calibratedBias)));
});
for (const lang of ['ru', 'en'] as const) {
  const idx = EXTERNAL_TEST.map((s, i) => (s.lang === lang ? i : -1)).filter((i) => i >= 0);
  const sc = idx.map((i) => hz[i]!);
  const lb = idx.map((i) => EXTERNAL_TEST[i]!.ai);
  console.log(`held-out ${lang}: n=${idx.length} ROC-AUC ${rocAuc(sc, lb).toFixed(3)} FPR@50 ${fpr(sc, lb, 50).toFixed(3)} FPR@65 ${fpr(sc, lb, 65).toFixed(3)}`);
}
