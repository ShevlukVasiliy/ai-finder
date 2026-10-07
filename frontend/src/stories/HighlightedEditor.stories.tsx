import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { useState } from 'react';
import { HighlightedEditor, type HighlightedEditorProps } from '../ui/components/HighlightedEditor';
import { aiReport, humanReport, longReport } from './mocks';
import { dark, mobile } from './variants';

function Stateful(p: HighlightedEditorProps) {
  const [text, setText] = useState(p.text);
  return <HighlightedEditor {...p} text={text} analyzedText={p.text} onChange={setText} />;
}

const meta: Meta<typeof HighlightedEditor> = {
  title: 'Report/HighlightedEditor',
  component: HighlightedEditor,
  render: (args) => <Stateful {...args} />,
  args: { text: aiReport.text, sentences: aiReport.sentences, advice: aiReport.advice },
};
export default meta;
type S = StoryObj<typeof HighlightedEditor>;

export const Data: S = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const editor = c.getByRole('textbox');
    await expect(canvasElement.querySelectorAll('.hl').length).toBeGreaterThan(0);
    await userEvent.click(editor);
    await userEvent.keyboard(' ок');
    // Highlights are dropped after an edit until the next recheck.
    await expect(canvasElement.querySelectorAll('.hl').length).toBe(0);
  },
};
export const ActiveAdvice: S = { args: { activeId: aiReport.advice[0]?.id } };
export const HumanText: S = { args: { text: humanReport.text, sentences: humanReport.sentences, advice: humanReport.advice } };
export const Empty: S = { args: { text: '', sentences: [], advice: [] } };
export const Loading: S = { args: { readOnly: true } };
export const Long: S = { args: { text: longReport.text, sentences: longReport.sentences, advice: longReport.advice } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
