import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';

interface MockUniversity {
  id: number;
  name: string;
  campuses: string[];
}

interface MockProgram {
  id: number;
  universityId: number;
  name: string;
  faculty: string;
}

interface UniversityChoice {
  id: number;
  universityId: number;
  universityName: string;
  campus: string;
  programId: number;
  programName: string;
  faculty: string;
  sortOrder: number;
}

interface ChoiceDraft {
  universityName: string;
  campus: string;
  programName: string;
}

@Component({
  selector: 'app-student-university-goals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-university-goals.component.html',
  styleUrl: './student-university-goals.component.scss',
})
export class StudentUniversityGoalsComponent implements OnInit {
  private readonly storagePrefix = 'university-goals-ouac-prototype';
  private readonly defaultStudentKey = 'prototype';

  readonly universities: MockUniversity[] = [
    {
      id: 1,
      name: '模拟多伦多大学',
      campuses: ['St. George', 'Scarborough', 'Mississauga'],
    },
    { id: 2, name: '模拟大学 A', campuses: [] },
    { id: 3, name: '模拟大学 B', campuses: [] },
    { id: 4, name: '模拟大学 C', campuses: [] },
  ];

  readonly programs: MockProgram[] = [
    { id: 101, universityId: 1, name: 'Education Studies', faculty: 'Faculty of Education' },
    { id: 102, universityId: 1, name: 'Child Development', faculty: 'Faculty of Education' },
    { id: 103, universityId: 1, name: 'Teaching and Learning', faculty: 'Faculty of Education' },
    { id: 201, universityId: 2, name: 'Primary Education', faculty: 'School of Education' },
    { id: 202, universityId: 2, name: 'Language Education', faculty: 'School of Education' },
    { id: 301, universityId: 3, name: 'Educational Psychology', faculty: 'Education Department' },
    { id: 302, universityId: 3, name: 'Special Education', faculty: 'Education Department' },
    { id: 401, universityId: 4, name: 'Curriculum Studies', faculty: 'Faculty of Teaching' },
    { id: 402, universityId: 4, name: 'Early Childhood Education', faculty: 'Faculty of Teaching' },
  ];

  studentKey = this.defaultStudentKey;
  teacherMode = false;
  choices: UniversityChoice[] = [];
  draft: ChoiceDraft = this.createEmptyDraft();
  modalOpen = false;
  message = '';
  dragIndex: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.resolveContext();
    this.loadChoices();
  }

  get selectedUniversity(): MockUniversity | null {
    const universityName = this.draft.universityName.trim();
    return this.universities.find((item) => item.name === universityName) ?? null;
  }

  get visibleUniversities(): MockUniversity[] {
    const keyword = this.draft.universityName.trim().toLowerCase();
    if (!keyword) return this.universities;
    return this.universities.filter((item) => item.name.toLowerCase().includes(keyword));
  }

  get visiblePrograms(): MockProgram[] {
    const university = this.selectedUniversity;
    if (!university) return [];
    const keyword = this.draft.programName.trim().toLowerCase();
    return this.programs.filter((item) => {
      if (item.universityId !== university.id) return false;
      if (!keyword) return true;
      return `${item.name} ${item.faculty}`.toLowerCase().includes(keyword);
    });
  }

  goBack(): void {
    this.router.navigate([this.teacherMode ? '/teacher/students' : '/dashboard']);
  }

  openModal(): void {
    this.draft = this.createEmptyDraft();
    this.message = '';
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
  }

  onUniversityInput(): void {
    this.draft.campus = '';
    this.draft.programName = '';
  }

  selectUniversity(university: MockUniversity): void {
    this.draft.universityName = university.name;
    this.draft.campus = '';
    this.draft.programName = '';
  }

  selectProgram(program: MockProgram): void {
    this.draft.programName = program.name;
  }

  addChoice(): void {
    const university = this.selectedUniversity;
    const programName = this.draft.programName.trim();
    const program = this.programs.find(
      (item) => item.universityId === university?.id && item.name === programName
    );

    if (!university) {
      this.message = '请选择大学。';
      return;
    }
    if (university.campuses.length > 0 && !this.draft.campus) {
      this.message = '请选择校区。';
      return;
    }
    if (!program || program.universityId !== university.id) {
      this.message = '请选择该大学下的专业。';
      return;
    }

    const nextChoice: UniversityChoice = {
      id: Date.now(),
      universityId: university.id,
      universityName: university.name,
      campus: this.draft.campus,
      programId: program.id,
      programName: program.name,
      faculty: program.faculty,
      sortOrder: this.choices.length + 1,
    };

    this.choices = this.reorder([...this.choices, nextChoice]);
    this.saveChoices();
    this.modalOpen = false;
    this.message = '已添加一条大学目标。';
  }

  removeChoice(choice: UniversityChoice): void {
    this.choices = this.reorder(this.choices.filter((item) => item.id !== choice.id));
    this.saveChoices();
    this.message = '已删除大学目标。';
  }

  onDragStart(index: number): void {
    this.dragIndex = index;
  }

  onDragOver(event: DragEvent): void {
    if (this.dragIndex === null) return;
    event.preventDefault();
  }

  onDrop(targetIndex: number): void {
    const sourceIndex = this.dragIndex;
    this.dragIndex = null;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    const next = [...this.choices];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    this.choices = this.reorder(next);
    this.saveChoices();
    this.message = '顺序已保存。';
  }

  onDragEnd(): void {
    this.dragIndex = null;
  }

  trackChoice(_index: number, choice: UniversityChoice): number {
    return choice.id;
  }

  private resolveContext(): void {
    const routeStudentId = this.route.snapshot.paramMap.get('studentId');
    if (routeStudentId) {
      this.teacherMode = true;
      this.studentKey = routeStudentId;
      return;
    }

    const sessionStudentId = this.auth.getSession()?.studentId;
    this.studentKey = sessionStudentId ? String(sessionStudentId) : this.defaultStudentKey;
  }

  private loadChoices(): void {
    const raw = window.localStorage.getItem(this.storageKey());
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UniversityChoice[];
        if (Array.isArray(parsed)) {
          this.choices = this.reorder(parsed);
          return;
        }
      } catch {
        this.choices = [];
      }
    }

    this.choices = this.createStarterChoices();
    this.saveChoices();
  }

  private saveChoices(): void {
    window.localStorage.setItem(this.storageKey(), JSON.stringify(this.choices));
  }

  private createStarterChoices(): UniversityChoice[] {
    return [
      {
        id: 1001,
        universityId: 1,
        universityName: '模拟多伦多大学',
        campus: 'St. George',
        programId: 101,
        programName: 'Education Studies',
        faculty: 'Faculty of Education',
        sortOrder: 1,
      },
      {
        id: 1002,
        universityId: 2,
        universityName: '模拟大学 A',
        campus: '',
        programId: 201,
        programName: 'Primary Education',
        faculty: 'School of Education',
        sortOrder: 2,
      },
    ];
  }

  private reorder(items: UniversityChoice[]): UniversityChoice[] {
    return items.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
  }

  private createEmptyDraft(): ChoiceDraft {
    return {
      universityName: '',
      campus: '',
      programName: '',
    };
  }

  private storageKey(): string {
    return `${this.storagePrefix}-${this.studentKey}`;
  }

}
