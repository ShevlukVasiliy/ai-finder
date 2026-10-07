import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { AdviceCard } from '../ui/components/AdviceCard';
import { advice } from './mocks';
import { dark, mobile } from './variants';

const withRepl = advice.find((a) => a.replacements.length) ?? advice[0]!;
const meta: Meta<typeof AdviceCard> = { title: 'Advice/AdviceCard', component: AdviceCard, args: { item: withRepl, onFocus: fn() } };
export default meta;
type S = StoryObj<typeof AdviceCard>;

export const Data: S = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: args.item.title }));
    await expect(args.onFocus).toHaveBeenCalled();
  },
};
export const Active: S = { args: { active: true } };
export const Compact: S = { args: { compact: true } };
export const LowSeverity: S = { args: { item: { ...withRepl, severity: 'low', expectedGain: 0, replacements: [] } } };
export const Long: S = { args: { item: { ...withRepl, title: withRepl.title.repeat(3), actions: [...withRepl.actions, ...withRepl.actions, ...withRepl.actions] } } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
