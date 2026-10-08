import * as yaml from 'js-yaml';
import detectorsSrc from '@rules/detectors.yaml?raw';
import adviceSrc from '@rules/advice.yaml?raw';
import markersSrc from '@rules/markers.yaml?raw';
import lexiconSrc from '@rules/lexicon.yaml?raw';
import weightsSrc from '@rules/weights.yaml?raw';
import { CATEGORIES, type Category, type ContentKind, type Lang } from './types';

export interface DetectorSpec {
  id: string;
  category: Category;
  kind: ContentKind;
  weight: number;
  metric: string;
  direction: 'up' | 'down';
  thresholds: Record<Lang, { lo: number; hi: number }>;
  corridor: Record<Lang, [number, number]>;
  name: Record<Lang, string>;
}

export interface AdviceText {
  title: string;
  explain: string;
  actions: string[];
}

export interface AdviceRule {
  id: string;
  detector: string;
  target: 'sentences' | 'paragraphs' | 'phrases' | 'none';
  effort: number;
  expected_gain: number;
  autofix?: boolean;
  ru: AdviceText;
  en: AdviceText;
}

export interface ComboRule {
  id: string;
  detectors: string[];
  min: number;
  effort: number;
  ru: AdviceText;
  en: AdviceText;
}

export interface Marker {
  pattern: string;
  weight: number;
  replace: string[];
}

export interface Lexicon {
  hedges: Record<Lang, string[]>;
  nominal_suffixes: Record<Lang, string[]>;
  noise: Record<Lang, string[]>;
  conclusion: Record<Lang, string[]>;
  summary_openers: Record<Lang, string[]>;
  template_headings: Record<Lang, string[]>;
  assistant_openers: Record<Lang, string[]>;
  assistant_recaps: Record<Lang, string[]>;
  assistant_offers: Record<Lang, string[]>;
  chat_markers: string[];
}

export interface Weights {
  /** Per content kind: bias and per-detector coefficients of the logistic model. */
  [kind: string]: { bias: number; weights: Record<string, number> };
}

export interface RuleSet {
  detectors: DetectorSpec[];
  advice: AdviceRule[];
  combos: ComboRule[];
  markers: Record<Lang, Marker[]>;
  lexicon: Lexicon;
  weights: Weights;
}

export interface RuleSources {
  detectors: string;
  advice: string;
  markers: string;
  lexicon: string;
  weights: string;
}

