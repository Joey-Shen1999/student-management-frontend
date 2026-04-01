import { LanguageTrackingStatus } from './ielts-types';

export type LanguageTrackingDisplayState = LanguageTrackingStatus | 'LOADING' | 'UNAVAILABLE';

export interface LanguageTrackingStatusDisplay {
  state: LanguageTrackingDisplayState;
  label: string;
  background: string;
  textColor: string;
  borderColor: string;
}

export interface ResolveLanguageTrackingStatusDisplayInput {
  status?: LanguageTrackingStatus | null;
  isLoading?: boolean;
  isUnavailable?: boolean;
}

export function resolveLanguageTrackingStatusDisplay(
  input: ResolveLanguageTrackingStatusDisplayInput
): LanguageTrackingStatusDisplay {
  if (input.isLoading) {
    return buildLanguageTrackingStatusDisplay('LOADING');
  }
  if (input.isUnavailable) {
    return buildLanguageTrackingStatusDisplay('UNAVAILABLE');
  }

  const status = input.status;
  if (
    status === 'TEACHER_REVIEW_APPROVED' ||
    status === 'AUTO_PASS_ALL_SCHOOLS' ||
    status === 'AUTO_PASS_PARTIAL_SCHOOLS' ||
    status === 'NEEDS_TRACKING'
  ) {
    return buildLanguageTrackingStatusDisplay(status);
  }

  return buildLanguageTrackingStatusDisplay('UNAVAILABLE');
}

function buildLanguageTrackingStatusDisplay(
  state: LanguageTrackingDisplayState
): LanguageTrackingStatusDisplay {
  if (state === 'TEACHER_REVIEW_APPROVED') {
    return {
      state,
      label: '已审核通过',
      background: '#1f7a3f',
      textColor: '#ffffff',
      borderColor: '#1f7a3f',
    };
  }

  if (state === 'AUTO_PASS_ALL_SCHOOLS') {
    return {
      state,
      label: '已通过，适配全部学校',
      background: '#2e7d32',
      textColor: '#ffffff',
      borderColor: '#2e7d32',
    };
  }

  if (state === 'AUTO_PASS_PARTIAL_SCHOOLS') {
    return {
      state,
      label: '已通过，适配部分学校',
      background: '#fff3da',
      textColor: '#875a00',
      borderColor: '#875a00',
    };
  }

  if (state === 'NEEDS_TRACKING') {
    return {
      state,
      label: '需要跟踪',
      background: '#fff2d8',
      textColor: '#8a5a00',
      borderColor: '#8a5a00',
    };
  }

  if (state === 'LOADING') {
    return {
      state,
      label: '加载中...',
      background: '#edf2fb',
      textColor: '#4a5f82',
      borderColor: '#4a5f82',
    };
  }

  return {
    state,
    label: '需要跟踪',
    background: '#fff2d8',
    textColor: '#8a5a00',
    borderColor: '#8a5a00',
  };
}
