import type { Report } from '../core/types';

/** Serialises a report for download (pixels are omitted). */
export function reportJson(r: Report): string {
  const image = r.image ? { ...r.image, pixels: undefined } : undefined;
  return JSON.stringify({ ...r, image, generatedAt: new Date().toISOString() }, null, 2);
}

export function download(name: string, content: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PDF export uses the browser's print-to-PDF with a print stylesheet (no server, full Cyrillic support). */
export function exportPdf(): void {
  window.print();
}
