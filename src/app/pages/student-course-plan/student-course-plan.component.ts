import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { CoursePlanPrototypeComponent } from '../student-profile/course-plan-prototype.component';

@Component({
  selector: 'app-student-course-plan',
  standalone: true,
  imports: [CommonModule, CoursePlanPrototypeComponent],
  templateUrl: './student-course-plan.component.html',
  styleUrl: './student-course-plan.component.scss',
})
export class StudentCoursePlanComponent {
  constructor(private router: Router) {}

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goProfile(): void {
    this.router.navigate(['/student/profile']);
  }
}
