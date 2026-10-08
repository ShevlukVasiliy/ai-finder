import { describe, expect, it } from 'vitest';
import { parseBibliography, parseCitations, splitSections } from '../../src/core/detectors/academic';
import { getRegistry } from '../../src/core/registry';
import { ctx, sample } from './helpers';

const det = (id: string) => getRegistry().text.find((d) => d.id === id)!;
const run = (id: string, text: string, lang: 'ru' | 'en' = 'ru') => det(id).analyze(ctx(text, lang));

const para = (n: number, cite: string) =>
  `Как показал Шварц в своей фундаментальной работе, избыток альтернатив порождает паралич анализа и откладывает начало работы на неопределённый срок ${cite}. Принципиально иную динамику демонстрирует дефицит, который сужает внимание и детально раскрывает механизм концентрации на главном (абзац ${n}).`;

const GENERATED = `# Статья

**Автор:** Студенческое научное исследование

## 1. Введение

**Парадокс изобилия** описан многими. ${para(1, '[1, с. 2–5]')}

${para(2, '[2, с. 75–78]')}

## 2. Теория

**Подручность** — ключевое понятие. ${para(3, '[3, с. 40–42]')}

$$\\text{Человек} \\rightarrow \\text{Мир}$$

${para(4, '[4, с. 12–14]')}

## 3. Анализ

**Дурная вера** по Сартру. ${para(5, '[3, с. 26–28]')}

${para(6, '[5, с. 19–35]')}

## 4. Заключение

**Принцип достаточности.** ${para(7, '[2, с. 129–136]')}

${para(8, '[1, с. 33–34]')}

## Библиографический список

1. Шварц Б. Парадокс выбора. М., 2004. 280 с.
2. Саймон Г. Рациональный выбор // Журнал. 1956. С. 129–138.
3. Сартр Ж.-П. Экзистенциализм — это гуманизм. М., 1953. 41 с.
4. Хайдеггер М. Бытие и время. М., 1997. 452 с.
5. Морозов Е. Блеф солюционизма // Логос. 2015. С. 19–38.
`;

const HUMAN = `Статья посвящена ранним текстам Хайдеггера. В лекциях 1919 года техника почти не упоминается [1]. Позже, в работах 1930-х, отношение меняется, и об этом писали многие исследователи, хотя их выводы расходятся [2, с. 114].

Нам не удалось найти прямых свидетельств того, что Хайдеггер читал Юнгера до 1932 года; переписка за эти годы утрачена. Поэтому реконструкция остаётся гипотетической.

${'Обычный абзац с рассуждением о технике и культуре, без ссылок и без выделений, просто текст исследователя. '.repeat(6)}

Список литературы
1. Хайдеггер М. Собрание сочинений. Т. 56/57. Франкфурт, 1987. 220 с.
2. Михайловский А. В. Статья // Вопросы философии. 2010. № 3. С. 110–120.
`;

describe('citation parsing', () => {
  it('parses single, ranged and multiple references', () => {
    const c = parseCitations('a [4, с. 41–42] b [8, с. 35–48; 15, p. 19–27] c [7] d [3, p. 5]');
    expect(c.map((x) => [x.source, x.pages])).toEqual([[4, [41, 42]], [8, [35, 48]], [15, [19, 27]], [7, []], [3, [5]]]);
    expect(c[0]!.range).toBe(true);
  });

  it('reads total page counts but not page ranges from the bibliography', () => {
    const b = parseBibliography(GENERATED);
    expect(b.find((x) => x.n === 3)?.totalPages).toBe(41);
    expect(b.find((x) => x.n === 2)?.totalPages).toBeUndefined();
    expect(parseBibliography('no bibliography here')).toEqual([]);
  });

  it('splits markdown sections', () => {
    expect(splitSections(GENERATED).length).toBeGreaterThanOrEqual(5);
    expect(splitSections('plain text')).toEqual([]);
  });
});

describe('B-01 citations', () => {
  it('flags a page beyond the book length, dense and ranged citations', () => {
    const r = run('B-01', GENERATED);
    expect(r.score).toBeGreaterThanOrEqual(0.8);
    expect(String(r.findings[0]!.params.extra)).toContain('41 с.');
  });
  it('stays quiet on a human paper and without citations', () => {
    expect(run('B-01', HUMAN).applicable).toBe(false);
    expect(run('B-01', sample('ru', false, 0)).applicable).toBe(false);
  });
  it('flags references to sources missing from the bibliography', () => {
    const t = `${'Текст [1, с. 3]. '.repeat(5)}Ещё [9, с. 4].\n\nСписок литературы\n1. Автор А. Книга. М., 2000. 100 с.`;
    expect(String(run('B-01', t).findings[0]?.params.extra ?? '')).toContain('9');
  });
});

describe('S-08 template sections', () => {
  it('flags placeholder author, LaTeX and identical section skeletons', () => {
    const r = run('S-08', GENERATED);
    expect(r.value).toBeGreaterThanOrEqual(2.5);
    expect(String(r.findings[0]!.params.extra)).toMatch(/автора/);
  });
  it('is not applicable to unstructured human prose', () => {
    expect(run('S-08', HUMAN).applicable).toBe(false);
  });
});

describe('L-07 attribution links', () => {
  it('counts "author + showed" links and academic clichés', () => {
    const r = run('L-07', GENERATED);
    expect(r.score).toBe(1);
    expect(r.findings[0]!.spans.length).toBeGreaterThan(5);
  });
  it('quiet on a human paper; needs enough text', () => {
    expect(run('L-07', HUMAN).score).toBeLessThan(0.3);
    expect(run('L-07', 'коротко').applicable).toBe(false);
  });
  it('works in English', () => {
    const en = `${'Schwartz (2004) showed that choice overload paralyses action [1, p. 2]. Simon argued that satisficing is rational [2, p. 129]. This seminal work sheds light on the problem. '.repeat(12)}`;
    expect(run('L-07', en, 'en').score).toBeGreaterThan(0.5);
  });
});
