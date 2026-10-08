import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import enAi from './corpus/en-ai.txt?raw';
import enHuman from './corpus/en-human.txt?raw';
import ruAi from './corpus/ru-ai.txt?raw';
import ruHuman from './corpus/ru-human.txt?raw';
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

const EXT_DIR = join(__dirname, 'external');

/** gzipped JSONL built by scripts/build_dataset.py: {lang, ai, model, source, text}. */
export interface ExternalSample extends Sample {
  model: string;
  source: string;
}

function loadExternal(name: string): ExternalSample[] {
  const file = join(EXT_DIR, `${name}.jsonl.gz`);
  if (!existsSync(file)) return [];
  return gunzipSync(readFileSync(file))
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => ({ ...(JSON.parse(l) as Omit<ExternalSample, 'origin'>), origin: 'external' as const }));
}

/**
 * ~22k public texts (DetectRL-X 2026: GPT-4o, Gemini-2.5, DeepSeek-V3, Qwen-Max; AINL-Eval-2025; artnitolog;
 * rasbt human-vs-ai-50k; COLING-2025 MGT). The test split is committed; the train split is regenerated locally.
 */
export const EXTERNAL_TEST = loadExternal('test');
export const EXTERNAL_TRAIN = loadExternal('train');
