import { describe, expect, it } from 'vitest';

import { deriveOssltTrackingStatus, deriveStudentOssltSummary } from './osslt-derive';
import { StudentOssltModuleState } from './osslt-types';

describe('osslt-derive', () => {
  it('should treat OSSLC enrolled as PASSED when manual status is not set', () => {
    expect(deriveOssltTrackingStatus(null, 'FAIL', true)).toBe('PASSED');
  });

  it('should prioritize teacher manual status over OSSLC flag', () => {
    expect(deriveOssltTrackingStatus('WAITING_UPDATE', 'FAIL', true)).toBe('WAITING_UPDATE');
    expect(deriveOssltTrackingStatus('NEEDS_TRACKING', 'FAIL', true)).toBe('NEEDS_TRACKING');
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
      osslcCourseStatus: null,
      osslcCourseLocation: null,
      ossltTrackingManualStatus: null,
      ossltTrackingStatus: null,
      updatedAt: null,
    };

    const summary = deriveStudentOssltSummary(state);
    expect(summary.trackingStatus).toBe('PASSED');
    expect(summary.trackingTitle).toBe('OSSLT Requirement Completed');
  });

  it('should render summary as not passed when tracking status is needs tracking', () => {
    const state: StudentOssltModuleState = {
      studentId: 1,
      graduationYear: 2027,
      latestOssltResult: 'FAIL',
      latestOssltDate: null,
      hasOsslc: false,
      osslcCourseStatus: 'IN_PROGRESS',
      osslcCourseLocation: 'Night School',
      ossltTrackingManualStatus: 'NEEDS_TRACKING',
      ossltTrackingStatus: null,
      updatedAt: null,
    };

    const summary = deriveStudentOssltSummary(state);
    expect(summary.trackingStatus).toBe('NEEDS_TRACKING');
    expect(summary.trackingTitle).toBe('OSSLT Not Passed');
  });
});
