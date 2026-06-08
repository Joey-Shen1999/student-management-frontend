import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  GraduationApplication,
  GraduationApplicationHistoryEntry,
  GraduationApplicationHistoryFieldChange,
  GraduationApplicationPortalCredential,
  GraduationApplicationStageService,
  GraduationApplicationStatus,
  GraduationApplicationUniversitySummary,
  GraduationApplicationUniversityStudent,
} from '../../services/graduation-application-stage.service';
import { AppLanguageService } from '../../services/app-language.service';
import {
  University,
  UniversityAspirationService,
} from '../../services/university-aspiration.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocalizedText, uiText } from '../../shared/i18n/ui-translations';
import { navigateBack } from '../../utils/navigate-back';

type OverviewMessage = '' | LocalizedText;
type PortalCredentialField = 'schoolAccount' | 'schoolEmail' | 'schoolPassword';
type PortalRequirementField = 'interviewRequired' | 'languageScoreRequired';

interface PortalCredentialDraft {
  schoolAccount: string;
  schoolEmail: string;
  schoolPassword: string;
  studentVisible: boolean;
  interviewRequired: boolean;
  languageScoreRequired: boolean;
}

@Component({
  selector: 'app-university-application-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './university-application-overview.component.html',
  styleUrl: './university-application-overview.component.scss',
})
export class UniversityApplicationOverviewComponent implements OnInit {
  readonly ui = {
    applicationManagement: uiText('\u7533\u8bf7\u7ba1\u7406', 'Application Management'),
    pageTitle: uiText('\u6309\u5927\u5b66\u67e5\u770b\u7533\u8bf7', 'Applications by University'),
    refresh: uiText('\u5237\u65b0', 'Refresh'),
    back: uiText('\u8fd4\u56de', 'Back'),
    chooseUniversity: uiText('\u9009\u62e9\u5927\u5b66', 'Select University'),
    universityPlaceholder: uiText(
      '\u8f93\u5165\u5927\u5b66\u540d\u79f0\u3001\u57ce\u5e02\u6216\u7701\u4efd',
      'Search by university, city, or province'
    ),
    clear: uiText('\u6e05\u7a7a', 'Clear'),
    loadingUniversities: uiText(
      '\u6b63\u5728\u8bfb\u53d6\u5927\u5b66\u5217\u8868...',
      'Loading universities...'
    ),
    loadingApplicationCounts: uiText(
      '\u6b63\u5728\u8bfb\u53d6\u7533\u8bf7\u7edf\u8ba1...',
      'Loading application counts...'
    ),
    currentUniversity: uiText('\u5f53\u524d\u5927\u5b66', 'Current University'),
    applicantStudents: uiText('\u7533\u8bf7\u5b66\u751f', 'Students'),
    applicationPrograms: uiText('\u7533\u8bf7\u4e13\u4e1a', 'Programs'),
    optionStudents: uiText('\u4f4d\u5b66\u751f', 'students'),
    optionPrograms: uiText('\u4e2a\u4e13\u4e1a', 'programs'),
    optionNoApplications: uiText('\u6682\u65e0\u5b66\u751f\u7533\u8bf7', 'No applications'),
    submitted: uiText('\u5df2\u63d0\u4ea4', 'Submitted'),
    offer: uiText('Offer', 'Offer'),
    pending: uiText('\u5f85\u5904\u7406', 'Pending'),
    expanded: uiText('\u5df2\u5c55\u5f00', 'Expanded'),
    collapsed: uiText('\u5df2\u6536\u8d77', 'Collapsed'),
    stageEnabled: uiText('\u5df2\u8fdb\u5165', 'Entered'),
    status: uiText('\u8fdb\u5ea6', 'Status'),
    updatedAt: uiText('\u66f4\u65b0', 'Updated'),
    updating: uiText('\u66f4\u65b0\u4e2d...', 'Updating...'),
    emptySelection: uiText(
      '\u5148\u9009\u62e9\u4e00\u6240\u5927\u5b66\uff0c\u7cfb\u7edf\u4f1a\u7ad6\u5411\u5217\u51fa\u6240\u6709\u6b63\u5f0f\u7533\u8bf7\u8be5\u5927\u5b66\u7684\u5b66\u751f\u3002',
      'Choose a university first. The page will list all students with formal applications to that university.'
    ),
    loadingApplications: uiText(
      '\u6b63\u5728\u8bfb\u53d6\u7533\u8bf7\u5b66\u751f...',
      'Loading applicant students...'
    ),
    retry: uiText('\u91cd\u8bd5', 'Retry'),
    noApplications: uiText(
      '\u6682\u65e0\u5b66\u751f\u6b63\u5f0f\u7533\u8bf7\u8fd9\u6240\u5927\u5b66\u3002',
      'No students have formal applications to this university yet.'
    ),
    studentId: uiText('\u5b66\u751f ID', 'Student ID'),
    username: uiText('\u767b\u5f55\u8d26\u53f7', 'Login Account'),
    viewApplication: uiText('\u67e5\u770b\u7533\u8bf7', 'View Application'),
    universityLoadError: uiText(
      '\u5927\u5b66\u5217\u8868\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'Failed to load universities. Please try again later.'
    ),
    applicationLoadError: uiText(
      '\u7533\u8bf7\u6570\u636e\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
      'Failed to load application data. Please try again later.'
    ),
    applicationUpdateError: uiText(
      '\u7533\u8bf7\u8fdb\u5ea6\u66f4\u65b0\u5931\u8d25\uff0c\u8bf7\u8fdb\u5165\u5b66\u751f\u7533\u8bf7\u9875\u91cd\u8bd5\u3002',
      'Failed to update application status. Please open the student application page and try again.'
    ),
    statusPreparing: uiText('\u51c6\u5907\u4e2d', 'Preparing'),
    statusReadyToSubmit: uiText('\u5f85\u63d0\u4ea4', 'Ready to Submit'),
    statusSubmitted: uiText('\u5df2\u63d0\u4ea4', 'Submitted'),
    statusWaitingResult: uiText('\u7b49\u5f85\u7ed3\u679c', 'Waiting for Result'),
    statusOfferReceived: uiText('\u5df2\u6536\u5230 Offer', 'Offer Received'),
    statusOfferAccepted: uiText('\u5df2\u63a5\u6536 Offer', 'Offer Accepted'),
    statusNotAdmitted: uiText('\u672a\u5f55\u53d6', 'Not Admitted'),
    portalTitle: uiText('\u5b66\u6821\u8d26\u53f7\u8d44\u6599', 'School Account'),
    loginWebsite: uiText('\u767b\u5f55\u7f51\u7ad9', 'Login Website'),
    schoolAccount: uiText('\u5b66\u6821\u8d26\u53f7', 'School Account'),
    schoolEmail: uiText('\u7533\u8bf7\u90ae\u7bb1', 'Application Email'),
    schoolPassword: uiText('\u5b66\u6821\u5bc6\u7801', 'School Password'),
    clickToCopy: uiText('\u70b9\u51fb\u590d\u5236', 'Click to copy'),
    copied: uiText('\u5df2\u590d\u5236', 'Copied'),
    copyFailed: uiText(
      '\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u9009\u62e9\u590d\u5236\u3002',
      'Copy failed. Please copy manually.'
    ),
    blank: uiText('\u7559\u767d', 'Blank'),
    edit: uiText('\u4fee\u6539', 'Edit'),
    save: uiText('\u4fdd\u5b58', 'Save'),
    saving: uiText('\u4fdd\u5b58\u4e2d...', 'Saving...'),
    cancel: uiText('\u53d6\u6d88', 'Cancel'),
    loadingPortal: uiText(
      '\u6b63\u5728\u8bfb\u53d6\u5b66\u6821\u8d26\u53f7...',
      'Loading school account...'
    ),
    portalLoadError: uiText(
      '\u5b66\u6821\u8d26\u53f7\u8d44\u6599\u8bfb\u53d6\u5931\u8d25\u3002',
      'Failed to load school account.'
    ),
    portalSaveError: uiText(
      '\u5b66\u6821\u8d26\u53f7\u8d44\u6599\u4fdd\u5b58\u5931\u8d25\u3002',
      'Failed to save school account.'
    ),
    studentVisible: uiText('\u5b66\u751f\u53ef\u89c1', 'Student Visible'),
    studentHidden: uiText('\u5b66\u751f\u9690\u85cf', 'Hidden from Student'),
    interview: uiText('\u9762\u8bd5', 'Interview'),
    languageScore: uiText('\u8bed\u8a00\u6210\u7ee9', 'Language Score'),
    operationHistory: uiText('\u64cd\u4f5c\u8bb0\u5f55', 'Operation History'),
    hideHistory: uiText('\u6536\u8d77\u8bb0\u5f55', 'Hide History'),
    historyLoading: uiText('\u6b63\u5728\u8bfb\u53d6\u64cd\u4f5c\u8bb0\u5f55...', 'Loading operation history...'),
    historyEmpty: uiText('\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55', 'No operation history yet'),
    historyLoadError: uiText('\u64cd\u4f5c\u8bb0\u5f55\u8bfb\u53d6\u5931\u8d25\u3002', 'Failed to load operation history.'),
    latestHistoryCount: uiText('\u6700\u8fd1', 'Latest'),
    totalHistoryCount: uiText('\u5171', 'Total'),
    historyItemUnit: uiText('\u6761', 'items'),
    historyChangedTo: uiText('\u6539\u4e3a', 'to'),
    systemActor: uiText('\u7cfb\u7edf', 'System'),
    roleAdmin: uiText('\u7ba1\u7406\u5458', 'Admin'),
    roleTeacher: uiText('\u8001\u5e08', 'Teacher'),
    roleStudent: uiText('\u5b66\u751f', 'Student'),
    operationEnterStage: uiText('\u8fdb\u5165\u5347\u5b66\u9636\u6bb5', 'Entered Application Stage'),
    operationConfirmStage: uiText('\u786e\u8ba4\u6b63\u5f0f\u7533\u8bf7', 'Confirmed Formal Applications'),
    operationCreateApplication: uiText('\u65b0\u589e\u7533\u8bf7', 'Created Application'),
    operationUpdateApplication: uiText('\u4fee\u6539\u7533\u8bf7', 'Updated Application'),
    operationDeleteApplication: uiText('\u5220\u9664\u7533\u8bf7', 'Deleted Application'),
    operationReorderApplications: uiText('\u8c03\u6574\u987a\u5e8f', 'Reordered Applications'),
    operationUpdateApplicationAccount: uiText('\u4fee\u6539\u7533\u8bf7\u8d26\u53f7', 'Updated Application Account'),
    operationUpdatePortalCredential: uiText('\u4fee\u6539\u5b66\u6821\u8d26\u53f7', 'Updated School Account'),
    fieldGraduationStage: uiText('\u5347\u5b66\u9636\u6bb5', 'Application Stage'),
    fieldApplication: uiText('\u7533\u8bf7', 'Application'),
    fieldApplicationOrder: uiText('\u7533\u8bf7\u987a\u5e8f', 'Application Order'),
    fieldUniversity: uiText('\u5927\u5b66', 'University'),
    fieldProgram: uiText('\u4e13\u4e1a', 'Program'),
    fieldApplicationEmail: uiText('\u7533\u8bf7\u90ae\u7bb1', 'Application Email'),
    fieldApplicationPassword: uiText('\u7533\u8bf7\u5bc6\u7801', 'Application Password'),
    fieldBooleanYes: uiText('\u662f', 'Yes'),
    fieldBooleanNo: uiText('\u5426', 'No'),
    fieldEmpty: uiText('\u7a7a', 'Empty'),
    fieldGeneric: uiText('\u5b57\u6bb5', 'Field'),
  };

