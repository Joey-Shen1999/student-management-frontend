import { OssltTrackingStatus } from './osslt-types';

export type OssltStatusDisplayState = OssltTrackingStatus | 'LOADING' | 'UNAVAILABLE';

export interface OssltStatusDisplayModel {
  state: OssltStatusDisplayState;
  label: string;
  background: string;
  textColor: string;
  borderColor: string;
}

export interface ResolveOssltStatusDisplayInput {
  status?: OssltTrackingStatus | null;
  isLoading?: boolean;
  isUnavailable?: boolean;
}

export function resolveOssltStatusDisplay(input: ResolveOssltStatusDisplayInput): OssltStatusDisplayModel {
  if (input.isLoading) {
    return buildDisplayModel('LOADING');
  }
  if (input.isUnavailable) {
    return buildDisplayModel('UNAVAILABLE');
  }
  if (input.status === 'PASSED' || input.status === 'WAITING_UPDATE' || input.status === 'NEEDS_TRACKING') {
    return buildDisplayModel(input.status);
  }
  return buildDisplayModel('UNAVAILABLE');
}

function buildDisplayModel(state: OssltStatusDisplayState): OssltStatusDisplayModel {
  if (state === 'PASSED') {
    return {
      state,
      label: '已通过',
      background: '#e7f6ec',
      textColor: '#2f6b43',
      borderColor: '#8fc8a3',
    };
  }

  if (state === 'WAITING_UPDATE') {
    return {
      state,
      label: '等待更新',
      background: '#edf2fb',
      textColor: '#4a5f82',
      borderColor: '#9fb4d8',
    };
  }

  if (state === 'NEEDS_TRACKING') {
    return {
      state,
      label: '未通过',
      background: '#fff2d8',
      textColor: '#8a5a00',
      borderColor: '#e3c77a',
    };
  }

  if (state === 'LOADING') {
    return {
      state,
      label: '加载中...',
      background: '#edf2fb',
      textColor: '#4a5f82',
      borderColor: '#9fb4d8',
    };
  }

  return {
    state,
    label: '不可用',
    background: '#f1f3f5',
    textColor: '#6a7385',
    borderColor: '#c8cfda',
  };
}
