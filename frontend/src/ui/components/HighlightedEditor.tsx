import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo, useRef } from 'react';
import type { AdviceItem, Category, SentenceScore } from '../../core/types';
import { useT } from '../i18n';

export interface Highlight {
  start: number;
  end: number;
  className: string;
  title?: string;
}

const key = new PluginKey<DecorationSet>('ai-finder-highlights');

const Highlights = Extension.create({
  name: 'highlights',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const next = tr.getMeta(key) as DecorationSet | undefined;
            return next ?? old.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

export function textToDoc(text: string) {
  return {
    type: 'doc',
    content: text.split('\n').map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })),
  };
}

export function docToText(doc: PMNode): string {
  return doc.textBetween(0, doc.content.size, '\n');
}

/** Maps plain-text offsets (lines joined by "\n") to ProseMirror positions. */
export function offsetMapper(text: string): (offset: number) => number {
  const starts: number[] = [];
  let off = 0;
  for (const line of text.split('\n')) {
    starts.push(off);
    off += line.length + 1;
  }
  return (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= offset) lo = mid;
      else hi = mid - 1;
    }
    return offset + 1 + lo;
  };
}

export function buildHighlights(sentences: SentenceScore[], advice: AdviceItem[], activeId?: string, hidden?: Set<string>): Highlight[] {
  // Sentence heat: only the hottest sentences get a quiet underline; colour fills belong to findings.
  const out: Highlight[] = sentences
    .filter((s) => s.score >= 0.6)
    .map((s) => ({ start: s.start, end: s.end, className: `sheat sheat-${Math.min(4, Math.floor(s.score * 5))}` }));
  for (const a of advice.filter((x) => !hidden?.has(x.id)))
    for (const sp of a.spans)
      out.push({
        start: sp.start,
        end: sp.end,
        className: `hl cat-${a.category as Category}${a.id === activeId ? ' hl-active' : ''}`,
        title: a.title,
      });
  return out;
}

export interface HighlightedEditorProps {
  text: string;
  onChange?: (text: string) => void;
  sentences?: SentenceScore[];
  advice?: AdviceItem[];
  activeId?: string;
  readOnly?: boolean;
  /** Text the highlights were computed for (defaults to `text`). */
  analyzedText?: string;
  hidden?: Set<string>;
  /** "write" hides all highlights (Hemingway's Write mode). */
  mode?: 'edit' | 'write';
}

export function HighlightedEditor({ text, onChange, sentences = [], advice = [], activeId, readOnly, analyzedText, hidden, mode = 'edit' }: HighlightedEditorProps) {
  const t = useT();
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bold: false,
        italic: false,
        strike: false,
        code: false,
        link: false,
        underline: false,
      }),
      Highlights,
    ],
    content: textToDoc(text),
    editable: !readOnly,
    immediatelyRender: true,
    editorProps: { attributes: { 'aria-label': t.editorLabel, role: 'textbox', 'aria-multiline': 'true', class: 'editor' } },
    onUpdate: ({ editor: e }) => changeRef.current?.(docToText(e.state.doc)),
  });

  // External text changes (normalisation, new file) replace the document.
  useEffect(() => {
    if (!editor) return;
    if (docToText(editor.state.doc) !== text) editor.commands.setContent(textToDoc(text), { emitUpdate: false });
  }, [editor, text]);

  const highlights = useMemo(
    () => (mode === 'write' ? [] : buildHighlights(sentences, advice, activeId, hidden)),
    [sentences, advice, activeId, hidden, mode],
  );

  useEffect(() => {
    if (!editor) return;
    const current = docToText(editor.state.doc);
    // Highlights refer to the analysed text; drop them once the user edits.
    const map = offsetMapper(current);
    const size = editor.state.doc.content.size;
    const decos = current === (analyzedText ?? text)
      ? highlights
          .filter((h) => h.end > h.start && h.end <= current.length)
          .map((h) => Decoration.inline(Math.min(size, map(h.start)), Math.min(size, map(h.end)), { class: h.className, ...(h.title ? { title: h.title } : {}) }))
      : [];
    editor.view.dispatch(editor.state.tr.setMeta(key, DecorationSet.create(editor.state.doc, decos)).setMeta('addToHistory', false));
  }, [editor, highlights, text, analyzedText]);

  useEffect(() => {
    if (!editor || !activeId) return;
    const el = editor.view.dom.querySelector('.hl-active');
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [editor, activeId, highlights]);

  return (
    <section className="editor-card">
      <EditorContent editor={editor} />
    </section>
  );
}