const LANGS: Lang[] = ['ru', 'en'];
const KINDS: ContentKind[] = ['text', 'document', 'image', 'code'];
const TARGETS = ['sentences', 'paragraphs', 'phrases', 'none'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function checkAdviceText(v: unknown, where: string, errors: string[]): void {
  if (!isObj(v)) {
    errors.push(`${where}: missing text block`);
    return;
  }
  if (!isStr(v.title)) errors.push(`${where}.title: required string`);
  if (!isStr(v.explain)) errors.push(`${where}.explain: required string`);
  if (!isStrArr(v.actions) || v.actions.length === 0) errors.push(`${where}.actions: non-empty list required`);
}

function checkRegex(p: unknown, where: string, errors: string[]): void {
  if (!isStr(p)) {
    errors.push(`${where}: pattern must be a string`);
    return;
  }
  try {
    new RegExp(p, 'iu');
  } catch (e) {
    errors.push(`${where}: invalid regex (${(e as Error).message})`);
  }
}

/** Validates raw parsed YAML against the rule schema. Returns a list of human-readable errors. */
export function validateRules(raw: Record<keyof RuleSources, unknown>): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(raw.detectors)) errors.push('detectors: must be a list');
  else
    raw.detectors.forEach((d: unknown, i) => {
      const w = `detectors[${i}]`;
      if (!isObj(d)) return void errors.push(`${w}: must be a mapping`);
      if (!isStr(d.id) || !/^[A-Z]-\d{2}$/.test(d.id)) errors.push(`${w}.id: expected like "R-01"`);
      else if (ids.has(d.id)) errors.push(`${w}.id: duplicate ${d.id}`);
      else ids.add(d.id);
      if (!CATEGORIES.includes(d.category as Category)) errors.push(`${w}.category: unknown ${String(d.category)}`);
      if (!KINDS.includes(d.kind as ContentKind)) errors.push(`${w}.kind: unknown ${String(d.kind)}`);
      if (!isNum(d.weight) || d.weight < 0) errors.push(`${w}.weight: non-negative number required`);
      if (!isStr(d.metric)) errors.push(`${w}.metric: required`);
      if (d.direction !== 'up' && d.direction !== 'down') errors.push(`${w}.direction: up|down`);
      for (const lang of LANGS) {
        const t = isObj(d.thresholds) ? d.thresholds[lang] : undefined;
        if (!isObj(t) || !isNum(t.lo) || !isNum(t.hi) || t.hi <= t.lo)
          errors.push(`${w}.thresholds.${lang}: need lo < hi`);
        const c = isObj(d.corridor) ? d.corridor[lang] : undefined;
        if (!Array.isArray(c) || c.length !== 2 || !isNum(c[0]) || !isNum(c[1]) || c[0] > c[1])
          errors.push(`${w}.corridor.${lang}: need [lo, hi]`);
        if (!isObj(d.name) || !isStr(d.name[lang])) errors.push(`${w}.name.${lang}: required`);
      }
    });

  const adv = isObj(raw.advice) ? raw.advice : {};
  if (!Array.isArray(adv.rules)) errors.push('advice.rules: must be a list');
  else {
    const ruleIds = new Set<string>();
    const covered = new Set<string>();
    adv.rules.forEach((r: unknown, i) => {
      const w = `advice.rules[${i}]`;
      if (!isObj(r)) return void errors.push(`${w}: must be a mapping`);
      if (!isStr(r.id)) errors.push(`${w}.id: required`);
      else if (ruleIds.has(r.id)) errors.push(`${w}.id: duplicate ${r.id}`);
      else ruleIds.add(r.id);
      if (!isStr(r.detector) || !ids.has(r.detector)) errors.push(`${w}.detector: unknown ${String(r.detector)}`);
      else covered.add(r.detector);
      if (isStr(r.id) && isStr(r.detector) && !r.id.startsWith(`${r.detector}.`))
        errors.push(`${w}.id: must start with "${r.detector}."`);
      if (!TARGETS.includes(r.target as string)) errors.push(`${w}.target: one of ${TARGETS.join('|')}`);
      if (!isNum(r.effort) || r.effort < 1 || r.effort > 3) errors.push(`${w}.effort: 1..3`);
      if (!isNum(r.expected_gain) || r.expected_gain < 0) errors.push(`${w}.expected_gain: number >= 0`);
      for (const lang of LANGS) checkAdviceText(r[lang], `${w}.${lang}`, errors);
    });
    for (const id of ids) if (!id.startsWith('D-05') && !covered.has(id)) errors.push(`advice: no rule for ${id}`);
  }
  if (!Array.isArray(adv.combos)) errors.push('advice.combos: must be a list');
  else
    adv.combos.forEach((c: unknown, i) => {
      const w = `advice.combos[${i}]`;
      if (!isObj(c)) return void errors.push(`${w}: must be a mapping`);
      if (!isStr(c.id)) errors.push(`${w}.id: required`);
      if (!isStrArr(c.detectors) || c.detectors.some((d) => !ids.has(d)))
        errors.push(`${w}.detectors: known detector ids required`);
      if (!isNum(c.min) || c.min < 2) errors.push(`${w}.min: >= 2`);
      if (!isNum(c.effort)) errors.push(`${w}.effort: required`);
      for (const lang of LANGS) checkAdviceText(c[lang], `${w}.${lang}`, errors);
    });

  if (!isObj(raw.markers)) errors.push('markers: must be a mapping');
  else
    for (const lang of LANGS) {
      const list = raw.markers[lang];
      if (!Array.isArray(list) || list.length === 0) {
        errors.push(`markers.${lang}: non-empty list required`);
        continue;
      }
      list.forEach((m: unknown, i) => {
        const w = `markers.${lang}[${i}]`;
        if (!isObj(m)) return void errors.push(`${w}: must be a mapping`);
        checkRegex(m.pattern, `${w}.pattern`, errors);
        if (!isNum(m.weight) || m.weight <= 0) errors.push(`${w}.weight: positive number required`);
        if (!isStrArr(m.replace)) errors.push(`${w}.replace: list of strings required`);
      });
    }

  if (!isObj(raw.lexicon)) errors.push('lexicon: must be a mapping');
  else {
    for (const key of ['hedges', 'nominal_suffixes', 'noise', 'conclusion', 'summary_openers', 'template_headings', 'assistant_openers', 'assistant_recaps', 'assistant_offers']) {
      const v = raw.lexicon[key];
      for (const lang of LANGS)
        if (!isObj(v) || !isStrArr(v[lang])) errors.push(`lexicon.${key}.${lang}: list of strings required`);
    }
    const cm = raw.lexicon.chat_markers;
    if (!isStrArr(cm)) errors.push('lexicon.chat_markers: list required');
    else cm.forEach((p, i) => checkRegex(p, `lexicon.chat_markers[${i}]`, errors));
  }

  if (!isObj(raw.weights)) errors.push('weights: must be a mapping');
  else
    for (const [kind, w] of Object.entries(raw.weights)) {
      if (!KINDS.includes(kind as ContentKind)) errors.push(`weights.${kind}: unknown content kind`);
      if (!isObj(w) || !isNum(w.bias) || !isObj(w.weights)) {
        errors.push(`weights.${kind}: need bias and weights`);
        continue;
      }
      for (const [id, v] of Object.entries(w.weights)) {
        if (!ids.has(id)) errors.push(`weights.${kind}.${id}: unknown detector`);
        if (!isNum(v)) errors.push(`weights.${kind}.${id}: number required`);
      }
    }
  return errors;
}

