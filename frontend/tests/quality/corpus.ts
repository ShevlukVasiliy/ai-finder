import enAi from './corpus/en-ai.txt?raw';
import enHuman from './corpus/en-human.txt?raw';
import ruAi from './corpus/ru-ai.txt?raw';
import ruHuman from './corpus/ru-human.txt?raw';
import extEn from './external/en.jsonl?raw';
import extRu from './external/ru.jsonl?raw';
import type { Lang } from '../../src/core/types';

export interface Sample {
  lang: Lang;
  ai: boolean;
  text: string;
  origin: 'own' | 'external';
}

const split = (src: string) =>
  src
    .split(/^===\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);

/** Hand-written mini-corpus (see docs/DECISIONS.md). */
export const CORPUS: Sample[] = [
  ...split(ruHuman).map((text) => ({ lang: 'ru' as const, ai: false, text, origin: 'own' as const })),
  ...split(ruAi).map((text) => ({ lang: 'ru' as const, ai: true, text, origin: 'own' as const })),
  ...split(enHuman).map((text) => ({ lang: 'en' as const, ai: false, text, origin: 'own' as const })),
  ...split(enAi).map((text) => ({ lang: 'en' as const, ai: true, text, origin: 'own' as const })),
];

const jsonl = (src: string, lang: Lang): Sample[] =>
  src
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { ai: boolean; text: string })
    .map((r) => ({ lang, ai: r.ai, text: r.text, origin: 'external' as const }));

/**
 * Sample of COLING-2025 MGT (multilingual) — RuATD/M4 human texts vs gpt-3.5/4, Llama-3, Mixtral, Gemma, Cohere.
 * Even rows calibrate the weights, odd rows are a held-out check.
 */
const EXTERNAL = [...jsonl(extRu, 'ru'), ...jsonl(extEn, 'en')];
export const EXTERNAL_TRAIN = EXTERNAL.filter((_, i) => i % 2 === 0);
export const EXTERNAL_TEST = EXTERNAL.filter((_, i) => i % 2 === 1);

/** Own corpus counts twice: it is the only source of modern chat-assistant answers. */
export const TRAINING = [...CORPUS, ...CORPUS, ...EXTERNAL_TRAIN];
