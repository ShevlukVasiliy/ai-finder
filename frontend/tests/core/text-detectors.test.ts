import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { getRegistry } from '../../src/core/registry';
import { loadModels } from '../../src/core/ngram';
import { borderline, ctx, LANGS, sample } from './helpers';

const det = (id: string) => getRegistry().text.find((d) => d.id === id)!;
const run = (id: string, text: string, lang?: 'ru' | 'en', md = false) => det(id).analyze(ctx(text, lang, md));

beforeAll(() => loadModels());

const AI_SIGNAL = ['R-01', 'R-02', 'L-01', 'L-05', 'S-02', 'P-01'];

describe.each(LANGS)('text detectors (%s)', (lang) => {
  it.each(AI_SIGNAL)('%s scores AI text above human text', (id) => {
    const h = [0, 1, 2].map((i) => run(id, sample(lang, false, i), lang).score);
    const a = [0, 1, 2].map((i) => run(id, sample(lang, true, i), lang).score);
    const avg = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    expect(avg(a)).toBeGreaterThan(avg(h));
  });

  it('borderline formal human text stays below AI level on lexicon', () => {
    expect(run('L-01', borderline(lang), lang).score).toBeLessThan(0.5);
  });

  it('AI text yields findings with advice rule ids', () => {
    const r = run('L-01', sample(lang, true, 0), lang);
    expect(r.findings[0]?.rule).toBe('L-01.markers');
    expect(r.findings[0]!.spans.length).toBeGreaterThan(0);
  });
});

describe('all text detectors', () => {
  const all = getRegistry().text;
  it.each(all.map((d) => d.id))('%s handles empty and short input', (id) => {
    for (const t of ['', 'Да.', 'Hi']) {
      const r = det(id).analyze(ctx(t));
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('never crash and keep score in [0,1] on arbitrary unicode', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 400 }), (s) => {
        const c = ctx(s);
        for (const d of all) {
          const r = d.analyze(c);
          if (!(r.score >= 0 && r.score <= 1)) return false;
        }
        return true;
      }),
      { numRuns: 60 },
    );
  });

  it('property: sentence-ish random text keeps scores bounded', () => {
    const word = fc.stringMatching(/^[a-zа-я]{1,10}$/);
    const sentence = fc.array(word, { minLength: 1, maxLength: 30 }).map((w) => `${w.join(' ')}.`);
    fc.assert(
      fc.property(fc.array(sentence, { minLength: 1, maxLength: 30 }), (ss) => {
        const c = ctx(ss.join(' '));
        return all.every((d) => {
          const r = d.analyze(c);
          return r.score >= 0 && r.score <= 1;
        });
      }),
      { numRuns: 40 },
    );
  });
});

describe('typography', () => {
  it('T-01 finds mixed-alphabet words', () => {
    const r = run('T-01', 'Это тeкст с подмeной букв и ещё одним словом xoрошо.');
    expect(r.value).toBe(3);
    expect(r.findings[0]!.params.phrase).toBe('тeкст');
    expect(run('T-01', 'Обычный текст без подмен.').value).toBe(0);
    expect(run('T-01', 'Greek οmicron in wοrd').value).toBe(2);
  });

  it('T-02 finds invisible chars but ignores leading BOM and typical NBSP', () => {
    const r = run('T-02', '﻿При​вет мир­ок, в доме 5 кг, длинное слово');
    expect(r.value).toBe(3);
    expect(r.findings[0]!.params.kinds).toContain('ZWSP');
  });

  it('T-03 flags em-dash heavy English', () => {
    const t = Array.from({ length: 12 }, (_, i) => `Item ${i} — this is a clause — and another one…`).join(' ');
    const r = run('T-03', t, 'en');
    expect(r.score).toBe(1);
    expect(r.findings[0]!.params.extra).toContain('Ellipsis');
    expect(run('T-03', 'short').applicable).toBe(false);
  });

  it('T-04 detects mixed quotes and dashes', () => {
    const r = run('T-04', 'Он сказал "да" и «нет» - а потом — ушёл.');
    expect(r.value).toBe(2);
  });

  it('T-05 counts markdown, skipped for markdown docs', () => {
    const t = '## Title\n\n**bold** text\n\n- item\n- item\n\n`code`';
    expect(run('T-05', t).value).toBeGreaterThanOrEqual(4);
    expect(run('T-05', t, 'en', true).applicable).toBe(false);
  });

  it('T-06 measures ё consistency (RU only)', () => {
    const yo = 'Её дом. Ещё раз. Всё хорошо. Он идёт. Чёрный кот.';
    expect(run('T-06', yo, 'ru').value).toBe(1);
    expect(run('T-06', 'Ее дом. Еще раз. Все хорошо. Он идет. Черный кот.', 'ru').value).toBe(0);
    expect(run('T-06', yo, 'en').applicable).toBe(false);
    expect(run('T-06', 'Её дом.', 'ru').applicable).toBe(false);
  });
});

