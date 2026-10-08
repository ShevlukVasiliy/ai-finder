import type { Metric } from '../../core/types';
import { useT } from '../i18n';

const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));

export function MetricCorridor({ metric }: { metric: Metric }) {
  const t = useT();
  const [lo, hi] = metric.corridor;
  const span = Math.max(hi - lo, Math.abs(hi) || 1);
  const min = Math.min(lo - span * 0.5, metric.value);
  const max = Math.max(hi + span * 0.5, metric.value);
  const pos = (v: number) => (max === min ? 50 : ((v - min) / (max - min)) * 100);
  const inside = metric.value >= lo && metric.value <= hi;
  return (
    <div className="corridor">
      <div className="corridor-head">
        <span>{metric.name}</span>
        <span className={inside ? 'ok' : 'warn'}>
          {t.current}: {fmt(metric.value)} · {t.corridor}: {fmt(lo)}–{fmt(hi)}
        </span>
      </div>
      <div className="corridor-track" role="img" aria-label={`${metric.name}: ${fmt(metric.value)}, ${t.corridor} ${fmt(lo)}–${fmt(hi)}`}>
        <span className="corridor-zone" style={{ left: `${pos(lo)}%`, width: `${Math.max(1, pos(hi) - pos(lo))}%` }} />
        <span className={`corridor-mark ${inside ? 'ok' : 'warn'}`} style={{ left: `${pos(metric.value)}%` }} />
      </div>
    </div>
  );
}

export function MetricList({ metrics }: { metrics: Metric[] }) {
  const t = useT();
  return (
    <section className="block">
      <h3>{t.metricsTitle}</h3>
      {metrics.length ? metrics.map((m) => <MetricCorridor key={m.detector} metric={m} />) : <p className="muted">{t.empty}</p>}
    </section>
  );
}
