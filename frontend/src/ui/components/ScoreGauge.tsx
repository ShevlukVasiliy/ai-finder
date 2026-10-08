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
  const pct = Math.max(0, Math.min(100, score));
  return (
    <section className={`card gauge v-${verdict}`} aria-label={t.score}>
      <div className="gauge-label">{t.score}</div>
      <div className="gauge-row">
        <span className="gauge-num">{Math.round(pct)}</span>
        <span className="gauge-of">/100</span>
      </div>
      <div className="gauge-scale" role="img" aria-label={`${t.score}: ${Math.round(pct)}`}>
        <span className="gauge-zone z-human" />
        <span className="gauge-zone z-mixed" />
        <span className="gauge-zone z-ai" />
        <span className="gauge-pin" style={{ left: `${pct}%` }} />
      </div>
      <div className="gauge-ticks" aria-hidden="true"><span>0</span><span>35</span><span>65</span><span>100</span></div>
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
