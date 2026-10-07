# Прогресс

## Сделано
- Решение: только клиент (SPA), без бэкенда и Docker. TZ.md и prompt.md обновлены.
- Каркас фронтенда: Vite + React + TS, Vitest, Playwright, Storybook 8, ESLint.
- `rules/*.yaml`: детекторы, советы RU/EN (на каждый детектор), маркеры L-01, лексикон, веса.
- Ядро `frontend/src/core`: сегментация, детекторы T/R/L/S/P/D/I/C, скоринг (логистика), достоверность,
  движок советов (контрфактический gain, комбо, замены), нормализация T-01/T-02, analyze/recheck/diff,
  парсеры DOCX/ODT/RTF/TXT/MD/PDF и JPEG/PNG/WebP, сессия (sessionStorage), n-граммная модель.
- Корпус для регрессии качества (RU/EN, люди/ИИ), скрипты calibrate / make_fixtures / train_ngram, фикстуры.

## Осталось
- Починить парсинг YAML в тестах (падает rules.test.ts на `yaml.load` при загрузке модуля), дописать тесты на все детекторы, property-тесты, парсеры, quality-тест.
- Модель EN (train_ngram шёл в фоне), затем `pnpm calibrate`.
- UI-компоненты и Storybook, e2e.
- Terraform (бакет + SA), CI/deploy workflows, docs (README, DEPLOY, DECISIONS), репозиторий на GitHub и деплой в YC general/default.
