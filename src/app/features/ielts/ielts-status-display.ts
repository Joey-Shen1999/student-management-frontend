import { IeltsTrackingStatus } from './ielts-types';

export type IeltsStatusDisplayState =
  | IeltsTrackingStatus
  | 'NO_IELTS_REQUIRED'
  | 'LOADING'
  | 'UNAVAILABLE';

export interface IeltsStatusDisplayModel {
  state: IeltsStatusDisplayState;
  label: string;
  background: string;
  textColor: string;
  borderColor: string;
}

export interface ResolveIeltsStatusDisplayInput {
  trackingStatus?: IeltsTrackingStatus | null;
  shouldShowModule?: boolean | null;
  colorToken?: string | null;
  isLoading?: boolean;
  isUnavailable?: boolean;
}

export function resolveIeltsStatusDisplay(input: ResolveIeltsStatusDisplayInput): IeltsStatusDisplayModel {
  if (input.isLoading) {
    return buildDisplayModel('LOADING');
  }

  if (input.isUnavailable) {
    return buildDisplayModel('UNAVAILABLE');
  }

  if (input.shouldShowModule === false) {
    return buildDisplayModel('NO_IELTS_REQUIRED');
  }

  const status = input.trackingStatus;
  if (
    status === 'GREEN_STRICT_PASS' ||
    status === 'GREEN_COMMON_PASS_WITH_WARNING' ||
    status === 'YELLOW_NEEDS_PREPARATION'
  ) {
    return buildDisplayModel(status);
  }

  return buildDisplayModel('UNAVAILABLE');
}

function buildDisplayModel(state: IeltsStatusDisplayState): IeltsStatusDisplayModel {
  if (state === 'NO_IELTS_REQUIRED') {
    return {
      state,
      label: '无需语言成绩',
      background: '#f1f3f5',
      textColor: '#6a7385',
      borderColor: '#6a7385',
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

  if (state === 'UNAVAILABLE') {
    return {
      state,
      label: '可能需要语言成绩',
      background: '#fff6dc',
      textColor: '#8a5a00',
      borderColor: '#e3c77a',
    };
  }

  if (state === 'GREEN_STRICT_PASS') {
    return {
      state,
      label: '已满足语言成绩',
      background: '#e7f6ec',
      textColor: '#2f6b43',
      borderColor: '#8fc8a3',
    };
  }

  if (state === 'GREEN_COMMON_PASS_WITH_WARNING') {
    return {
      state,
      label: '已满足语言成绩(大部分本科)',
      background: '#e7f6ec',
      textColor: '#2f6b43',
      borderColor: '#8fc8a3',
    };
  }

  return {
    state,
    label: '可能需要语言成绩',
    background: '#fff6dc',
    textColor: '#8a5a00',
    borderColor: '#e3c77a',
  };
}
