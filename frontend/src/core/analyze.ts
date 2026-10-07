import { buildAdvice } from './advice';
import { detectCodeLanguage } from './detectors/code';
import { getRegistry } from './registry';
import { getRules, spec } from './rules';
import { categories, combine, confidence, sentenceScores, verdict } from './scoring';
import { normalizeText, type NormalizeResult } from './normalize';
import { buildContext, detectLang } from './text/segment';
import type {
  AnalysisInput,
  DetectorResult,
  Lang,
  Metric,
  Report,
  ReportDiff,
  TextContext,
} from './types';

export const LIMITS = { maxFileBytes: 20 * 1024 * 1024, maxChars: 100_000, minChars: 300 };

export type AnalysisErrorCode = 'empty' | 'too_long' | 'too_large' | 'unsupported' | 'invalid';

export class AnalysisError extends Error {
  constructor(
    public readonly code: AnalysisErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function runText(ctx: TextContext): DetectorResult[] {
  return getRegistry().text.map((d) => d.analyze(ctx));
}

function metricsFor(results: DetectorResult[], lang: Lang): Metric[] {
  return results
    .filter((r) => r.applicable && spec(r.id).weight > 0)
    .map((r) => {
      const s = spec(r.id);
      return { detector: r.id, name: s.name[lang], value: r.value, corridor: s.corridor[lang], score: r.score };
    });
}

function textOf(input: AnalysisInput): string {
  if (input.kind === 'text') return input.text ?? '';
  if (input.kind === 'document') return input.document?.text ?? '';
  if (input.kind === 'code') return input.code?.code ?? input.text ?? '';
  return '';
}

export function analyze(input: AnalysisInput): Report {
  const text = textOf(input);
  const warnings: string[] = [];
  if (input.kind !== 'image' && !text.trim()) throw new AnalysisError('empty', 'Nothing to analyse');
  if (text.length > LIMITS.maxChars) throw new AnalysisError('too_long', `Text exceeds ${LIMITS.maxChars} characters`);
  if (input.kind === 'image' && !input.image) throw new AnalysisError('invalid', 'Image data missing');
  if (input.kind === 'document' && !input.document) throw new AnalysisError('invalid', 'Document data missing');

  const forced = input.lang && input.lang !== 'auto' ? input.lang : undefined;
  const lang: Lang = forced ?? (text.trim() ? detectLang(text).lang : 'ru');
  const ui: Lang = input.uiLang ?? lang;
  let results: DetectorResult[];
  let sentences: { start: number; end: number }[] = [];

  if (input.kind === 'text' || input.kind === 'document') {
    if (text.length < LIMITS.minChars) warnings.push('short_text');
    const ctx = buildContext(text, forced, input.document?.meta.format === 'md');
    sentences = ctx.sentences;
    results = runText(ctx);
    if (input.kind === 'document') {
      const doc = input.document!;
      const docResults = getRegistry().document.map((d) => d.analyze({ doc, lang: ui }));
      const textScore = combine(results, 'text') / 100;
      results = [
        ...results,
        ...docResults,
        { id: 'D-05', category: 'metadata', score: textScore, applicable: true, value: textScore, findings: [] },
      ];
    }
  } else if (input.kind === 'image') {
    const image = input.image!;
    results = getRegistry().image.map((d) => d.analyze({ image, lang: ui }));
  } else {
    const code = input.code ?? { code: text, language: detectCodeLanguage(text), lines: text.split('\n') };
    results = getRegistry().code.map((d) => d.analyze({ code, lang: ui }));
  }

  const score = combine(results, input.kind);
  const advice = buildAdvice(results, input.kind, ui, input.kind === 'code' ? '' : text);
  return {
    kind: input.kind,
    lang,
    score,
    verdict: verdict(score),
    confidence: confidence(input.kind, text.length, results),
    categories: categories(results.filter((r) => r.id !== 'D-05')),
    results,
    findings: results.flatMap((r) => r.findings),
    advice,
    metrics: metricsFor(results, ui),
    sentences: sentenceScores(sentences, results, score),
    text,
    document: input.document?.meta,
    image: input.image,
    warnings,
  };
}

export function diffReports(before: Report, after: Report): ReportDiff {
  const fired = (r: Report) => new Set(r.advice.flatMap((a) => (a.id.startsWith('combo.') ? [a.id] : a.detectors)));
  const b = fired(before);
  const a = fired(after);
  const metrics = after.metrics
    .map((m) => {
      const prev = before.metrics.find((x) => x.detector === m.detector);
      return prev ? { detector: m.detector, name: m.name, before: prev.value, after: m.value } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Math.abs(x.before - x.after) > 1e-9);
  return {
    scoreBefore: before.score,
    scoreAfter: after.score,
    closed: [...b].filter((x) => !a.has(x)),
    opened: [...a].filter((x) => !b.has(x)),
    remaining: [...a].filter((x) => b.has(x)),
    metrics,
  };
}

export function recheck(previous: Report, input: AnalysisInput): { report: Report; diff: ReportDiff } {
  const report = analyze(input);
  return { report, diff: diffReports(previous, report) };
}

export function normalize(text: string): NormalizeResult {
  if (text.length > LIMITS.maxChars) throw new AnalysisError('too_long', `Text exceeds ${LIMITS.maxChars} characters`);
  return normalizeText(text);
}

/** Detector catalogue (equivalent of GET /api/rules). */
export function rulesCatalog(lang: Lang) {
  const r = getRules();
  return r.detectors.map((d) => ({
    id: d.id,
    category: d.category,
    kind: d.kind,
    name: d.name[lang],
    corridor: d.corridor[lang],
    advice: r.advice.filter((a) => a.detector === d.id).map((a) => ({ id: a.id, title: a[lang].title })),
  }));
}
