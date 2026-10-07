import { beforeAll, describe, expect, it } from 'vitest';
import { buildAdvice, counterfactualGain, fill, severity, topAdvice } from '../../src/core/advice';
import { analyze, AnalysisError, diffReports, LIMITS, normalize, recheck, rulesCatalog } from '../../src/core/analyze';
import { f1, fitLogistic, fpr, rocAuc } from '../../src/core/metrics';
import { loadModels, trainModel, crossEntropy, normalizeForModel } from '../../src/core/ngram';
import { normalizeText } from '../../src/core/normalize';
import { getRegistry, registerDetector, unregisterDetector } from '../../src/core/registry';
import { categories, combine, confidence, modelFor, verdict } from '../../src/core/scoring';
import { addVersion, clearHistory, loadHistory, saveHistory } from '../../src/core/session';
import type { DetectorResult } from '../../src/core/types';
import { sample } from './helpers';

beforeAll(() => loadModels());

describe('analyze()', () => {
  it('AI text → high score, verdict ai, advice sorted by priority', () => {
    const r = analyze({ kind: 'text', text: sample('ru', true, 0) });
    expect(r.lang).toBe('ru');
    expect(r.score).toBeGreaterThan(65);
    expect(r.verdict).toBe('ai');
    expect(r.advice.length).toBeGreaterThan(2);
    for (let i = 1; i < r.advice.length; i++) expect(r.advice[i - 1]!.priority).toBeGreaterThanOrEqual(r.advice[i]!.priority);
    expect(r.sentences.length).toBeGreaterThan(5);
    expect(r.categories.length).toBeGreaterThan(3);
    expect(r.metrics.every((m) => m.corridor.length === 2)).toBe(true);
  });

  it('human text → low score', () => {
    const r = analyze({ kind: 'text', text: sample('en', false, 0) });
    expect(r.score).toBeLessThan(35);
    expect(r.verdict).toBe('human');
  });

  it('validation errors and limits', () => {
    expect(() => analyze({ kind: 'text', text: '  ' })).toThrow(AnalysisError);
    expect(() => analyze({ kind: 'text', text: 'a'.repeat(LIMITS.maxChars + 1) })).toThrowError(/exceeds/);
    expect(() => analyze({ kind: 'image' })).toThrow(AnalysisError);
    expect(() => analyze({ kind: 'document' })).toThrow(AnalysisError);
    const short = analyze({ kind: 'text', text: 'Короткий текст.' });
    expect(short.warnings).toContain('short_text');
    expect(short.confidence.level).toBe('low');
  });

  it('forced language overrides detection', () => {
    expect(analyze({ kind: 'text', text: sample('en', true, 1), lang: 'ru' }).lang).toBe('ru');
  });

  it('code from pasted text', () => {
    const r = analyze({ kind: 'code', text: '# Step 1: init\nx = 1\n# Step 2: print\nprint(x)\n# Example usage:\nprint("🚀 go")\n' });
    expect(r.kind).toBe('code');
    expect(r.results.find((x) => x.id === 'C-05')!.score).toBeGreaterThan(0);
  });

  it('recheck returns diff with closed findings', () => {
    const text = sample('ru', true, 0);
    const before = analyze({ kind: 'text', text });
    const edited = sample('ru', false, 0);
    const { report, diff } = recheck(before, { kind: 'text', text: edited });
    expect(report.score).toBeLessThan(before.score);
    expect(diff.scoreBefore).toBe(before.score);
    expect(diff.closed.length).toBeGreaterThan(0);
    expect(diff.metrics.length).toBeGreaterThan(0);
    expect(diffReports(before, before).closed).toEqual([]);
  });

  it('normalize() and rulesCatalog()', () => {
    expect(normalize('тeкст​').text).toBe('текст');
    expect(() => normalize('a'.repeat(LIMITS.maxChars + 1))).toThrow();
    const cat = rulesCatalog('en');
    expect(cat.find((d) => d.id === 'R-01')!.advice[0]!.id).toBe('R-01.low_burstiness');
  });
});

