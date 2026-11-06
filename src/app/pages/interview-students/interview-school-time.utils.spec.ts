import { schoolTimeDifference } from './interview-school-time.utils';
import { hasExtendedEngineeringInterview } from './interview-university.utils';
const winter=new Date('2026-11-06T17:00:00Z');
describe('Interview university classification and school time',()=>{
 it('leaves Toronto-only applications unchanged and separates McMaster or Waterloo',()=>{
 const plan=(names:string[])=>({engineeringApplications:names.map(universityName=>({universityName}))} as any);
 expect(hasExtendedEngineeringInterview(plan(['University of Toronto']))).toBe(false);
 expect(hasExtendedEngineeringInterview(plan(['University of Toronto','McMaster University']))).toBe(true);
 expect(hasExtendedEngineeringInterview(plan(['University of Waterloo']))).toBe(true);
 });
 it('uses verified school cities and updated permanent western time',()=>{
 const row=(schoolProvince:string,schoolCity:string)=>({schoolProvince,schoolCity,schoolCountry:'Canada'} as any);
 expect(schoolTimeDifference(row('BC','Vancouver'),winter)).toContain('−2'.replace('−','-'));
 expect(schoolTimeDifference(row('AB','Calgary'),winter)).toContain('-1');
 expect(schoolTimeDifference(row('ON','Toronto'),winter)).toContain('同一时间');
 expect(schoolTimeDifference(row('Ontario','Unknown'),winter)).toBe('时区待确认');
 expect(schoolTimeDifference(row('Ontario','Vancouver'),winter)).toBe('时区待确认');
 expect(schoolTimeDifference(row('NL',"St. John's"),winter)).toContain('+1.5');
 expect(schoolTimeDifference(row('BC','Vancouver'),new Date('2027-07-01T17:00:00Z'))).toContain('-3');
 });
});
