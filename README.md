# AI-Finder

Проверяет текст, документы, изображения и код на признаки генерации нейросетью и подсказывает, что поправить руками.
Без LLM и без сервера: все детекторы — эвристики и классическая статистика, весь анализ идёт в браузере. Файлы никуда не отправляются.

**Прод:** https://d5dfu10517n03l076cfs.764nr5vy.apigw.yandexcloud.net

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
- `infra/` — спецификация API Gateway и скрипт первичной настройки облака.

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
