import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { CoursePlanPrototypeComponent } from '../student-profile/course-plan-prototype.component';

@Component({
  selector: 'app-student-course-plan',
  standalone: true,
  imports: [CommonModule, CoursePlanPrototypeComponent],
  templateUrl: './student-course-plan.component.html',
  styleUrl: './student-course-plan.component.scss',
})
export class StudentCoursePlanComponent implements OnInit, OnDestroy {
  managedMode = false;
  studentId = 0;

  private routeSub: Subscription | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.applyRouteContext(params);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  backToDashboard(): void {
    if (this.managedMode) {
      this.router.navigate(['/teacher/dashboard']);
      return;
    }
    this.router.navigate(['/dashboard']);
  }

  goProfile(): void {
    if (this.managedMode && this.studentId > 0) {
      this.router.navigate(['/teacher/students', this.studentId, 'profile']);
      return;
    }
    this.router.navigate(['/student/profile']);
  }

  private applyRouteContext(params: ParamMap): void {
    const routeStudentId = params.get('studentId');
    if (routeStudentId === null) {
      this.managedMode = false;
      this.studentId = 0;
      return;
    }

    const parsed = Number(routeStudentId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.managedMode = true;
      this.studentId = 0;
      return;
    }

    this.managedMode = true;
    this.studentId = Math.trunc(parsed);
  }
}
