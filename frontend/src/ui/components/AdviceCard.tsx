import type { AdviceItem } from '../../core/types';
import { useT } from '../i18n';

export interface AdviceCardProps {
  item: AdviceItem;
  active?: boolean;
  onFocus?: (item: AdviceItem) => void;
  compact?: boolean;
}

export function AdviceCard({ item, active, onFocus, compact }: AdviceCardProps) {
  const t = useT();
  return (
    <article className={`advice sev-${item.severity}${active ? ' active' : ''}`}>
      <header>
        <button type="button" className="advice-title" onClick={() => onFocus?.(item)} aria-pressed={active}>
          {item.title}
        </button>
        <span className="advice-meta">
          <span className="badge">{t.effort[item.effort]}</span>
          {item.expectedGain > 0 && <span className="gain">−{item.expectedGain.toFixed(1)} {t.points}</span>}
        </span>
      </header>
      {!compact && <p className="advice-explain">{item.explain}</p>}
      <ul className="advice-actions">
        {(compact ? item.actions.slice(0, 1) : item.actions).map((a, i) => <li key={i}>{a}</li>)}
      </ul>
      {!compact && item.replacements.length > 0 && (
        <details>
          <summary>{t.replacements}</summary>
          <ul className="repl">
            {item.replacements.slice(0, 8).map((r) => (
              <li key={r.phrase}><mark>{r.phrase}</mark> → {r.options.join(' / ')}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
