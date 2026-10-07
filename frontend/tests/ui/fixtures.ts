import { analyze, diffReports } from '../../src/core/analyze';
import type { Report } from '../../src/core/types';
import { sample } from '../core/helpers';

export const aiReport = (): Report => analyze({ kind: 'text', text: sample('ru', true, 0) });
export const humanReport = (): Report => analyze({ kind: 'text', text: sample('ru', false, 0) });
export const diff = () => diffReports(aiReport(), humanReport());
