import type { Meta, StoryObj } from '@storybook/react';
import { DocumentMetaTable } from '../ui/components/DocumentMetaTable';
import { dark, mobile } from './variants';

const meta: Meta<typeof DocumentMetaTable> = {
  title: 'Report/DocumentMetaTable',
  component: DocumentMetaTable,
  args: {
    meta: { format: 'docx', author: 'python-docx', application: 'python-docx', created: '2024-05-01T10:00:00Z', modified: '2024-05-01T10:00:00Z', totalTimeMin: 1, revisions: 1, styles: ['Normal (Web)'], rsids: 1, fonts: ['Calibri'], colors: [], htmlFragments: 0, positions: [] },
  },
};
export default meta;
type S = StoryObj<typeof DocumentMetaTable>;

export const Data: S = {};
export const Empty: S = { args: { meta: undefined } };
export const Long: S = { args: { meta: { format: 'pdf', creator: 'ReportLab PDF Library - www.reportlab.com', producer: 'ReportLab PDF Library - www.reportlab.com', styles: Array.from({ length: 30 }, (_, i) => `Style ${i}`), rsids: 0, fonts: ['Helvetica', 'Times', 'Courier'], colors: [], htmlFragments: 0, positions: [] } } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
