import type { ReportDiff } from '../../core/types';
import { useT } from '../i18n';

export function RecheckDiff({ diff, titles = {} }: { diff: ReportDiff; titles?: Record<string, string> }) {
  const t = useT();
  const delta = diff.scoreAfter - diff.scoreBefore;
  const name = (id: string) => titles[id] ?? id;
  return (
    <section className="card diff" aria-live="polite">
      <h3>{t.diffTitle}</h3>
      <p className="diff-score">
        {t.score}: {Math.round(diff.scoreBefore)} → <strong>{Math.round(diff.scoreAfter)}</strong>{' '}
        <span className={delta <= 0 ? 'ok' : 'warn'}>({delta > 0 ? '+' : ''}{delta.toFixed(1)})</span>
      </p>
      <div className="diff-cols">
        <div><h4>{t.closed} ({diff.closed.length})</h4><ul>{diff.closed.map((x) => <li key={x} className="ok">✓ {name(x)}</li>)}</ul></div>
        <div><h4>{t.opened} ({diff.opened.length})</h4><ul>{diff.opened.map((x) => <li key={x} className="warn">+ {name(x)}</li>)}</ul></div>
        <div><h4>{t.remaining} ({diff.remaining.length})</h4><ul>{diff.remaining.map((x) => <li key={x}>• {name(x)}</li>)}</ul></div>
      </div>
      {diff.metrics.length > 0 && (
        <table className="table">
          <tbody>
            {diff.metrics.map((m) => (
              <tr key={m.detector}><td>{m.name}</td><td>{t.was} {m.before.toFixed(2)}</td><td>{t.now} {m.after.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
