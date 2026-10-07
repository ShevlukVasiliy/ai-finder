import { DETECTORS as CODE } from './detectors/code';
import { DETECTORS as DOC } from './detectors/document';
import { DETECTORS as IMAGE } from './detectors/image';
import { DETECTORS as LEXICAL } from './detectors/lexical';
import { DETECTORS as RHYTHM } from './detectors/rhythm';
import { DETECTORS as STATS } from './detectors/stats';
import { DETECTORS as STRUCTURE } from './detectors/structure';
import { DETECTORS as TYPO } from './detectors/typography';
import type { CodeCtx } from './detectors/code';
import type { DocContext } from './detectors/document';
import type { ImageContext } from './detectors/image';
import type { Detector, TextContext } from './types';

/** Plugin registry: detectors are grouped by the context they consume. */
export interface Registry {
  text: Detector<TextContext>[];
  document: Detector<DocContext>[];
  image: Detector<ImageContext>[];
  code: Detector<CodeCtx>[];
}

const registry: Registry = {
  text: [...TYPO, ...RHYTHM, ...LEXICAL, ...STRUCTURE, ...STATS],
  document: [...DOC],
  image: [...IMAGE],
  code: [...CODE],
};

export function getRegistry(): Registry {
  return registry;
}

/** Registers an extra detector (third-party plugin). Replaces a detector with the same id. */
export function registerDetector<K extends keyof Registry>(kind: K, det: Registry[K][number]): void {
  const list = registry[kind] as Detector<unknown>[];
  const i = list.findIndex((d) => d.id === det.id);
  if (i >= 0) list[i] = det as Detector<unknown>;
  else list.push(det as Detector<unknown>);
}

export function unregisterDetector(kind: keyof Registry, id: string): void {
  const list = registry[kind] as Detector<unknown>[];
  const i = list.findIndex((d) => d.id === id);
  if (i >= 0) list.splice(i, 1);
}
