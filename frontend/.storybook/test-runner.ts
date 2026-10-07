import type { TestRunnerConfig } from '@storybook/test-runner';
import { checkA11y, injectAxe } from 'axe-playwright';

/** Runs axe on every story; a11y violations fail the run. */
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page) {
    // The a11y addon may still be running its own axe pass in the preview; retry until it finishes.
    for (let attempt = 0; ; attempt++) {
      try {
        await checkA11y(page, '#storybook-root', { detailedReport: true, detailedReportOptions: { html: true } });
        return;
      } catch (e) {
        if (attempt > 10 || !String(e).includes('Axe is already running')) throw e;
        await page.waitForTimeout(200);
      }
    }
  },
};
export default config;
