import { IeltsTrackingRuleSet, LanguageScoreType } from './ielts-types';

const SHARED_LABELS = {
  strictLineName: '内部保守严格线',
  commonLineName: '常见录取线',
} as const;

const SHARED_VALIDITY = {
  anchorMonth: 5,
  anchorDay: 31,
  rollingYears: 2,
} as const;

function createMessaging(testName: string): IeltsTrackingRuleSet['messaging'] {
  return {
    GREEN_STRICT_PASS: {
      title: '成绩较稳妥（仍需逐校核验）',
      message: `当前有效 ${testName} 成绩已达到内部严格线，仅代表申请跟踪口径，仍需按目标院校/专业逐项核对。`,
      colorToken: '#1b5e20',
    },
    GREEN_COMMON_PASS_WITH_WARNING: {
      title: '成绩初步可用（需重点复核）',
      message: `当前有效 ${testName} 成绩已达到常见线，但部分院校/专业可能要求更高总分或单项分，仍需逐校确认。`,
      colorToken: '#2e7d32',
    },
    YELLOW_NEEDS_PREPARATION: {
      title: '可能需要递交语言成绩',
      message: '当前还没有达到常见线的有效语言成绩。请尽快确认目标项目要求并安排备考/出分计划。',
      colorToken: '#b26a00',
    },
  };
}

// v1 policy naming is intentionally conservative:
// - commonLine: representative undergraduate baseline observed on many schools.
// - strictLine: internal conservative stricter line for risk tracking, not an admission guarantee.
export const IELTS_TRACKING_RULESET_V1: IeltsTrackingRuleSet = {
  id: 'IELTS_TRACKING_RULESET_V1_2026Q1',
  scope: 'IELTS_ACADEMIC_ONLY',
  labels: SHARED_LABELS,
  validity: SHARED_VALIDITY,
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
  messaging: createMessaging('IELTS Academic'),
};

export const TOEFL_TRACKING_RULESET_V1: IeltsTrackingRuleSet = {
  id: 'TOEFL_TRACKING_RULESET_V1_2026Q2',
  scope: 'TOEFL_IBT_2026_ONLY',
  labels: SHARED_LABELS,
  validity: SHARED_VALIDITY,
  strictLine: {
    minimumOverall: 5.0,
    minimumListening: 4.5,
    minimumReading: 4.5,
    minimumWriting: 4.5,
    minimumSpeaking: 4.5,
  },
  commonLine: {
    minimumOverall: 4.5,
    minimumListening: 4.0,
    minimumReading: 4.0,
    minimumWriting: 4.0,
    minimumSpeaking: 4.0,
  },
  messaging: createMessaging('TOEFL iBT'),
};

export const DUOLINGO_TRACKING_RULESET_V1: IeltsTrackingRuleSet = {
  id: 'DUOLINGO_TRACKING_RULESET_V1_2026Q2',
  scope: 'DUOLINGO_DET_2026_ONLY',
  labels: SHARED_LABELS,
  validity: SHARED_VALIDITY,
  // DET score range reference:
  // Official Guide 2024 shows score scale 10-160 with 5-point increments.
  // Concordance table maps IELTS 6.5 around DET 120-125 and IELTS 7 around DET 130-135.
  strictLine: {
    minimumOverall: 130,
    minimumListening: 120,
    minimumReading: 120,
    minimumWriting: 120,
    minimumSpeaking: 120,
  },
  commonLine: {
    minimumOverall: 120,
    minimumListening: 110,
    minimumReading: 110,
    minimumWriting: 110,
    minimumSpeaking: 110,
  },
  messaging: createMessaging('Duolingo English Test'),
};

export function resolveLanguageTrackingRuleSet(
  languageScoreType: LanguageScoreType | null | undefined
): IeltsTrackingRuleSet {
  if (languageScoreType === 'TOEFL') {
    return TOEFL_TRACKING_RULESET_V1;
  }
  if (languageScoreType === 'DUOLINGO') {
    return DUOLINGO_TRACKING_RULESET_V1;
  }
  return IELTS_TRACKING_RULESET_V1;
}
