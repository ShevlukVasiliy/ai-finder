import { buildContext } from '../../src/core/text/segment';
import type { Lang } from '../../src/core/types';
import { CORPUS } from '../quality/corpus';

export const ctx = (text: string, lang?: Lang, md = false) => buildContext(text, lang, md);

export const sample = (lang: Lang, ai: boolean, i = 0) => CORPUS.filter((s) => s.lang === lang && s.ai === ai)[i]!.text;

/** Borderline: formal human writing (news/protocol style) from the corpus. */
export const borderline = (lang: Lang) =>
  lang === 'ru' ? CORPUS.filter((s) => s.lang === 'ru' && !s.ai).at(-4)!.text : CORPUS.filter((s) => s.lang === 'en' && !s.ai).at(-2)!.text;

export const LANGS: Lang[] = ['ru', 'en'];
