import { useEffect, useMemo, useState } from 'react';
import type { LangSetting } from '../core/types';
import { ReportPage } from './components/ReportPage';
import { UploadDropzone } from './components/UploadDropzone';
import { download, exportPdf, reportJson } from './export';
import { useAnalysis } from './hooks/useAnalysis';
import { useTheme } from './hooks/useTheme';
import { DICTS, I18nContext } from './i18n';

function uiLangDefault(): 'ru' | 'en' {
  try {
    const saved = localStorage.getItem('ai-finder:ui');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && /^ru|^uk|^be|^kk/i.test(navigator.language) ? 'ru' : 'en';
}

export function App() {
  const [ui, setUi] = useState<'ru' | 'en'>(uiLangDefault);
  const [lang, setLang] = useState<LangSetting>('auto');
  const { theme, toggle } = useTheme();
  const { state, analyzeText, analyzeFile, setText, recheck, clean, reset } = useAnalysis(lang, ui);
  const t = DICTS[ui];
  const [draft, setDraft] = useState('');
  useEffect(() => {
    document.documentElement.lang = ui;
    try {
      localStorage.setItem('ai-finder:ui', ui);
    } catch {
      /* ignore */
    }
    document.title = t.docTitle;
  }, [ui, t]);
  const notice = useMemo(() => {
    if (!state.notice) return undefined;
    const [r, d] = state.notice.split('/').map(Number);
    return t.cleaned(r ?? 0, d ?? 0);
  }, [state.notice, t]);
  const error = state.error ? (t.errors[state.error] ?? state.error) : undefined;

  return (
    <I18nContext.Provider value={t}>
      <a href="#main" className="sr-only skip">{t.skip}</a>
      <header className="topbar">
        <div className="brand"><h1 className="logo">{t.appTitle}</h1><span className="brand-sub">{t.brandSub}</span></div>
        <div className="topbar-actions">
          <label className="inline">
            <span>{t.langLabel}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as LangSetting)} aria-label={t.langLabel}>
              <option value="auto">{t.langAuto}</option>
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </label>
          <button type="button" className="ghost" onClick={() => setUi(ui === 'ru' ? 'en' : 'ru')} aria-label={t.uiLang} title={t.uiLang}>
            {ui === 'ru' ? 'EN' : 'RU'}
          </button>
          <button type="button" className="ghost" onClick={toggle} aria-label={theme === 'dark' ? t.themeLight : t.themeDark} title={theme === 'dark' ? t.themeLight : t.themeDark}>
            {theme === 'dark' ? t.themeLight : t.themeDark}
          </button>
        </div>
      </header>
      <main id="main">
        {state.report && state.status !== 'idle' ? (
          <>
            {state.status === 'error' && error && <p role="alert" className="error-text">{error}</p>}
            <ReportPage
              report={state.report}
              text={state.text}
              diff={state.diff}
              loading={state.status === 'loading'}
              imageUrl={state.imageUrl}
              notice={notice}
              onTextChange={setText}
              onRecheck={recheck}
              onClean={clean}
              onExportJson={() => download('ai-finder-report.json', reportJson(state.report!))}
              onExportPdf={exportPdf}
              onReset={() => {
                setDraft('');
                reset();
              }}
            />
          </>
        ) : (
          <div className="home">
            <p className="tagline">{t.tagline}</p>
            <textarea
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.inputPlaceholder}
              aria-label={t.inputPlaceholder}
              rows={12}
            />
            <div className="home-actions">
              <button type="button" className="primary" disabled={state.status === 'loading' || !draft.trim()} onClick={() => analyzeText(draft)}>
                {state.status === 'loading' ? t.analyzing : t.analyze}
              </button>
              <span className="muted small">{draft.length.toLocaleString()} / 100 000</span>
            </div>
            <UploadDropzone onFile={analyzeFile} disabled={state.status === 'loading'} error={state.status === 'error' ? error : undefined} />
            <p className="disclaimer">{t.disclaimer}</p>
          </div>
        )}
      </main>
    </I18nContext.Provider>
  );
}
