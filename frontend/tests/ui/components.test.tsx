import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdviceCard } from '../../src/ui/components/AdviceCard';
import { AdviceList } from '../../src/ui/components/AdviceList';
import { CategoryBreakdown } from '../../src/ui/components/CategoryBreakdown';
import { DocumentMetaTable } from '../../src/ui/components/DocumentMetaTable';
import { buildHighlights, HighlightedEditor, offsetMapper } from '../../src/ui/components/HighlightedEditor';
import { ImageReport } from '../../src/ui/components/ImageReport';
import { MetricCorridor, MetricList } from '../../src/ui/components/MetricCorridor';
import { RecheckDiff } from '../../src/ui/components/RecheckDiff';
import { ReportPage } from '../../src/ui/components/ReportPage';
import { ScoreGauge } from '../../src/ui/components/ScoreGauge';
import { TopAdvice } from '../../src/ui/components/TopAdvice';
import { UploadDropzone } from '../../src/ui/components/UploadDropzone';
import { DICTS, I18nContext } from '../../src/ui/i18n';
import { aiReport, diff } from './fixtures';

const en = (ui: React.ReactNode) => render(<I18nContext.Provider value={DICTS.en}>{ui}</I18nContext.Provider>);

describe('ScoreGauge', () => {
  it('renders states', () => {
    const { rerender } = render(<ScoreGauge loading />);
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
    rerender(<ScoreGauge error="boom" />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    rerender(<ScoreGauge />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
    rerender(<ScoreGauge score={82} verdict="ai" confidence={{ level: 'low', value: 0.2, reasons: ['short_text'] }} />);
    expect(screen.getByText('Похоже на ИИ')).toBeInTheDocument();
    expect(screen.getByText('Низкая достоверность')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('AI-score: 82');
  });
});

describe('CategoryBreakdown', () => {
  it('shows bars, loading and empty', () => {
    const { rerender } = render(<CategoryBreakdown categories={[{ category: 'style', score: 70, detectors: [] }, { category: 'lexicon', score: 20, detectors: [] }]} />);
    expect(screen.getAllByRole('meter')).toHaveLength(2);
    rerender(<CategoryBreakdown loading />);
    expect(screen.queryByRole('meter')).toBeNull();
    rerender(<CategoryBreakdown categories={[]} />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });
});

describe('Advice components', () => {
  const r = aiReport();
  it('AdviceCard focuses on click and shows replacements', async () => {
    const onFocus = vi.fn();
    const item = r.advice.find((a) => a.replacements.length) ?? r.advice[0]!;
    en(<AdviceCard item={item} onFocus={onFocus} active />);
    await userEvent.click(screen.getByRole('button', { name: item.title }));
    expect(onFocus).toHaveBeenCalledWith(item);
  });

  it('AdviceList filters by category and effort', async () => {
    render(<AdviceList items={r.advice} />);
    const total = screen.getAllByRole('article').length;
    expect(total).toBe(r.advice.length);
    const cat = r.advice[r.advice.length - 1]!.category;
    await userEvent.selectOptions(screen.getByLabelText('Все категории'), cat);
    expect(screen.getAllByRole('article').length).toBe(r.advice.filter((a) => a.category === cat).length);
    await userEvent.selectOptions(screen.getByLabelText('Все категории'), '');
    await userEvent.selectOptions(screen.getByLabelText('Любая сложность'), '3');
    expect(screen.queryAllByRole('article').length).toBe(r.advice.filter((a) => a.effort === 3).length);
  });

  it('AdviceList empty and loading', () => {
    const { rerender } = render(<AdviceList items={[]} />);
    expect(screen.getByText(/Советов нет/)).toBeInTheDocument();
    rerender(<AdviceList items={[]} loading />);
    expect(screen.queryByText(/Советов нет/)).toBeNull();
  });

  it('TopAdvice shows at most three and nothing when empty', () => {
    const { container, rerender } = render(<TopAdvice items={r.advice} />);
    expect(within(container).getAllByRole('article')).toHaveLength(Math.min(3, r.advice.length));
    rerender(<TopAdvice items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('MetricCorridor', () => {
  it('marks values inside/outside the corridor', () => {
    const { container, rerender } = render(<MetricCorridor metric={{ detector: 'R-01', name: 'CV', value: 0.7, corridor: [0.5, 0.9], score: 0 }} />);
    expect(container.querySelector('.corridor-mark.ok')).not.toBeNull();
    rerender(<MetricCorridor metric={{ detector: 'L-01', name: 'Markers', value: 30, corridor: [0, 2], score: 1 }} />);
    expect(container.querySelector('.corridor-mark.warn')).not.toBeNull();
    rerender(<MetricList metrics={[]} />);
    expect(screen.getByText('Нет данных')).toBeInTheDocument();
  });
});

describe('UploadDropzone', () => {
  it('handles click-select, drag-n-drop and keyboard', async () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} error="bad" />);
    const f = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByTestId('file-input'), f);
    expect(onFile).toHaveBeenCalledWith(f);
    const zone = screen.getByTestId('dropzone');
    fireEvent.dragOver(zone);
    expect(screen.getByText('Отпустите, чтобы загрузить')).toBeInTheDocument();
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [f] } });
    expect(onFile).toHaveBeenCalledTimes(2);
    zone.focus();
    fireEvent.keyDown(zone, { key: 'Enter' });
    fireEvent.click(zone);
    expect(screen.getByRole('alert')).toHaveTextContent('bad');
  });

  it('ignores drops when disabled', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} disabled />);
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [new File(['x'], 'x.txt')] } });
    expect(onFile).not.toHaveBeenCalled();
  });
});

