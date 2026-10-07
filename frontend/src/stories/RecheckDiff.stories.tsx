import type { Meta, StoryObj } from '@storybook/react';
import { RecheckDiff } from '../ui/components/RecheckDiff';
import { recheckDiff } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof RecheckDiff> = { title: 'Report/RecheckDiff', component: RecheckDiff, args: { diff: recheckDiff } };
export default meta;
type S = StoryObj<typeof RecheckDiff>;

export const Data: S = {};
export const Empty: S = { args: { diff: { scoreBefore: 40, scoreAfter: 40, closed: [], opened: [], remaining: [], metrics: [] } } };
export const Worse: S = { args: { diff: { scoreBefore: 30, scoreAfter: 55, closed: [], opened: ['L-01', 'S-02'], remaining: ['R-01'], metrics: [{ detector: 'L-01', name: 'Маркеры', before: 1, after: 9 }] } } };
export const Long: S = { args: { diff: { ...recheckDiff, closed: [...recheckDiff.closed, ...recheckDiff.closed.map((x) => `${x}-2`)], remaining: Array.from({ length: 12 }, (_, i) => `X-${i}`) } } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
