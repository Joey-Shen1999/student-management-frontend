import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';

import {
  GraduationApplication,
  GraduationApplicationAccountCredential,
  GraduationApplicationRequest,
  GraduationApplicationHistoryEntry,
  GraduationApplicationHistoryFieldChange,
  GraduationApplicationPortalCredential,
  GraduationApplicationStageService,
  GraduationApplicationStatus,
} from '../../services/graduation-application-stage.service';
import {
  University,
  UniversityAspirationService,
  UniversityProgram,
} from '../../services/university-aspiration.service';

interface ApplicationGroup {
  key: string;
  universityId: number | null;
  universityName: string;
  applications: GraduationApplication[];
}

type ApplicationFormMode = 'addUniversity' | 'addProgram' | 'editProgram';

interface ApplicationFormModel {
  universityId: number | null;
  universityName: string;
  programId: number | null;
  programName: string;
  status: GraduationApplicationStatus;
}

type PortalCredentialField = 'schoolAccount' | 'schoolEmail' | 'schoolPassword';

interface PortalCredentialDraft {
  schoolAccount: string;
  schoolEmail: string;
  schoolPassword: string;
}

type ApplicationAccountField = 'applicationEmail' | 'applicationPassword';

interface ApplicationAccountDraft {
  applicationEmail: string;
  applicationPassword: string;
}

