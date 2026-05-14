import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import {
  GraduationApplication,
  GraduationApplicationStageService,
  GraduationApplicationStatus,
} from '../../services/graduation-application-stage.service';

interface ApplicationGroup {
  universityName: string;
  applications: GraduationApplication[];
}

@Component({
  selector: 'app-graduation-applications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graduation-applications.component.html',
  styleUrl: './graduation-applications.component.scss',
})
export class GraduationApplicationsComponent implements OnInit {
  readonly statusOptions: GraduationApplicationStatus[] = [
    'PREPARING',
    'READY_TO_SUBMIT',
    'SUBMITTED',
    'WAITING_RESULT',
    'OFFER_RECEIVED',
  ];

  studentId = 0;
  loading = false;
  error = '';
  applications: GraduationApplication[] = [];
  updatingId: string | number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public graduationStage: GraduationApplicationStageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resolveContext();
    this.loadApplications();
  }

  get groups(): ApplicationGroup[] {
    const groups = new Map<string, GraduationApplication[]>();
    for (const application of this.sortedApplications) {
      const universityName = application.universityName?.trim() || '未命名大学';
      groups.set(universityName, [...(groups.get(universityName) || []), application]);
    }
    return Array.from(groups.entries()).map(([universityName, applications]) => ({
      universityName,
      applications,
    }));
  }

  get sortedApplications(): GraduationApplication[] {
    return [...this.applications].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  get totalCount(): number {
    return this.applications.length;
  }

  get submittedCount(): number {
    return this.applications.filter((item) =>
      ['SUBMITTED', 'WAITING_RESULT', 'OFFER_RECEIVED'].includes(item.status)
    ).length;
  }

  get offerCount(): number {
    return this.applications.filter((item) => item.status === 'OFFER_RECEIVED').length;
  }

  get pageTitle(): string {
    return '学生正式申请';
  }

  goBack(): void {
    this.router.navigate(['/teacher/graduation']);
  }

  loadApplications(): void {
    if (this.studentId <= 0) {
      this.error = '缺少学生 ID';
      return;
    }

    this.loading = true;
    this.error = '';
    this.graduationStage
      .listApplications(this.studentId)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (rows) => {
          this.applications = rows || [];
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '读取申请进度失败。';
          this.applications = [];
          this.cdr.markForCheck();
        },
      });
  }

  updateStatus(application: GraduationApplication, status: GraduationApplicationStatus): void {
    if (this.updatingId !== null || application.status === status) return;

    const applicationId = Number(application.id);
    const nextApplication = {
      ...application,
      status,
      updatedAt: new Date().toISOString(),
    };

    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      this.replaceApplication(nextApplication);
      return;
    }

    this.updatingId = application.id;
    this.error = '';
    this.graduationStage
      .updateApplication(applicationId, {
        universityId: Number(application.universityId),
        programId: Number(application.programId),
        status,
        sourceAspirationId: application.sourceAspirationId,
      })
      .pipe(
        finalize(() => {
          this.updatingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (saved) => {
          this.replaceApplication({ ...application, ...saved, status });
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '更新申请进度失败。';
          this.cdr.markForCheck();
        },
      });
  }

  trackGroup(_index: number, group: ApplicationGroup): string {
    return group.universityName;
  }

  trackApplication(_index: number, application: GraduationApplication): string | number {
    return application.id;
  }

  displayUpdatedAt(value: string | undefined): string {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return '-';
    return new Date(timestamp).toLocaleString();
  }

  private replaceApplication(nextApplication: GraduationApplication): void {
    this.applications = this.applications.map((item) =>
      String(item.id) === String(nextApplication.id) ? nextApplication : item
    );
    this.cdr.markForCheck();
  }

  private resolveContext(): void {
    const routeStudentId = Math.trunc(Number(this.route.snapshot.paramMap.get('studentId')));
    this.studentId = Number.isFinite(routeStudentId) && routeStudentId > 0 ? routeStudentId : 0;
  }

  private extractErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (!error || typeof error !== 'object') return '';
    const source = error as { error?: unknown; message?: unknown };
    if (source.error && typeof source.error === 'object') {
      const nested = source.error as { message?: unknown; error?: unknown };
      return String(nested.message || nested.error || '').trim();
    }
    return String(source.message || source.error || '').trim();
  }
}
