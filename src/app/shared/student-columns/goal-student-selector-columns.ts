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
    label: 'Name',
    defaultVisible: true,
    hideable: false,
    backendDependent: false,
  },
  {
    key: 'email',
    label: 'Email',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'phone',
    label: 'Phone',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'graduation',
    label: 'Graduation',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'schoolName',
    label: 'School',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'canadaIdentity',
    label: 'Canada Identity',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'gender',
    label: 'Gender',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'nationality',
    label: 'Nationality',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'firstLanguage',
    label: 'First Language',
    defaultVisible: false,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'schoolBoard',
    label: 'School Board',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'country',
    label: 'Country',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'province',
    label: 'Province',
    defaultVisible: false,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'city',
    label: 'City',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'teacherNote',
    label: 'Teacher Note',
    defaultVisible: true,
    hideable: true,
    backendDependent: true,
  },
  {
    key: 'status',
    label: 'Archive Status',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
  {
    key: 'selectable',
    label: 'Selectable',
    defaultVisible: true,
    hideable: true,
    backendDependent: false,
  },
];
