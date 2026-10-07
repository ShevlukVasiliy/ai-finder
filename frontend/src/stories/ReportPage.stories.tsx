import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { ReportPage } from '../ui/components/ReportPage';
import { aiReport, humanReport, imageMock, imageSrc, longReport, recheckDiff } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof ReportPage> = {
  title: 'Pages/ReportPage',
  component: ReportPage,
  parameters: { layout: 'fullscreen' },
  args: { report: aiReport, text: aiReport.text, onRecheck: fn(), onClean: fn(), onExportJson: fn(), onExportPdf: fn(), onReset: fn(), onTextChange: fn() },
};
export default meta;
type S = StoryObj<typeof ReportPage>;

export const Data: S = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Перепроверить' }));
    await expect(args.onRecheck).toHaveBeenCalled();
    await userEvent.click(c.getAllByRole('button', { name: aiReport.advice[0]!.title })[0]!);
    for (const b of await c.findAllByRole('button', { name: aiReport.advice[0]!.title })) await expect(b).toHaveAttribute('aria-pressed', 'true');
  },
};
export const AfterRecheck: S = { args: { report: humanReport, text: humanReport.text, diff: recheckDiff, notice: 'Заменено символов: 3, удалено: 1.' } };
export const Loading: S = { args: { loading: true } };
export const Human: S = { args: { report: humanReport, text: humanReport.text } };
export const Image: S = { args: { report: { ...aiReport, kind: 'image', image: imageMock, advice: aiReport.advice.slice(0, 2) }, imageUrl: imageSrc } };
export const Long: S = { args: { report: longReport, text: longReport.text } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