describe('advice engine', () => {
  const res = (id: string, score: number, rule: string, params = {}): DetectorResult => ({
    id, category: 'style', score, applicable: true, value: 0.2,
    findings: [{ detector: id, rule, score, spans: [{ start: 0, end: 4, detector: id }], params }],
  });

  it('fills templates with formats', () => {
    expect(fill('cv {cv:.2f} share {s:.0%} n {n} miss {x} f {f}', { cv: 0.123, s: 0.5, n: 3, f: 0.333 })).toBe('cv 0.12 share 50% n 3 miss f 0.33');
    expect(fill('«{p}»', {})).toBe('…');
  });

  it('maps findings to rules with substitutions and severity', () => {
    const items = buildAdvice([res('R-01', 0.9, 'R-01.low_burstiness', { value: 0.21, para: 2 })], 'text', 'ru');
    expect(items[0]!.id).toBe('R-01.low_burstiness');
    expect(items[0]!.explain).toContain('0.21');
    expect(items[0]!.actions[0]).toContain('абзаце 2');
    expect(items[0]!.severity).toBe('high');
    expect(severity(0.6)).toBe('medium');
    expect(severity(0.2)).toBe('low');
  });

  it('merges related findings into a combo', () => {
    const items = buildAdvice(
      [res('R-01', 0.9, 'R-01.low_burstiness'), res('R-03', 0.8, 'R-03.uniform_paragraphs'), res('S-01', 0.9, 'S-01.template')],
      'text',
      'en',
    );
    expect(items.map((i) => i.id)).toEqual(['combo.too_even']);
    expect(items[0]!.detectors).toEqual(expect.arrayContaining(['R-01', 'R-03', 'S-01']));
  });

  it('prioritises by expected_gain / effort', () => {
    const items = buildAdvice([res('L-01', 1, 'L-01.markers'), res('L-02', 1, 'L-02.flat_diversity')], 'text', 'en', 'it is crucial to delve');
    expect(items[0]!.id).toBe('L-01.markers');
    expect(items[0]!.replacements.length).toBeGreaterThan(0);
    expect(topAdvice(items, 1)).toHaveLength(1);
  });

  it('counterfactual gain is positive for strong detectors', () => {
    expect(counterfactualGain([res('L-01', 1, 'L-01.markers')], 'text', ['L-01'])).toBeGreaterThan(0);
  });

  it('ignores findings without a matching rule', () => {
    expect(buildAdvice([res('R-01', 1, 'nope')], 'text', 'en')).toEqual([]);
  });
});

describe('scoring', () => {
  it('verdict bands, categories, confidence', () => {
    expect(verdict(10)).toBe('human');
    expect(verdict(50)).toBe('mixed');
    expect(verdict(90)).toBe('ai');
    expect(combine([], 'image')).toBeLessThan(50);
    expect(modelFor('code').bias).toBeLessThan(0);
    expect(modelFor('document').weight('R-01')).toBeGreaterThan(0);
    expect(categories([{ id: 'R-01', category: 'style', score: 0.5, applicable: true, value: 0, findings: [] }])[0]!.score).toBe(50);
    expect(confidence('image', 0, []).reasons).toContain('image_lower_confidence');
    expect(confidence('text', 5000, []).reasons).toContain('few_signals');
  });
});

describe('normalizeText', () => {
  it('fixes homoglyphs to the dominant script and strips invisibles', () => {
    const r = normalizeText('﻿Пpивeт​ wоrld­s δοg раз длинное');
    expect(r.text).toBe('Привет worlds \u03B4og раз\u00A0длинное');
    expect(r.replaced).toBeGreaterThanOrEqual(3);
    expect(r.removed).toBeGreaterThanOrEqual(3);
    expect(normalizeText('Αlpha').text).toBe('Alpha');
    expect(normalizeText('кот').replaced).toBe(0);
  });
});

describe('plugins, session, metrics, ngram', () => {
  it('registers and replaces detectors', () => {
    const d = { id: 'X-01', analyze: () => ({ id: 'X-01', category: 'style' as const, score: 0, applicable: false, value: 0, findings: [] }) };
    registerDetector('text', d);
    registerDetector('text', d);
    expect(getRegistry().text.filter((x) => x.id === 'X-01')).toHaveLength(1);
    unregisterDetector('text', 'X-01');
    unregisterDetector('text', 'X-01');
    expect(getRegistry().text.some((x) => x.id === 'X-01')).toBe(false);
  });

  it('session history round-trip', () => {
    clearHistory();
    const r = analyze({ kind: 'text', text: sample('en', true, 0) });
    let h = addVersion([], r);
    h = addVersion(h, { ...r, image: { meta: {} as never, pixels: { width: 1, height: 1, data: new Uint8Array(4) } } });
    saveHistory(h);
    const loaded = loadHistory();
    expect(loaded.map((v) => v.id)).toEqual([1, 2]);
    expect(loaded[1]!.report.image?.pixels).toBeUndefined();
    sessionStorage.setItem('ai-finder:history', '{bad');
    expect(loadHistory()).toEqual([]);
    clearHistory();
  });

  it('metrics and logistic fit', () => {
    expect(rocAuc([0.9, 0.8, 0.1], [true, true, false])).toBe(1);
    expect(rocAuc([0.5], [true])).toBe(0.5);
    expect(fpr([0.9, 0.1], [true, false], 0.5)).toBe(0);
    expect(fpr([1], [true], 0.5)).toBe(0);
    expect(f1([0.9, 0.1, 0.8], [true, false, false], 0.5)).toBeCloseTo(2 / 3);
    expect(f1([0.1], [true], 0.5)).toBe(0);
    const { weights } = fitLogistic([[1], [0], [1], [0]], [1, 0, 1, 0], { epochs: 500 });
    expect(weights[0]).toBeGreaterThan(0);
  });

  it('trigram model gives lower cross-entropy to familiar text', () => {
    const m = trainModel(['the cat sat on the mat. the cat sat again.'.repeat(5)], 3, 1);
    expect(crossEntropy(m, 'the cat sat')).toBeLessThan(crossEntropy(m, 'zxq vbk jjj'));
    expect(crossEntropy(m, '')).toBeGreaterThanOrEqual(0);
    expect(normalizeForModel('Ёлка 123!')).toBe('елка 000!');
  });
});
