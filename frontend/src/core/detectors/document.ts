import { words } from '../text/segment';
import type { Detector, Lang, ParsedDocument } from '../types';
import { finding, notApplicable, result } from './util';

export interface DocContext {
  doc: ParsedDocument;
  lang: Lang;
}

const GENERATORS = /python-docx|reportlab|pandoc|wkhtmltopdf|microsoft print to pdf|chrome|skia\/pdf|headless|puppeteer|weasyprint|docx\.js|openxml sdk|fpdf|tcpdf|html2pdf|jspdf|pdfkit|latex|chatgpt|openai|claude|gemini/i;

const t = (lang: Lang, ru: string, en: string) => (lang === 'ru' ? ru : en);

const D01: Detector<DocContext> = {
  id: 'D-01',
  analyze({ doc, lang }) {
    const m = doc.meta;
    if (['txt', 'md'].includes(m.format)) return notApplicable('D-01', lang);
    const notes: string[] = [];
    let flags = 0;
    for (const [field, v] of [
      ['Creator', m.creator],
      ['Producer', m.producer],
      ['Application', m.application],
      ['Author', m.author],
    ] as const) {
      if (v && GENERATORS.test(v)) {
        flags += 1.5;
        notes.push(t(lang, `Поле ${field} = «${v}»: так подписывают документы программы и браузерные чаты.`, `${field} = “${v}”, which is typical for scripts and browser chats.`));
      }
    }
    if (!m.author && !m.creator && !m.application && !m.producer) {
      flags += 0.5;
      notes.push(t(lang, 'Метаданные об авторе и приложении пустые.', 'Author and application metadata are empty.'));
    }
    if (m.created && m.modified && m.created === m.modified) {
      flags += 0.5;
      notes.push(t(lang, 'Время создания совпадает со временем изменения.', 'Creation and modification time are identical.'));
    }
    return result('D-01', lang, flags, { findings: [finding('D-01.metadata', [], { value: flags, extra: notes.join(' ') })] });
  },
};

const D02: Detector<DocContext> = {
  id: 'D-02',
  analyze({ doc, lang }) {
    const m = doc.meta;
    if (m.format !== 'docx' && m.format !== 'odt') return notApplicable('D-02', lang);
    const n = words(doc.text).length;
    if (m.totalTimeMin === undefined || n < 100) return notApplicable('D-02', lang);
    const wpm = n / Math.max(1, m.totalTimeMin);
    const notes = [
      t(lang, `${n} слов за ${m.totalTimeMin} мин. редактирования (${Math.round(wpm)} слов/мин).`, `${n} words in ${m.totalTimeMin} min of editing (${Math.round(wpm)} words/min).`),
    ];
    if (m.revisions !== undefined && m.revisions <= 2)
      notes.push(t(lang, `Ревизий: ${m.revisions}.`, `Revisions: ${m.revisions}.`));
    const extra = m.revisions !== undefined && m.revisions <= 2 && wpm > 40 ? 50 : 0;
    return result('D-02', lang, wpm + extra, { findings: [finding('D-02.edit_time', [], { value: wpm, extra: notes.join(' ') })] });
  },
};

const D03: Detector<DocContext> = {
  id: 'D-03',
  analyze({ doc, lang }) {
    const m = doc.meta;
    if (m.format !== 'docx' && m.format !== 'odt') return notApplicable('D-03', lang);
    const n = words(doc.text).length;
    if (n < 150) return notApplicable('D-03', lang);
    const notes: string[] = [];
    let flags = 0;
    if (m.format === 'docx' && m.rsids <= 1) {
      flags += 1.5;
      notes.push(t(lang, 'Весь текст имеет один идентификатор сессии правки (rsid): вставлен разом.', 'All text shares one revision session id (rsid): pasted at once.'));
    }
    if (m.styles.length <= 1 && m.fonts.length <= 1) {
      flags += 0.7;
      notes.push(t(lang, 'Во всём документе один стиль и один шрифт.', 'One style and one font across the whole document.'));
    }
    return result('D-03', lang, flags, { findings: [finding('D-03.paste', [], { value: flags, extra: notes.join(' ') })] });
  },
};

const D04: Detector<DocContext> = {
  id: 'D-04',
  analyze({ doc, lang }) {
    const m = doc.meta;
    if (m.format === 'md' || m.format === 'txt') return notApplicable('D-04', lang);
    const notes: string[] = [];
    let flags = 0;
    const md = (doc.text.match(/\*\*[^*\n]+\*\*|^#{1,6}\s/gm) ?? []).length;
    if (md) {
      flags += Math.min(1.5, md * 0.3);
      notes.push(t(lang, `Остатки Markdown: ${md}.`, `Markdown leftovers: ${md}.`));
    }
    if (m.styles.some((s) => /normal \(web\)|html|обычный \(веб\)/i.test(s))) {
      flags += 1;
      notes.push(t(lang, 'Стиль «Normal (Web)» — признак вставки из браузера.', '“Normal (Web)” style — pasted from a browser.'));
    }
    if (m.htmlFragments) {
      flags += 1;
      notes.push(t(lang, `HTML-фрагменты (altChunk): ${m.htmlFragments}.`, `HTML fragments (altChunk): ${m.htmlFragments}.`));
    }
    if (m.fonts.some((f) => /söhne|sohne|ui-sans-serif|segoe ui|-apple-system|inter\b/i.test(f))) {
      flags += 1;
      notes.push(t(lang, `Шрифт веб-интерфейса чата: ${m.fonts.join(', ')}.`, `Chat web UI font: ${m.fonts.join(', ')}.`));
    }
    return result('D-04', lang, flags, { findings: [finding('D-04.chat_format', [], { value: flags, extra: notes.join(' ') })] });
  },
};

export const DETECTORS = [D01, D02, D03, D04];
