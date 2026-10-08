import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixtures = join(__dirname, '..', 'tests', 'fixtures');
const corpus = (f: string, i = 0) => readFileSync(join(__dirname, '..', 'tests', 'quality', 'corpus', f), 'utf8').split(/^===\s*$/m)[i]!.trim();

const score = async (page: Page) => Number(await page.locator('.gauge-num').first().textContent());

async function editAndRecheck(page: Page, text: string) {
  const before = await score(page);
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await editor.fill(text);
  await page.getByRole('button', { name: 'Перепроверить' }).click();
  await expect(page.getByText('Изменения после перепроверки')).toBeVisible();
  await expect.poll(() => score(page)).not.toBe(before);
  return { before, after: await score(page) };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'ru-RU' }));
  await page.goto('/');
});

test('text: paste → report → edit → recheck → score drops', async ({ page }) => {
  await page.getByLabel(/Вставьте текст/).fill(corpus('ru-ai.txt'));
  await page.getByRole('button', { name: 'Проверить' }).click();
  await expect(page.getByText('Похоже на ИИ')).toBeVisible();
  await expect(page.locator('.hl').first()).toBeVisible();
  const { before, after } = await editAndRecheck(page, corpus('ru-human.txt'));
  expect(after).toBeLessThan(before);
});

test('document: upload DOCX → report with metadata → edit → recheck', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles(join(fixtures, 'ai.docx'));
  await expect(page.getByRole('heading', { name: 'Метаданные документа' })).toBeVisible();
  await expect(page.getByText('python-docx').first()).toBeVisible();
  await editAndRecheck(page, corpus('ru-human.txt', 2));
});

test('document: PDF text layer is extracted', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles(join(fixtures, 'sample.pdf'));
  await expect(page.getByText(/ReportLab/).first()).toBeVisible();
  await expect(page.locator('.ProseMirror')).toContainText('fast-paced world');
});

test('image: upload PNG with SD parameters → report → cleaned image scores lower', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles(join(fixtures, 'sd.png'));
  await expect(page.getByRole('heading', { name: 'Изображение', exact: true })).toBeVisible();
  await expect(page.getByText('Метаданные указывают на генератор').first()).toBeVisible();
  await expect(page.getByText('Для изображений достоверность ниже')).toBeVisible();
  const before = await score(page);
  await page.getByRole('button', { name: 'Новая проверка' }).click();
  await page.getByTestId('file-input').setInputFiles(join(fixtures, 'plain.png'));
  await expect(page.getByRole('heading', { name: 'Изображение', exact: true })).toBeVisible();
  await expect.poll(() => score(page)).toBeLessThan(before);
});

test('code: upload .py → report → remove chat markers → recheck', async ({ page }) => {
  await page.getByTestId('file-input').setInputFiles(join(fixtures, 'ai.py'));
  await expect(page.getByText('Остатки ответа чат-бота').first()).toBeVisible();
  const { before, after } = await editAndRecheck(page, readFileSync(join(fixtures, 'human.py'), 'utf8'));
  expect(after).toBeLessThan(before);
});

test('theme toggle and disclaimer', async ({ page }) => {
  await page.getByRole('button', { name: /Тёмная|Светлая/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);
  await expect(page.getByText(/ложные срабатывания возможны/)).toBeVisible();
});