export class RuleValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid rules:\n${errors.join('\n')}`);
  }
}

export function parseRules(src: RuleSources): RuleSet {
  const raw = {
    detectors: yaml.load(src.detectors),
    advice: yaml.load(src.advice),
    markers: yaml.load(src.markers),
    lexicon: yaml.load(src.lexicon),
    weights: yaml.load(src.weights) ?? {},
  };
  const errors = validateRules(raw);
  if (errors.length) throw new RuleValidationError(errors);
  const advice = raw.advice as { rules: AdviceRule[]; combos: ComboRule[] };
  return {
    detectors: raw.detectors as DetectorSpec[],
    advice: advice.rules,
    combos: advice.combos,
    markers: raw.markers as Record<Lang, Marker[]>,
    lexicon: raw.lexicon as Lexicon,
    weights: raw.weights as Weights,
  };
}

export const defaultSources: RuleSources = {
  detectors: detectorsSrc,
  advice: adviceSrc,
  markers: markersSrc,
  lexicon: lexiconSrc,
  weights: weightsSrc,
};

let current: RuleSet = parseRules(defaultSources);

export function getRules(): RuleSet {
  return current;
}

/** Hot-swap the active rules (used by calibration and tests). */
export function setRules(rules: RuleSet): void {
  current = rules;
}

export function spec(id: string): DetectorSpec {
  const s = current.detectors.find((d) => d.id === id);
  if (!s) throw new Error(`Unknown detector ${id}`);
  return s;
}

/** Normalises a raw metric into [0,1] using the language-specific thresholds. */
export function normalize(id: string, value: number, lang: Lang): number {
  const s = spec(id);
  const { lo, hi } = s.thresholds[lang];
  const t = (value - lo) / (hi - lo);
  const v = s.direction === 'up' ? t : 1 - t;
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
