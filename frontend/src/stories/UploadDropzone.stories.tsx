import type { Meta, StoryObj } from '@storybook/react';
import { expect, fireEvent, fn, waitFor, within } from '@storybook/test';
import { UploadDropzone } from '../ui/components/UploadDropzone';
import { dark, mobile } from './variants';

const meta: Meta<typeof UploadDropzone> = { title: 'Input/UploadDropzone', component: UploadDropzone, args: { onFile: fn() } };
export default meta;
type S = StoryObj<typeof UploadDropzone>;

export const Default: S = {
  play: async ({ canvasElement, args }) => {
    const zone = within(canvasElement).getByTestId('dropzone');
    const file = new File(['Привет'], 'a.txt', { type: 'text/plain' });
    await fireEvent.dragOver(zone);
    await expect(await within(canvasElement).findByText('Отпустите, чтобы загрузить')).toBeInTheDocument();
    const dt = new DataTransfer();
    dt.items.add(file);
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await waitFor(() => expect(args.onFile).toHaveBeenCalledTimes(1));
    await expect(within(canvasElement).getByText('Перетащите файл сюда')).toBeInTheDocument();
  },
};
export const Loading: S = { args: { disabled: true } };
export const Error: S = { args: { error: 'Этот формат не поддерживается.' } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