  readonly statusOptions: GraduationApplicationStatus[] = [
    'PREPARING',
    'READY_TO_SUBMIT',
    'SUBMITTED',
    'WAITING_RESULT',
    'OFFER_RECEIVED',
    'OFFER_ACCEPTED',
    'NOT_ADMITTED',
  ];
  readonly historyPageSize = 20;

  universities: University[] = [];
  universityQuery = '';
  universityOptionsOpen = false;
  selectedUniversityId: number | null = null;
  selectedUniversity: University | null = null;
  students: GraduationApplicationUniversityStudent[] = [];
  universitySummaryById = new Map<number, GraduationApplicationUniversitySummary>();
  expandedStudentIds = new Set<number>();
  updatingApplicationIds = new Set<number | string>();
  portalCredentials = new Map<string, GraduationApplicationPortalCredential>();
  portalDrafts = new Map<string, PortalCredentialDraft>();
  portalErrors = new Map<string, OverviewMessage>();
  portalLoadingKeys = new Set<string>();
  portalSavingKeys = new Set<string>();
  portalEditingKeys = new Set<string>();
  copiedPortalFieldKey: string | null = null;
  historyOpenStudentIds = new Set<number>();
  historyLoadingStudentIds = new Set<number>();
  historyEntriesByStudentId = new Map<number, GraduationApplicationHistoryEntry[]>();
  historyTotalsByStudentId = new Map<number, number>();
  historyErrorsByStudentId = new Map<number, OverviewMessage>();
  loadingUniversities = false;
  loadingUniversitySummaries = false;
  loadingApplications = false;
  universityError: OverviewMessage = '';
  applicationError: OverviewMessage = '';