interface UniversityPortalLoginLink {
  aliases: string[];
  url: string;
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
    'OFFER_ACCEPTED',
  ];
  readonly historyPageSize = 20;
  readonly outlookLoginUrl = 'https://outlook.live.com/mail/';
  private readonly universityPortalLoginLinks: UniversityPortalLoginLink[] = [
    {
      aliases: ['Acadia University', 'Acadia'],
      url: 'https://www2.acadiau.ca/student-life/my-acadia.html',
    },
    {
      aliases: ['Algoma University', 'Algoma'],
      url: 'https://students.algomau.ca/',
    },
    {
      aliases: ['Brock University', 'Brock'],
      url: 'https://my.brocku.ca/',
    },
    {
      aliases: ['Carleton University', 'Carleton', 'Carleton360'],
      url: 'https://360.carleton.ca/',
    },
    {
      aliases: ['Concordia University', 'Concordia'],
      url: 'https://campus.concordia.ca/',
    },
    {
      aliases: ['Dalhousie University', 'Dalhousie', 'Dal'],
      url: 'https://dalonline.dal.ca/',
    },
    {
      aliases: ['Lakehead University', 'Lakehead', 'myInfo', 'myPortal Lakehead'],
      url: 'https://myportal.lakeheadu.ca/',
    },
    {
      aliases: ['Laurentian University', 'Laurentian'],
      url: 'https://selfservice.laurentian.ca/',
    },
    {
      aliases: ['McGill University', 'McGill'],
      url: 'https://horizon.mcgill.ca/',
    },
    {
      aliases: ['McMaster University', 'McMaster', 'Mac', 'Mosaic'],
      url: 'https://future.mcmaster.ca/applicant-portal/',
    },
    {
      aliases: ['Memorial University of Newfoundland', 'Memorial University', 'MUN'],
      url: 'https://www.mun.ca/undergrad/admissions/i-have-applied/',
    },
    {
      aliases: ['Mount Allison University', 'Mount Allison', 'MTA'],
      url: 'https://connect.mta.ca/',
    },
    {
      aliases: ['Nipissing University', 'Nipissing', 'My Nipissing'],
      url: 'https://www.nipissingu.ca/departments/office-registrar/student-resources/webadvisor-instructions',
    },
    {
      aliases: ['OCAD University', 'OCAD', 'OCAD U'],
      url: 'https://join.ocadu.ca/application/login',
    },
    {
      aliases: ['Ontario Tech University', 'Ontario Tech', 'UOIT'],
      url: 'https://ontariotechu.ca/applicantportal',
    },
    {
      aliases: ["Queen's University", 'Queens University', 'Queen s University', 'Queens', 'SOLUS'],
      url: 'https://my.queensu.ca/',
    },
    {
      aliases: ['Royal Military College of Canada', 'RMC', 'RMC CMR'],
      url: 'https://www.rmc-cmr.ca/en/registrars-office/student-information-system',
    },
    {
      aliases: ["Saint Mary's University", 'Saint Marys University', 'SMU'],
      url: 'https://selfservice.smu.ca/',
    },
    {
      aliases: ['Simon Fraser University', 'Simon Fraser', 'SFU'],
      url: 'https://go.sfu.ca/',
    },
    {
      aliases: [
        'Toronto Metropolitan University',
        'Toronto Metropolitan University formerly Ryerson University',
        'Ryerson University',
        'TMU',
        'ChooseTMU',
      ],
      url: 'https://www.torontomu.ca/admissions/undergraduate/choose-login/',
    },
    {
      aliases: ['Trent University', 'Trent'],
      url: 'https://my.trentu.ca/',
    },
    {
      aliases: [
        'Universite de Montreal',
        'Universit de Montreal',
        'Universit de Montr al',
        'Universite de Montreal',
        'University of Montreal',
        'UdeM',
      ],
      url: 'https://admission.umontreal.ca/admission/depot-de-la-demande/suivre-votre-dossier/',
    },
    {
      aliases: ['Universite de Sherbrooke', 'Universit de Sherbrooke', 'University of Sherbrooke', 'UdeS'],
      url: 'https://www.usherbrooke.ca/admission/demande-admission/suivre-votre-demande',
    },
    {
      aliases: ['Universite Laval', 'Universit Laval', 'University Laval', 'Laval University', 'ULaval'],
      url: 'https://monportail.ulaval.ca/',
    },
    {
      aliases: ['Universite de Hearst', 'Universit de Hearst', 'University of Hearst', 'Hearst'],
      url: 'https://www.uhearst.ca/',
    },
    {
      aliases: [
        "Universite de l'Ontario francais",
        'Universite de l Ontario francais',
        'Universit de l Ontario fran ais',
        'University of French Ontario',
        'UOF',
      ],
      url: 'https://www.uontario.ca/',
    },
    {
      aliases: ['University of Alberta', 'UAlberta', 'U of A'],
      url: 'https://www.ualberta.ca/en/admissions/how-to-apply/after-you-apply/index.html',
    },
    {
      aliases: ['University of British Columbia', 'UBC'],
      url: 'https://myapplication.ubc.ca/',
    },
    {
      aliases: ['University of Calgary', 'UCalgary', 'U of C'],
      url: 'https://my.ucalgary.ca/',
    },
    {
      aliases: ['University of Guelph-Humber', 'Guelph-Humber', 'Guelph Humber'],
      url: 'https://www.uoguelph.ca/webadvisor',
    },
    {
      aliases: ['University of Guelph', 'Guelph', 'U of G'],
      url: 'https://www.uoguelph.ca/webadvisor',
    },
    {
      aliases: ['University of Lethbridge', 'Lethbridge', 'ULethbridge'],
      url: 'https://bridge.uleth.ca/',
    },
    {
      aliases: ['University of Manitoba', 'Manitoba', 'UManitoba'],
      url: 'https://aurora.umanitoba.ca/',
    },
    {
      aliases: ['University of New Brunswick', 'UNB', 'New Brunswick'],
      url: 'https://eservices.unb.ca/',
    },
    {
      aliases: ['University of Northern British Columbia', 'UNBC'],
      url: 'https://online.unbc.ca/',
    },
    {
      aliases: ['University of Ottawa', 'uOttawa', 'U of O', 'uoZone'],
      url: 'https://www.uottawa.ca/en/current-students',
    },
    {
      aliases: ['University of Prince Edward Island', 'UPEI'],
      url: 'https://my.upei.ca/',
    },
    {
      aliases: ['University of Regina', 'Regina', 'URegina'],
      url: 'https://banner.uregina.ca/',
    },
    {
      aliases: ['University of Saskatchewan', 'Saskatchewan', 'USask'],
      url: 'https://students.usask.ca/paws.php',
    },
    {
      aliases: [
        'University of Toronto',
        'University of Toronto St George',
        'University of Toronto St. George',
        'University of Toronto St George Campus',
        'University of Toronto St. George Campus',
        'University of Toronto Mississauga',
        'University of Toronto Scarborough',
        'UofT',
        'U of T',
      ],
      url: 'https://join.utoronto.ca/',
    },
    {
      aliases: ['University of Victoria', 'UVic', 'Victoria'],
      url: 'https://www.uvic.ca/tools/sign-in/index.php',
    },
    {
      aliases: ['University of Waterloo', 'Waterloo', 'UWaterloo', 'UW', 'Quest'],
      url: 'https://uwaterloo.ca/quest/',
    },
    {
      aliases: ['University of Windsor', 'Windsor', 'UWindsor'],
      url: 'https://my.uwindsor.ca/',
    },
    {
      aliases: ['University of Winnipeg', 'Winnipeg', 'UWinnipeg'],
      url: 'https://www.uwinnipeg.ca/student-services/webadvisor.html',
    },
    {
      aliases: ['Western University', 'Western', 'UWO', 'University of Western Ontario'],
      url: 'https://student.uwo.ca/',
    },
    {
      aliases: ['Wilfrid Laurier University', 'Laurier', 'WLU', 'LORIS'],
      url: 'https://www.chooselaurier.ca/future-students/undergraduate/admissions/process/',
    },
    {
      aliases: ['York University', 'York', 'YorkU', 'MyFile'],
      url: 'https://myfile.yorku.ca/',
    },
  ];

  studentId = 0;
  loading = false;
  error = '';
  applications: GraduationApplication[] = [];
  updatingId: string | number | null = null;
  deletingId: string | number | null = null;
  deletingGroupKey: string | null = null;

  formOpen = false;
  formError = '';
  formSaving = false;
  formMode: ApplicationFormMode = 'addUniversity';
  editingApplication: GraduationApplication | null = null;
  form: ApplicationFormModel = this.createEmptyForm();
  universities: University[] = [];
  programOptions: UniversityProgram[] = [];
  loadingUniversities = false;
  loadingPrograms = false;
  universitySuggestionsOpen = false;
  programSuggestionsOpen = false;

  historyPanelOpen = false;
  historyLoading = false;
  historyError = '';
  historyEntries: GraduationApplicationHistoryEntry[] = [];
  historyTotal = 0;

  applicationAccountExpanded = false;
  applicationAccountCredential: GraduationApplicationAccountCredential | null = null;
  applicationAccountDraft: ApplicationAccountDraft = this.createApplicationAccountDraft(null);
  applicationAccountLoading = false;
  applicationAccountSaving = false;
  applicationAccountEditing = false;
  applicationAccountError = '';
  copiedApplicationAccountField: ApplicationAccountField | null = null;

  expandedPortalKeys = new Set<string>();
  portalCredentials = new Map<string, GraduationApplicationPortalCredential>();
  portalDrafts = new Map<string, PortalCredentialDraft>();
  portalErrors = new Map<string, string>();
  portalLoadingKey: string | null = null;
  portalSavingKey: string | null = null;
  portalEditingKey: string | null = null;
  copiedPortalFieldKey: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public graduationStage: GraduationApplicationStageService,
    private universityApi: UniversityAspirationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.resolveContext();
    this.loadUniversities();
    this.loadApplicationAccount();
    this.loadApplications();
  }

  get groups(): ApplicationGroup[] {
    const groups = new Map<string, ApplicationGroup>();
    for (const application of this.sortedApplications) {
      const universityName = application.universityName?.trim() || '未命名大学';
      const universityId = this.normalizeOptionalId(application.universityId);
      const key = this.createUniversityGroupKey(universityId, universityName);
      const current = groups.get(key) || {
        key,
        universityId,
        universityName,
        applications: [],
      };
      current.applications = [...current.applications, application];
      groups.set(key, current);
    }
    return Array.from(groups.values());
  }

  get sortedApplications(): GraduationApplication[] {
    return [...this.applications].sort((left, right) => {
      const acceptedRank =
        Number(right.status === 'OFFER_ACCEPTED') - Number(left.status === 'OFFER_ACCEPTED');
      if (acceptedRank !== 0) return acceptedRank;
      return left.sortOrder - right.sortOrder;
    });
  }

  get totalCount(): number {
    return this.applications.length;
  }

  get submittedCount(): number {
    return this.applications.filter((item) =>
      ['SUBMITTED', 'WAITING_RESULT', 'OFFER_RECEIVED', 'OFFER_ACCEPTED'].includes(item.status)
    ).length;
  }

  get offerCount(): number {
    return this.applications.filter((item) =>
      ['OFFER_RECEIVED', 'OFFER_ACCEPTED'].includes(item.status)
    ).length;
  }

  isOfferAccepted(application: GraduationApplication): boolean {
    return application.status === 'OFFER_ACCEPTED';
  }

  get pageTitle(): string {
    return '学生正式申请';
  }

  get formTitle(): string {
    if (this.formMode === 'addProgram') return '添加专业';
    if (this.formMode === 'editProgram') return '修改专业';
    return '添加大学';
  }

  get formSubmitLabel(): string {
    if (this.formSaving) return '保存中...';
    if (this.formMode === 'editProgram') return '保存修改';
    if (this.formMode === 'addProgram') return '添加专业';
    return '添加大学';
  }

  get isUniversityLockedInForm(): boolean {
    return this.formMode === 'addProgram';
  }

  goBack(): void {
    this.router.navigate(['/teacher/graduation']);
  }

  toggleApplicationAccount(): void {
    if (this.applicationAccountSaving) return;
    this.applicationAccountExpanded = !this.applicationAccountExpanded;
    this.cdr.markForCheck();
  }

  startApplicationAccountEdit(): void {
    if (this.applicationAccountLoading || this.applicationAccountSaving) return;
    this.applicationAccountDraft = this.createApplicationAccountDraft(this.applicationAccountCredential);
    this.applicationAccountEditing = true;
    this.applicationAccountError = '';
    if (!this.applicationAccountExpanded) {
      this.applicationAccountExpanded = true;
    }
    this.cdr.markForCheck();
  }

  cancelApplicationAccountEdit(): void {
    if (this.applicationAccountSaving) return;
    this.applicationAccountDraft = this.createApplicationAccountDraft(this.applicationAccountCredential);
    this.applicationAccountEditing = false;
    this.applicationAccountError = '';
    this.cdr.markForCheck();
  }

  updateApplicationAccountDraft(field: ApplicationAccountField, value: string): void {
    this.applicationAccountDraft = { ...this.applicationAccountDraft, [field]: value };
    this.applicationAccountError = '';
    this.cdr.markForCheck();
  }

  copyApplicationAccountField(field: ApplicationAccountField): void {
    const value = String(this.applicationAccountDraft[field] || '');
    if (!value.trim()) return;

    this.writeClipboard(value)
      .then(() => {
        this.copiedApplicationAccountField = field;
        window.setTimeout(() => {
          if (this.copiedApplicationAccountField === field) {
            this.copiedApplicationAccountField = null;
            this.cdr.markForCheck();
          }
        }, 1200);
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.applicationAccountError = '复制失败，请手动选择复制。';
        this.cdr.markForCheck();
      });
  }

  isApplicationAccountFieldCopied(field: ApplicationAccountField): boolean {
    return this.copiedApplicationAccountField === field;
  }

  saveApplicationAccount(): void {
    if (this.applicationAccountSaving) return;
    const current = this.createApplicationAccountDraft(this.applicationAccountCredential);
    const draft = this.applicationAccountDraft;
    if (
      draft.applicationEmail.trim() === current.applicationEmail.trim() &&
      draft.applicationPassword.trim() === current.applicationPassword.trim()
    ) {
      this.applicationAccountEditing = false;
      this.cdr.markForCheck();
      return;
    }

    this.applicationAccountSaving = true;
    this.applicationAccountError = '';
    this.graduationStage
      .updateApplicationAccountCredential(this.studentId, draft)
      .pipe(
        finalize(() => {
          this.applicationAccountSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (saved) => {
          this.applicationAccountCredential = saved;
          this.applicationAccountDraft = this.createApplicationAccountDraft(saved);
          this.applicationAccountEditing = false;
          this.syncPortalDraftsWithApplicationAccount(saved);
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.applicationAccountError = this.extractErrorMessage(error) || '保存申请账号失败。';
          this.cdr.markForCheck();
        },
      });
  }

  openAddUniversity(): void {
    this.formOpen = true;
    this.formError = '';
    this.formMode = 'addUniversity';
    this.editingApplication = null;
    this.form = this.createEmptyForm();
    this.programOptions = [];
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
    this.cdr.markForCheck();
  }

  openAddProgram(group: ApplicationGroup): void {
    this.formOpen = true;
    this.formError = '';
    this.formMode = 'addProgram';
    this.editingApplication = null;
    this.form = {
      universityId: group.universityId,
      universityName: group.universityName,
      programId: null,
      programName: '',
      status: 'PREPARING',
    };
    this.programOptions = [];
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = true;
    if (group.universityId) {
      this.loadPrograms(group.universityId);
    }
    this.cdr.markForCheck();
  }

  openEditApplication(application: GraduationApplication): void {
    this.formOpen = true;
    this.formError = '';
    this.formMode = 'editProgram';
    this.editingApplication = application;
    this.form = {
      universityId: this.normalizeOptionalId(application.universityId),
      universityName: String(application.universityName || ''),
      programId: this.normalizeOptionalId(application.programId),
      programName: String(application.programName || ''),
      status: application.status || 'PREPARING',
    };
    this.programOptions = [];
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
    if (this.form.universityId) {
      this.loadPrograms(this.form.universityId);
    }
    this.cdr.markForCheck();
  }

  closeApplicationForm(force = false): void {
    if (this.formSaving && !force) return;
    this.formOpen = false;
    this.formError = '';
    this.formMode = 'addUniversity';
    this.editingApplication = null;
    this.form = this.createEmptyForm();
    this.programOptions = [];
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = false;
    this.cdr.markForCheck();
  }

  saveApplicationForm(): void {
    if (this.formSaving) return;
    const payload = this.buildApplicationFormPayload();
    if (!payload) return;

    const editingId = this.editingApplication
      ? Math.trunc(Number(this.editingApplication.id))
      : null;
    const request =
      editingId && Number.isFinite(editingId) && editingId > 0
        ? this.graduationStage.updateApplication(editingId, payload)
        : this.graduationStage.createApplication(this.studentId, payload);

    this.formSaving = true;
    this.formError = '';
    this.error = '';
    request
      .pipe(
        finalize(() => {
          this.formSaving = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (saved) => {
          if (editingId) {
            this.replaceApplication({ ...this.editingApplication!, ...saved });
          } else {
            this.applications = [...this.applications, saved];
          }
          this.closeApplicationForm(true);
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.formError = this.extractErrorMessage(error) || '保存申请失败。';
          this.cdr.markForCheck();
        },
      });
  }

  deleteApplication(application: GraduationApplication): void {
    const applicationId = Math.trunc(Number(application.id));
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      this.applications = this.applications.filter((item) => String(item.id) !== String(application.id));
      return;
    }

    if (!confirm(`确定删除专业「${application.programName || '未命名专业'}」吗？`)) return;

    this.deletingId = application.id;
    this.error = '';
    this.graduationStage
      .deleteApplication(applicationId)
      .pipe(
        finalize(() => {
          this.deletingId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.applications = this.applications.filter((item) => String(item.id) !== String(application.id));
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '删除专业失败。';
          this.cdr.markForCheck();
        },
      });
  }

  deleteUniversityGroup(group: ApplicationGroup): void {
    const applicationIds = group.applications
      .map((application) => Math.trunc(Number(application.id)))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (applicationIds.length === 0) return;

    if (!confirm(`确定删除「${group.universityName}」下的 ${group.applications.length} 个专业吗？`)) {
      return;
    }

    this.deletingGroupKey = group.key;
    this.error = '';
    forkJoin(applicationIds.map((id) => this.graduationStage.deleteApplication(id)))
      .pipe(
        finalize(() => {
          this.deletingGroupKey = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          const deleted = new Set(applicationIds.map((id) => String(id)));
          this.applications = this.applications.filter((item) => !deleted.has(String(item.id)));
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '删除大学失败。';
          this.cdr.markForCheck();
        },
      });
  }

  onUniversityPanelClick(group: ApplicationGroup, event: MouseEvent): void {
    if (!group.universityId || this.isGroupBusy(group)) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'button, input, select, textarea, a, .program-list, .portal-card, .suggestion-list'
      )
    ) {
      return;
    }
    this.togglePortal(group);
  }

  togglePortal(group: ApplicationGroup): void {
    if (!group.universityId) return;
    if (this.expandedPortalKeys.has(group.key)) {
      this.expandedPortalKeys.delete(group.key);
      if (this.portalEditingKey === group.key) {
        this.portalEditingKey = null;
      }
      this.cdr.markForCheck();
      return;
    }

    this.expandedPortalKeys.add(group.key);
    this.loadPortalCredential(group);
    this.cdr.markForCheck();
  }

  isPortalExpanded(group: ApplicationGroup): boolean {
    return this.expandedPortalKeys.has(group.key);
  }

  isPortalEditing(group: ApplicationGroup): boolean {
    return this.portalEditingKey === group.key;
  }

  isPortalLoading(group: ApplicationGroup): boolean {
    return this.portalLoadingKey === group.key;
  }

  isPortalSaving(group: ApplicationGroup): boolean {
    return this.portalSavingKey === group.key;
  }

  portalError(group: ApplicationGroup): string {
    return this.portalErrors.get(group.key) || '';
  }

  getPortalDraft(group: ApplicationGroup): PortalCredentialDraft {
    return this.ensurePortalDraft(group);
  }

  updatePortalDraft(group: ApplicationGroup, field: PortalCredentialField, value: string): void {
    const draft = this.ensurePortalDraft(group);
    this.portalDrafts.set(group.key, { ...draft, [field]: value });
    this.portalErrors.delete(group.key);
    this.cdr.markForCheck();
  }

  copyPortalField(group: ApplicationGroup, field: PortalCredentialField): void {
    const value = String(this.ensurePortalDraft(group)[field] || '');
    if (!value.trim()) return;

    this.writeClipboard(value)
      .then(() => {
        const copiedKey = this.createPortalFieldKey(group, field);
        this.copiedPortalFieldKey = copiedKey;
        window.setTimeout(() => {
          if (this.copiedPortalFieldKey === copiedKey) {
            this.copiedPortalFieldKey = null;
            this.cdr.markForCheck();
          }
        }, 1200);
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.portalErrors.set(group.key, '复制失败，请手动选择复制。');
        this.cdr.markForCheck();
      });
  }

  isPortalFieldCopied(group: ApplicationGroup, field: PortalCredentialField): boolean {
    return this.copiedPortalFieldKey === this.createPortalFieldKey(group, field);
  }

  resolvePortalLoginUrl(group: ApplicationGroup): string {
    const universityName = String(group.universityName || '');
    const normalizedName = this.normalizeSearchText(universityName);
    const compactName = this.compactSearchText(universityName);
    if (!normalizedName) return '';

    let bestMatch: { url: string; score: number } | null = null;
    for (const link of this.universityPortalLoginLinks) {
      for (const alias of link.aliases) {
        const normalizedAlias = this.normalizeSearchText(alias);
        const compactAlias = this.compactSearchText(alias);
        if (
          normalizedName.includes(normalizedAlias) ||
          compactName.includes(compactAlias) ||
          compactAlias.includes(compactName)
        ) {
          const score = Math.max(normalizedAlias.length, compactAlias.length);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { url: link.url, score };
          }
        }
      }
    }
    return bestMatch?.url || '';
  }

  startPortalEdit(group: ApplicationGroup): void {
    if (!group.universityId || this.isPortalLoading(group) || this.isPortalSaving(group)) return;
    this.ensurePortalDraft(group);
    this.portalEditingKey = group.key;
    this.cdr.markForCheck();
  }

  cancelPortalEdit(group: ApplicationGroup): void {
    this.portalDrafts.set(group.key, this.createPortalDraft(this.portalCredentials.get(group.key)));
    if (this.portalEditingKey === group.key) {
      this.portalEditingKey = null;
    }
    this.portalErrors.delete(group.key);
    this.cdr.markForCheck();
  }

  savePortalCredential(group: ApplicationGroup): void {
    if (!group.universityId || !this.isPortalEditing(group) || this.isPortalSaving(group)) return;
    const draft = this.ensurePortalDraft(group);
    const current = this.createPortalDraft(this.portalCredentials.get(group.key));
    if (
      draft.schoolAccount.trim() === current.schoolAccount.trim() &&
      draft.schoolEmail.trim() === current.schoolEmail.trim() &&
      draft.schoolPassword.trim() === current.schoolPassword.trim()
    ) {
      this.portalEditingKey = null;
      this.cdr.markForCheck();
      return;
    }

    this.portalSavingKey = group.key;
    this.portalErrors.delete(group.key);
    this.graduationStage
      .updatePortalCredential(this.studentId, group.universityId, draft)
      .pipe(
        finalize(() => {
          this.portalSavingKey = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (saved) => {
          this.portalCredentials.set(group.key, saved);
          this.portalDrafts.set(group.key, this.createPortalDraft(saved));
          if (this.portalEditingKey === group.key) {
            this.portalEditingKey = null;
          }
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.portalErrors.set(group.key, this.extractErrorMessage(error) || '保存学校账号资料失败。');
          this.cdr.markForCheck();
        },
      });
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.portalEditingKey) return;
    const target = event.target as HTMLElement | null;
    const portalCard = target?.closest('.portal-card') as HTMLElement | null;
    if (portalCard?.dataset?.['portalKey'] === this.portalEditingKey) return;

    const editingGroup = this.groups.find((group) => group.key === this.portalEditingKey);
    if (editingGroup) {
      this.savePortalCredential(editingGroup);
    }
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

  openHistory(): void {
    this.historyPanelOpen = true;
    this.loadHistory();
  }

  closeHistory(): void {
    this.historyPanelOpen = false;
    this.historyError = '';
  }

  refreshHistory(): void {
    if (this.historyLoading) return;
    this.loadHistory();
  }

  updateStatus(application: GraduationApplication, status: GraduationApplicationStatus): void {
    if (this.updatingId !== null || this.formSaving || application.status === status) return;

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
          if (this.historyPanelOpen) {
            this.loadHistory();
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.error = this.extractErrorMessage(error) || '更新申请进度失败。';
          this.cdr.markForCheck();
        },
      });
  }

  trackGroup(_index: number, group: ApplicationGroup): string {
    return group.key;
  }

  trackApplication(_index: number, application: GraduationApplication): string | number {
    return application.id;
  }

  trackUniversity(_index: number, university: University): number {
    return university.id;
  }

  trackProgram(_index: number, program: UniversityProgram): number {
    return program.id;
  }

  trackHistory(_index: number, entry: GraduationApplicationHistoryEntry): string | number {
    return entry.id || `${entry.operation || 'history'}-${entry.changedAt || _index}`;
  }

  trackHistoryChange(_index: number, change: GraduationApplicationHistoryFieldChange): string {
    return `${change.path || change.label || 'change'}-${_index}`;
  }

  displayUpdatedAt(value: string | undefined): string {
    return this.displayDateTime(value);
  }

  displayHistoryTimestamp(entry: GraduationApplicationHistoryEntry): string {
    return this.displayDateTime(entry.changedAt);
  }

  displayHistoryActor(entry: GraduationApplicationHistoryEntry): string {
    const role = this.displayActorRole(entry.actorRole);
    const name = String(entry.actorName || '').trim();
    if (role && name) return `${role} · ${name}`;
    return name || role || '系统';
  }

  displayHistoryOperation(entry: GraduationApplicationHistoryEntry): string {
    switch (entry.operation) {
      case 'ENTER_GRADUATION_STAGE':
        return '进入升学阶段';
      case 'CONFIRM_STAGE':
        return '确认正式申请';
      case 'CREATE_APPLICATION':
        return '新增申请';
      case 'UPDATE_APPLICATION':
        return '修改申请';
      case 'DELETE_APPLICATION':
        return '删除申请';
      case 'REORDER_APPLICATIONS':
        return '调整顺序';
      case 'UPDATE_APPLICATION_ACCOUNT_CREDENTIAL':
        return '修改申请账号';
      case 'UPDATE_PORTAL_CREDENTIAL':
        return '修改学校账号';
      default:
        return String(entry.operation || '操作记录');
    }
  }

  getHistoryChanges(entry: GraduationApplicationHistoryEntry): GraduationApplicationHistoryFieldChange[] {
    return Array.isArray(entry.changedFields) ? entry.changedFields : [];
  }

  displayHistoryField(change: GraduationApplicationHistoryFieldChange): string {
    const label = String(change.label || '').trim();
    if (label) return label;

    switch (change.path) {
      case 'graduationStage':
        return '升学阶段';
      case 'application':
        return '申请';
      case 'applicationOrder':
        return '申请顺序';
      case 'status':
        return '申请进度';
      case 'universityId':
      case 'universityName':
        return '大学';
      case 'programId':
      case 'programName':
        return '专业';
      case 'applicationEmail':
        return '申请邮箱';
      case 'applicationPassword':
        return '申请密码';
      case 'schoolAccount':
        return '学校账号';
      case 'schoolEmail':
        return '申请邮箱';
      case 'schoolPassword':
        return '学校密码';
      default:
        return String(change.path || '字段');
    }
  }

  displayHistoryValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '空';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
      return this.displayStatusCode(value) || value;
    }
    if (Array.isArray(value)) {
      const labels = value
        .map((item) => this.summarizeHistoryObject(item))
        .filter((item) => item.length > 0);
      return labels.length > 0 ? labels.join('；') : `${value.length} 项`;
    }
    if (typeof value === 'object') {
      return this.summarizeHistoryObject(value) || JSON.stringify(value);
    }
    return String(value);
  }

  isApplicationBusy(application: GraduationApplication): boolean {
    const applicationKey = String(application.id);
    return (
      this.formSaving ||
      this.updatingId === application.id ||
      this.deletingId === application.id ||
      this.groups.some((group) =>
        this.deletingGroupKey === group.key &&
        group.applications.some((item) => String(item.id) === applicationKey)
      )
    );
  }

  isGroupBusy(group: ApplicationGroup): boolean {
    return this.formSaving || this.deletingGroupKey === group.key;
  }

  get selectedFormUniversity(): University | null {
    const id = this.normalizeOptionalId(this.form.universityId);
    if (id) {
      const foundById = this.universities.find((item) => Number(item.id) === id);
      if (foundById) return foundById;
      const name = this.form.universityName.trim();
      if (name) return { id, name };
    }
    const name = this.form.universityName.trim();
    if (!name) return null;
    const normalized = this.normalizeSearchText(name);
    return this.universities.find((item) => this.normalizeSearchText(item.name) === normalized) ?? null;
  }

  get selectedFormProgram(): UniversityProgram | null {
    const university = this.selectedFormUniversity;
    const name = this.form.programName.trim();
    if (!university || !name) return null;
    const normalized = this.normalizeSearchText(name);
    return (
      this.programOptions.find((item) => {
        const belongsToUniversity = !item.universityId || Number(item.universityId) === university.id;
        return belongsToUniversity && this.normalizeSearchText(item.programName) === normalized;
      }) ?? null
    );
  }

  get visibleFormUniversities(): University[] {
    const keyword = this.form.universityName.trim();
    if (!keyword) return this.universities;
    return this.universities.filter((item) =>
      this.matchesSearch(keyword, [item.name, item.city, item.province, item.country, item.website])
    );
  }

  get visibleFormPrograms(): UniversityProgram[] {
    if (!this.selectedFormUniversity) return [];
    const keyword = this.form.programName.trim();
    if (!keyword) return this.programOptions;
    return this.programOptions.filter((item) =>
      this.matchesSearch(keyword, [item.programName, item.facultyName, item.degreeType])
    );
  }

  private loadApplicationAccount(): void {
    if (this.studentId <= 0) return;
    this.applicationAccountLoading = true;
    this.applicationAccountError = '';
    this.graduationStage
      .getApplicationAccountCredential(this.studentId)
      .pipe(
        finalize(() => {
          this.applicationAccountLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (credential) => {
          this.applicationAccountCredential = credential;
          this.applicationAccountDraft = this.createApplicationAccountDraft(credential);
          this.syncPortalDraftsWithApplicationAccount(credential);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.applicationAccountError = this.extractErrorMessage(error) || '读取申请账号失败。';
          this.applicationAccountDraft = this.createApplicationAccountDraft(null);
          this.cdr.markForCheck();
        },
      });
  }

  onFormUniversityInput(): void {
    if (this.isUniversityLockedInForm) return;
    this.form.programName = '';
    this.form.programId = null;
    this.programOptions = [];
    this.formError = '';
    const university = this.selectedFormUniversity;
    this.form.universityId = university?.id ?? null;
    this.universitySuggestionsOpen = !!this.form.universityName.trim() && !university;
    this.programSuggestionsOpen = !!university;
    if (university) {
      this.loadPrograms(university.id);
    }
    this.cdr.markForCheck();
  }

  onFormUniversityFocus(): void {
    if (this.isUniversityLockedInForm) return;
    this.universitySuggestionsOpen = !this.selectedFormUniversity;
    this.cdr.markForCheck();
  }

  selectFormUniversity(university: University): void {
    if (this.isUniversityLockedInForm) return;
    this.form.universityName = university.name;
    this.form.universityId = university.id;
    this.form.programName = '';
    this.form.programId = null;
    this.formError = '';
    this.universitySuggestionsOpen = false;
    this.programSuggestionsOpen = true;
    this.loadPrograms(university.id);
    this.cdr.markForCheck();
  }

  onFormProgramInput(): void {
    this.form.programId = this.selectedFormProgram?.id ?? null;
    this.formError = '';
    this.programSuggestionsOpen = !!this.selectedFormUniversity && !this.selectedFormProgram;
    this.cdr.markForCheck();
  }

  onFormProgramFocus(): void {
    this.programSuggestionsOpen = !!this.selectedFormUniversity && !this.selectedFormProgram;
    this.cdr.markForCheck();
  }

  selectFormProgram(program: UniversityProgram): void {
    this.form.programName = program.programName;
    this.form.programId = program.id;
    this.formError = '';
    this.programSuggestionsOpen = false;
    this.cdr.markForCheck();
  }

  private loadPortalCredential(group: ApplicationGroup): void {
    if (!group.universityId || this.portalCredentials.has(group.key) || this.portalLoadingKey === group.key) {
      this.ensurePortalDraft(group);
      return;
    }

    this.portalLoadingKey = group.key;
    this.portalErrors.delete(group.key);
    this.graduationStage
      .getPortalCredential(this.studentId, group.universityId)
      .pipe(
        finalize(() => {
          this.portalLoadingKey = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (credential) => {
          this.portalCredentials.set(group.key, credential);
          this.portalDrafts.set(group.key, this.createPortalDraft(credential));
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.portalErrors.set(group.key, this.extractErrorMessage(error) || '读取学校账号资料失败。');
          this.portalDrafts.set(group.key, this.createPortalDraft(null));
          this.cdr.markForCheck();
        },
      });
  }

  private ensurePortalDraft(group: ApplicationGroup): PortalCredentialDraft {
    const existing = this.portalDrafts.get(group.key);
    if (existing) return existing;
    const draft = this.createPortalDraft(this.portalCredentials.get(group.key));
    this.portalDrafts.set(group.key, draft);
    return draft;
  }

  private createPortalDraft(
    credential: GraduationApplicationPortalCredential | null | undefined
  ): PortalCredentialDraft {
    return {
      schoolAccount: String(credential?.schoolAccount || ''),
      schoolEmail: String(credential?.schoolEmail || credential?.defaultSchoolEmail || ''),
      schoolPassword: String(credential?.schoolPassword || credential?.defaultSchoolPassword || 'ZAQ!2wsxcde3'),
    };
  }

  private createApplicationAccountDraft(
    credential: GraduationApplicationAccountCredential | null | undefined
  ): ApplicationAccountDraft {
    return {
      applicationEmail: String(credential?.applicationEmail || credential?.defaultApplicationEmail || ''),
      applicationPassword: String(
        credential?.applicationPassword || credential?.defaultApplicationPassword || 'ZAQ!2wsxcde3'
      ),
    };
  }

  private syncPortalDraftsWithApplicationAccount(credential: GraduationApplicationAccountCredential): void {
    const applicationEmail = String(credential.applicationEmail || credential.defaultApplicationEmail || '').trim();
    const applicationPassword = String(
      credential.applicationPassword || credential.defaultApplicationPassword || 'ZAQ!2wsxcde3'
    ).trim();
    if (!applicationEmail && !applicationPassword) return;

    this.portalCredentials.forEach((portalCredential, key) => {
      const synced = {
        ...portalCredential,
        schoolEmail: applicationEmail || portalCredential.schoolEmail,
        schoolPassword: applicationPassword || portalCredential.schoolPassword,
        defaultSchoolEmail: applicationEmail || portalCredential.defaultSchoolEmail,
        defaultSchoolPassword: applicationPassword || portalCredential.defaultSchoolPassword,
      };
      this.portalCredentials.set(key, synced);
    });

    this.portalDrafts.forEach((draft, key) => {
      this.portalDrafts.set(key, {
        ...draft,
        schoolEmail: applicationEmail || draft.schoolEmail,
        schoolPassword: applicationPassword || draft.schoolPassword,
      });
    });
  }

  private createPortalFieldKey(group: ApplicationGroup, field: PortalCredentialField): string {
    return `${group.key}:${field}`;
  }

  private async writeClipboard(value: string): Promise<void> {
    const clipboard = navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private loadHistory(): void {
    if (this.studentId <= 0) {
      this.historyError = '缺少学生 ID';
      this.historyEntries = [];
      this.historyTotal = 0;
      return;
    }

    this.historyLoading = true;
    this.historyError = '';
    this.graduationStage
      .listHistory(this.studentId, { size: this.historyPageSize })
      .pipe(
        finalize(() => {
          this.historyLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (response) => {
          this.historyEntries = response?.items || [];
          this.historyTotal = Number(response?.total || this.historyEntries.length);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.historyEntries = [];
          this.historyTotal = 0;
          this.historyError = this.extractErrorMessage(error) || '读取操作记录失败。';
          this.cdr.markForCheck();
        },
      });
  }

  private replaceApplication(nextApplication: GraduationApplication): void {
    this.applications = this.applications.map((item) =>
      String(item.id) === String(nextApplication.id) ? nextApplication : item
    );
    this.cdr.markForCheck();
  }

  private loadUniversities(): void {
    this.loadingUniversities = true;
    this.universityApi
      .listUniversities()
      .pipe(
        finalize(() => {
          this.loadingUniversities = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (rows) => {
          this.universities = rows || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.universities = [];
          this.cdr.markForCheck();
        },
      });
  }

  private loadPrograms(universityId: number): void {
    if (!Number.isFinite(universityId) || universityId <= 0) return;
    this.loadingPrograms = true;
    this.universityApi
      .listPrograms(universityId)
      .pipe(
        finalize(() => {
          this.loadingPrograms = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (rows) => {
          this.programOptions = rows || [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.programOptions = [];
          this.formError = '读取专业列表失败。';
          this.cdr.markForCheck();
        },
      });
  }

  private buildApplicationFormPayload(): GraduationApplicationRequest | null {
    if (this.studentId <= 0) {
      this.formError = '缺少学生 ID。';
      return null;
    }

    const university = this.selectedFormUniversity;
    if (!university) {
      this.formError = '请先选择大学。';
      this.universitySuggestionsOpen = true;
      this.cdr.markForCheck();
      return null;
    }

    const program = this.selectedFormProgram;
    if (!program || (program.universityId && Number(program.universityId) !== university.id)) {
      this.formError = '请选择该大学下的专业。';
      this.programSuggestionsOpen = true;
      this.cdr.markForCheck();
      return null;
    }

    return {
      universityId: university.id,
      programId: program.id,
      status: this.form.status || this.editingApplication?.status || 'PREPARING',
      sourceAspirationId: this.editingApplication?.sourceAspirationId,
    };
  }

  private createEmptyForm(): ApplicationFormModel {
    return {
      universityId: null,
      universityName: '',
      programId: null,
      programName: '',
      status: 'PREPARING',
    };
  }

  private createUniversityGroupKey(universityId: number | null, universityName: string): string {
    return universityId ? `id:${universityId}` : `name:${this.normalizeSearchText(universityName)}`;
  }

  private normalizeOptionalId(value: unknown): number | null {
    const id = Math.trunc(Number(value));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private matchesSearch(keyword: string, values: Array<string | null | undefined>): boolean {
    const normalizedKeyword = this.normalizeSearchText(keyword);
    if (!normalizedKeyword) return true;
    const compactKeyword = this.compactSearchText(keyword);
    return values.some((value) => {
      const text = String(value || '');
      return (
        this.normalizeSearchText(text).includes(normalizedKeyword) ||
        (!!compactKeyword && this.compactSearchText(text).includes(compactKeyword))
      );
    });
  }

  private normalizeSearchText(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private compactSearchText(value: string | null | undefined): string {
    return this.normalizeSearchText(value).replace(/\s+/g, '');
  }

  private resolveContext(): void {
    const routeStudentId = Math.trunc(Number(this.route.snapshot.paramMap.get('studentId')));
    this.studentId = Number.isFinite(routeStudentId) && routeStudentId > 0 ? routeStudentId : 0;
  }

  private displayDateTime(value: string | undefined): string {
    const timestamp = Date.parse(String(value || ''));
    if (!Number.isFinite(timestamp)) return '-';
    return new Date(timestamp).toLocaleString();
  }

  private displayActorRole(role: string | undefined): string {
    switch (String(role || '').toUpperCase()) {
      case 'ADMIN':
        return '管理员';
      case 'TEACHER':
        return '老师';
      case 'STUDENT':
        return '学生';
      default:
        return '';
    }
  }

  private displayStatusCode(status: string): string {
    if (this.statusOptions.includes(status as GraduationApplicationStatus)) {
      return this.graduationStage.statusLabel(status);
    }
    return '';
  }

  private summarizeHistoryObject(value: unknown): string {
    if (!value || typeof value !== 'object') return '';
    const source = value as Record<string, unknown>;
    const university = String(source['universityName'] || '').trim();
    const program = String(source['programName'] || '').trim();
    const status = this.displayStatusCode(String(source['status'] || '').trim());
    const order = Number(source['sortOrder']);
    const parts = [university, program, status].filter((item) => item.length > 0);
    const label = parts.join(' / ');
    if (label && Number.isFinite(order) && order > 0) return `${order}. ${label}`;
    return label;
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
