import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

type Gender = '' | 'Male' | 'Female' | 'Other';

interface AddressModel {
  streetAddress: string;
  streetAddressLine2: string;
  city: string;
  state: string;
  country: string;
  postal: string;
}

type SchoolType = '' | 'Ontario High School' | 'Private School' | 'International School' | 'Other';

interface CourseModel {
  schoolType: SchoolType;
  schoolName: string;
  courseCode: string;

  mark: number | null;       // 0-100
  gradeLevel: number | null; // 9-12

  startTime: string; // yyyy-mm-dd
  endTime: string;   // yyyy-mm-dd
}


interface StudentProfileModel {
  // basic
  legalFirstName: string;
  legalLastName: string;
  preferredName: string;
  gender: Gender;
  birthday: string; // yyyy-mm-dd
  phone: string;
  email: string;

  // immigration / language
  statusInCanada: string;
  citizenship: string;
  firstLanguage: string;
  firstBoardingDate: string; // yyyy-mm-dd

  // address
  address: AddressModel;

  // school
  oenNumber: string;
  ib: string;
  ap: boolean;

  // documents / notes
  identityFileNote: string;

  // courses
  otherCourses: CourseModel[];
}

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './student-profile.html',
})
export class StudentProfile {
  saving = false;
  saved = false;
  error = '';

  // ✅ 先做前端：localStorage key
  private readonly storageKey = 'sm_student_profile';

  model: StudentProfileModel = this.load() ?? this.defaultModel();

  constructor(private router: Router) {}

  back() {
    this.router.navigate(['/dashboard']);
  }

  addCourse() {
    this.model.otherCourses.push({
      schoolType: '',
      schoolName: '',
      courseCode: '',
      mark: null,
      gradeLevel: null,
      startTime: '',
      endTime: '',
    });
  }

  removeCourse(i: number) {
    this.model.otherCourses.splice(i, 1);
  }

  save() {
    this.error = '';
    this.saved = false;
    this.saving = true;

    try {
      // 你可以先不做强校验，先保证流程跑通
      localStorage.setItem(this.storageKey, JSON.stringify(this.model));
      this.saved = true;
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to save locally.';
    } finally {
      this.saving = false;
    }
  }

  private defaultModel(): StudentProfileModel {
    return {
      legalFirstName: '',
      legalLastName: '',
      preferredName: '',
      gender: '',
      birthday: '',
      phone: '',
      email: '',

      statusInCanada: '',
      citizenship: '',
      firstLanguage: '',
      firstBoardingDate: '',

      address: {
        streetAddress: '',
        streetAddressLine2: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
      },

      oenNumber: '',
      ib: '',
      ap: false,

      identityFileNote: '',

      otherCourses: [],
    };
  }

  private load(): StudentProfileModel | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StudentProfileModel;
    } catch {
      return null;
    }
  }
}
