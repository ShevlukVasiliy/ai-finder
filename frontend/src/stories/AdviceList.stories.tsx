import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { AdviceList } from '../ui/components/AdviceList';
import { advice, longAdvice } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof AdviceList> = { title: 'Advice/AdviceList', component: AdviceList, args: { items: advice } };
export default meta;
type S = StoryObj<typeof AdviceList>;

export const Data: S = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const all = c.getAllByRole('article').length;
    await userEvent.selectOptions(c.getByLabelText('Любая сложность'), '1');
    await expect(c.queryAllByRole('article').length).toBeLessThanOrEqual(all);
    await userEvent.selectOptions(c.getByLabelText('Любая сложность'), '0');
    await expect(c.getAllByRole('article').length).toBe(all);
  },
};
export const Loading: S = { args: { loading: true } };
export const Empty: S = { args: { items: [] } };
export const Long: S = { args: { items: longAdvice } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
