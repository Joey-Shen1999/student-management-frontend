import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeacherFormsService } from './teacher-forms.service';
import { TeacherFormsComponent } from '../pages/teacher-forms/teacher-forms.component';
describe('Personal teacher forms',()=>{
 let user=1; let store:TeacherFormsService;
 beforeEach(()=>{localStorage.clear();user=1;store=new TeacherFormsService({getCurrentUserId:()=>user} as any);});
 it('isolates hidden forms and ordering by teacher',()=>{const list=store.load();list[0].hidden=true;list.reverse();store.save(list);expect(store.load()[7].hidden).toBe(true);user=2;expect(store.load()[0].hidden).toBe(false);user=1;expect(store.load()[0].id).toBe(list[0].id);});
 it('creates named custom views and preserves system defaults and data',()=>{const ui=new TeacherFormsComponent(store);ui.create();ui.draft!.name='我的申请跟进';ui.base('graduationApplications');ui.column('interviewCourse',false);ui.apply();ui.save();const custom=store.load().find(f=>f.custom)!;expect(custom.name).toBe('我的申请跟进');expect(custom.columns).not.toContain('interviewCourse');expect(store.load().find(f=>f.id==='graduationApplications')!.columns).toContain('interviewCourse');ui.remove(custom);ui.save();expect(store.load()).toHaveLength(8);});
 it('cancels changes, rejects duplicate names, and keeps hidden positions',()=>{const ui=new TeacherFormsComponent(store);ui.create();ui.draft!.name='学生管理';ui.apply();expect(ui.error).not.toBe('');ui.cancel();ui.forms[0].hidden=true;ui.move(0,1);ui.save();const id=ui.forms[1].id;ui.showAll();expect(ui.forms[1].id).toBe(id);ui.move(1,1);ui.cancel();expect(ui.forms[1].id).toBe(id);});
 it('preserves custom field order after saving',()=>{const ui=new TeacherFormsComponent(store);ui.create();ui.draft!.name='排序测试';ui.moveColumn(1,-1);ui.apply();ui.save();expect(store.load().find(f=>f.custom)!.columns.slice(0,2)).toEqual(['birthday','name']);});
 it('supports drag sorting and restores all hidden entries',()=>{const ui=new TeacherFormsComponent(store);ui.dragging='graduationApplications';ui.drop('students');expect(ui.forms[0].id).toBe('graduationApplications');ui.forms.forEach(f=>f.hidden=true);ui.save();expect(store.load().every(f=>f.hidden)).toBe(true);ui.showAll();expect(ui.visible.length).toBe(8);ui.resetOrder();expect(ui.forms[0].id).toBe('students');});
 it('keeps the draft when saving is unavailable',()=>{const ui=new TeacherFormsComponent(store);const spy=vi.spyOn(store,'save').mockImplementation(()=>{throw new Error('full');});ui.forms[0].hidden=true;ui.save();expect(ui.error).not.toBe('');expect(ui.forms[0].hidden).toBe(true);spy.mockRestore();});
 it('falls back safely from corrupt browser preferences',()=>{localStorage.setItem('teacher-forms.v1.1','invalid');expect(store.load()).toHaveLength(8);});
});
