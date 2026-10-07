import type { Meta, StoryObj } from '@storybook/react';
import { TopAdvice } from '../ui/components/TopAdvice';
import { advice, longAdvice } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof TopAdvice> = { title: 'Advice/TopAdvice', component: TopAdvice, args: { items: advice } };
export default meta;
type S = StoryObj<typeof TopAdvice>;

export const Data: S = {};
export const Empty: S = { args: { items: [] } };
export const Single: S = { args: { items: advice.slice(0, 1) } };
export const Long: S = { args: { items: longAdvice } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
