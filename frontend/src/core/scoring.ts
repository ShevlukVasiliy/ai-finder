import { getRules, spec } from './rules';
import type { Category, CategoryScore, ContentKind, DetectorResult, Report, SentenceScore, Span } from './types';
import { CATEGORIES } from './types';

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

interface Model {
  bias: number;
  weight(id: string): number;
}

/** Calibrated logistic model for a content kind, falling back to prior weights from detectors.yaml. */
export function modelFor(kind: ContentKind): Model {
  const rules = getRules();
  const w = rules.weights[kind];
  const textW = rules.weights.text;
  const prior = (id: string) => spec(id).weight;
  const calibrated = (id: string): number | undefined => {
    if (w && id in w.weights) return w.weights[id];
    // Document text goes through the text pipeline, so reuse its calibration.
    if (kind === 'document' && textW && id in textW.weights) return textW.weights[id];
    return undefined;
  };
  const hasCal = Boolean(w && Object.keys(w.weights).length) || (kind === 'document' && Boolean(textW && Object.keys(textW.weights).length));
  if (hasCal) {
    const bias = w?.bias ?? textW!.bias;
    return { bias, weight: (id) => calibrated(id) ?? prior(id) };
  }
  // Uncalibrated prior: a text where every detector sits at 0.35 scores 50.
  const total = rules.detectors.filter((d) => d.kind === kind || (kind === 'document' && d.kind === 'text')).reduce((a, d) => a + d.weight, 0);
  return { bias: -0.35 * total, weight: prior };
}

export function combine(results: DetectorResult[], kind: ContentKind): number {
  const m = modelFor(kind);
  let z = m.bias;
  for (const r of results) if (r.applicable) z += m.weight(r.id) * r.score;
  return Math.round(sigmoid(z) * 1000) / 10;
}

export function verdict(score: number): Report['verdict'] {
  return score < 35 ? 'human' : score < 65 ? 'mixed' : 'ai';
}

export function categories(results: DetectorResult[]): CategoryScore[] {
  const out: CategoryScore[] = [];
  for (const c of CATEGORIES) {
    const rs = results.filter((r) => r.category === c && r.applicable);
    if (!rs.length) continue;
    const wsum = rs.reduce((a, r) => a + spec(r.id).weight, 0) || rs.length;
    const score = rs.reduce((a, r) => a + r.score * (spec(r.id).weight || 1), 0) / wsum;
    out.push({ category: c as Category, score: Math.round(score * 100), detectors: rs.map((r) => r.id) });
  }
  return out;
}

export function confidence(
  kind: ContentKind,
  textLength: number,
  results: DetectorResult[],
): Report['confidence'] {
  const reasons: string[] = [];
  const active = new Set(results.filter((r) => r.applicable && r.score >= 0.5).map((r) => r.category));
  const signalFactor = Math.min(1, 0.4 + active.size * 0.15);
  let lengthFactor = 1;
  if (kind === 'text' || kind === 'document') {
    lengthFactor = Math.min(1, textLength / 2000);
    if (textLength < 300) {
      lengthFactor = Math.min(lengthFactor, 0.2);
      reasons.push('short_text');
    }
  }
  let value = lengthFactor * 0.6 + signalFactor * 0.4;
  if (kind === 'image') {
    value = Math.min(value, 0.6);
    reasons.push('image_lower_confidence');
  }
  if (active.size <= 1) reasons.push('few_signals');
  const level = value >= 0.75 ? 'high' : value >= 0.45 ? 'medium' : 'low';
  return { level, value: Math.round(value * 100) / 100, reasons };
}

/** Per-sentence heat: overall level plus weighted overlap with finding spans. */
export function sentenceScores(
  sentences: { start: number; end: number }[],
  results: DetectorResult[],
  overall: number,
): SentenceScore[] {
  const spans: (Span & { w: number })[] = [];
  for (const r of results)
    for (const f of r.findings)
      for (const s of f.spans) spans.push({ ...s, w: f.score * Math.max(0.3, spec(r.id).weight) });
  return sentences.map((s) => {
    let heat = 0;
    for (const sp of spans) if (sp.start < s.end && sp.end > s.start) heat += sp.w * 0.12;
    const score = Math.min(1, (overall / 100) * 0.5 + heat);
    return { start: s.start, end: s.end, score: Math.round(score * 100) / 100 };
  });
}
