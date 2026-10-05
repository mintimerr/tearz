/**
 * Optional external benchmark — collected AFTER placement for validation research.
 * Never used during Tearz adaptive selection / scoring.
 */

import type { CefrLevel } from '../types.js';

export type ExternalBenchmarkType =
  | 'IELTS'
  | 'TOEFL'
  | 'CAMBRIDGE'
  | 'CEFR_SELF_REPORT'
  | 'OTHER_PLACEMENT'
  | 'TEACHER_ASSESSMENT';

export type ExternalBenchmark = {
  type: ExternalBenchmarkType;
  score?: string | number;
  reportedLevel?: CefrLevel;
  takenAt?: number;
};
