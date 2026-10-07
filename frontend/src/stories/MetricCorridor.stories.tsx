import type { Meta, StoryObj } from '@storybook/react';
import { MetricCorridor, MetricList } from '../ui/components/MetricCorridor';
import { metrics } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof MetricCorridor> = {
  title: 'Report/MetricCorridor',
  component: MetricCorridor,
  args: { metric: { detector: 'R-01', name: 'Burstiness длин предложений', value: 0.28, corridor: [0.5, 0.9], score: 1 } },
};
export default meta;
type S = StoryObj<typeof MetricCorridor>;

export const OutOfCorridor: S = {};
export const InCorridor: S = { args: { metric: { detector: 'R-01', name: 'Burstiness', value: 0.7, corridor: [0.5, 0.9], score: 0 } } };
export const ZeroCorridor: S = { args: { metric: { detector: 'T-01', name: 'Гомоглифы', value: 0, corridor: [0, 0], score: 0 } } };
export const List: S = { render: () => <MetricList metrics={metrics} /> };
export const Empty: S = { render: () => <MetricList metrics={[]} /> };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile, render: () => <MetricList metrics={metrics} /> };