describe('RecheckDiff, DocumentMetaTable, ImageReport', () => {
  it('RecheckDiff shows score change and lists', () => {
    const d = diff();
    render(<RecheckDiff diff={d} titles={{ [d.closed[0]!]: 'Closed one' }} />);
    expect(screen.getByText(/Закрыто/)).toBeInTheDocument();
    expect(screen.getByText(/Closed one/)).toBeInTheDocument();
  });

  it('DocumentMetaTable renders rows or empty', () => {
    const { rerender } = render(<DocumentMetaTable meta={{ format: 'docx', application: 'python-docx', styles: ['Normal'], rsids: 1, fonts: [], colors: [], htmlFragments: 0, positions: [] }} />);
    expect(screen.getByText('python-docx')).toBeInTheDocument();
    rerender(<DocumentMetaTable />);
    expect(screen.getByText('Метаданных нет')).toBeInTheDocument();
  });

  it('ImageReport renders metadata, C2PA and heatmap', () => {
    render(
      <ImageReport
        src="data:image/png;base64,"
        image={{
          meta: { format: 'png', width: 512, height: 512, exif: { Software: 'X' }, xmp: '', pngText: { parameters: 'p'.repeat(200) }, c2pa: { present: true, issuers: ['OpenAI'], aiClaim: true }, jpegQuantTables: [], jpegDqtCount: 0 },
          heatmap: [[0.1, 0.9], [0.5, 0.2]],
        }}
      />,
    );
    expect(screen.getByText('512×512')).toBeInTheDocument();
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Тепловая/ })).toBeInTheDocument();
  });
});

describe('HighlightedEditor', () => {
  it('maps offsets across lines', () => {
    const m = offsetMapper('ab\ncd\n\nef');
    expect(m(0)).toBe(1);
    expect(m(3)).toBe(4 + 1);
    expect(m(7)).toBe(1 + 7 + 3 * 2 - 3 * 1);
  });

  it('builds heat and finding highlights', () => {
    const h = buildHighlights([{ start: 0, end: 5, score: 0.9 }], [{ ...aiReport().advice[0]!, spans: [{ start: 1, end: 3, detector: 'L-01' }] }], aiReport().advice[0]!.id);
    expect(h[0]!.className).toBe('sheat sheat-4');
    expect(h[1]!.className).toContain('hl-active');
  });

  it('renders text with decorations and reports edits', async () => {
    const r = aiReport();
    const onChange = vi.fn();
    const { container, rerender } = render(<HighlightedEditor text={r.text} sentences={r.sentences} advice={r.advice} onChange={onChange} activeId={r.advice[0]!.id} />);
    expect(container.querySelector('.ProseMirror')).toHaveTextContent('В современном мире');
    expect(container.querySelectorAll('.sheat').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.hl').length).toBeGreaterThan(0);
    rerender(<HighlightedEditor text="Новый текст" sentences={[]} advice={[]} onChange={onChange} />);
    expect(container.querySelector('.ProseMirror')).toHaveTextContent('Новый текст');
    await act(async () => {
      const ed = container.querySelector('.ProseMirror') as HTMLElement;
      ed.focus();
    });
  });
});

describe('ReportPage', () => {
  it('wires toolbar actions', async () => {
    const r = aiReport();
    const h = { onRecheck: vi.fn(), onClean: vi.fn(), onExportJson: vi.fn(), onExportPdf: vi.fn(), onReset: vi.fn() };
    const withAutofix = { ...r, advice: [...r.advice, { ...r.advice[0]!, id: 'T-01.homoglyphs', autofix: true }] };
    render(<ReportPage report={withAutofix} text={r.text} diff={diff()} notice="cleaned" {...h} />);
    await userEvent.click(screen.getByRole('button', { name: 'Перепроверить' }));
    await userEvent.click(screen.getByRole('button', { name: 'Очистить символы' }));
    await userEvent.click(screen.getByRole('button', { name: 'Экспорт JSON' }));
    await userEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
    await userEvent.click(screen.getByRole('button', { name: 'Новая проверка' }));
    for (const f of Object.values(h)) expect(f).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getAllByRole('button', { name: r.advice[0]!.title })[0]!);
    expect(screen.getByRole('status')).toHaveTextContent('cleaned');
  });

  it('renders image and document variants', () => {
    const r = aiReport();
    const { rerender } = render(<ReportPage report={{ ...r, kind: 'image', image: { meta: { format: 'png', width: 1, height: 1, exif: {}, xmp: '', pngText: {}, c2pa: { present: false, issuers: [], aiClaim: false }, jpegQuantTables: [], jpegDqtCount: 0 } } }} text="" />);
    expect(screen.queryByRole('button', { name: 'Перепроверить' })).toBeNull();
    rerender(<ReportPage report={{ ...r, kind: 'document', document: { format: 'pdf', styles: [], rsids: 0, fonts: [], colors: [], htmlFragments: 0, positions: [], creator: 'ReportLab' } }} text={r.text} loading />);
    expect(screen.getByText('ReportLab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Анализ…' })).toBeDisabled();
  });
});
