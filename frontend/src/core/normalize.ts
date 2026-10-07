import { CYR_TO_LAT, GREEK_TO_LAT, INVISIBLE, LAT_TO_CYR, invisibleSpans } from './detectors/typography';

const CYR = /\p{Script=Cyrillic}/u;
const LAT = /\p{Script=Latin}/u;

export interface NormalizeResult {
  text: string;
  replaced: number;
  removed: number;
}

/**
 * T-01/T-02 cleanup: converts homoglyphs to the dominant script of each word and drops invisible characters.
 * This is normalisation only — content words are never rewritten.
 */
export function normalizeText(input: string): NormalizeResult {
  let removed = 0;
  // Positions of suspicious NBSPs (computed before any mutation).
  const badNbsp = new Set(invisibleSpans(input).filter((s) => s.label === 'NBSP').map((s) => s.start));
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (INVISIBLE[ch] && !(ch === '﻿' && i === 0)) {
      removed++;
      continue;
    }
    if (badNbsp.has(i)) {
      out += ' ';
      removed++;
      continue;
    }
    out += ch;
  }
  if (out.charCodeAt(0) === 0xfeff) {
    out = out.slice(1);
    removed++;
  }
  let replaced = 0;
  const text = out.replace(/\p{L}+/gu, (word) => {
    let c = 0;
    let l = 0;
    for (const ch of word) {
      if (CYR.test(ch)) c++;
      else if (LAT.test(ch)) l++;
    }
    const greek = [...word].some((ch) => GREEK_TO_LAT[ch]);
    if (!(c && l) && !greek) return word;
    const toCyr = c >= l;
    let res = '';
    for (const ch of word) {
      let r = ch;
      if (GREEK_TO_LAT[ch]) r = toCyr ? (LAT_TO_CYR[GREEK_TO_LAT[ch]] ?? GREEK_TO_LAT[ch]) : GREEK_TO_LAT[ch];
      else if (toCyr && LAT_TO_CYR[ch]) r = LAT_TO_CYR[ch];
      else if (!toCyr && CYR_TO_LAT[ch]) r = CYR_TO_LAT[ch];
      if (r !== ch) replaced++;
      res += r;
    }
    return res;
  });
  return { text, replaced, removed };
}
