import type { CategoryScore } from '../../core/types';
import { useT } from '../i18n';

export function CategoryBreakdown({ categories, loading }: { categories?: CategoryScore[]; loading?: boolean }) {
  const t = useT();
  return (
    <section className="card" aria-busy={loading || undefined}>
      <h3>{t.categoriesTitle}</h3>
      {loading ? (
        <div className="skeleton bars-skel" />
      ) : !categories?.length ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <ul className="bars">
          {categories.map((c) => (
            <li key={c.category}>
              <span className="bar-label">{t.categories[c.category]}</span>
              <span className="bar" role="meter" aria-valuenow={c.score} aria-valuemin={0} aria-valuemax={100} aria-label={t.categories[c.category]}>
                <span className={`bar-fill ${c.score >= 65 ? 'hot' : c.score >= 35 ? 'warm' : 'cool'}`} style={{ width: `${c.score}%` }} />
              </span>
              <span className="bar-num">{c.score}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
