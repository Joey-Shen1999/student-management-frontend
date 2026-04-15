import type { GoalStudentSelectorColumnKey } from '../student-columns/goal-student-selector-columns';

export type StudentManagementPageContext = 'students' | 'ielts' | 'osslt' | 'volunteer';

export type StudentListColumnKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'graduation'
  | 'serviceItems'
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
  | 'languageCourseStatus'
  | 'ossltResult'
  | 'ossltTracking'
  | 'volunteerTracking'
  | 'resetPassword'
  | 'archive'
  | 'status'
  | 'selectable';

export const STUDENT_ACCOUNT_MANAGEMENT_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'email',
  'phone',
  'graduation',
  'serviceItems',
  'teacherNote',
  'profile',
  'resetPassword',
  'archive',
];

export const LANGUAGE_SCORE_TRACKING_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'graduation',
  'motherLanguage',
  'teacherNote',
  'ielts',
  'languageTracking',
  'languageCourseStatus',
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

export const VOLUNTEER_TRACKING_DEFAULT_COLUMN_KEYS: readonly StudentListColumnKey[] = [
  'name',
  'graduation',
  'schoolName',
  'schoolBoard',
  'city',
  'teacherNote',
  'volunteerTracking',
];

export const STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT: Record<
  StudentManagementPageContext,
  readonly StudentListColumnKey[]
> = {
  students: STUDENT_ACCOUNT_MANAGEMENT_DEFAULT_COLUMN_KEYS,
  ielts: LANGUAGE_SCORE_TRACKING_DEFAULT_COLUMN_KEYS,
  osslt: OSSLT_TRACKING_DEFAULT_COLUMN_KEYS,
  volunteer: VOLUNTEER_TRACKING_DEFAULT_COLUMN_KEYS,
};

export type StudentSelectorContext = 'goal-create' | 'info-create';
export type StudentSelectorFilterFieldKey =
  | 'country'
  | 'province'
  | 'city'
  | 'schoolBoard'
  | 'graduationSeason'
  | 'languageScore'
  | 'languageTracking'
  | 'languageCourseStatus'
  | 'ossltResult'
  | 'ossltTracking'
  | 'volunteerCompleted'
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
  'ielts',
  'languageTracking',
  'languageCourseStatus',
  'ossltResult',
  'ossltTracking',
  'status',
  'selectable',
];

const UNIFIED_TASK_INFO_STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS: readonly GoalStudentSelectorColumnKey[] = [
  'name',
  'email',
  'phone',
  'graduation',
  'schoolName',
  'canadaIdentity',
  'schoolBoard',
  'country',
  'province',
  'city',
  'teacherNote',
  'ielts',
  'languageTracking',
  'languageCourseStatus',
  'ossltResult',
  'ossltTracking',
  'status',
  'selectable',
];

export const STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS_BY_CONTEXT: Record<
  StudentSelectorContext,
  readonly GoalStudentSelectorColumnKey[]
> = {
  'goal-create': UNIFIED_TASK_INFO_STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS,
  'info-create': UNIFIED_TASK_INFO_STUDENT_SELECTOR_DEFAULT_COLUMN_KEYS,
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
  'goal-create': [
    'country',
    'province',
    'city',
    'schoolBoard',
    'graduationSeason',
    'languageScore',
    'languageTracking',
    'languageCourseStatus',
    'ossltResult',
    'ossltTracking',
    'volunteerCompleted',
    'keyword',
  ],
  'info-create': [
    'country',
    'province',
    'city',
    'schoolBoard',
    'graduationSeason',
    'languageScore',
    'languageTracking',
    'languageCourseStatus',
    'ossltResult',
    'ossltTracking',
    'volunteerCompleted',
    'keyword',
  ],
};
