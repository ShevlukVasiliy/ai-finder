import { getRules } from '../rules';
import { cv } from '../text/segment';
import type { CodeContext, Detector, Lang, Span } from '../types';
import { finding, notApplicable, result, spansOf } from './util';

export interface CodeCtx {
  code: CodeContext;
  lang: Lang;
}

const t = (lang: Lang, ru: string, en: string) => (lang === 'ru' ? ru : en);

export function detectCodeLanguage(code: string, filename = ''): string {
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase();
  const byExt: Record<string, string> = {
    py: 'python', js: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    go: 'go', java: 'java', cs: 'csharp', php: 'php', rb: 'ruby', rs: 'rust', kt: 'kotlin', swift: 'swift',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', sh: 'shell', sql: 'sql', scala: 'scala',
  };
  if (ext && byExt[ext]) return byExt[ext];
  if (/^\s*(def |import |from \S+ import |class \w+[:(])/m.test(code) && !/[;{]\s*$/m.test(code)) return 'python';
  if (/^\s*package \w+\s*$/m.test(code) && /\bfunc\b/.test(code)) return 'go';
  if (/<\?php/.test(code)) return 'php';
  if (/\bpublic (?:static )?class\b|System\.out\.println/.test(code)) return 'java';
  if (/\busing System\b|Console\.WriteLine/.test(code)) return 'csharp';
  if (/:\s*(?:string|number|boolean)\b|\binterface \w+ \{|\btype \w+ =/.test(code)) return 'typescript';
  if (/\b(?:const|let|function)\b|=>/.test(code)) return 'javascript';
  if (/#include\s*</.test(code)) return 'cpp';
  return 'unknown';
}

/** Heuristic: does this look like source code rather than prose? */
export function looksLikeCode(text: string): boolean {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 3) return false;
  const codeish = lines.filter((l) =>
    /[{};]\s*$|^\s*(?:def|class|import|from|return|if|for|while|const|let|var|function|public|private|func|package|#include)\b|^\s{2,}\S|=>|==|\(\)\s*[:{]/.test(l),
  ).length;
  return codeish / lines.length > 0.5;
}

const HASH_LANGS = new Set(['python', 'ruby', 'shell']);

export function commentLines(c: CodeContext): { index: number; text: string; start: number }[] {
  const out: { index: number; text: string; start: number }[] = [];
  const marker = HASH_LANGS.has(c.language) ? /^\s*#(?!!)\s?(.*)$/ : /^\s*(?:\/\/|\/?\*+)\s?(.*)$/;
  let offset = 0;
  c.lines.forEach((l, i) => {
    const m = marker.exec(l);
    if (m) out.push({ index: i, text: m[1]!.trim(), start: offset });
    else {
      const inline = HASH_LANGS.has(c.language) ? /\s#\s(.+)$/.exec(l) : /\s\/\/\s?(.+)$/.exec(l);
      if (inline && !/["'`]/.test(l.slice(inline.index))) out.push({ index: i, text: inline[1]!.trim(), start: offset + inline.index });
    }
    offset += l.length + 1;
  });
  return out;
}

const OBVIOUS = /^(?:increment|decrement|initiali[sz]e|import|define|create|set|get|return|loop|iterate|check if|call|print|add|update|declare|instantiate|open|close|read|write|convert|calculate)\b.{0,40}$/i;

const C01: Detector<CodeCtx> = {
  id: 'C-01',
  analyze({ code, lang }) {
    const nonEmpty = code.lines.filter((l) => l.trim()).length;
    if (nonEmpty < 8) return notApplicable('C-01', lang);
    const comments = commentLines(code);
    const density = comments.length / nonEmpty;
    const steps = comments.filter((c) => /^step\s*\d+|^шаг\s*\d+|^\d+\.\s/i.test(c.text));
    const obvious = comments.filter((c) => OBVIOUS.test(c.text));
    const fnCount = (code.code.match(/^\s*(?:def |async def |func |function |public |private |protected )/gm) ?? []).length;
    const docstrings = (code.code.match(/^\s*(?:def|class) [^\n]+:\n\s*(?:"""|''')/gm) ?? []).length + (code.code.match(/\/\*\*[\s\S]*?\*\/\s*\n\s*(?:export |public |private |function |async )/g) ?? []).length;
    let flags = 0;
    const notes: string[] = [];
    if (density > 0.25) {
      flags += Math.min(1.5, (density - 0.25) * 6);
      notes.push(t(lang, `Комментарии в ${Math.round(density * 100)} % строк.`, `Comments on ${Math.round(density * 100)}% of lines.`));
    }
    if (steps.length >= 2) {
      flags += 1;
      notes.push(t(lang, `Нумерованные шаги: ${steps.length}.`, `Numbered steps: ${steps.length}.`));
    }
    if (obvious.length >= 2) {
      flags += Math.min(1.5, obvious.length * 0.3);
      notes.push(t(lang, `Комментарии, пересказывающие код: ${obvious.length}.`, `Comments restating the code: ${obvious.length}.`));
    }
    if (fnCount >= 3 && docstrings >= fnCount) {
      flags += 0.8;
      notes.push(t(lang, 'Docstring у каждой функции.', 'Docstring on every function.'));
    }
    const spans: Span[] = [...steps, ...obvious].map((c) => ({
      start: c.start,
      end: c.start + (code.lines[c.index]?.length ?? 0),
      detector: 'C-01',
      label: c.text,
    }));
    return result('C-01', lang, flags, { findings: [finding('C-01.comments', spans, { value: flags, extra: notes.join(' ') })] });
  },
};

const ABBREV = /^(?:i|j|k|n|x|y|idx|cfg|ctx|req|res|resp|err|tmp|buf|ptr|num|cnt|len|str|obj|arr|val|args|kwargs|db|fn|cb|el|ev|e|df|ok|id|s|v|t|m|p|q|r|w|h|db|conn|msg|src|dst|env|opts|params)$/i;

export function identifiers(code: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:def|function|func|let|const|var|class|async def)\s+([A-Za-z_]\w*)|\b([a-z_][A-Za-z0-9_]*)\s*=(?!=)/g;
  for (const m of code.matchAll(re)) out.add((m[1] ?? m[2])!);
  return [...out];
}

function splitIdent(id: string): string[] {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/_+/)
    .filter(Boolean);
}

const C02: Detector<CodeCtx> = {
  id: 'C-02',
  analyze({ code, lang }) {
    const ids = identifiers(code.code);
    if (ids.length < 6) return notApplicable('C-02', lang);
    const dictionary = ids.filter((id) => {
      const parts = splitIdent(id);
      return parts.length >= 2 && parts.every((p) => p.length >= 4 && !ABBREV.test(p));
    });
    const value = dictionary.length / ids.length;
    return result('C-02', lang, value, { findings: [finding('C-02.naming', [], { value })] });
  },
};

const C03: Detector<CodeCtx> = {
  id: 'C-03',
  analyze({ code, lang }) {
    if (code.lines.length < 8) return notApplicable('C-03', lang);
    const src = code.code;
    const notes: string[] = [];
    let flags = 0;
    const spans: Span[] = [];
    if (/if __name__ == ['"]__main__['"]:\s*\n\s+main\(\)/.test(src)) {
      flags += 0.8;
      notes.push(t(lang, 'Шаблонный блок if __name__ == "__main__": main().', 'Boilerplate if __name__ == "__main__": main().'));
    }
    const broad = spansOf(/except\s+Exception(?:\s+as\s+\w+)?\s*:|catch\s*\(\s*(?:Exception|error|err|e)\s*(?::\s*\w+)?\)/g, src, 'C-03');
    if (broad.length >= 2) {
      flags += Math.min(1.2, broad.length * 0.4);
      notes.push(t(lang, `Перехват всех исключений: ${broad.length}.`, `Catch-all exception handlers: ${broad.length}.`));
      spans.push(...broad);
    }
    const emoji = spansOf(/(?:print|console\.\w+|log(?:ger)?\.\w+|fmt\.Print\w*)\([^)\n]*\p{Extended_Pictographic}[^)\n]*\)/gu, src, 'C-03');
    if (emoji.length) {
      flags += Math.min(1.5, emoji.length * 0.5);
      notes.push(t(lang, `Эмодзи в логах: ${emoji.length}.`, `Emoji in log messages: ${emoji.length}.`));
      spans.push(...emoji);
    }
    return result('C-03', lang, flags, { findings: [finding('C-03.boilerplate', spans, { value: flags, extra: notes.join(' ') })] });
  },
};

const C04: Detector<CodeCtx> = {
  id: 'C-04',
  analyze({ code, lang }) {
    const lines = code.lines;
    if (lines.length < 20) return notApplicable('C-04', lang);
    const notes: string[] = [];
    let flags = 0;
    const indents = lines.filter((l) => /^\s+\S/.test(l)).map((l) => /^\s+/.exec(l)![0]);
    const tabs = indents.filter((i) => i.includes('\t')).length;
    const mixedIndent = tabs > 0 && tabs < indents.length;
    const trailing = lines.filter((l) => /\S[ \t]+$/.test(l)).length;
    const tooLong = lines.filter((l) => l.length > 100).length;
    if (!mixedIndent && trailing === 0 && tooLong === 0) {
      flags += 0.8;
      notes.push(t(lang, 'Ни одного отступа не по стандарту, хвостовых пробелов или длинных строк.', 'No inconsistent indents, trailing spaces or long lines at all.'));
    }
    // Function length uniformity.
    const starts = lines.map((l, i) => (/^\s*(?:def |async def |func |function |public |private )/.test(l) ? i : -1)).filter((i) => i >= 0);
    if (starts.length >= 4) {
      const lens = starts.slice(1).map((s, i) => s - starts[i]!);
      const c = cv(lens);
      if (c < 0.25) {
        flags += 0.8;
        notes.push(t(lang, `Функции почти одинаковой длины (CV ${c.toFixed(2)}).`, `Functions of nearly equal length (CV ${c.toFixed(2)}).`));
      }
    }
    return result('C-04', lang, flags, { findings: [finding('C-04.style', [], { value: flags, extra: notes.join(' ') })] });
  },
};

const C05: Detector<CodeCtx> = {
  id: 'C-05',
  analyze({ code, lang }) {
    const re = new RegExp(getRules().lexicon.chat_markers.join('|'), 'giu');
    const spans = spansOf(re, code.code, 'C-05');
    return result('C-05', lang, spans.length, {
      findings: [finding('C-05.chat_markers', spans, { count: spans.length, phrase: spans[0]?.label ?? '' })],
    });
  },
};

export const DETECTORS = [C01, C02, C03, C04, C05];
