import type { Meta, StoryObj } from '@storybook/react';
import { CategoryBreakdown } from '../ui/components/CategoryBreakdown';
import { aiReport } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof CategoryBreakdown> = { title: 'Report/CategoryBreakdown', component: CategoryBreakdown, args: { categories: aiReport.categories } };
export default meta;
type S = StoryObj<typeof CategoryBreakdown>;

export const Data: S = {};
export const Loading: S = { args: { loading: true } };
export const Empty: S = { args: { categories: [] } };
export const Long: S = {
  args: { categories: (['style', 'lexicon', 'structure', 'typography', 'stats', 'metadata', 'image', 'code'] as const).map((c, i) => ({ category: c, score: (i * 37) % 101, detectors: [] })) },
};
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile, args: Long.args };
