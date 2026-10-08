import { expect, test } from '@playwright/test';

/** Post-deploy smoke test against the public API Gateway URL (E2E_BASE_URL). */
test('prod: app loads through the gateway and analyses text', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox').first().fill(
    'В современном мире технологии играют ключевую роль в жизни каждого человека. Важно отметить, что цифровизация открывает новые возможности. Таким образом, технологии являются неотъемлемой частью общества. В заключение можно сказать, что их грамотное использование открывает широкий спектр возможностей для развития бизнеса и общества.',
  );
  await page.locator('button.primary').first().click();
  await expect(page.locator('.gauge-num')).toBeVisible();
  // SPA fallback: unknown paths still render the app.
  await page.goto('/some/unknown/path');
  await expect(page.locator('.logo')).toBeVisible();
});
