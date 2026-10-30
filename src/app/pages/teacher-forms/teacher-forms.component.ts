import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TeacherFormsService, TeacherForm, FORM_PRESETS } from '../../services/teacher-forms.service';
import { STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT, StudentListColumnKey, StudentManagementPageContext } from '../../shared/student-fields/student-field-presets';
@Component({standalone:true,imports:[CommonModule,FormsModule,RouterModule],templateUrl:'./teacher-forms.component.html',styleUrl:'./teacher-forms.component.scss'})
export class TeacherFormsComponent {
 forms:TeacherForm[]; presets=FORM_PRESETS; draft:TeacherForm|null=null; message=''; error=''; dragging:string|null=null;
 labels:Record<string,string>={name:'姓名',birthday:'出生年月日',email:'邮箱',phone:'电话',graduation:'毕业时间',serviceItems:'服务项目',teacherNote:'老师备注',profile:'档案',documents:'文档',resetPassword:'重置密码',archive:'归档',schoolName:'学校',schoolBoard:'教育局',coursePlan:'课程表',motherLanguage:'母语',ielts:'语言成绩',languageTracking:'语言跟踪',languageCourseStatus:'报课情况',ossltResult:'OSSLT 成绩',ossltTracking:'OSSLT 跟踪',osslcCourseLocation:'OSSLC 上课地点',city:'城市',volunteerTracking:'义工跟踪',extracurricular:'课外活动',universityGoals:'大学目标',graduationStage:'升学阶段',interviewCourse:'面试课'};
 constructor(public store:TeacherFormsService){this.forms=store.load();}
 get visible(){return this.forms.filter(f=>!f.hidden);}
 get options(){return this.draft?STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT[this.draft.context]:[];}
 create(){this.error='';this.draft={id:'custom-'+Array.from(crypto.getRandomValues(new Uint32Array(4)), n=>n.toString(16).padStart(8,'0')).join(''),name:'',context:'students',hidden:false,custom:true,columns:[...STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT.students]};}
 edit(form:TeacherForm){this.error='';this.draft={...form,columns:[...form.columns]};}
 base(context:StudentManagementPageContext){if(this.draft){this.draft.context=context;this.draft.columns=[...STUDENT_LIST_DEFAULT_COLUMN_KEYS_BY_CONTEXT[context]];}}
 column(key:StudentListColumnKey,checked:boolean){if(!this.draft||key==='name')return;this.draft.columns=checked?[...this.draft.columns,key]:this.draft.columns.filter(k=>k!==key);}
 moveColumn(index:number,delta:number){if(!this.draft)return;const a=this.draft.columns;const j=index+delta;if(j<0||j>=a.length)return;[a[index],a[j]]=[a[j],a[index]];}
 apply(){if(!this.draft)return;const name=this.draft.name.trim();if(!name){this.error='请填写表单名称。';return;}if(this.forms.some(f=>f.id!==this.draft!.id&&f.name===name)){this.error='已有同名表单，请换一个名称。';return;}const next={...this.draft,name};const i=this.forms.findIndex(f=>f.id===next.id);if(i<0)this.forms.push(next);else this.forms[i]=next;this.draft=null;this.error='';this.message='配置已调整，请保存设置。';}
 remove(form:TeacherForm){this.forms=this.forms.filter(f=>f.id!==form.id);this.message='已移除个人视图，保存后生效。学生数据保留。';}
 move(index:number,delta:number){const j=index+delta;if(j<0||j>=this.forms.length)return;[this.forms[index],this.forms[j]]=[this.forms[j],this.forms[index]];this.message='顺序已调整，请保存设置。';}
 drop(target:string){const i=this.forms.findIndex(f=>f.id===this.dragging);const j=this.forms.findIndex(f=>f.id===target);if(i>=0&&j>=0){const [item]=this.forms.splice(i,1);this.forms.splice(j,0,item);}this.dragging=null;}
 showAll(){this.forms.forEach(f=>f.hidden=false);}
 resetOrder(){const custom=this.forms.filter(f=>f.custom);this.forms=[...this.store.defaults().map(f=>this.forms.find(x=>x.id===f.id)||f),...custom];}
 save(){try{this.store.save(this.forms);this.message='设置已保存。';this.error='';}catch{this.error='保存失败，请检查浏览器存储后重试。';}}
 cancel(){this.forms=this.store.load();this.draft=null;this.error='';this.message='未保存的调整已取消。';}
}
