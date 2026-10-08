import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/ui/App';
import { download, exportPdf, reportJson } from '../../src/ui/export';
import { useAnalysis, withText } from '../../src/ui/hooks/useAnalysis';
import { useTheme } from '../../src/ui/hooks/useTheme';
import { sample } from '../core/helpers';
import { aiReport } from './fixtures';

const fx = (n: string) => readFileSync(join(__dirname, '..', 'fixtures', n));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  Object.defineProperty(navigator, 'language', { value: 'ru-RU', configurable: true });
});

async function analyzePasted(text: string) {
  render(<App />);
  fireEvent.change(screen.getByLabelText(/Вставьте текст/), { target: { value: text } });
  await userEvent.click(screen.getByRole('button', { name: 'Проверить' }));
  await screen.findByRole('button', { name: 'Перепроверить' });
}

describe('App user flows', () => {
  it('paste text → report → recheck shows diff', async () => {
    await analyzePasted(sample('ru', true, 0));
    expect(screen.getByText('Похоже на ИИ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Перепроверить' }));
    expect(await screen.findByText('Изменения после перепроверки')).toBeInTheDocument();
  });

  it('clean characters fixes homoglyphs', async () => {
    await analyzePasted(`${sample('ru', true, 1)} Тeкст с пoдменой.`);
    await userEvent.click(screen.getByRole('button', { name: 'Очистить символы' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Заменено символов: [1-9]/);
  });

  it('upload a file and drag-n-drop', async () => {
    render(<App />);
    const docx = new File([fx('ai.docx')], 'ai.docx');
    await userEvent.upload(screen.getByTestId('file-input'), docx);
    expect((await screen.findAllByText('Метаданные документа')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Новая проверка' }));
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [new File([fx('ai.py')], 'ai.py')] } });
    expect((await screen.findAllByText('Остатки ответа чат-бота')).length).toBeGreaterThan(0);
  });

  it('shows errors for unsupported files', async () => {
    render(<App />);
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [new File(['x'], 'x.exe')] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('не поддерживается');
  });

  it('theme toggle, UI language and content language switch', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Тёмная' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await userEvent.selectOptions(screen.getByLabelText('Язык текста'), 'en');
    await userEvent.click(screen.getByRole('button', { name: 'Язык интерфейса' }));
    expect(screen.getByRole('button', { name: 'Analyse' })).toBeDisabled();
  });

  it('export JSON and PDF', async () => {
    const create = vi.fn(() => 'blob:x');
    URL.createObjectURL = create;
    URL.revokeObjectURL = vi.fn();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await analyzePasted(sample('en', true, 0));
    await userEvent.click(screen.getByRole('button', { name: 'Экспорт JSON' }));
    expect(create).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Экспорт PDF' }));
    expect(print).toHaveBeenCalled();
  });
});

describe('hooks and helpers', () => {
  it('useTheme persists and toggles', () => {
    const { result } = renderHook(() => useTheme());
    const first = result.current.theme;
    act(() => result.current.toggle());
    expect(result.current.theme).not.toBe(first);
    expect(localStorage.getItem('ai-finder:theme')).toBe(result.current.theme);
  });

  it('useAnalysis: error, text edit, clean, reset', async () => {
    const { result } = renderHook(() => useAnalysis('auto'));
    await act(() => result.current.analyzeText('   '));
    expect(result.current.state.status).toBe('error');
    expect(result.current.state.error).toBe('empty');
    await act(() => result.current.analyzeText(sample('en', true, 0)));
    expect(result.current.state.status).toBe('ready');
    act(() => result.current.setText('Hеllo​ world'));
    act(() => {
      result.current.clean();
    });
    expect(result.current.state.text).toBe('Hello world');
    await act(() => result.current.recheck());
    expect(result.current.state.diff).toBeDefined();
    expect(result.current.state.history).toHaveLength(2);
    act(() => result.current.reset());
    expect(result.current.state.status).toBe('idle');
  });

  it('useAnalysis: image file uses object URL', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:img');
    URL.revokeObjectURL = vi.fn();
    const { result } = renderHook(() => useAnalysis('auto'));
    await act(() => result.current.analyzeFile(new File([fx('sd.png')], 'sd.png', { type: 'image/png' })));
    expect(result.current.state.report?.kind).toBe('image');
    expect(result.current.state.imageUrl).toBe('blob:img');
    await act(() => result.current.analyzeFile({ name: 'big.txt', size: 30e6, type: '', arrayBuffer: async () => new ArrayBuffer(0) }));
    expect(result.current.state.error).toBe('too_large');
  });

  it('withText keeps kind', () => {
    const doc = { kind: 'document' as const, document: { text: 'a', meta: { format: 'txt' as const, styles: [], rsids: 0, fonts: [], colors: [], htmlFragments: 0, positions: [] } } };
    expect(withText(doc, 'b', 'auto').document?.text).toBe('b');
    expect(withText(undefined, 'def f():\n    return 1\n\nif x:\n    f()', 'auto').kind).toBe('code');
    expect(withText(undefined, 'plain words here', 'ru').kind).toBe('text');
  });

  it('export helpers', () => {
    URL.createObjectURL = vi.fn(() => 'blob:y');
    URL.revokeObjectURL = vi.fn();
    const r = aiReport();
    const json = JSON.parse(reportJson({ ...r, image: { meta: r.image?.meta as never, pixels: { width: 1, height: 1, data: new Uint8Array(4) } } }));
    expect(json.image.pixels).toBeUndefined();
    download('x.json', '{}');
    expect(URL.createObjectURL).toHaveBeenCalled();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    exportPdf();
    expect(print).toHaveBeenCalled();
  });

  it('history survives reload', async () => {
    const { result, unmount } = renderHook(() => useAnalysis('auto'));
    await act(() => result.current.analyzeText(sample('ru', true, 0)));
    unmount();
    const again = renderHook(() => useAnalysis('auto'));
    await waitFor(() => expect(again.result.current.state.history.length).toBe(1));
  });
});

describe('App footer', () => {
  it('is shown on the home page and on the report page', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Научная база' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Вставьте текст/), { target: { value: sample('ru', true, 0) } });
    await userEvent.click(screen.getByRole('button', { name: 'Проверить' }));
    await screen.findByRole('button', { name: 'Перепроверить' });
    expect(screen.getByRole('button', { name: 'Научная база' })).toBeInTheDocument();
  });
});
