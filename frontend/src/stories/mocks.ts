import { analyze, diffReports } from '../core/analyze';
import type { AdviceItem, Metric, ParsedImage, Report } from '../core/types';
import enAi from '../../tests/quality/corpus/en-ai.txt?raw';
import ruAi from '../../tests/quality/corpus/ru-ai.txt?raw';
import ruHuman from '../../tests/quality/corpus/ru-human.txt?raw';

const first = (s: string, i = 0) => s.split(/^===\s*$/m)[i]!.trim();

export const aiReport: Report = analyze({ kind: 'text', text: first(ruAi, 2) });
export const humanReport: Report = analyze({ kind: 'text', text: first(ruHuman) });
export const enReport: Report = analyze({ kind: 'text', text: first(enAi), uiLang: 'en' });
export const longReport: Report = analyze({ kind: 'text', text: ruAi.split(/^===\s*$/m).slice(0, 8).join('\n\n') });
export const recheckDiff = diffReports(aiReport, humanReport);

export const advice: AdviceItem[] = aiReport.advice;
export const longAdvice: AdviceItem[] = [...longReport.advice, ...enReport.advice.map((a) => ({ ...a, id: `${a.id}-en` }))];
export const metrics: Metric[] = aiReport.metrics;

export const imageMock: ParsedImage = {
  meta: {
    format: 'png',
    width: 1024,
    height: 1024,
    exif: { Software: 'ComfyUI' },
    xmp: '',
    pngText: { parameters: 'a cat in space, highly detailed\nSteps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 1234567, Size: 1024x1024, Model: sdxl' },
    c2pa: { present: true, issuers: ['OpenAI'], aiClaim: true },
    jpegQuantTables: [],
    jpegDqtCount: 0,
  },
  heatmap: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => ((x * y) % 7) / 7)),
};

export const imageSrc =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='g' x1='0' x2='1'><stop offset='0' stop-color='%236366f1'/><stop offset='1' stop-color='%23f472b6'/></linearGradient></defs><rect width='400' height='300' fill='url(%23g)'/><circle cx='200' cy='150' r='70' fill='white' opacity='.6'/></svg>";
