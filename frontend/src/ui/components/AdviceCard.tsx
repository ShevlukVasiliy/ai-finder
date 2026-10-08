import { useState } from 'react';
import type { AdviceItem } from '../../core/types';
import { useT } from '../i18n';

export interface AdviceCardProps {
  item: AdviceItem;
  active?: boolean;
  onFocus?: (item: AdviceItem) => void;
  /** Hide this finding's highlights in the editor. */
  hidden?: boolean;
  onToggleHidden?: (item: AdviceItem) => void;
  compact?: boolean;
}

/** One issue row: coloured like its highlights, with a count, expandable to the full advice. */
export function AdviceCard({ item, active, onFocus, hidden, onToggleHidden, compact }: AdviceCardProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const count = item.spans.length;
  if (compact)
    return (
      <button type="button" className="quick" onClick={() => onFocus?.(item)} aria-pressed={active}>
        <span className="quick-title">{item.title}</span>
        {item.expectedGain > 0 && <span className="quick-gain">−{item.expectedGain.toFixed(0)}</span>}
      </button>
    );
  return (
    <article className={`issue cat-${item.category}${active ? ' active' : ''}${hidden ? ' is-hidden' : ''}`}>
      <div className="issue-row">
        <button
          type="button"
          className="issue-title"
          aria-pressed={active}
          aria-expanded={open}
          onClick={() => {
            setOpen((o) => !o);
            onFocus?.(item);
          }}
        >
          {count > 0 && <span className="issue-count">{count}</span>}
          {item.title}
        </button>
        {onToggleHidden && count > 0 && (
          <button type="button" className="issue-eye" onClick={() => onToggleHidden(item)} aria-label={hidden ? t.showHl : t.hideHl} title={hidden ? t.showHl : t.hideHl}>
            {hidden ? t.show : t.hide}
          </button>
        )}
      </div>
      {open && (
        <div className="issue-body">
          <p className="issue-explain">{item.explain}</p>
          <ul className="issue-actions">{item.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          {item.replacements.length > 0 && (
            <p className="issue-repl">
              <span className="muted">{t.replacements}: </span>
              {item.replacements.slice(0, 6).map((r, i) => (
                <span key={r.phrase}>{i > 0 && '; '}<s>{r.phrase}</s> → {r.options.join(' / ')}</span>
              ))}
            </p>
          )}
          <p className="issue-meta muted">
            {t.effort[item.effort]}
            {item.expectedGain > 0 && ` · ${t.gain} ${item.expectedGain.toFixed(1)} ${t.points}`}
          </p>
        </div>
      )}
    </article>
  );
}