  constructor(
    private universityApi: UniversityAspirationService,
    private graduationStage: GraduationApplicationStageService,
    private router: Router,
    private language: AppLanguageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUniversities();
    this.loadUniversitySummaries();
  }

  get filteredUniversities(): University[] {
    const query = this.normalizeText(this.universityQuery);
    const rows = this.universities || [];
    const filtered = query
      ? rows
      .filter((university) => {
        const haystack = this.normalizeText(
          `${university.name || ''} ${university.city || ''} ${university.province || ''}`
        );
        return haystack.includes(query);
      })
      : rows;

    return filtered
      .slice()
      .sort((left, right) => this.compareUniversityOptions(left, right))
      .slice(0, 30);
  }

  get totalProgramCount(): number {
    return this.students.reduce((total, student) => total + this.applicationsFor(student).length, 0);
  }

  get submittedCount(): number {
    return this.countByStatus(['SUBMITTED', 'WAITING_RESULT', 'OFFER_RECEIVED', 'OFFER_ACCEPTED']);
  }

  get offerCount(): number {
    return this.countByStatus(['OFFER_RECEIVED', 'OFFER_ACCEPTED']);
  }

  get pendingCount(): number {
    return this.countByStatus(['PREPARING', 'READY_TO_SUBMIT']);
  }

