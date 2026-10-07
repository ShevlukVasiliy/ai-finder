import { useState } from 'react';
import type { AdviceItem, Report, ReportDiff } from '../../core/types';
import { useT } from '../i18n';
import { AdviceList } from './AdviceList';
import { CategoryBreakdown } from './CategoryBreakdown';
import { DocumentMetaTable } from './DocumentMetaTable';
import { HighlightedEditor } from './HighlightedEditor';
import { ImageReport } from './ImageReport';
import { MetricList } from './MetricCorridor';
import { RecheckDiff } from './RecheckDiff';
import { ScoreGauge } from './ScoreGauge';
import { TopAdvice } from './TopAdvice';

export interface ReportPageProps {
  report: Report;
  text: string;
  diff?: ReportDiff;
  loading?: boolean;
  imageUrl?: string;
  notice?: string;
  onTextChange?: (t: string) => void;
  onRecheck?: () => void;
  onClean?: () => void;
  onExportJson?: () => void;
  onExportPdf?: () => void;
  onReset?: () => void;
}

export function ReportPage(p: ReportPageProps) {
  const t = useT();
  const [active, setActive] = useState<string>();
  const r = p.report;
  const focus = (a: AdviceItem) => setActive((x) => (x === a.id ? undefined : a.id));
  const hasAutofix = r.advice.some((a) => a.autofix);
  const titles = Object.fromEntries(
    r.advice.flatMap((a) => [[a.id, a.title], ...a.detectors.map((d) => [d, a.title])]),
  ) as Record<string, string>;
  const textual = r.kind !== 'image';
  return (
    <div className="report">
      <div className="toolbar" role="toolbar">
        {textual && <button type="button" className="primary" onClick={p.onRecheck} disabled={p.loading}>{p.loading ? t.analyzing : t.recheck}</button>}
        {textual && hasAutofix && <button type="button" onClick={p.onClean}>{t.clean}</button>}
        <button type="button" onClick={p.onExportJson}>{t.exportJson}</button>
        <button type="button" onClick={p.onExportPdf}>{t.exportPdf}</button>
        <button type="button" className="ghost" onClick={p.onReset}>{t.newCheck}</button>
      </div>
      {p.notice && <p className="notice" role="status">{p.notice}</p>}
      <div className="report-grid">
        <div className="report-main">
          {textual ? (
            <HighlightedEditor text={p.text} analyzedText={r.text} onChange={p.onTextChange} sentences={r.sentences} advice={r.advice} activeId={active} />
          ) : (
            r.image && <ImageReport image={r.image} src={p.imageUrl} />
          )}
          {r.kind === 'document' && <DocumentMetaTable meta={r.document} />}
          {p.diff && <RecheckDiff diff={p.diff} titles={titles} />}
        </div>
        <aside className="report-side">
          <ScoreGauge score={r.score} verdict={r.verdict} confidence={r.confidence} loading={p.loading} />
          <TopAdvice items={r.advice} onFocus={focus} activeId={active} />
          <CategoryBreakdown categories={r.categories} />
          <AdviceList items={r.advice} activeId={active} onFocus={focus} />
          <MetricList metrics={r.metrics} />
        </aside>
      </div>
      <p className="disclaimer">{t.disclaimer}</p>
    </div>
  );
}
