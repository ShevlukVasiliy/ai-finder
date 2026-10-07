import '@testing-library/jest-dom/vitest';

// jsdom lacks layout APIs used by ProseMirror.
const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) });
const rects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
for (const proto of [Range.prototype, Element.prototype, Text.prototype as unknown as Element]) {
  const p = proto as unknown as Record<string, unknown>;
  if (typeof p.getClientRects !== 'function') p.getClientRects = rects;
  if (typeof p.getBoundingClientRect !== 'function') p.getBoundingClientRect = rect;
}
if (!document.elementFromPoint) document.elementFromPoint = () => null;
