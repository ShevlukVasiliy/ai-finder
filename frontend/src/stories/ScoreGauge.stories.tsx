import type { Meta, StoryObj } from '@storybook/react';
import { ScoreGauge } from '../ui/components/ScoreGauge';
import { dark, darkMobile, mobile } from './variants';

const meta: Meta<typeof ScoreGauge> = { title: 'Report/ScoreGauge', component: ScoreGauge, args: { score: 82, verdict: 'ai', confidence: { level: 'high', value: 0.82, reasons: [] } } };
export default meta;
type S = StoryObj<typeof ScoreGauge>;

export const Data: S = {};
export const Human: S = { args: { score: 12, verdict: 'human', confidence: { level: 'medium', value: 0.6, reasons: ['few_signals'] } } };
export const Mixed: S = { args: { score: 50, verdict: 'mixed' } };
export const LowConfidence: S = { args: { score: 64, verdict: 'mixed', confidence: { level: 'low', value: 0.2, reasons: ['short_text', 'few_signals', 'image_lower_confidence'] } } };
export const Loading: S = { args: { loading: true } };
export const Empty: S = { args: { score: undefined, verdict: undefined, confidence: undefined } };
export const Error: S = { args: { error: 'Не удалось прочитать файл.' } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
export const DarkMobile: S = { ...darkMobile, args: LowConfidence.args };
