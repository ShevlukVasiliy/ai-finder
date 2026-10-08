import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BASIS_DOC_URL, Footer, REPO_URL, SOURCES } from '../../src/ui/components/Footer';
import { DICTS, I18nContext } from '../../src/ui/i18n';

const renderEn = () => render(<I18nContext.Provider value={DICTS.en}><Footer /></I18nContext.Provider>);

describe('Footer', () => {
  it('shows privacy note and GitHub link', () => {
    render(<Footer />);
    expect(screen.getByText(/Анализ в браузере/)).toBeInTheDocument();
    const gh = screen.getByRole('link', { name: 'Исходный код на GitHub' });
    expect(gh).toHaveAttribute('href', REPO_URL);
    expect(gh).toHaveAttribute('rel', 'noreferrer');
  });

  it('opens the methodology dialog with external sources and the full document link', async () => {
    renderEn();
    const trigger = screen.getByRole('button', { name: 'Methodology' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Methodology & Scientific Basis' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(DICTS.en.footer.principles).toHaveLength(SOURCES.length);
    for (const s of SOURCES.flat()) {
      const a = screen.getByRole('link', { name: s.label });
      expect(a).toHaveAttribute('href', s.url);
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noreferrer');
    }
    expect(screen.getByRole('link', { name: /SCIENTIFIC_BASIS/ })).toHaveAttribute('href', BASIS_DOC_URL);
  });

  it('closes by Escape and returns focus to the trigger', async () => {
    renderEn();
    const trigger = screen.getByRole('button', { name: 'Methodology' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes by the close button and by clicking outside, but not by clicking inside', async () => {
    renderEn();
    await userEvent.click(screen.getByRole('button', { name: 'Methodology' }));
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Methodology' }));
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('every principle has RU and EN text', () => {
    expect(DICTS.ru.footer.principles.map((p) => p.title)).toHaveLength(5);
    expect(DICTS.ru.footer.principles[0]!.title).not.toBe(DICTS.en.footer.principles[0]!.title);
  });
});
