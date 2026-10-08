export type Lang = 'ru' | 'en';
export type LangSetting = Lang | 'auto';
export type ContentKind = 'text' | 'document' | 'image' | 'code';
export type Category =
  | 'typography'
  | 'style'
  | 'lexicon'
  | 'structure'
  | 'stats'
  | 'metadata'
  | 'image'
  | 'code';

export const CATEGORIES: Category[] = [
  'style',
  'lexicon',
  'structure',
  'typography',
  'stats',
  'metadata',
  'image',
  'code',
];

export type Params = Record<string, string | number>;

/** Character range inside the analysed text. */
export interface Span {
  start: number;
  end: number;
  detector: string;
  label?: string;
}

export interface Finding {
  detector: string;
  /** Advice rule id, e.g. "R-01.low_burstiness". */
  rule: string;
  score: number;
  spans: Span[];
  params: Params;
}

export interface DetectorResult {
  id: string;
  category: Category;
  /** Normalised AI-likeness in [0, 1]. */
  score: number;
  /** False when the input is unsuitable (too short, wrong language…). */
  applicable: boolean;
  /** Main metric value (see rules/detectors.yaml). */
  value: number;
  findings: Finding[];
}

export interface Sentence {
  start: number;
  end: number;
  text: string;
  words: string[];
  paragraph: number;
}

export interface Paragraph {
  start: number;
  end: number;
  text: string;
  sentences: number[];
  /** True for headings / list items. */
  kind: 'text' | 'heading' | 'list';
}

export interface TextContext {
  text: string;
  lang: Lang;
  /** Ratio of letters in the minority script. */
  mixedShare: number;
  sentences: Sentence[];
  paragraphs: Paragraph[];
  words: { start: number; end: number; lower: string }[];
  isMarkdown: boolean;
  /** Language for human-readable notes (UI language); defaults to `lang`. */
  uiLang?: Lang;
}

export interface DocumentMeta {
  format: 'docx' | 'pdf' | 'txt' | 'md' | 'odt' | 'rtf';
  author?: string;
  creator?: string;
  producer?: string;
  application?: string;
  created?: string;
  modified?: string;
  totalTimeMin?: number;
  revisions?: number;
  /** Paragraph styles used. */
  styles: string[];
  /** Distinct w:rsidR values (docx). */
  rsids: number;
  fonts: string[];
  colors: string[];
  htmlFragments: number;
  /** Mapping from text offsets to document position. */
  positions: { start: number; end: number; page: number; paragraph: number }[];
}

export interface ParsedDocument {
  text: string;
  meta: DocumentMeta;
}

export interface PixelData {
  width: number;
  height: number;
  /** RGBA, length = width * height * 4. */
  data: Uint8ClampedArray | Uint8Array;
}

export interface ImageMeta {
  format: 'jpeg' | 'png' | 'webp' | 'unknown';
  width: number;
  height: number;
  exif: Record<string, string>;
  xmp: string;
  pngText: Record<string, string>;
  c2pa: { present: boolean; issuers: string[]; aiClaim: boolean };
  jpegQuantTables: number[][];
  jpegDqtCount: number;
}

export interface ParsedImage {
  meta: ImageMeta;
  pixels?: PixelData;
  /** Per-block artefact heat (rows of values in [0,1]). */
  heatmap?: number[][];
}

export interface CodeContext {
  code: string;
  language: string;
  lines: string[];
}

export interface AnalysisInput {
  kind: ContentKind;
  text?: string;
  document?: ParsedDocument;
  image?: ParsedImage;
  code?: CodeContext;
  lang?: LangSetting;
  /** Language for advice and explanations (defaults to the content language). */
  uiLang?: Lang;
}

export interface AdviceItem {
  id: string;
  detectors: string[];
  category: Category;
  severity: 'high' | 'medium' | 'low';
  title: string;
  explain: string;
  actions: string[];
  effort: number;
  expectedGain: number;
  priority: number;
  spans: Span[];
  replacements: { phrase: string; options: string[] }[];
  autofix: boolean;
}

export interface CategoryScore {
  category: Category;
  score: number;
  detectors: string[];
}

export interface Metric {
  detector: string;
  name: string;
  value: number;
  corridor: [number, number];
  score: number;
}

export interface SentenceScore {
  start: number;
  end: number;
  score: number;
}

export interface Report {
  kind: ContentKind;
  lang: Lang;
  score: number;
  verdict: 'human' | 'mixed' | 'ai';
  confidence: { level: 'low' | 'medium' | 'high'; value: number; reasons: string[] };
  categories: CategoryScore[];
  results: DetectorResult[];
  findings: Finding[];
  advice: AdviceItem[];
  metrics: Metric[];
  sentences: SentenceScore[];
  text: string;
  document?: DocumentMeta;
  image?: ParsedImage;
  warnings: string[];
}

export interface ReportDiff {
  scoreBefore: number;
  scoreAfter: number;
  closed: string[];
  opened: string[];
  remaining: string[];
  metrics: { detector: string; name: string; before: number; after: number }[];
}

export interface Detector<C> {
  id: string;
  analyze(ctx: C): DetectorResult;
}
