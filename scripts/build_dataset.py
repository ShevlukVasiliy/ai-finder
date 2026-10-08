"""
Builds the calibration dataset (~20k texts, RU + EN, human vs. modern LLMs) from public sources.

Run:  uv run --with pandas --with pyarrow --with ijson scripts/build_dataset.py <download_dir>
Downloads (see docs/DECISIONS.md for licences):
  WUJUNCHAO/DetectRL-X            Binary/binary_general_open.json   (MIT; GPT-4o, Gemini-2.5-Flash, DeepSeek-V3, Qwen-Max)
  iis-research-team/AINL-Eval-2025 train.csv                        (Apache-2.0; RU scientific abstracts)
  artnitolog/llm-generated-texts   parquet                          (GPT-4o, Claude 3 Opus, YandexGPT, GigaChat, Llama-3, Command R+)
  rasbt/human-vs-ai-50k            parquet train
  Jinyan1/COLING_2025_MGT_multingual parquet dev                    (RuATD/M4/MAGE)
Output: frontend/tests/quality/external/{train,test}.jsonl.gz — each line {lang, ai, model, source, text}.
The test split (20 %) is committed; the train split is only needed for scripts/calibrate.ts.
"""

import gzip
import json
import random
import sys
from pathlib import Path

import ijson
import pandas as pd

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'frontend' / 'tests' / 'quality' / 'external'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(42)
MIN, MAX = 400, 4000
rows: list[dict] = []


def ok(t) -> bool:
    return isinstance(t, str) and MIN <= len(t) <= MAX


def add(lang, ai, model, source, text):
    if ok(text):
        rows.append({'lang': lang, 'ai': bool(ai), 'model': str(model), 'source': source, 'text': text.strip()})


def cap(items, n):
    rng.shuffle(items)
    return items[:n]


# 1. DetectRL-X: paired human / LLM texts; take RU and EN, balanced over model x domain.
per_cell = {}
with open(SRC / 'detectrl_general.json', 'rb') as f:
    for r in ijson.items(f, 'item'):
        lang = {'russian': 'ru', 'english': 'en'}.get(r.get('lang'))
        if not lang:
            continue
        per_cell.setdefault((lang, r['model'], r.get('domain')), []).append(r)
for (lang, model, domain), items in per_cell.items():
    for r in cap(items, 160):  # 4 models x 6 domains x 160 pairs per language (fewer where cells are smaller)
        add(lang, False, 'human', f'detectrl-x/{domain}', r['human_written_text'])
        add(lang, True, model, f'detectrl-x/{domain}', r['llm_generated_text'])
print('after DetectRL-X', len(rows))

# 2. AINL-Eval-2025: RU scientific abstracts.
ainl = pd.read_csv(SRC / 'ainl_train.csv')
h = ainl[ainl.label.str.lower() == 'human']
a = ainl[ainl.label.str.lower() != 'human']
for r in h.sample(n=min(1000, len(h)), random_state=42).itertuples():
    add('ru', False, 'human', 'ainl-2025/abstracts', r.text)
a = a.groupby('label').head(250).sample(frac=1, random_state=42).head(1000)
for r in a.itertuples():
    add('ru', True, r.label, 'ainl-2025/abstracts', r.text)
print('after AINL', len(rows))

# 3. artnitolog: same prompt answered by a human and several commercial models.
art = pd.read_parquet(SRC / 'artnitolog.parquet')
models = [c for c in art.columns if c not in ('dataset_name', 'id', 'prompt', 'human')]
for r in art.sample(n=min(1500, len(art)), random_state=42).to_dict('records'):
    add('en', False, 'human', f"artnitolog/{r['dataset_name']}", r['human'])
    m = rng.choice(models)
    add('en', True, m, f"artnitolog/{r['dataset_name']}", r[m])
print('after artnitolog', len(rows))

# 4. rasbt human-vs-ai-50k.
ra = pd.read_parquet(SRC / 'rasbt_train.parquet')
ra['label'] = ra.label.astype(int)
for lbl, n in ((0, 2000), (1, 2000)):
    for r in ra[ra.label == lbl].sample(n=n, random_state=42).to_dict('records'):
        add('en', lbl == 1, r.get('generator_model') or 'human', f"rasbt/{r.get('text_collection')}", r['text'])
print('after rasbt', len(rows))

# 5. COLING-2025 MGT (older generators, broader domains).
co = pd.read_parquet(SRC / 'coling_dev.parquet', columns=['lang', 'label', 'model', 'source', 'sub_source', 'text'])
co['label'] = co.label.astype(int)
ru = co[co.lang == 'ru']
for r in ru.to_dict('records'):
    add('ru', r['label'] == 1, r['model'], f"coling/{r['sub_source']}", r['text'])
en = co[(co.lang == 'en')].sample(frac=1, random_state=42)
for lbl in (0, 1):
    for r in en[en.label == lbl].groupby('sub_source').head(60).head(1200).to_dict('records'):
        add('en', lbl == 1, r['model'], f"coling/{r['sub_source']}", r['text'])
print('after COLING', len(rows))

# De-duplicate and split 80/20 stratified by (lang, ai, source family).
seen, uniq = set(), []
for r in rows:
    k = r['text'][:200]
    if k not in seen:
        seen.add(k)
        uniq.append(r)
rng.shuffle(uniq)
train, test = [], []
counts: dict = {}
for r in uniq:
    key = (r['lang'], r['ai'], r['source'].split('/')[0])
    counts[key] = counts.get(key, 0) + 1
    (test if counts[key] % 5 == 0 else train).append(r)
for name, data in (('train', train), ('test', test)):
    with gzip.open(OUT / f'{name}.jsonl.gz', 'wt', encoding='utf-8') as f:
        for r in data:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')
df = pd.DataFrame(uniq)
print(df.groupby(['lang', 'ai']).size())
print(df[df.ai].groupby(['lang', 'model']).size().sort_values(ascending=False).head(30))
print('train', len(train), 'test', len(test))
