import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

type YesNo = 'YES' | 'NO';

interface Address {
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  state: string;
  country: string;
  postal: string;
}

interface CourseRecord {
  schoolType: 'MAIN' | 'OTHER';
  courseCode: string;
  schoolName: string;
  mark: number | null;
  gradeLevel: number | null;
  startTime: string; // yyyy-mm-dd
  endTime: string;   // yyyy-mm-dd
}

interface StudentProfileDraft {
  birthday: string; // yyyy-mm-dd
  statusInCanada: string;

  address: Address;

  phone: string;
  citizenship: string;
  firstLanguage: string;

  firstBoardingDate: string; // yyyy-mm-dd

  oenNumber: string; // nullable in backend, 这里先当 string
  ib: string;
  ap: boolean;

  // 先只做文本占位，文件上传后面再接
  identityFileNote: string;

  otherCourses: CourseRecord[];
}

const STORAGE_KEY = 'sm_student_profile_draft';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-profile.html',
})
export class StudentProfileComponent {
  saving = false;
  saved = false;
  error = '';

  model: StudentProfileDraft = this.loadDraft();

  constructor(private router: Router) {}

  back() {
    this.router.navigate(['/dashboard']);
  }

  addCourse() {
    this.model.otherCourses.push({
      schoolType: 'OTHER',
      courseCode: '',
      schoolName: '',
      mark: null,
      gradeLevel: null,
      startTime: '',
      endTime: '',
    });
  }

  removeCourse(i: number) {
    this.model.otherCourses.splice(i, 1);
    this.persist();
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.model));
  }

  save() {
    this.error = '';
    this.saved = false;

    // ✅ 今天先做最轻的校验（你可以随时加）
    if (!this.model.phone.trim()) {
      this.error = 'Phone is required (for now).';
      return;
    }
    if (!this.model.address.city.trim()) {
      this.error = 'City is required (for now).';
      return;
    }

    this.saving = true;

    // 模拟保存
    setTimeout(() => {
      this.persist();
      this.saving = false;
      this.saved = true;
    }, 300);
  }

  private loadDraft(): StudentProfileDraft {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as StudentProfileDraft;
      } catch {}
    }

    // 默认值
    return {
      birthday: '',
      statusInCanada: '',

      address: {
        streetAddress: '',
        streetAddressLine2: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
      },

      phone: '',
      citizenship: '',
      firstLanguage: '',

      firstBoardingDate: '',

      oenNumber: '',
      ib: '',
      ap: false,

      identityFileNote: '',

      otherCourses: [],
    };
  }
}
