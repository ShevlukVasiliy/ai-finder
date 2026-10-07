import { describe, expect, it } from 'vitest';
import { buildContext, cv, detectLang, mean, per1000, splitSentences, std, words } from '../../src/core/text/segment';

describe('segment', () => {
  it('detects language', () => {
    expect(detectLang('Привет, как дела?').lang).toBe('ru');
    expect(detectLang('Hello there, friend').lang).toBe('en');
    expect(detectLang('').lang).toBe('en');
    expect(detectLang('Привет hello мир').mixedShare).toBeGreaterThan(0.2);
  });

  it('splits sentences with abbreviations and decimals', () => {
    const t = 'Это было в 2020 г. в Москве. Цена 3.5 руб. Ок! Правда? Да…';
    const s = splitSentences(t).map((r) => t.slice(r.start, r.end));
    expect(s).toEqual(['Это было в 2020 г. в Москве.', 'Цена 3.5 руб.', 'Ок!', 'Правда?', 'Да…']);
  });

  it('builds paragraphs, headings and lists', () => {
    const c = buildContext('# Title\n\nFirst para. Second sentence.\n\n- item one\n- item two\n\nLast one.');
    expect(c.paragraphs.map((p) => p.kind)).toEqual(['heading', 'text', 'list', 'list', 'text']);
    expect(c.sentences.length).toBeGreaterThanOrEqual(5);
    expect(c.words.length).toBeGreaterThan(5);
  });

  it('uses single newlines as paragraph breaks when there are no blank lines', () => {
    expect(buildContext('One line.\nTwo line.\nThree.').paragraphs).toHaveLength(3);
  });

  it('math helpers', () => {
    expect(mean([])).toBe(0);
    expect(std([1])).toBe(0);
    expect(cv([0, 0])).toBe(0);
    expect(cv([1, 3])).toBeCloseTo(0.5);
    expect(per1000(5, 0)).toBe(0);
    expect(per1000(5, 500)).toBe(10);
    expect(words("Don't stop-me now")).toEqual(["don't", 'stop-me', 'now']);
  });
});
