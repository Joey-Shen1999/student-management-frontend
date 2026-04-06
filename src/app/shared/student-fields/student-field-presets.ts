import type { GoalStudentSelectorColumnKey } from '../student-columns/goal-student-selector-columns';

export type StudentManagementPageContext = 'students' | 'ielts' | 'osslt';

export type StudentListColumnKey =
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
  | 'profile'
  | 'ielts'
  | 'languageTracking'
  | 'ossltResult'
  | 'ossltTracking'
  | 'resetPassword'
  | 'archive';

export const STUDENT_ACCOUNT_MANAGEMENT_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'email',
  'phone',
  'graduation',
  'teacherNote',
  'profile',
  'resetPassword',
  'archive',
];

export const LANGUAGE_SCORE_TRACKING_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'graduation',
  'schoolName',
  'canadaIdentity',
  'teacherNote',
  'ielts',
  'languageTracking',
];

export const OSSLT_TRACKING_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'graduation',
  'schoolName',
  'schoolBoard',
  'city',
  'teacherNote',
  'ossltResult',
  'ossltTracking',
];

export const STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT: Record<
  StudentManagementPageContext,
  readonly StudentListColumnKey[]
> = {
  students: STUDENT_ACCOUNT_MANAGEMENT_DEFAULT_COLUMN_KEYS,
  ielts: LANGUAGE_SCORE_TRACKING_DEFAULT_COLUMN_KEYS,
  osslt: OSSLT_TRACKING_DEFAULT_COLUMN_KEYS,
};

export type StudentSelectorContext = 'goal-create' | 'info-create';
export type StudentSelectorFilterFieldKey =
  | 'country'
  | 'province'
  | 'city'
  | 'schoolBoard'
  | 'graduationSeason'
  | 'keyword';

export const STUDENT_SELECTOR_FULL_COLUMN_KEYS: readonly GoalStudentSelectorColumnKey[] = [
  'name',
  'email',
  'phone',
  'graduation',
  'schoolName',
  'canadaIdentity',
  'gender',
  'nationality',
  'firstLanguage',
  'motherLanguage',
  'schoolBoard',
  'country',
  'province',
  'city',
  'teacherNote',
  'status',
  'selectable',
];

export const STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS_BY_CONTEXT: Record<
  StudentSelectorContext,
  readonly GoalStudentSelectorColumnKey[]
> = {
  'goal-create': [
    'name',
    'email',
    'phone',
    'graduation',
    'schoolBoard',
    'city',
    'teacherNote',
    'status',
    'selectable',
  ],
  'info-create': [
    'name',
    'email',
    'phone',
    'graduation',
    'schoolBoard',
    'city',
    'teacherNote',
    'status',
    'selectable',
  ],
};

export const STUDENT_SELECTOR_AVAILABLE_COLUMN_KEYS_BY_CONTEXT: Record<
  StudentSelectorContext,
  readonly GoalStudentSelectorColumnKey[]
> = {
  'goal-create': STUDENT_SELECTOR_FULL_COLUMN_KEYS,
  'info-create': STUDENT_SELECTOR_FULL_COLUMN_KEYS,
};

export const STUDENT_SELECTOR_FILTER_FIELDS_BY_CONTEXT: Record<
  StudentSelectorContext,
  readonly StudentSelectorFilterFieldKey[]
> = {
  'goal-create': ['country', 'province', 'city', 'schoolBoard', 'graduationSeason', 'keyword'],
  'info-create': ['country', 'province', 'city', 'schoolBoard', 'graduationSeason', 'keyword'],
};
