/**
 * Builds the compact character-trigram models used by P-01.
 * Training text: plain-text extracts of random Wikipedia articles (CC BY-SA), fetched once at build time.
 * Run: pnpm --dir frontend exec tsx ../scripts/train_ngram.ts [articlesPerLang]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trainModel } from '../frontend/src/core/ngram';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = Number(process.argv[2] ?? 400);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchExtracts(lang: 'ru' | 'en', n: number): Promise<string[]> {
  const out: string[] = [];
  while (out.length < n) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=random&grnnamespace=0&grnlimit=20&prop=extracts&explaintext=1&exlimit=20&exchars=4000`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ai-finder-model-builder/0.1 (https://github.com/ShevlukVasiliy/ai-finder)' } });
    if (res.status === 429 || res.status >= 500) {
      await sleep(5000);
      continue;
    }
    if (!res.ok) throw new Error(`${lang}: HTTP ${res.status}`);
    await sleep(1200);
    const json = (await res.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
    for (const p of Object.values(json.query?.pages ?? {})) {
      const t = (p.extract ?? '').replace(/==+[^=]+==+/g, ' ');
      if (t.length > 500) out.push(t);
    }
    process.stdout.write(`\r${lang}: ${out.length}/${n}`);
  }
  process.stdout.write('\n');
  return out.slice(0, n);
}

for (const lang of ['ru', 'en'] as const) {
  const texts = await fetchExtracts(lang, N);
  const model = trainModel(texts, 3, 3);
  const file = join(root, 'rules', 'models', `ngram-${lang}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(model));
  console.log(`${lang}: ${Object.keys(model.grams).length} trigrams → ${file}`);
}
