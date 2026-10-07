import enAi from './corpus/en-ai.txt?raw';
import enHuman from './corpus/en-human.txt?raw';
import ruAi from './corpus/ru-ai.txt?raw';
import ruHuman from './corpus/ru-human.txt?raw';
import type { Lang } from '../../src/core/types';

export interface Sample {
  lang: Lang;
  ai: boolean;
  text: string;
}

const split = (src: string) =>
  src
    .split(/^===\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);

export const CORPUS: Sample[] = [
  ...split(ruHuman).map((text) => ({ lang: 'ru' as const, ai: false, text })),
  ...split(ruAi).map((text) => ({ lang: 'ru' as const, ai: true, text })),
  ...split(enHuman).map((text) => ({ lang: 'en' as const, ai: false, text })),
  ...split(enAi).map((text) => ({ lang: 'en' as const, ai: true, text })),
];
