import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT, StudentManagementPageContext, StudentListColumnKey } from '../shared/student-fields/student-field-presets';
export interface TeacherForm { id: string; name: string; context: StudentManagementPageContext; hidden: boolean; custom: boolean; columns: StudentListColumnKey[]; }
export const FORM_PRESETS: {context: StudentManagementPageContext; name: string; path: string}[] = [
 {context:'students',name:'学生管理',path:'/teacher/students'}, {context:'courses',name:'课程管理',path:'/teacher/courses'},
 {context:'ielts',name:'语言成绩跟踪',path:'/teacher/ielts'}, {context:'osslt',name:'OSSLT 跟踪',path:'/teacher/osslt'},
 {context:'volunteer',name:'义工跟踪',path:'/teacher/volunteer'}, {context:'extracurricular',name:'课外活动',path:'/teacher/extracurricular'},
 {context:'universityGoals',name:'升学目标',path:'/teacher/university-goals'}, {context:'graduationApplications',name:'申请管理',path:'/teacher/graduation'}];
@Injectable({providedIn:'root'})
export class TeacherFormsService {
 constructor(private auth: AuthService) {}
 private get key() { return `teacher-forms.v1.${this.auth.getCurrentUserId()}`; }
 defaults(): TeacherForm[] { return FORM_PRESETS.map(p=>({id:p.context,name:p.name,context:p.context,hidden:false,custom:false,columns:[...STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT[p.context]]})); }
 load(): TeacherForm[] {
  try {
   const raw=JSON.parse(localStorage.getItem(this.key)||'null');
   if (!Array.isArray(raw)) return this.defaults();
   const defaults=this.defaults(); const seen=new Set<string>(); const result:TeacherForm[]=[];
   for(const item of raw) {
    if(!item || typeof item.id!=='string' || seen.has(item.id) || !FORM_PRESETS.some(p=>p.context===item.context)) continue;
    const system=defaults.find(p=>p.id===item.id);
    if(!system && !item.id.startsWith('custom-')) continue;
    const name=typeof item.name==='string'?item.name.trim().slice(0,40):'';
    if(!name) continue;
    seen.add(item.id);
    const allowed=STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT[item.context as StudentManagementPageContext];
    const columns=Array.isArray(item.columns)?item.columns.filter((k:StudentListColumnKey)=>allowed.includes(k)):[...allowed];
    result.push({...system,...item,name,custom:!system,hidden:item.hidden===true,columns:Array.from(new Set(columns.includes('name') ? columns : ['name',...columns]))} as TeacherForm);
   }
   return [...result,...defaults.filter(p=>!seen.has(p.id))];
  } catch { return this.defaults(); }
 }
 save(forms:TeacherForm[]) { localStorage.setItem(this.key,JSON.stringify(forms)); }
 path(form:TeacherForm) {return FORM_PRESETS.find(p=>p.context===form.context)!.path;}
}
