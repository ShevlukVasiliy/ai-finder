import type { Lang } from './types';

/**
 * Compact character trigram language model (pure counting, no neural nets).
 * Stored as { order, total, alphabet, grams: {"abc": n}, ctx: {"ab": n} } with rare grams pruned.
 */
export interface NgramModel {
  order: number;
  alphabet: number;
  grams: Record<string, number>;
  ctx: Record<string, number>;
}

const models: Partial<Record<Lang, NgramModel>> = {};

export function normalizeForModel(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s.,!?-]/gu, '')
    .replace(/\d/g, '0')
    .replace(/\s+/g, ' ');
}

export function trainModel(texts: string[], order = 3, minCount = 2): NgramModel {
  const grams: Record<string, number> = {};
  const chars = new Set<string>();
  for (const t of texts) {
    const s = ` ${normalizeForModel(t)} `;
    for (const ch of s) chars.add(ch);
    for (let i = 0; i + order <= s.length; i++) {
      const g = s.slice(i, i + order);
      grams[g] = (grams[g] ?? 0) + 1;
    }
  }
  const pruned: Record<string, number> = {};
  const ctx: Record<string, number> = {};
  for (const [g, n] of Object.entries(grams)) {
    if (n < minCount) continue;
    pruned[g] = n;
    const c = g.slice(0, -1);
    ctx[c] = (ctx[c] ?? 0) + n;
  }
  return { order, alphabet: chars.size, grams: pruned, ctx };
}

/** Mean negative log2-probability per character (cross-entropy, bits/char). */
export function crossEntropy(model: NgramModel, text: string): number {
  const s = ` ${normalizeForModel(text)} `;
  const k = 0.1;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + model.order <= s.length; i++) {
    const g = s.slice(i, i + model.order);
    const c = model.ctx[g.slice(0, -1)] ?? 0;
    const p = ((model.grams[g] ?? 0) + k) / (c + k * model.alphabet);
    sum += -Math.log2(p);
    n++;
  }
  return n ? sum / n : 0;
}

export function setModel(lang: Lang, m: NgramModel | undefined): void {
  if (m) models[lang] = m;
  else delete models[lang];
}

export function getModel(lang: Lang): NgramModel | undefined {
  return models[lang];
}

/** Lazily loads the bundled models (code-split chunks). Safe to call repeatedly. */
export async function loadModels(): Promise<void> {
  if (models.ru && models.en) return;
  try {
    const [ru, en] = await Promise.all([
      import('../../../rules/models/ngram-ru.json'),
      import('../../../rules/models/ngram-en.json'),
    ]);
    models.ru ??= ru.default as unknown as NgramModel;
    models.en ??= en.default as unknown as NgramModel;
  } catch {
    // Models are optional; P-01 becomes "not applicable".
  }
}
