# AI-Finder

Проверяет текст, документы, изображения и код на признаки генерации нейросетью и подсказывает, что поправить руками.
Без LLM и без сервера: все детекторы — эвристики и классическая статистика, весь анализ идёт в браузере. Файлы никуда не отправляются.

**Прод:** https://shevlukvasiliy.github.io/ai-finder/

## Запуск локально

```bash
pnpm install
pnpm dev
```

Откроется http://localhost:5173.

## Что внутри

- `frontend/src/core` — движок: сегментация, детекторы T/R/L/S/P (текст), D (документы), I (изображения), C (код), логистическая комбинация, советы, нормализация символов.
- `frontend/src/ui` — интерфейс в духе Hemingway Editor: текст с цветной подсветкой по типам находок, справа оценка и список «что поправить».
- `rules/` — словари, пороги, советы (RU/EN), веса модели и компактные n-граммные модели. Правятся без изменения кода.
- `frontend/tests` — unit-, property- и UI-тесты, регрессия качества на размеченном корпусе. `frontend/e2e` — Playwright.

## Команды (в `frontend/`)

| Команда | Что делает |
|---|---|
| `pnpm test:cov` | unit + UI + quality с порогами покрытия |
| `pnpm e2e` | e2e на собранной статике (десктоп и 360 px) |
| `pnpm lint`, `pnpm typecheck` | ESLint, TypeScript strict |
| `pnpm calibrate` | переобучить веса логистической модели на корпусе → `rules/weights.yaml` |
| `pnpm fixtures` | пересоздать файлы-фикстуры (DOCX, ODT, RTF, PDF, PNG, JPEG, WebP, код) |
| `pnpm train` | переобучить n-граммные модели по выдержкам из Википедии |

См. также [docs/DEPLOY.md](docs/DEPLOY.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/PROGRESS.md](docs/PROGRESS.md).

## Данные и лицензии

Код распространяется под лицензией MIT (см. `LICENSE`).

В `frontend/tests/quality/external/test.jsonl.gz` лежит выборка из открытых датасетов. Они используются только для калибровки и тестов, лицензии исходных наборов сохраняются:

| Датасет | Лицензия |
|---|---|
| [WUJUNCHAO/DetectRL-X](https://huggingface.co/datasets/WUJUNCHAO/DetectRL-X) | MIT |
| [iis-research-team/AINL-Eval-2025](https://huggingface.co/datasets/iis-research-team/AINL-Eval-2025) | Apache-2.0 |
| [artnitolog/llm-generated-texts](https://huggingface.co/datasets/artnitolog/llm-generated-texts) | см. карточку датасета |
| [rasbt/human-vs-ai-50k](https://huggingface.co/datasets/rasbt/human-vs-ai-50k) | лицензии источников указаны построчно (`source_license`) |
| [Jinyan1/COLING_2025_MGT_multingual](https://huggingface.co/datasets/Jinyan1/COLING_2025_MGT_multingual) | см. карточку датасета (M4, MAGE, RuATD) |

N-граммные модели в `rules/models/` обучены на выдержках из Википедии (CC BY-SA 4.0).
