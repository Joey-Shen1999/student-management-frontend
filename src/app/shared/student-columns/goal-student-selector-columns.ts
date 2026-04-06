import type { StudentSelectorColumnConfig } from '../student-selector/student-selector.types';

export type GoalStudentSelectorColumnKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'graduation'
  | 'schoolName'
  | 'canadaIdentity'
  | 'gender'
  | 'nationality'
  | 'firstLanguage'
  | 'motherLanguage'
  | 'schoolBoard'
  | 'country'
  | 'province'
  | 'city'
  | 'teacherNote'
  | 'status'
  | 'selectable';

export type GoalStudentSelectorColumnConfig =
  StudentSelectorColumnConfig<GoalStudentSelectorColumnKey>;

export const GOAL_STUDENT_SELECTOR_COLUMNS: readonly GoalStudentSelectorColumnConfig[] = [
  {
    key: 'name',
    label: '\u59d3\u540d',
    defaultVisible: true,
    hideable: false,
    backendDependent: false,
  },
  {
    key: 'email',
    label: '\u90ae\u7bb1',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'phone',
    label: '\u7535\u8bdd',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'graduation',
    label: '\u6bd5\u4e1a\u65f6\u95f4',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'schoolName',
    label: '\u5b66\u6821\u540d',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'canadaIdentity',
    label: '\u5728\u52a0\u62ff\u5927\u7684\u8eab\u4efd',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'gender',
    label: '\u6027\u522b',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'nationality',
    label: '\u56fd\u7c4d',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'firstLanguage',
    label: '\u7b2c\u4e00\u8bed\u8a00',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'motherLanguage',
    label: '\u6bcd\u8bed',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'schoolBoard',
    label: '\u6240\u5c5e\u6559\u80b2\u5c40\uff08\u5728\u8bfb\u5b66\u6821\uff09',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'country',
    label: '\u56fd\u5bb6',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'province',
    label: '\u7701\u4efd',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'city',
    label: '\u57ce\u5e02\uff08\u5728\u8bfb\u5b66\u6821\uff09',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'teacherNote',
    label: '\u8001\u5e08\u5907\u6ce8\uff08\u5b66\u751f\u4e0d\u53ef\u89c1\uff09',
    defaultVisible: true,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'status',
    label: '\u5f52\u6863\u72b6\u6001',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'selectable',
    label: '\u53ef\u9009\u62e9',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
];

export const buildGoalStudentSelectorColumns = (
  keys: readonly GoalStudentSelectorColumnKey[]
): readonly GoalStudentSelectorColumnConfig[] => {
  if (!Array.isArray(keys) || keys.length === 0) {
    return GOAL_STUDENT_SELECTOR_COLUMNS;
  }

  const allowedKeys = new Set<GoalStudentSelectorColumnKey>(keys);
  return GOAL_STUDENT_SELECTOR_COLUMNS.filter((column) => allowedKeys.has(column.key));
};
