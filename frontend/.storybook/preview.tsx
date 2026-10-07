import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview } from '@storybook/react';
import { DICTS, I18nContext } from '../src/ui/i18n';
import '../src/ui/styles.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    viewport: {
      viewports: {
        mobile: { name: 'Mobile 360', styles: { width: '360px', height: '740px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
      },
    },
    backgrounds: { disable: true },
  },
  globalTypes: {
    uiLang: { description: 'UI language', toolbar: { title: 'Lang', items: ['ru', 'en'] } },
  },
  initialGlobals: { uiLang: 'ru' },
  decorators: [
    withThemeByDataAttribute({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'light', attributeName: 'data-theme' }),
    (Story, ctx) => (
      <I18nContext.Provider value={DICTS[(ctx.globals.uiLang as 'ru' | 'en') ?? 'ru']}>
        <div style={{ background: 'var(--bg)', color: 'var(--text)', padding: 12 }}>
          <Story />
        </div>
      </I18nContext.Provider>
    ),
  ],
};
export default preview;
