import {
  OssltResult,
  OssltSummaryViewModel,
  OssltTrackingManualStatus,
  OssltTrackingStatus,
  StudentOssltModuleState,
} from './osslt-types';

export function deriveAutoOssltTrackingStatus(result: OssltResult): OssltTrackingStatus {
  if (result === 'PASS') return 'PASSED';
  if (result === 'FAIL') return 'WAITING_UPDATE';
  return 'WAITING_UPDATE';
}

export function deriveOssltTrackingStatus(
  manualStatus: OssltTrackingManualStatus,
  latestResult: OssltResult,
  hasOsslc: boolean | null = null
): OssltTrackingStatus {
  if (manualStatus === 'WAITING_UPDATE') return 'WAITING_UPDATE';
  if (manualStatus === 'NEEDS_TRACKING') return 'NEEDS_TRACKING';
  if (manualStatus === 'PASSED') return 'PASSED';
  if (hasOsslc === true) return 'PASSED';
  if (latestResult === 'PASS') return 'PASSED';
  if (latestResult === 'FAIL' && hasOsslc === false) return 'NEEDS_TRACKING';
  return deriveAutoOssltTrackingStatus(latestResult);
}

export function deriveStudentOssltSummary(state: StudentOssltModuleState): OssltSummaryViewModel {
  const trackingStatus = deriveOssltTrackingStatus(
    state.ossltTrackingManualStatus,
    state.latestOssltResult,
    state.hasOsslc
  );

  if (trackingStatus === 'PASSED') {
    return {
      trackingStatus,
      trackingTitle: 'OSSLT Requirement Completed',
      trackingMessage: 'Student has completed OSSLT requirement.',
      colorToken: '#1b5e20',
      latestOssltResult: state.latestOssltResult,
      latestOssltDate: state.latestOssltDate,
      graduationYear: state.graduationYear,
    };
  }

  if (trackingStatus === 'NEEDS_TRACKING') {
    return {
      trackingStatus,
      trackingTitle: 'OSSLT Not Passed',
      trackingMessage: 'Student has not passed OSSLT yet.',
      colorToken: '#b26a00',
      latestOssltResult: state.latestOssltResult,
      latestOssltDate: state.latestOssltDate,
      graduationYear: state.graduationYear,
    };
  }

  return {
    trackingStatus,
    trackingTitle: 'Waiting Update',
    trackingMessage: 'Waiting for latest OSSLT update.',
    colorToken: '#5d6d7e',
    latestOssltResult: state.latestOssltResult,
    latestOssltDate: state.latestOssltDate,
    graduationYear: state.graduationYear,
  };
}
