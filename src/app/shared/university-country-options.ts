import {
  COUNTRY_FILTER_FALLBACK_OPTIONS,
  COUNTRY_FILTER_PRIORITY_OPTIONS,
} from './student-location/student-location-options';

export const OTHER_UNIVERSITY_COUNTRY = '__other__';

// Keep catalog country values consistent so universities can be filtered by region.
export const UNIVERSITY_COUNTRY_OPTIONS: readonly string[] = [
  ...COUNTRY_FILTER_PRIORITY_OPTIONS,
  'Hong Kong',
  'Macao',
  'Taiwan',
  ...COUNTRY_FILTER_FALLBACK_OPTIONS,
];

export function resolveUniversityCountry(selected: string, other: string): string {
  return (selected === OTHER_UNIVERSITY_COUNTRY ? other : selected).trim();
}
