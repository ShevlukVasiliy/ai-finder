import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../i18n';

export const REPO_URL = 'https://github.com/ShevlukVasiliy/ai-finder';
export const BASIS_DOC_URL = `${REPO_URL}/blob/main/docs/SCIENTIFIC_BASIS.md`;

/** Primary sources per principle (same order as `t.footer.principles`). */
export const SOURCES: { label: string; url: string }[][] = [
  [{ label: 'Tian, GPTZero (2023)', url: 'https://gptzero.me/news/perplexity-and-burstiness-what-is-it/' }],
  [
    { label: 'Jiang et al., Findings of ACL 2023', url: 'https://aclanthology.org/2023.findings-acl.426/' },
    { label: 'Delétang et al., ICLR 2024', url: 'https://arxiv.org/abs/2309.10668' },
  ],
  [{ label: 'Gehrmann et al., GLTR, ACL 2019', url: 'https://aclanthology.org/P19-3019/' }],
  [
    { label: 'Kobak et al. (2024)', url: 'https://arxiv.org/abs/2406.07016' },
    { label: 'Liang et al., ICML 2024', url: 'https://arxiv.org/abs/2403.07183' },
  ],
  [
    { label: 'Frank et al., ICML 2020', url: 'https://proceedings.mlr.press/v119/frank20a.html' },
    { label: 'Corvi et al. (2023)', url: 'https://arxiv.org/abs/2211.00680' },
    { label: 'C2PA', url: 'https://c2pa.org/' },
  ],
];

export function MethodologyDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" data-testid="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId}>{t.footer.title}</h2>
          <button ref={closeRef} type="button" className="ghost modal-close" onClick={onClose} aria-label={t.footer.close}>
            ×
          </button>
        </div>
        <p className="modal-intro">{t.footer.intro}</p>
        <ul className="principles">
          {t.footer.principles.map((p, i) => (
            <li key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <p className="refs">
                {(SOURCES[i] ?? []).map((s, k) => (
                  <span key={s.url}>
                    {k > 0 && ' · '}
                    <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
        <p className="modal-foot">
          <a href={BASIS_DOC_URL} target="_blank" rel="noreferrer">{t.footer.full}</a>
        </p>
      </div>
    </div>
  );
}

export function Footer() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <footer className="site-footer">
      <span>{t.footer.privacy}</span>
      <span className="footer-links">
        <button type="button" className="link" onClick={() => setOpen(true)} aria-haspopup="dialog">
          {t.footer.methodology}
        </button>
        <a href={REPO_URL} target="_blank" rel="noreferrer">{t.footer.github}</a>
      </span>
      {open && <MethodologyDialog onClose={() => setOpen(false)} />}
    </footer>
  );
}