describe('rhythm & structure specifics', () => {
  const uniform = Array.from({ length: 12 }, (_, i) => `This sentence number ${i} has exactly nine words here.`).join(' ');
  it('R-01/R-02 flag uniform sentences', () => {
    expect(run('R-01', uniform, 'en').score).toBe(1);
    expect(run('R-02', uniform, 'en').score).toBe(1);
  });

  it('R-04 autocorrelation detects period-3 rhythm', () => {
    const pat = [5, 5, 20];
    const t = Array.from({ length: 15 }, (_, i) => `${'word '.repeat(pat[i % 3]!).trim()}.`).join(' ');
    const r = run('R-04', t, 'en');
    expect(r.value).toBeGreaterThan(0.5);
    expect(r.findings[0]!.params.lag).toBe(3);
  });

  it('R-05 detects repeated openings', () => {
    const t = Array.from({ length: 8 }, (_, i) => `The thing ${i} works well enough today.`).join(' ');
    expect(run('R-05', t, 'en').score).toBe(1);
  });

  it('R-03 needs at least three paragraphs', () => {
    expect(run('R-03', 'One. Two.\n\nThree.').applicable).toBe(false);
  });

  it('S-01 recognises intro → points → conclusion', () => {
    const t = `Intro sentence about the topic here today. Another intro line with words.\n\n## Point one\n\nText one is here and now with more words added for length.\n\n## Point two\n\nText two is here and now with more words added for length.\n\n## Point three\n\nText three is here and now with more words added for length.\n\n## Conclusion\n\nIn conclusion, everything is great and we covered it all here.`;
    const r = run('S-01', t, 'en');
    expect(r.score).toBeGreaterThan(0.6);
    expect(run('S-03', t, 'en').value).toBeGreaterThanOrEqual(1);
  });

  it('S-03 flags Title Case headings with colon', () => {
    expect(run('S-03', '## Unlocking Potential: A Complete Guide\n\nText here.', 'en').value).toBe(1);
  });

  it('S-04 flags uniform "**Term:** text" items', () => {
    const t = '- **Speed:** fast\n- **Cost:** low\n- **Ease:** high';
    expect(run('S-04', t, 'en').value).toBe(1);
    expect(run('S-04', '- a\n- b', 'en').applicable).toBe(false);
  });

  it('S-05 flags summarising paragraph endings', () => {
    const p = 'Cats are great pets for busy people. They sleep a lot. They need little care. Overall, cats are great pets for busy people.';
    expect(run('S-05', `${p}\n\n${p}`, 'en').value).toBe(1);
  });

  it('S-06 counts "not just X, it is Y" constructions', () => {
    const t = `${"It's not just a tool, it's a revolution in how we work every day. ".repeat(3)}${'Filler words make this text long enough to count properly. '.repeat(5)}`;
    expect(run('S-06', t, 'en').value).toBeGreaterThan(0);
    expect(run('S-06', `Это не просто инструмент, а настоящая революция. ${'Слова для длины текста здесь. '.repeat(10)}`, 'ru').value).toBeGreaterThan(0);
  });

  it('L-06 finds repeated trigrams', () => {
    const t = `${'the quick brown fox jumps over lazy dogs. '.repeat(3)}${'Different words appear here to pad it out more. '.repeat(8)}`;
    expect(run('L-06', t, 'en').findings[0]!.params.count).toBeGreaterThan(0);
  });

  it('P-01 is not applicable without a model', async () => {
    const { setModel, getModel } = await import('../../src/core/ngram');
    const m = getModel('en');
    setModel('en', undefined);
    expect(run('P-01', sample('en', true, 0), 'en').applicable).toBe(false);
    setModel('en', m);
  });
});
