import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { GraduationApplicationsComponent } from './graduation-applications.component';
import {
  GraduationApplication,
  GraduationApplicationStageService,
} from '../../services/graduation-application-stage.service';
import { UniversityAspirationService } from '../../services/university-aspiration.service';

describe('GraduationApplicationsComponent', () => {
  function createComponent(options?: {
    routeStudentId?: string | null;
    applications?: GraduationApplication[];
    listError?: unknown;
  }) {
    const route = {
      snapshot: {
        paramMap: {
          get: () => options?.routeStudentId ?? null,
        },
      },
    } as unknown as ActivatedRoute;
    const router = {
      navigate: vi.fn(),
    } as unknown as Router;
    const graduationStage = {
      listApplications: vi
        .fn()
        .mockReturnValue(
          options?.listError
            ? throwError(() => options.listError)
            : of(options?.applications ?? [createApplication(1, 'University A', 'Program A', 1)])
        ),
      listHistory: vi.fn().mockReturnValue(of({ items: [], total: 0, page: 0, size: 20 })),
      getApplicationAccountCredential: vi.fn().mockReturnValue(
        of({
          studentId: 101,
          applicationEmail: 'gradportalvip2027@outlook.com',
          applicationPassword: 'ZAQ!2wsxcde3',
        })
      ),
      updateApplicationAccountCredential: vi.fn().mockReturnValue(
        of({
          studentId: 101,
          applicationEmail: 'shared.application@outlook.com',
          applicationPassword: 'Shared!234',
        })
      ),
      updateApplication: vi.fn().mockReturnValue(
        of({
          ...createApplication(1, 'University A', 'Program A', 1),
          status: 'SUBMITTED',
        })
      ),
      createApplication: vi.fn().mockReturnValue(
        of(createApplication(2, 'University B', 'Program B', 2))
      ),
      deleteApplication: vi.fn().mockReturnValue(of(undefined)),
      getPortalCredential: vi.fn().mockReturnValue(
        of({
          studentId: 101,
          universityId: 1,
          universityName: 'University A',
          schoolAccount: '',
          schoolEmail: 'gradportalvip2027@outlook.com',
          schoolPassword: 'ZAQ!2wsxcde3',
          studentVisible: false,
          interviewRequired: false,
          languageScoreRequired: false,
        })
      ),
      updatePortalCredential: vi.fn().mockImplementation((_studentId, _universityId, payload) =>
        of({
          studentId: 101,
          universityId: 1,
          universityName: 'University A',
          schoolAccount: payload.schoolAccount,
          schoolEmail: payload.schoolEmail,
          schoolPassword: payload.schoolPassword,
          studentVisible: payload.studentVisible === true,
          interviewRequired: payload.interviewRequired === true,
          languageScoreRequired: payload.languageScoreRequired === true,
        })
      ),
      statusLabel: (status: string) => status,
    } as unknown as GraduationApplicationStageService;
    const universityApi = {
      listUniversities: vi.fn().mockReturnValue(
        of([
          { id: 1, name: 'University A' },
          { id: 2, name: 'University B' },
        ])
      ),
      listPrograms: vi.fn().mockImplementation((universityId: number) =>
        of([
          {
            id: universityId * 10,
            universityId,
            programName: universityId === 1 ? 'Program A' : 'Program B',
          },
        ])
      ),
    } as unknown as UniversityAspirationService;
    const cdr = {
      markForCheck: vi.fn(),
    };

    const component = new GraduationApplicationsComponent(
      route,
      router,
      graduationStage,
      universityApi,
      cdr as any
    );

    return { component, router, graduationStage, universityApi };
  }

  it('loads teacher student applications from the route student id', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [
        createApplication(2, 'University B', 'Program B', 2),
        createApplication(1, 'University A', 'Program A', 1),
      ],
    });

    component.ngOnInit();

    expect(component.studentId).toBe(101);
    expect(graduationStage.listApplications).toHaveBeenCalledWith(101);
    expect(component.groups.map((group) => group.universityName)).toEqual(['University A', 'University B']);
  });

  it('shows an error when the route student id is missing', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: null,
    });

    component.ngOnInit();

    expect(component.studentId).toBe(0);
    expect(component.error).toContain('缺少学生 ID');
    expect(graduationStage.listApplications).not.toHaveBeenCalled();
  });

  it('loads operation history for the teacher application page', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
    });
    vi.mocked(graduationStage.listHistory).mockReturnValue(
      of({
        items: [
          {
            id: 7,
            studentId: 101,
            applicationId: 1,
            operation: 'UPDATE_APPLICATION',
            actorRole: 'TEACHER',
            actorName: 'Teacher A',
            changedAt: '2026-05-14T12:00:00',
            changedFields: [{ path: 'status', before: 'PREPARING', after: 'SUBMITTED' }],
          },
        ],
        total: 1,
        page: 0,
        size: 20,
      })
    );

    component.ngOnInit();
    component.openHistory();

    expect(graduationStage.listHistory).toHaveBeenCalledWith(101, { size: 20 });
    expect(component.historyPanelOpen).toBe(true);
    expect(component.historyEntries).toHaveLength(1);
    expect(component.displayHistoryOperation(component.historyEntries[0])).toBe('修改申请');
    expect(component.displayHistoryField(component.historyEntries[0].changedFields![0])).toBe('申请进度');
  });

  it('updates an application status', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University A', 'Program A', 1)],
    });
    component.ngOnInit();

    component.updateStatus(component.applications[0], 'SUBMITTED');

    expect(graduationStage.updateApplication).toHaveBeenCalledWith(1, {
      universityId: 1,
      programId: 10,
      status: 'SUBMITTED',
      sourceAspirationId: undefined,
    });
    expect(component.applications[0].status).toBe('SUBMITTED');
  });

  it('pins accepted offers before other application progress rows', () => {
    const { component } = createComponent({
      routeStudentId: '101',
      applications: [
        createApplication(1, 'University A', 'Program A', 1),
        { ...createApplication(2, 'University B', 'Program B', 2), status: 'OFFER_ACCEPTED' },
      ],
    });

    component.ngOnInit();

    expect(component.sortedApplications.map((application) => application.status)).toEqual([
      'OFFER_ACCEPTED',
      'PREPARING',
    ]);
    expect(component.isOfferAccepted(component.sortedApplications[0])).toBe(true);
    expect(component.submittedCount).toBe(1);
    expect(component.offerCount).toBe(1);
  });

  it('creates a new university application from selected university and first program', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University A', 'Program A', 1)],
    });
    vi.mocked(graduationStage.createApplication).mockReturnValue(
      of(createApplication(2, 'University B', 'Program B', 2))
    );
    component.ngOnInit();

    component.openAddUniversity();
    component.selectFormUniversity({ id: 2, name: 'University B' });
    component.programOptions = [{ id: 20, universityId: 2, programName: 'Program B' }];
    component.selectFormProgram({ id: 20, universityId: 2, programName: 'Program B' });
    component.saveApplicationForm();

    expect(graduationStage.createApplication).toHaveBeenCalledWith(101, {
      universityId: 2,
      programId: 20,
      status: 'PREPARING',
      sourceAspirationId: undefined,
    });
    expect(component.applications.map((application) => application.id)).toEqual([1, 2]);
    expect(component.formOpen).toBe(false);
  });

  it('adds a program under an existing university group', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University A', 'Program A', 1)],
    });
    vi.mocked(graduationStage.createApplication).mockReturnValue(
      of({
        ...createApplication(3, 'University A', 'Program C', 2),
        universityId: 1,
        programId: 30,
      })
    );
    component.ngOnInit();

    component.openAddProgram(component.groups[0]);
    expect(component.form.universityName).toBe('University A');
    component.programOptions = [
      { id: 10, universityId: 1, programName: 'Program A' },
      { id: 30, universityId: 1, programName: 'Program C' },
    ];
    component.selectFormProgram({ id: 30, universityId: 1, programName: 'Program C' });
    component.saveApplicationForm();

    expect(graduationStage.createApplication).toHaveBeenCalledWith(101, {
      universityId: 1,
      programId: 30,
      status: 'PREPARING',
      sourceAspirationId: undefined,
    });
    expect(component.groups[0].applications.map((application) => application.programName)).toEqual([
      'Program A',
      'Program C',
    ]);
  });

  it('edits an existing formal application university and program', () => {
    const existing = createApplication(1, 'University A', 'Program A', 1);
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [existing],
    });
    vi.mocked(graduationStage.updateApplication).mockReturnValue(
      of({
        ...existing,
        universityId: 2,
        universityName: 'University B',
        programId: 20,
        programName: 'Program B',
      })
    );
    component.ngOnInit();

    component.openEditApplication(component.applications[0]);
    component.selectFormUniversity({ id: 2, name: 'University B' });
    component.programOptions = [{ id: 20, universityId: 2, programName: 'Program B' }];
    component.selectFormProgram({ id: 20, universityId: 2, programName: 'Program B' });
    component.saveApplicationForm();

    expect(graduationStage.updateApplication).toHaveBeenCalledWith(1, {
      universityId: 2,
      programId: 20,
      status: 'PREPARING',
      sourceAspirationId: undefined,
    });
    expect(component.applications[0].universityName).toBe('University B');
    expect(component.applications[0].programName).toBe('Program B');
    expect(component.formOpen).toBe(false);
  });

  it('deletes a single program application', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [
        createApplication(1, 'University A', 'Program A', 1),
        { ...createApplication(2, 'University A', 'Program B', 2), universityId: 1 },
      ],
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.ngOnInit();

    component.deleteApplication(component.applications[0]);

    expect(graduationStage.deleteApplication).toHaveBeenCalledWith(1);
    expect(component.applications.map((application) => application.programName)).toEqual(['Program B']);
  });

  it('deletes an entire university group', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [
        createApplication(1, 'University A', 'Program A', 1),
        { ...createApplication(2, 'University A', 'Program B', 2), universityId: 1 },
        createApplication(3, 'University B', 'Program C', 3),
      ],
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    component.ngOnInit();

    component.deleteUniversityGroup(component.groups[0]);

    expect(graduationStage.deleteApplication).toHaveBeenCalledWith(1);
    expect(graduationStage.deleteApplication).toHaveBeenCalledWith(2);
    expect(component.applications.map((application) => application.universityName)).toEqual([
      'University B',
    ]);
  });

  it('loads and saves a university portal credential from the school card', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University A', 'Program A', 1)],
    });
    component.ngOnInit();
    const group = component.groups[0];

    const cardBlankTarget = document.createElement('div');
    component.onUniversityPanelClick(group, { target: cardBlankTarget } as unknown as MouseEvent);

    expect(component.isPortalExpanded(group)).toBe(true);
    expect(graduationStage.getPortalCredential).toHaveBeenCalledWith(101, 1);
    expect(component.getPortalDraft(group).schoolEmail).toBe('gradportalvip2027@outlook.com');

    const actionButton = document.createElement('button');
    component.onUniversityPanelClick(group, { target: actionButton } as unknown as MouseEvent);
    expect(component.isPortalExpanded(group)).toBe(true);

    const programList = document.createElement('div');
    programList.className = 'program-list';
    const programChild = document.createElement('span');
    programList.appendChild(programChild);
    component.onUniversityPanelClick(group, { target: programChild } as unknown as MouseEvent);
    expect(component.isPortalExpanded(group)).toBe(true);

    component.startPortalEdit(group);
    const portalCard = document.createElement('section');
    portalCard.className = 'portal-card';
    portalCard.dataset['portalKey'] = group.key;
    const portalInput = document.createElement('input');
    portalCard.appendChild(portalInput);
    component.onDocumentMouseDown({ target: portalInput } as unknown as MouseEvent);
    expect(component.isPortalEditing(group)).toBe(true);

    component.updatePortalDraft(group, 'schoolAccount', 'portal-user');
    component.updatePortalDraft(group, 'schoolEmail', 'custom.portal@outlook.com');
    component.updatePortalDraft(group, 'schoolPassword', 'Changed!234');
    component.togglePortalStudentVisible(group, true);
    component.savePortalCredential(group);

    expect(graduationStage.updatePortalCredential).toHaveBeenCalledWith(101, 1, {
      schoolAccount: 'portal-user',
      schoolEmail: 'custom.portal@outlook.com',
      schoolPassword: 'Changed!234',
      studentVisible: true,
      interviewRequired: false,
      languageScoreRequired: false,
    });
    expect(component.isPortalEditing(group)).toBe(false);
    expect(component.getPortalDraft(group).schoolAccount).toBe('portal-user');
  });

  it('updates the shared application account and syncs visible school account drafts', () => {
    const { component, graduationStage } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University A', 'Program A', 1)],
    });
    component.ngOnInit();
    const group = component.groups[0];
    component.togglePortal(group);
    expect(component.getPortalDraft(group).schoolEmail).toBe('gradportalvip2027@outlook.com');

    component.startApplicationAccountEdit();
    component.updateApplicationAccountDraft('applicationEmail', 'shared.application@outlook.com');
    component.updateApplicationAccountDraft('applicationPassword', 'Shared!234');
    component.saveApplicationAccount();

    expect(graduationStage.updateApplicationAccountCredential).toHaveBeenCalledWith(101, {
      applicationEmail: 'shared.application@outlook.com',
      applicationPassword: 'Shared!234',
    });
    expect(component.applicationAccountEditing).toBe(false);
    expect(component.getPortalDraft(group).schoolEmail).toBe('shared.application@outlook.com');
    expect(component.getPortalDraft(group).schoolPassword).toBe('Shared!234');
  });

  it('resolves the University of Toronto student login link', () => {
    const { component } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University of Toronto St. George Campus', 'Computer Science', 1)],
    });
    component.ngOnInit();

    expect(component.resolvePortalLoginUrl(component.groups[0])).toBe('https://join.utoronto.ca/');
  });

  it('keeps a stable Outlook mail shortcut for application email accounts', () => {
    const { component } = createComponent({ routeStudentId: '101' });

    expect(component.outlookLoginUrl).toBe('https://outlook.live.com/mail/');
  });

  it('resolves common university portal links beyond University of Toronto', () => {
    const { component } = createComponent({
      routeStudentId: '101',
      applications: [
        createApplication(1, 'University of Waterloo', 'Computer Science', 1),
        createApplication(2, 'York University', 'Commerce', 2),
        createApplication(3, 'Toronto Metropolitan University (formerly Ryerson University)', 'Business', 3),
      ],
    });
    component.ngOnInit();

    const urls = new Map(component.groups.map((group) => [group.universityName, component.resolvePortalLoginUrl(group)]));
    expect(urls.get('University of Waterloo')).toBe('https://uwaterloo.ca/quest/');
    expect(urls.get('York University')).toBe('https://myfile.yorku.ca/');
    expect(urls.get('Toronto Metropolitan University (formerly Ryerson University)')).toBe(
      'https://www.torontomu.ca/admissions/undergraduate/choose-login/'
    );
  });

  it('uses the most specific portal alias when university names overlap', () => {
    const { component } = createComponent({
      routeStudentId: '101',
      applications: [createApplication(1, 'University of Guelph-Humber', 'Media Studies', 1)],
    });
    component.ngOnInit();

    expect(component.resolvePortalLoginUrl(component.groups[0])).toBe('https://www.uoguelph.ca/webadvisor');
  });
});

function createApplication(
  id: number,
  universityName: string,
  programName: string,
  sortOrder: number
): GraduationApplication {
  return {
    id,
    studentId: 101,
    universityId: id,
    universityName,
    programId: id * 10,
    programName,
    status: 'PREPARING',
    sortOrder,
    updatedAt: '2026-05-14T00:00:00',
  };
}