  loadUniversities(): void {
    this.loadingUniversities = true;
    this.universityError = '';

    this.universityApi
      .listUniversities()
      .pipe(
        finalize(() => {
          this.loadingUniversities = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (universities) => {
          this.universities = (universities || []).filter((item) => item && item.id);
        },
        error: () => {
          this.universityError = this.ui.universityLoadError;
          this.universities = [];
        },
      });
  }

  loadUniversitySummaries(): void {
    this.loadingUniversitySummaries = true;

    this.graduationStage
      .listUniversitySummaries()
      .pipe(
        finalize(() => {
          this.loadingUniversitySummaries = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (rows) => {
          this.universitySummaryById = new Map(
            (rows || [])
              .filter((row) => row && Number(row.universityId) > 0)
              .map((row) => [Number(row.universityId), row])
          );
        },
        error: () => {
          this.universitySummaryById = new Map();
        },
      });
  }

  selectUniversity(university: University): void {
    if (!university?.id) return;
    this.selectedUniversityId = university.id;
    this.selectedUniversity = university;
    this.universityQuery = university.name || '';
    this.universityOptionsOpen = false;
    this.clearPortalState();
    this.clearHistoryState();
    this.refreshView();
    this.loadApplications();
  }

  onUniversityQueryChange(value: string): void {
    this.universityQuery = value || '';
    this.universityOptionsOpen = true;
    this.refreshView();
  }

  openUniversityOptions(): void {
    this.universityOptionsOpen = true;
    this.refreshView();
  }

  clearSelection(): void {
    this.selectedUniversityId = null;
    this.selectedUniversity = null;
    this.universityQuery = '';
    this.universityOptionsOpen = true;
    this.students = [];
    this.expandedStudentIds = new Set<number>();
    this.applicationError = '';
    this.clearPortalState();
    this.clearHistoryState();
    this.refreshView();
  }

  loadApplications(): void {
    if (!this.selectedUniversityId) return;

    this.loadingApplications = true;
    this.applicationError = '';
    this.students = [];
    this.expandedStudentIds = new Set<number>();
    this.clearPortalState();
    this.clearHistoryState();
    this.refreshView();

    this.graduationStage
      .listStudentsByUniversity(this.selectedUniversityId)
      .pipe(
        finalize(() => {
          this.loadingApplications = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (students) => {
          this.students = this.sortStudentsForDisplay(students || []);
          this.expandedStudentIds = new Set<number>();
        },
        error: () => {
          this.applicationError = this.ui.applicationLoadError;
          this.students = [];
        },
      });
  }

  applicationsFor(student: GraduationApplicationUniversityStudent): GraduationApplication[] {
    return (student?.applications || []).slice().sort((left, right) => {
      const statusDiff = this.statusPriority(right.status) - this.statusPriority(left.status);
      if (statusDiff !== 0) return statusDiff;
      return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
    });
  }

  universityStudentCount(university: University): number {
    return Math.max(0, Number(this.universitySummaryById.get(Number(university?.id))?.studentCount || 0));
  }

  universityApplicationCount(university: University): number {
    return Math.max(0, Number(this.universitySummaryById.get(Number(university?.id))?.applicationCount || 0));
  }

  studentName(student: GraduationApplicationUniversityStudent): string {
    return String(student?.studentName || student?.username || `Student #${student?.studentId || ''}`).trim();
  }

  isStudentExpanded(student: GraduationApplicationUniversityStudent): boolean {
    return this.expandedStudentIds.has(Number(student?.studentId));
  }

  toggleStudent(student: GraduationApplicationUniversityStudent): void {
    const studentId = Number(student?.studentId);
    if (!studentId) return;

    const next = new Set(this.expandedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
      this.portalEditingKeys.delete(this.portalKeyFor(student));
      this.historyOpenStudentIds.delete(studentId);
    } else {
      next.add(studentId);
      this.loadPortalCredential(student);
    }
    this.expandedStudentIds = next;
    this.refreshView();
  }

  studentTopStatus(student: GraduationApplicationUniversityStudent): GraduationApplicationStatus | string | null {
    return this.applicationsFor(student)[0]?.status || null;
  }

  studentStageLabel(student: GraduationApplicationUniversityStudent): LocalizedText {
    const count = this.applicationsFor(student).length;
    return uiText(`\u5df2\u8fdb\u5165\uff08${count}\uff09`, `Entered (${count})`);
  }

  statusLabel(status: GraduationApplicationStatus | string | null | undefined): LocalizedText {
    switch (status) {
      case 'READY_TO_SUBMIT':
        return this.ui.statusReadyToSubmit;
      case 'SUBMITTED':
        return this.ui.statusSubmitted;
      case 'WAITING_RESULT':
        return this.ui.statusWaitingResult;
      case 'OFFER_RECEIVED':
        return this.ui.statusOfferReceived;
      case 'OFFER_ACCEPTED':
        return this.ui.statusOfferAccepted;
      case 'NOT_ADMITTED':
        return this.ui.statusNotAdmitted;
      case 'PREPARING':
      default:
        return this.ui.statusPreparing;
    }
  }

  statusClass(status: GraduationApplicationStatus | string | null | undefined): string {
    switch (status) {
      case 'OFFER_ACCEPTED':
      case 'OFFER_RECEIVED':
        return 'offer';
      case 'NOT_ADMITTED':
        return 'rejected';
      case 'SUBMITTED':
      case 'WAITING_RESULT':
        return 'submitted';
      case 'READY_TO_SUBMIT':
        return 'ready';
      case 'PREPARING':
      default:
        return 'preparing';
    }
  }

  openStudentApplication(student: GraduationApplicationUniversityStudent): void {
    if (!student?.studentId) return;
    this.router.navigate(['/teacher/students', String(student.studentId), 'graduation-applications']);
  }

  updateApplicationStatus(
    application: GraduationApplication,
    status: GraduationApplicationStatus
  ): void {
    if (!application || application.status === status || this.isApplicationUpdating(application)) return;

    const previousStatus = application.status;
    application.status = status;
    this.applicationError = '';

    const applicationId = application.id;
    if (typeof applicationId !== 'number') {
      application.updatedAt = new Date().toISOString();
      this.refreshView();
      return;
    }

    const universityId = Number(application.universityId || 0);
    const programId = Number(application.programId || 0);
    if (!universityId || !programId) {
      application.status = previousStatus;
      this.applicationError = this.ui.applicationUpdateError;
      this.refreshView();
      return;
    }

    this.setApplicationUpdating(applicationId, true);
    this.graduationStage
      .updateApplication(applicationId, {
        universityId,
        programId,
        status,
        sourceAspirationId: application.sourceAspirationId,
      })
      .pipe(finalize(() => this.setApplicationUpdating(applicationId, false)))
      .subscribe({
        next: (updated) => {
          this.replaceApplication(updated || { ...application, status });
          this.refreshStudentHistoryIfOpen(Number(application.studentId));
        },
        error: () => {
          application.status = previousStatus;
          this.applicationError = this.ui.applicationUpdateError;
          this.refreshView();
        },
      });
  }

  isApplicationUpdating(application: GraduationApplication): boolean {
    return this.updatingApplicationIds.has(application?.id);
  }

  isPortalLoading(student: GraduationApplicationUniversityStudent): boolean {
    return this.portalLoadingKeys.has(this.portalKeyFor(student));
  }

  isPortalSaving(student: GraduationApplicationUniversityStudent): boolean {
    return this.portalSavingKeys.has(this.portalKeyFor(student));
  }

  isPortalEditing(student: GraduationApplicationUniversityStudent): boolean {
    return this.portalEditingKeys.has(this.portalKeyFor(student));
  }

  portalError(student: GraduationApplicationUniversityStudent): OverviewMessage {
    return this.portalErrors.get(this.portalKeyFor(student)) || '';
  }

  getPortalDraft(student: GraduationApplicationUniversityStudent): PortalCredentialDraft {
    return this.ensurePortalDraft(student);
  }

  updatePortalDraft(
    student: GraduationApplicationUniversityStudent,
    field: PortalCredentialField,
    value: string
  ): void {
    const key = this.portalKeyFor(student);
    const draft = this.ensurePortalDraft(student);
    this.portalDrafts.set(key, { ...draft, [field]: String(value || '') });
    this.portalErrors.delete(key);
    this.refreshView();
  }

  togglePortalStudentVisible(student: GraduationApplicationUniversityStudent, visible: boolean): void {
    if (this.isPortalSaving(student)) return;
    const key = this.portalKeyFor(student);
    const draft = {
      ...this.ensurePortalDraft(student),
      studentVisible: visible === true,
    };
    this.portalDrafts.set(key, draft);
    this.portalErrors.delete(key);
    this.persistPortalCredential(student, draft, false);
  }

  togglePortalRequirement(
    student: GraduationApplicationUniversityStudent,
    field: PortalRequirementField,
    checked: boolean
  ): void {
    if (this.isPortalSaving(student)) return;
    const key = this.portalKeyFor(student);
    const draft = {
      ...this.ensurePortalDraft(student),
      [field]: checked === true,
    };
    this.portalDrafts.set(key, draft);
    this.portalErrors.delete(key);
    this.persistPortalCredential(student, draft, false);
  }

  startPortalEdit(student: GraduationApplicationUniversityStudent): void {
    if (this.isPortalLoading(student) || this.isPortalSaving(student)) return;
    this.ensurePortalDraft(student);
    this.portalEditingKeys.add(this.portalKeyFor(student));
    this.refreshView();
  }

  cancelPortalEdit(student: GraduationApplicationUniversityStudent): void {
    const key = this.portalKeyFor(student);
    this.portalDrafts.set(key, this.createPortalDraft(this.portalCredentials.get(key)));
    this.portalEditingKeys.delete(key);
    this.portalErrors.delete(key);
    this.refreshView();
  }

  savePortalCredential(student: GraduationApplicationUniversityStudent): void {
    if (!this.isPortalEditing(student) || this.isPortalSaving(student)) return;
    const key = this.portalKeyFor(student);
    const draft = this.ensurePortalDraft(student);
    const current = this.createPortalDraft(this.portalCredentials.get(key));
    if (
      draft.schoolAccount.trim() === current.schoolAccount.trim() &&
      draft.schoolEmail.trim() === current.schoolEmail.trim() &&
      draft.schoolPassword.trim() === current.schoolPassword.trim() &&
      draft.studentVisible === current.studentVisible &&
      draft.interviewRequired === current.interviewRequired &&
      draft.languageScoreRequired === current.languageScoreRequired
    ) {
      this.portalEditingKeys.delete(key);
      this.refreshView();
      return;
    }

    this.persistPortalCredential(student, draft, true);
  }

  copyPortalField(student: GraduationApplicationUniversityStudent, field: PortalCredentialField): void {
    if (this.isPortalEditing(student)) return;
    const value = String(this.ensurePortalDraft(student)[field] || '');
    if (!value.trim()) return;

    this.writeClipboard(value)
      .then(() => {
        const copiedKey = this.createPortalFieldKey(student, field);
        this.copiedPortalFieldKey = copiedKey;
        window.setTimeout(() => {
          if (this.copiedPortalFieldKey === copiedKey) {
            this.copiedPortalFieldKey = null;
            this.refreshView();
          }
        }, 1200);
        this.refreshView();
      })
      .catch(() => {
        this.portalErrors.set(this.portalKeyFor(student), this.ui.copyFailed);
        this.refreshView();
      });
  }

  isPortalFieldCopied(student: GraduationApplicationUniversityStudent, field: PortalCredentialField): boolean {
    return this.copiedPortalFieldKey === this.createPortalFieldKey(student, field);
  }

  isHistoryOpen(student: GraduationApplicationUniversityStudent): boolean {
    return this.historyOpenStudentIds.has(Number(student?.studentId || 0));
  }

  isHistoryLoading(student: GraduationApplicationUniversityStudent): boolean {
    return this.historyLoadingStudentIds.has(Number(student?.studentId || 0));
  }

  historyEntriesFor(student: GraduationApplicationUniversityStudent): GraduationApplicationHistoryEntry[] {
    return this.historyEntriesByStudentId.get(Number(student?.studentId || 0)) || [];
  }

  historyTotalFor(student: GraduationApplicationUniversityStudent): number {
    const studentId = Number(student?.studentId || 0);
    const loaded = this.historyEntriesFor(student).length;
    return Math.max(loaded, Number(this.historyTotalsByStudentId.get(studentId) || 0));
  }

  historyError(student: GraduationApplicationUniversityStudent): OverviewMessage {
    return this.historyErrorsByStudentId.get(Number(student?.studentId || 0)) || '';
  }

  toggleHistory(student: GraduationApplicationUniversityStudent): void {
    const studentId = Number(student?.studentId || 0);
    if (!studentId) return;

    const next = new Set(this.historyOpenStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
      this.historyOpenStudentIds = next;
      this.refreshView();
      return;
    }

    next.add(studentId);
    this.historyOpenStudentIds = next;
    if (!this.expandedStudentIds.has(studentId)) {
      const expanded = new Set(this.expandedStudentIds);
      expanded.add(studentId);
      this.expandedStudentIds = expanded;
      this.loadPortalCredential(student);
    }
    this.loadHistoryForStudent(student);
  }

  refreshHistory(student: GraduationApplicationUniversityStudent): void {
    if (this.isHistoryLoading(student)) return;
    this.loadHistoryForStudent(student);
  }

  historySummary(student: GraduationApplicationUniversityStudent): LocalizedText {
    const loaded = this.historyEntriesFor(student).length;
    const total = this.historyTotalFor(student);
    if (total > loaded) {
      return uiText(
        `\u6700\u8fd1 ${loaded} \u6761 / \u5171 ${total} \u6761`,
        `Latest ${loaded} / Total ${total}`
      );
    }
    return uiText(`\u6700\u8fd1 ${loaded} \u6761`, `Latest ${loaded}`);
  }

  trackHistory(_index: number, entry: GraduationApplicationHistoryEntry): string | number {
    return entry.id || `${entry.operation || 'history'}-${entry.changedAt || _index}`;
  }

  trackHistoryChange(_index: number, change: GraduationApplicationHistoryFieldChange): string {
    return `${change.path || change.label || 'change'}-${_index}`;
  }

  displayHistoryTimestamp(entry: GraduationApplicationHistoryEntry): string {
    return this.displayDateTime(entry.changedAt);
  }

  displayHistoryActor(entry: GraduationApplicationHistoryEntry): string {
    const role = this.translate(this.displayActorRole(entry.actorRole));
    const name = String(entry.actorName || '').trim();
    if (role && name) return `${role} ${name}`;
    return name || role || this.translate(this.ui.systemActor);
  }

  displayHistoryOperation(entry: GraduationApplicationHistoryEntry): LocalizedText | string {
    switch (entry.operation) {
      case 'ENTER_GRADUATION_STAGE':
        return this.ui.operationEnterStage;
      case 'CONFIRM_STAGE':
        return this.ui.operationConfirmStage;
      case 'CREATE_APPLICATION':
        return this.ui.operationCreateApplication;
      case 'UPDATE_APPLICATION':
        return this.ui.operationUpdateApplication;
      case 'DELETE_APPLICATION':
        return this.ui.operationDeleteApplication;
      case 'REORDER_APPLICATIONS':
        return this.ui.operationReorderApplications;
      case 'UPDATE_APPLICATION_ACCOUNT_CREDENTIAL':
        return this.ui.operationUpdateApplicationAccount;
      case 'UPDATE_PORTAL_CREDENTIAL':
        return this.ui.operationUpdatePortalCredential;
      default:
        return String(entry.operation || '').trim() || this.ui.operationHistory;
    }
  }

  getHistoryChanges(entry: GraduationApplicationHistoryEntry): GraduationApplicationHistoryFieldChange[] {
    return Array.isArray(entry.changedFields) ? entry.changedFields : [];
  }

  displayHistoryField(change: GraduationApplicationHistoryFieldChange): LocalizedText | string {
    switch (change.path) {
      case 'graduationStage':
        return this.ui.fieldGraduationStage;
      case 'application':
        return this.ui.fieldApplication;
      case 'applicationOrder':
      case 'sortOrder':
        return this.ui.fieldApplicationOrder;
      case 'status':
        return this.ui.status;
      case 'university':
      case 'universityId':
      case 'universityName':
        return this.ui.fieldUniversity;
      case 'program':
      case 'programId':
      case 'programName':
        return this.ui.fieldProgram;
      case 'applicationEmail':
      case 'schoolEmail':
        return this.ui.fieldApplicationEmail;
      case 'applicationPassword':
        return this.ui.fieldApplicationPassword;
      case 'schoolAccount':
        return this.ui.schoolAccount;
      case 'schoolPassword':
        return this.ui.schoolPassword;
      case 'studentVisible':
        return this.ui.studentVisible;
      case 'interviewRequired':
        return this.ui.interview;
      case 'languageScoreRequired':
        return this.ui.languageScore;
      default: {
        const label = String(change.label || '').trim();
        return label || this.ui.fieldGeneric;
      }
    }
  }

  displayHistoryValue(value: unknown): LocalizedText | string {
    if (value === null || value === undefined || value === '') return this.ui.fieldEmpty;
    if (typeof value === 'boolean') return value ? this.ui.fieldBooleanYes : this.ui.fieldBooleanNo;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      return this.statusLabel(value) || value;
    }
    if (Array.isArray(value)) {
      const labels = value
        .map((item) => this.summarizeHistoryObject(item))
        .filter((item) => item.length > 0);
      return labels.length > 0 ? labels.join('; ') : `${value.length}`;
    }
    if (typeof value === 'object') {
      return this.summarizeHistoryObject(value) || JSON.stringify(value);
    }
    return String(value);
  }

  resolvePortalLoginUrl(): string {
    return this.graduationStage.resolvePortalLoginUrl(this.selectedUniversity?.name);
  }

  displayUpdatedAt(value: string | null | undefined): string {
    const text = String(value || '').trim();
    if (!text) return '-';
    const timestamp = Date.parse(text);
    if (!Number.isFinite(timestamp)) return text;
    return new Date(timestamp).toLocaleDateString();
  }

  goBack(): void {
    navigateBack(this.router, ['/teacher/graduation']);
  }

  trackUniversity(_index: number, university: University): number {
    return university.id;
  }

  trackStudent(_index: number, student: GraduationApplicationUniversityStudent): number {
    return student.studentId;
  }

  trackApplication(_index: number, application: GraduationApplication): number | string {
    return application.id;
  }

  private loadPortalCredential(student: GraduationApplicationUniversityStudent): void {
    const universityId = Number(this.selectedUniversityId || 0);
    const studentId = Number(student?.studentId || 0);
    const key = this.portalKeyFor(student);
    if (!universityId || !studentId || this.portalCredentials.has(key) || this.portalLoadingKeys.has(key)) {
      this.ensurePortalDraft(student);
      return;
    }

    this.setPortalLoading(key, true);
    this.portalErrors.delete(key);
    this.graduationStage
      .getPortalCredential(studentId, universityId)
      .pipe(finalize(() => this.setPortalLoading(key, false)))
      .subscribe({
        next: (credential) => {
          this.portalCredentials.set(key, credential);
          this.portalDrafts.set(key, this.createPortalDraft(credential));
          this.refreshView();
        },
        error: () => {
          this.portalErrors.set(key, this.ui.portalLoadError);
          this.portalDrafts.set(key, this.createPortalDraft(null));
          this.refreshView();
        },
      });
  }

  private persistPortalCredential(
    student: GraduationApplicationUniversityStudent,
    draft: PortalCredentialDraft,
    closeEditing: boolean
  ): void {
    const universityId = Number(this.selectedUniversityId || 0);
    const studentId = Number(student?.studentId || 0);
    const key = this.portalKeyFor(student);
    if (!universityId || !studentId) return;

    this.setPortalSaving(key, true);
    this.portalErrors.delete(key);
    this.graduationStage
      .updatePortalCredential(studentId, universityId, draft)
      .pipe(finalize(() => this.setPortalSaving(key, false)))
      .subscribe({
        next: (saved) => {
          this.portalCredentials.set(key, saved);
          this.portalDrafts.set(key, this.createPortalDraft(saved));
          if (closeEditing) {
            this.portalEditingKeys.delete(key);
          }
          this.refreshStudentHistoryIfOpen(studentId);
          this.refreshView();
        },
        error: () => {
          this.portalErrors.set(key, this.ui.portalSaveError);
          this.refreshView();
        },
      });
  }

  private ensurePortalDraft(student: GraduationApplicationUniversityStudent): PortalCredentialDraft {
    const key = this.portalKeyFor(student);
    const existing = this.portalDrafts.get(key);
    if (existing) return existing;

    const credential = this.portalCredentials.get(key) || null;
    if (credential) {
      this.portalCredentials.set(key, credential);
    }
    const draft = this.createPortalDraft(credential);
    this.portalDrafts.set(key, draft);
    return draft;
  }

  private createPortalDraft(
    credential: GraduationApplicationPortalCredential | null | undefined
  ): PortalCredentialDraft {
    return {
      schoolAccount: String(credential?.schoolAccount || ''),
      schoolEmail: String(credential?.schoolEmail || credential?.defaultSchoolEmail || ''),
      schoolPassword: String(credential?.schoolPassword || credential?.defaultSchoolPassword || 'ZAQ!2wsxcde3'),
      studentVisible: credential?.studentVisible === true,
      interviewRequired: credential?.interviewRequired === true,
      languageScoreRequired: credential?.languageScoreRequired === true,
    };
  }

  private portalKeyFor(student: GraduationApplicationUniversityStudent): string {
    return `${Number(student?.studentId || 0)}:${Number(this.selectedUniversityId || 0)}`;
  }

  private createPortalFieldKey(
    student: GraduationApplicationUniversityStudent,
    field: PortalCredentialField
  ): string {
    return `${this.portalKeyFor(student)}:${field}`;
  }

  private clearPortalState(): void {
    this.portalCredentials = new Map<string, GraduationApplicationPortalCredential>();
    this.portalDrafts = new Map<string, PortalCredentialDraft>();
    this.portalErrors = new Map<string, OverviewMessage>();
    this.portalLoadingKeys = new Set<string>();
    this.portalSavingKeys = new Set<string>();
    this.portalEditingKeys = new Set<string>();
    this.copiedPortalFieldKey = null;
  }

  private clearHistoryState(): void {
    this.historyOpenStudentIds = new Set<number>();
    this.historyLoadingStudentIds = new Set<number>();
    this.historyEntriesByStudentId = new Map<number, GraduationApplicationHistoryEntry[]>();
    this.historyTotalsByStudentId = new Map<number, number>();
    this.historyErrorsByStudentId = new Map<number, OverviewMessage>();
  }

  private setPortalLoading(key: string, loading: boolean): void {
    const next = new Set(this.portalLoadingKeys);
    if (loading) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.portalLoadingKeys = next;
    this.refreshView();
  }

  private setPortalSaving(key: string, saving: boolean): void {
    const next = new Set(this.portalSavingKeys);
    if (saving) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.portalSavingKeys = next;
    this.refreshView();
  }

  private setHistoryLoading(studentId: number, loading: boolean): void {
    const next = new Set(this.historyLoadingStudentIds);
    if (loading) {
      next.add(studentId);
    } else {
      next.delete(studentId);
    }
    this.historyLoadingStudentIds = next;
    this.refreshView();
  }

  private loadHistoryForStudent(student: GraduationApplicationUniversityStudent): void {
    const studentId = Number(student?.studentId || 0);
    if (!studentId) return;

    this.setHistoryLoading(studentId, true);
    this.historyErrorsByStudentId.delete(studentId);
    this.graduationStage
      .listHistory(studentId, { size: this.historyPageSize })
      .pipe(finalize(() => this.setHistoryLoading(studentId, false)))
      .subscribe({
        next: (response) => {
          const items = response?.items || [];
          this.historyEntriesByStudentId.set(studentId, items);
          this.historyTotalsByStudentId.set(studentId, Number(response?.total || items.length));
          this.refreshView();
        },
        error: () => {
          this.historyEntriesByStudentId.set(studentId, []);
          this.historyTotalsByStudentId.set(studentId, 0);
          this.historyErrorsByStudentId.set(studentId, this.ui.historyLoadError);
          this.refreshView();
        },
      });
  }

  private refreshStudentHistoryIfOpen(studentId: number): void {
    if (!this.historyOpenStudentIds.has(studentId)) return;
    const student = this.students.find((item) => Number(item.studentId) === studentId);
    if (!student || this.historyLoadingStudentIds.has(studentId)) return;
    this.loadHistoryForStudent(student);
  }

  private writeClipboard(value: string): Promise<void> {
    const navigatorRef = globalThis.navigator;
    if (navigatorRef?.clipboard?.writeText) {
      return navigatorRef.clipboard.writeText(value);
    }
    return Promise.reject(new Error('Clipboard API unavailable'));
  }

  private countByStatus(statuses: string[]): number {
    const wanted = new Set(statuses);
    return this.students.reduce((total, student) => {
      return total + this.applicationsFor(student).filter((application) => wanted.has(String(application.status))).length;
    }, 0);
  }

  private sortStudentsForDisplay(
    students: GraduationApplicationUniversityStudent[]
  ): GraduationApplicationUniversityStudent[] {
    return students.slice().sort((left, right) => {
      const priorityDiff = this.studentPriority(right) - this.studentPriority(left);
      if (priorityDiff !== 0) return priorityDiff;
      return this.studentName(left).localeCompare(this.studentName(right));
    });
  }

  private studentPriority(student: GraduationApplicationUniversityStudent): number {
    return Math.max(0, ...this.applicationsFor(student).map((application) => this.statusPriority(application.status)));
  }

  private statusPriority(status: GraduationApplicationStatus | string | null | undefined): number {
    switch (status) {
      case 'OFFER_ACCEPTED':
        return 50;
      case 'OFFER_RECEIVED':
        return 45;
      case 'WAITING_RESULT':
        return 35;
      case 'SUBMITTED':
        return 30;
      case 'READY_TO_SUBMIT':
        return 20;
      case 'PREPARING':
        return 10;
      case 'NOT_ADMITTED':
      default:
        return 0;
    }
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '').trim().toLowerCase();
  }

  private compareUniversityOptions(left: University, right: University): number {
    const leftStudentCount = this.universityStudentCount(left);
    const rightStudentCount = this.universityStudentCount(right);
    if (leftStudentCount !== rightStudentCount) {
      return rightStudentCount - leftStudentCount;
    }

    const leftApplicationCount = this.universityApplicationCount(left);
    const rightApplicationCount = this.universityApplicationCount(right);
    if (leftApplicationCount !== rightApplicationCount) {
      return rightApplicationCount - leftApplicationCount;
    }

    return String(left?.name || '').localeCompare(String(right?.name || ''));
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {}
  }

  private setApplicationUpdating(applicationId: number | string, updating: boolean): void {
    const next = new Set(this.updatingApplicationIds);
    if (updating) {
      next.add(applicationId);
    } else {
      next.delete(applicationId);
    }
    this.updatingApplicationIds = next;
    this.refreshView();
  }

  private replaceApplication(updated: GraduationApplication): void {
    const updatedId = updated?.id;
    if (updatedId === undefined || updatedId === null) return;

    this.students = this.students.map((student) => ({
      ...student,
      applications: (student.applications || []).map((application) =>
        application.id === updatedId ? { ...application, ...updated } : application
      ),
    }));
    this.refreshView();
  }

  private displayDateTime(value: string | null | undefined): string {
    const text = String(value || '').trim();
    if (!text) return '-';
    const timestamp = Date.parse(text);
    if (!Number.isFinite(timestamp)) return text;
    return new Date(timestamp).toLocaleString();
  }

  private displayActorRole(role: string | null | undefined): LocalizedText {
    switch (String(role || '').trim().toUpperCase()) {
      case 'ADMIN':
        return this.ui.roleAdmin;
      case 'TEACHER':
        return this.ui.roleTeacher;
      case 'STUDENT':
        return this.ui.roleStudent;
      default:
        return this.ui.systemActor;
    }
  }

  private summarizeHistoryObject(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const source = value as Record<string, unknown>;
    const university = String(source['universityName'] || '').trim();
    const program = String(source['programName'] || '').trim();
    const statusText = this.translate(this.statusLabel(String(source['status'] || '').trim()));
    const order = Number(source['sortOrder']);
    const parts = [university, program, statusText].filter((item) => item.length > 0);
    const label = parts.join(' / ');
    if (label && Number.isFinite(order) && order > 0) return `${order}. ${label}`;
    return label;
  }

  private translate(value: LocalizedText | string): string {
    return this.language.translate(value);
  }

}
