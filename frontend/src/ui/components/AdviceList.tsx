import { useMemo, useState } from 'react';
import type { AdviceItem, Category } from '../../core/types';
import { useT } from '../i18n';
import { AdviceCard } from './AdviceCard';

export interface AdviceListProps {
  items: AdviceItem[];
  activeId?: string;
  onFocus?: (item: AdviceItem) => void;
  hidden?: Set<string>;
  onToggleHidden?: (item: AdviceItem) => void;
  loading?: boolean;
}

export function AdviceList({ items, activeId, onFocus, hidden, onToggleHidden, loading }: AdviceListProps) {
  const t = useT();
  const [category, setCategory] = useState<Category | ''>('');
  const [effort, setEffort] = useState(0);
  const cats = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter((i) => (!category || i.category === category) && (!effort || i.effort === effort));
  return (
    <section className="issues">
      <div className="issues-head">
        <h2>{t.adviceTitle}</h2>
        <div className="filters">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | '')} aria-label={t.allCategories}>
            <option value="">{t.allCategories}</option>
            {cats.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
          </select>
          <select value={effort} onChange={(e) => setEffort(Number(e.target.value))} aria-label={t.anyEffort}>
            <option value={0}>{t.anyEffort}</option>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{t.effort[n]}</option>)}
          </select>
        </div>
      </div>
      {loading ? <p className="muted">{t.loading}</p> : shown.length ? (
        <div className="issue-list">
          {shown.map((i) => (
            <AdviceCard key={i.id} item={i} active={i.id === activeId} onFocus={onFocus} hidden={hidden?.has(i.id)} onToggleHidden={onToggleHidden} />
          ))}
        </div>
      ) : (
        <p className="muted">{t.noAdvice}</p>
      )}
    </section>
  );
}
