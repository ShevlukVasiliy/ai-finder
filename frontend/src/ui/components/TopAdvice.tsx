import type { AdviceItem } from '../../core/types';
import { useT } from '../i18n';
import { AdviceCard } from './AdviceCard';

export function TopAdvice({ items, onFocus, activeId }: { items: AdviceItem[]; onFocus?: (i: AdviceItem) => void; activeId?: string }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <section className="card top-advice">
      <h3>{t.topAdvice}</h3>
      <ol>
        {items.slice(0, 3).map((i) => <li key={i.id}><AdviceCard item={i} compact onFocus={onFocus} active={i.id === activeId} /></li>)}
      </ol>
    </section>
  );
}
