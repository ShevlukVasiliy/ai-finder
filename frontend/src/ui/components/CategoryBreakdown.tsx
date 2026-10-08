import type { CategoryScore } from '../../core/types';
import { useT } from '../i18n';

export function CategoryBreakdown({ categories, loading }: { categories?: CategoryScore[]; loading?: boolean }) {
  const t = useT();
  return (
    <section className="cats" aria-busy={loading || undefined}>
      <h3>{t.categoriesTitle}</h3>
      {loading ? (
        <p className="muted">{t.loading}</p>
      ) : !categories?.length ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <table className="table">
          <tbody>
            {categories.map((c) => (
              <tr key={c.category}>
                <th scope="row"><span className={`dot cat-${c.category}`} aria-hidden="true" />{t.categories[c.category]}</th>
                <td>
                  <span className="bar" role="meter" aria-valuenow={c.score} aria-valuemin={0} aria-valuemax={100} aria-label={t.categories[c.category]}>
                    <span className="bar-fill" style={{ width: `${c.score}%` }} />
                  </span>
                </td>
                <td className="num">{c.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
