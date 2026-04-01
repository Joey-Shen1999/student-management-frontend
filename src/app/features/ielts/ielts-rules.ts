import { IeltsTrackingRuleSet } from './ielts-types';

// v1 policy naming is intentionally conservative:
// - commonLine: representative undergraduate baseline observed on many schools.
// - strictLine: internal conservative stricter line for risk tracking, not an admission guarantee.
export const IELTS_TRACKING_RULESET_V1: IeltsTrackingRuleSet = {
  id: 'IELTS_TRACKING_RULESET_V1_2026Q1',
  scope: 'IELTS_ACADEMIC_ONLY',
  labels: {
    strictLineName: '内部保守严格线',
    commonLineName: '常见录取线',
  },
  validity: {
    anchorMonth: 5,
    anchorDay: 31,
    rollingYears: 2,
  },
  strictLine: {
    minimumOverall: 7.0,
    minimumListening: 6.5,
    minimumReading: 6.5,
    minimumWriting: 6.5,
    minimumSpeaking: 6.5,
  },
  commonLine: {
    minimumOverall: 6.5,
    minimumListening: 6.0,
    minimumReading: 6.0,
    minimumWriting: 6.0,
    minimumSpeaking: 6.0,
  },
  messaging: {
    GREEN_STRICT_PASS: {
      title: '成绩较稳妥（仍需逐校核验）',
      message:
        '当前有效 IELTS Academic 已达到内部严格线，仅代表申请跟踪口径，仍需按目标院校/专业逐项核对。',
      colorToken: '#1b5e20',
    },
    GREEN_COMMON_PASS_WITH_WARNING: {
      title: '成绩初步可用（需重点复核）',
      message:
        '当前有效 IELTS Academic 已达到常见线，但部分院校/专业可能要求更高总分或单项分，仍需逐校确认。',
      colorToken: '#2e7d32',
    },
    YELLOW_NEEDS_PREPARATION: {
      title: '可能需要递交雅思成绩',
      message:
        '当前还没有达到常见线的有效 IELTS Academic 成绩。请尽快确认目标项目要求并安排备考/出分计划。',
      colorToken: '#b26a00',
    },
  },
};
