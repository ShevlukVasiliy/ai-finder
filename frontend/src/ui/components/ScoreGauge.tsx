import type { Report } from '../../core/types';
import { useT } from '../i18n';

export interface ScoreGaugeProps {
  score?: number;
  verdict?: Report['verdict'];
  confidence?: Report['confidence'];
  words?: number;
  loading?: boolean;
  error?: string;
}

/** Plain-text score block (Hemingway-style "Grade 8 · Good"), no dials. */
export function ScoreGauge({ score, verdict, confidence, words, loading, error }: ScoreGaugeProps) {
  const t = useT();
  if (loading) return <section className="score" aria-busy="true"><p className="muted">{t.loading}</p></section>;
  if (error) return <section className="score" role="alert"><strong>{t.error}</strong><p>{error}</p></section>;
  if (score === undefined || !verdict) return <section className="score"><p className="muted">{t.empty}</p></section>;
  const v = Math.round(Math.max(0, Math.min(100, score)));
  return (
    <section className="score" aria-label={t.score}>
      <h2 className="score-title">{t.score}</h2>
      <p className={`score-value v-${verdict}`} role="img" aria-label={`${t.score}: ${v}`}>
        <span className="gauge-num">{v}</span> <span className="score-of">/ 100</span>
      </p>
      <p className="score-verdict">{t.verdict[verdict]}</p>
      {confidence && (
        <p className="score-conf">
          <span className={`conf conf-${confidence.level}`}>{t.confidence[confidence.level]}</span>
          {confidence.reasons.length > 0 && <span className="muted">: {confidence.reasons.map((x) => t.confidenceReasons[x] ?? x).join('; ').toLowerCase()}</span>}
        </p>
      )}
      {words !== undefined && <p className="score-words">{t.words}: {words.toLocaleString()}</p>}
    </section>
  );
}
