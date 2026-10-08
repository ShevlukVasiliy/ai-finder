# Деплой

Облако `general` (`b1gfv73ub30tb6ai49ut`), каталог `default` (`b1g73boid8ttjagnuj8g`).

```
браузер → API Gateway (ai-finder) → Object Storage (приватный бакет ai-finder-site-b1g73b)
```

- Бакет приватный. Читает его только сервисный аккаунт шлюза `ai-finder-gateway` (ACL READ).
- Пишет в бакет только `ai-finder-deployer` (ACL FULL_CONTROL на этот бакет, ролей на каталог нет).
- Шлюз: `/` → `index.html`, `/{path+}` → объект, а если его нет — `index.html` (SPA fallback). Спецификация: `infra/apigw.yaml`.
- Terraform не используется: инфраструктуры три ресурса, они создаются один раз скриптом `infra/setup.sh`.

## Первичная настройка

```bash
YC_FOLDER_ID=b1g73boid8ttjagnuj8g BUCKET=ai-finder-site-b1g73b ./infra/setup.sh
yc iam access-key create --service-account-id <id ai-finder-deployer> --format json
```

В GitHub → Settings → Secrets and variables → Actions:

| Тип | Имя | Значение |
|---|---|---|
| secret | `YC_S3_ACCESS_KEY_ID` | `access_key.key_id` статического ключа деплоера |
| secret | `YC_S3_SECRET_ACCESS_KEY` | `secret` статического ключа |
| variable | `SITE_BUCKET` | `ai-finder-site-b1g73b` |
| variable | `SITE_URL` | `https://d5dfu10517n03l076cfs.764nr5vy.apigw.yandexcloud.net` |

Environment `production` создаётся автоматически при первом деплое; при желании включите в нём required reviewers.

Workload Identity Federation не нужна: деплою достаточно S3-ключа с правами на один бакет, IAM-токены облака в CI не используются.

## Пайплайн

1. `ci.yml` (PR и push): lint, typecheck, unit/UI/quality-тесты с порогами покрытия, e2e Playwright.
2. `deploy.yml` (после зелёного CI на `main`):
   - сборка;
   - снимок релиза в `releases/<sha>/`;
   - публикация: сначала ассеты с долгим кэшем, потом HTML;
   - smoke-тест по URL шлюза: HTTP 200 для `/`, ассетов и `release.txt`, затем Playwright проверяет анализ текста и SPA fallback;
   - если smoke-тест упал, из `releases/<предыдущий sha>/` восстанавливается прошлая сборка. Старые снимки удаляются lifecycle-правилом через 30 дней (опционально).

## Ручной деплой

```bash
cd frontend && pnpm build
AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… aws --endpoint-url https://storage.yandexcloud.net s3 sync dist s3://ai-finder-site-b1g73b/ --delete
```
