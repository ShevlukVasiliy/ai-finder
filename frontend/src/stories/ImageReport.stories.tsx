import type { Meta, StoryObj } from '@storybook/react';
import { ImageReport } from '../ui/components/ImageReport';
import { imageMock, imageSrc } from './mocks';
import { dark, mobile } from './variants';

const meta: Meta<typeof ImageReport> = { title: 'Report/ImageReport', component: ImageReport, args: { image: imageMock, src: imageSrc } };
export default meta;
type S = StoryObj<typeof ImageReport>;

export const Data: S = {};
export const Loading: S = { args: { src: undefined } };
export const NoMetadata: S = {
  args: { image: { meta: { ...imageMock.meta, exif: {}, pngText: {}, c2pa: { present: false, issuers: [], aiClaim: false } }, heatmap: undefined } },
};
export const Long: S = { args: { image: { ...imageMock, meta: { ...imageMock.meta, exif: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`Tag${i}`, 'value '.repeat(8)])) } } } };
export const Dark: S = { ...dark };
export const Mobile: S = { ...mobile };
