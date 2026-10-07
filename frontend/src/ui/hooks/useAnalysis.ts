import { useCallback, useEffect, useState } from 'react';
import { analyze, AnalysisError, diffReports, normalize } from '../../core/analyze';
import { detectCodeLanguage, looksLikeCode } from '../../core/detectors/code';
import { loadModels } from '../../core/ngram';
import { fileToInput, type FileLike } from '../../core/parsers/files';
import { addVersion, loadHistory, saveHistory, type Version } from '../../core/session';
import type { AnalysisInput, Lang, LangSetting, Report, ReportDiff } from '../../core/types';

export type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface AnalysisState {
  status: Status;
  report?: Report;
  diff?: ReportDiff;
  error?: string;
  /** Current editor text (may differ from the analysed one). */
  text: string;
  input?: AnalysisInput;
  history: Version[];
  imageUrl?: string;
  notice?: string;
}

const errCode = (e: unknown) => (e instanceof AnalysisError ? e.code : 'invalid');

/** Rebuilds the analysis input for edited text, keeping the original kind/metadata. */
export function withText(input: AnalysisInput | undefined, text: string, lang: LangSetting): AnalysisInput {
  if (input?.kind === 'document' && input.document) return { ...input, lang, document: { ...input.document, text } };
  if (input?.kind === 'code' || (!input && looksLikeCode(text)))
    return { kind: 'code', lang, code: { code: text, language: input?.code?.language ?? detectCodeLanguage(text), lines: text.split('\n') } };
  return { kind: 'text', text, lang };
}

export function useAnalysis(lang: LangSetting, uiLang?: Lang) {
  const [state, setState] = useState<AnalysisState>(() => ({ status: 'idle', text: '', history: loadHistory() }));

  useEffect(() => saveHistory(state.history), [state.history]);
  useEffect(() => () => {
    if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  }, [state.imageUrl]);

  const run = useCallback(async (input: AnalysisInput, previous?: Report, imageUrl?: string) => {
    setState((s) => ({ ...s, status: 'loading', error: undefined, notice: undefined }));
    try {
      await loadModels();
      const report = analyze({ ...input, uiLang });
      setState((s) => ({
        ...s,
        status: 'ready',
        report,
        input,
        text: report.text,
        diff: previous ? diffReports(previous, report) : undefined,
        history: addVersion(previous ? s.history : [], report),
        imageUrl: imageUrl ?? (input.kind === 'image' ? s.imageUrl : undefined),
      }));
    } catch (e) {
      setState((s) => ({ ...s, status: 'error', error: errCode(e) }));
    }
  }, [uiLang]);

  const analyzeText = useCallback((text: string) => run(withText(undefined, text, lang)), [run, lang]);

  const analyzeFile = useCallback(
    async (file: FileLike & Partial<Blob>) => {
      setState((s) => ({ ...s, status: 'loading', error: undefined }));
      try {
        const input = await fileToInput(file, lang);
        const url = input.kind === 'image' && typeof URL.createObjectURL === 'function' && file instanceof Blob ? URL.createObjectURL(file) : undefined;
        await run(input, undefined, url);
      } catch (e) {
        setState((s) => ({ ...s, status: 'error', error: errCode(e) }));
      }
    },
    [run, lang],
  );

  const setText = useCallback((text: string) => setState((s) => ({ ...s, text })), []);

  const recheck = useCallback(() => {
    if (!state.report) return;
    return run(withText(state.input, state.text, lang), state.report);
  }, [run, state.report, state.input, state.text, lang]);

  const clean = useCallback(() => {
    const r = normalize(state.text);
    setState((s) => ({ ...s, text: r.text, notice: `${r.replaced}/${r.removed}` }));
    return r;
  }, [state.text]);

  const reset = useCallback(() => setState((s) => ({ status: 'idle', text: '', history: s.history })), []);

  return { state, analyzeText, analyzeFile, setText, recheck, clean, reset };
}
