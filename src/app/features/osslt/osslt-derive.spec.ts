import { describe, expect, it } from 'vitest';

import { deriveOssltTrackingStatus, deriveStudentOssltSummary } from './osslt-derive';
import { StudentOssltModuleState } from './osslt-types';

describe('osslt-derive', () => {
  it('should treat OSSLC enrolled as PASSED even when OSSLT result is FAIL', () => {
    expect(deriveOssltTrackingStatus(null, 'FAIL', true)).toBe('PASSED');
    expect(deriveOssltTrackingStatus('WAITING_UPDATE', 'FAIL', true)).toBe('PASSED');
  });

  it('should require tracking when OSSLT result is FAIL and OSSLC is not enrolled', () => {
    expect(deriveOssltTrackingStatus(null, 'FAIL', false)).toBe('NEEDS_TRACKING');
  });

  it('should keep waiting update when result is unknown and no OSSLC signal', () => {
    expect(deriveOssltTrackingStatus(null, 'UNKNOWN', null)).toBe('WAITING_UPDATE');
  });

  it('should render summary as completed when OSSLC enrolled', () => {
    const state: StudentOssltModuleState = {
      studentId: 1,
      graduationYear: 2027,
      latestOssltResult: 'FAIL',
      latestOssltDate: null,
      hasOsslc: true,
      ossltTrackingManualStatus: null,
      ossltTrackingStatus: null,
      updatedAt: null,
    };

    const summary = deriveStudentOssltSummary(state);
    expect(summary.trackingStatus).toBe('PASSED');
    expect(summary.trackingTitle).toBe('OSSLT Requirement Completed');
  });
});

