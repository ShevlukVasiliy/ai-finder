import type { Report } from '../../core/types';
import { useT } from '../i18n';

export interface ScoreGaugeProps {
  score?: number;
  verdict?: Report['verdict'];
  confidence?: Report['confidence'];
  loading?: boolean;
  error?: string;
}

export function ScoreGauge({ score, verdict, confidence, loading, error }: ScoreGaugeProps) {
  const t = useT();
  if (loading) return <section className="card gauge" aria-busy="true"><div className="skeleton gauge-skel" />{t.loading}</section>;
  if (error) return <section className="card gauge" role="alert"><strong>{t.error}</strong><p>{error}</p></section>;
  if (score === undefined || !verdict) return <section className="card gauge muted">{t.empty}</section>;
  const r = 52;
  const c = Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <section className={`card gauge v-${verdict}`} aria-label={t.score}>
      <svg viewBox="0 0 120 70" className="gauge-svg" role="img" aria-label={`${t.score}: ${Math.round(pct)}`}>
        <path d="M8 62 A52 52 0 0 1 112 62" className="gauge-track" />
        <path d="M8 62 A52 52 0 0 1 112 62" className="gauge-fill" strokeDasharray={`${(c * pct) / 100} ${c}`} />
        <text x="60" y="58" textAnchor="middle" className="gauge-num">{Math.round(pct)}</text>
      </svg>
      <div className="gauge-verdict">{t.verdict[verdict]}</div>
      {confidence && (
        <div className="gauge-conf">
          <span className={`badge conf-${confidence.level}`} title={confidence.reasons.map((x) => t.confidenceReasons[x] ?? x).join('; ')}>
            {t.confidence[confidence.level]}
          </span>
          {confidence.reasons.length > 0 && (
            <ul className="conf-reasons">{confidence.reasons.map((x) => <li key={x}>{t.confidenceReasons[x] ?? x}</li>)}</ul>
          )}
        </div>
      )}
    </section>
  );
}
