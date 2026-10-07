import type { Report } from './types';

export interface Version {
  id: number;
  at: number;
  text: string;
  score: number;
  report: Report;
}

const KEY = 'ai-finder:history';
const MAX = 20;

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Reports are stored without pixel buffers to stay within storage quotas. */
function slim(r: Report): Report {
  if (!r.image?.pixels) return r;
  return { ...r, image: { ...r.image, pixels: undefined } };
}

export function loadHistory(): Version[] {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Version[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(versions: Version[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(versions.slice(-MAX).map((v) => ({ ...v, report: slim(v.report) }))));
  } catch {
    // Quota exceeded or storage disabled: history stays in memory only.
  }
}

export function addVersion(versions: Version[], report: Report): Version[] {
  const id = (versions[versions.length - 1]?.id ?? 0) + 1;
  return [...versions, { id, at: Date.now(), text: report.text, score: report.score, report }].slice(-MAX);
}

export function clearHistory(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
