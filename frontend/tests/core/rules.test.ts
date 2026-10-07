import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { RuleValidationError, defaultSources, getRules, normalize, parseRules, setRules, spec, validateRules } from '../../src/core/rules';

const raw = () => ({
  detectors: yaml.load(defaultSources.detectors),
  advice: yaml.load(defaultSources.advice),
  markers: yaml.load(defaultSources.markers),
  lexicon: yaml.load(defaultSources.lexicon),
  weights: yaml.load(defaultSources.weights),
});

describe('rules schema', () => {
  it('all shipped YAML rules are valid', () => {
    expect(validateRules(raw())).toEqual([]);
  });

  it('every detector has advice in RU and EN', () => {
    const r = getRules();
    for (const d of r.detectors.filter((x) => x.id !== 'D-05')) {
      const a = r.advice.filter((x) => x.detector === d.id);
      expect(a.length, d.id).toBeGreaterThan(0);
      for (const rule of a) {
        expect(rule.ru.title).toBeTruthy();
        expect(rule.en.title).toBeTruthy();
      }
    }
  });

  it('fails on a broken rule', () => {
    const r = raw() as Record<string, unknown>;
    const adv = r.advice as { rules: Record<string, unknown>[] };
    adv.rules[0] = { ...adv.rules[0], effort: 7, en: { title: '' } };
    const errors = validateRules(r as Parameters<typeof validateRules>[0]);
    expect(errors.some((e) => e.includes('effort'))).toBe(true);
    expect(errors.some((e) => e.includes('en.title'))).toBe(true);
  });

  it('reports many kinds of schema errors', () => {
    const errors = validateRules({
      detectors: [{ id: 'bad' }, { id: 'R-01', category: 'style', kind: 'text', weight: 1, metric: 'm', direction: 'up', thresholds: { ru: { lo: 0, hi: 1 }, en: { lo: 1, hi: 0 } }, corridor: { ru: [0, 1], en: [1] }, name: { ru: 'x' } }, 5],
      advice: { rules: [{ id: 'X', detector: 'Z-99', target: 'bad', effort: 1, expected_gain: -1 }, 'str'], combos: [{ id: 'c', detectors: ['Q-01'], min: 1 }, 3] },
      markers: { ru: [{ pattern: '(', weight: 0, replace: 'no' }, 1], en: [] },
      lexicon: { hedges: {}, chat_markers: ['['] },
      weights: { video: { bias: 0, weights: {} }, text: { bias: 'x' }, code: { bias: 0, weights: { 'R-01': 'a', 'Z-01': 1 } } },
    });
    for (const needle of ['id: expected', 'thresholds.en', 'corridor.en', 'name.en', 'must be a mapping', 'unknown Z-99', 'target', 'expected_gain', 'min', 'invalid regex', 'markers.en', 'lexicon.hedges', 'unknown content kind', 'need bias', 'unknown detector', 'number required', 'no rule for R-01'])
      expect(errors.some((e) => e.includes(needle)), needle).toBe(true);
    expect(validateRules({ detectors: 1, advice: {}, markers: 1, lexicon: 1, weights: 1 }).length).toBeGreaterThan(3);
  });

  it('parseRules throws RuleValidationError', () => {
    expect(() => parseRules({ ...defaultSources, markers: 'ru: []\nen: []' })).toThrow(RuleValidationError);
  });

  it('hot-swaps rules', () => {
    const orig = getRules();
    const modified = parseRules(defaultSources);
    modified.detectors.find((d) => d.id === 'R-01')!.weight = 9;
    setRules(modified);
    expect(spec('R-01').weight).toBe(9);
    setRules(orig);
    expect(() => spec('Q-42')).toThrow();
  });

  it('normalises by direction and clamps', () => {
    expect(normalize('R-01', 0.2, 'ru')).toBe(1);
    expect(normalize('R-01', 0.9, 'ru')).toBe(0);
    expect(normalize('L-01', 100, 'en')).toBe(1);
    expect(normalize('L-01', Number.NaN, 'en')).toBe(0);
  });
});
