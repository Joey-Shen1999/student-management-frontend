import { describe, expect, it } from 'vitest';
import {
  CANADIAN_EDUCATION_BOARDS_BY_PROVINCE,
  resolveCanadianProvince,
} from './canadian-education-boards';

describe('Canadian education board suggestions', () => {
  it('covers all Canadian provinces and territories outside Ontario', () => {
    expect(Object.keys(CANADIAN_EDUCATION_BOARDS_BY_PROVINCE)).toHaveLength(12);
    for (const authorities of Object.values(CANADIAN_EDUCATION_BOARDS_BY_PROVINCE)) {
      expect(authorities.length).toBeGreaterThan(0);
      expect(new Set(authorities).size).toBe(authorities.length);
    }
    expect(CANADIAN_EDUCATION_BOARDS_BY_PROVINCE['British Columbia']).toHaveLength(60);
    expect(CANADIAN_EDUCATION_BOARDS_BY_PROVINCE['Quebec']).toHaveLength(72);
  });

  it('recognizes common abbreviations and French province spelling', () => {
    expect(resolveCanadianProvince('B.C.')).toBe('British Columbia');
    expect(resolveCanadianProvince('Québec')).toBe('Quebec');
    expect(resolveCanadianProvince('ON')).toBe('Ontario');
    expect(resolveCanadianProvince('California')).toBeNull();
  });
});
