import type { ColumnVisibilityConfig } from '../student-columns/student-column-visibility.util';

export type StudentSelectorColumnKey = string;

export interface StudentSelectorColumnConfig<TKey extends string = StudentSelectorColumnKey>
  extends ColumnVisibilityConfig<TKey> {
  label: string;
  backendDependent: boolean;
}
