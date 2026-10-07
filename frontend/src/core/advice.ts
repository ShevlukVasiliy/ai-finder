import { findMarkers } from './detectors/lexical';
import { getRules, spec } from './rules';
import { combine } from './scoring';
import type { AdviceItem, ContentKind, DetectorResult, Lang, Params, Span } from './types';

/** Fills "{name}" / "{name:.2f}" / "{name:.0%}" placeholders. Unknown names become empty strings. */
export function fill(template: string, params: Params): string {
  return template
    .replace(/\{(\w+)(?::\.(\d)(f|%))?\}/g, (_, name: string, digits?: string, kind?: string) => {
      const v = params[name];
      if (v === undefined || v === '') return '';
      if (typeof v === 'number' && digits !== undefined)
        return kind === '%' ? `${(v * 100).toFixed(Number(digits))}%` : v.toFixed(Number(digits));
      if (typeof v === 'number' && !Number.isInteger(v)) return v.toFixed(2);
      return String(v);
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/«»|“”/g, '…')
    .trim();
}

export function severity(score: number): AdviceItem['severity'] {
  return score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low';
}

/** Counterfactual gain: how many score points disappear if these detectors drop to the human norm. */
export function counterfactualGain(results: DetectorResult[], kind: ContentKind, ids: string[]): number {
  const before = combine(results, kind);
  const after = combine(
    results.map((r) => (ids.includes(r.id) ? { ...r, score: 0 } : r)),
    kind,
  );
  return Math.max(0, Math.round((before - after) * 10) / 10);
}

export function buildAdvice(results: DetectorResult[], kind: ContentKind, lang: Lang, text = ''): AdviceItem[] {
  const rules = getRules();
  const items: AdviceItem[] = [];
  const fired = results.filter((r) => r.findings.length > 0);

  for (const r of fired) {
    for (const f of r.findings) {
      const rule = rules.advice.find((a) => a.id === f.rule);
      if (!rule) continue;
      const tx = rule[lang];
      const s = spec(r.id);
      const params: Params = {
        ...f.params,
        corridor_lo: f.params.corridor_lo ?? s.corridor[lang][0],
        corridor_hi: f.params.corridor_hi ?? s.corridor[lang][1],
      };
      const gain = counterfactualGain(results, kind, [r.id]);
      const replacements =
        r.id === 'L-01' && text
          ? dedupe(findMarkers(text, lang).map((h) => ({ phrase: h.label ?? '', options: h.replace })))
          : [];
      items.push({
        id: rule.id,
        detectors: [r.id],
        category: r.category,
        severity: severity(f.score),
        title: fill(tx.title, params),
        explain: fill(tx.explain, params),
        actions: tx.actions.map((a) => fill(a, params)),
        effort: rule.effort,
        expectedGain: gain || (rule.expected_gain * f.score) / 4,
        priority: 0,
        spans: rule.target === 'none' ? [] : f.spans,
        replacements,
        autofix: Boolean(rule.autofix),
      });
    }
  }

  // Combine related findings into one piece of advice.
  for (const combo of rules.combos) {
    const members = items.filter((i) => i.detectors.some((d) => combo.detectors.includes(d)));
    if (members.length < combo.min) continue;
    const ids = members.flatMap((m) => m.detectors);
    const tx = combo[lang];
    const params = { members: members.map((m) => m.title).join('; ') };
    const spans: Span[] = members.flatMap((m) => m.spans);
    const merged: AdviceItem = {
      id: combo.id,
      detectors: ids,
      category: members[0]!.category,
      severity: members.some((m) => m.severity === 'high') ? 'high' : 'medium',
      title: fill(tx.title, params),
      explain: fill(tx.explain, params),
      actions: [...tx.actions.map((a) => fill(a, params)), ...members.flatMap((m) => m.actions.slice(0, 1))],
      effort: combo.effort,
      expectedGain: counterfactualGain(results, kind, ids),
      priority: 0,
      spans,
      replacements: [],
      autofix: false,
    };
    for (const m of members) items.splice(items.indexOf(m), 1);
    items.push(merged);
  }

  for (const i of items) i.priority = Math.round((i.expectedGain / i.effort) * 100) / 100;
  return items.sort((a, b) => b.priority - a.priority || b.expectedGain - a.expectedGain);
}

function dedupe(xs: { phrase: string; options: string[] }[]) {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.phrase.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function topAdvice(advice: AdviceItem[], n = 3): AdviceItem[] {
  return advice.slice(0, n);
}
