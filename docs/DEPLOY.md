# Деплой

Сайт статический и публикуется в **GitHub Pages**: https://shevlukvasiliy.github.io/ai-finder/

## Пайплайн

1. `ci.yml` (PR и push): lint, typecheck, unit/UI/quality-тесты с порогами покрытия, e2e Playwright.
2. `deploy.yml` (после зелёного CI на `main` или вручную):
   - сборка с `VITE_BASE=/<repo>/`, копия `index.html` → `404.html` (SPA fallback), `release.txt` с SHA;
   - публикация через `actions/deploy-pages`;
   - smoke-тест: ждёт, пока `release.txt` отдаст новый SHA, затем Playwright проверяет анализ текста и fallback.

Секреты не нужны. Pages включён в настройках репозитория с источником «GitHub Actions».

Отката в Pages нет: если smoke-тест упал, предыдущую версию можно вернуть ручным запуском `deploy.yml` на нужном коммите (Actions → Deploy → Run workflow, выбрать ветку или тег).

## Локальная сборка под Pages

```bash
cd frontend && VITE_BASE=/ai-finder/ pnpm build && pnpm preview
```
