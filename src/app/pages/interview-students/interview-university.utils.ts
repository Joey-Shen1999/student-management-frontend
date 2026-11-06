import { InterviewCoursePlan } from '../../services/graduation-application-stage.service';
export function hasExtendedEngineeringInterview(row: InterviewCoursePlan): boolean {
  return (row.engineeringApplications || []).some(a => /mcmaster|waterloo|麦克马斯特|麦马|滑铁卢/i.test(a.universityName));
}

export function interviewUniversityGroup(row: InterviewCoursePlan): string {
  if (hasExtendedEngineeringInterview(row)) return '麦马／滑铁卢工程';
  if ((row.engineeringApplications || []).some(a=>/university of toronto|uoft|utsg|多伦多大学/i.test(a.universityName))) return '多大工程';
  return '其他／尚未报名工程申请';
}
export function interviewUniversityRank(row: InterviewCoursePlan): number {
  const group = interviewUniversityGroup(row);
  return group === '多大工程' ? 0 : group === '麦马／滑铁卢工程' ? 1 : 2;
}
