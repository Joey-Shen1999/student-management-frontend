import { ActivatedRoute, Router } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { afterEach, vi } from 'vitest';

import { GraduationApplicationSetupComponent } from './graduation-application-setup.component';
import { GraduationApplicationStageService } from '../../services/graduation-application-stage.service';
import { UniversityAspirationService } from '../../services/university-aspiration.service';

describe('GraduationApplicationSetupComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function createComponent(options?: {
    applications$?: ReturnType<GraduationApplicationStageService['listApplications']>;
    aspirations$?: ReturnType<UniversityAspirationService['listAspirations']>;
  }) {
    const route = {
      snapshot: {
        paramMap: {
          get: () => '101',
        },
      },
    } as unknown as ActivatedRoute;
    const router = {
      navigate: vi.fn(),
    } as unknown as Router;
    const aspirationApi = {
      listUniversities: vi.fn().mockReturnValue(of([])),
      listPrograms: vi.fn().mockReturnValue(of([])),
      listAspirations: vi.fn().mockReturnValue(options?.aspirations$ ?? of([])),
    } as unknown as UniversityAspirationService;
    const graduationStage = {
      listApplications: vi.fn().mockReturnValue(options?.applications$ ?? of([])),
      createFromAspiration: vi.fn().mockReturnValue(null),
      confirmStage: vi.fn().mockReturnValue(of([])),
      statusLabel: (status: string) => status,
    } as unknown as GraduationApplicationStageService;
    const cdr = {
      markForCheck: vi.fn(),
    };

    const component = new GraduationApplicationSetupComponent(
      route,
      router,
      aspirationApi,
      graduationStage,
      cdr as any
    );
    component.studentId = 101;
    return { component, aspirationApi, graduationStage, router };
  }

  it('falls back to university goals when loading applications stalls', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { component, aspirationApi } = createComponent({
      applications$: NEVER,
      aspirations$: of([]),
    });

    component.loadDrafts();

    expect(component.loading).toBe(true);
    vi.advanceTimersByTime(12001);

    expect(aspirationApi.listAspirations).toHaveBeenCalledWith(101);
    expect(component.loading).toBe(false);
    expect(component.loadingMessage).toBe('');
    expect(component.message).toBe('暂无大学目标');
  });

  it('clears the loading state when both backend reads stall', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { component } = createComponent({
      applications$: NEVER,
      aspirations$: NEVER,
    });

    component.loadDrafts();
    vi.advanceTimersByTime(24002);

    expect(component.loading).toBe(false);
    expect(component.loadingMessage).toBe('');
    expect(component.error).toContain('读取申请资料超时');
  });

  it('shows a clear permission message when the current teacher cannot access the student', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const forbiddenError = {
      status: 403,
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden: student not assigned to current teacher.',
      },
    };
    const { component } = createComponent({
      applications$: throwError(() => forbiddenError),
      aspirations$: throwError(() => forbiddenError),
    });

    component.loadDrafts();

    expect(component.loading).toBe(false);
    expect(component.error).toContain('当前老师没有权限访问该学生');
  });

  it('reorders draft applications by drag and drop', () => {
    const { component } = createComponent();
    component.drafts = [
      createDraft(1, 'University A', 'Program A', 1),
      createDraft(2, 'University B', 'Program B', 2),
      createDraft(3, 'University C', 'Program C', 3),
    ];
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue('1'),
    };

    component.onDraftDragStart({ dataTransfer } as unknown as DragEvent, component.drafts[0]);
    component.onDraftDragOver(
      { preventDefault: vi.fn(), dataTransfer } as unknown as DragEvent,
      component.drafts[2]
    );
    component.onDraftDrop(
      { preventDefault: vi.fn(), dataTransfer } as unknown as DragEvent,
      component.drafts[2]
    );

    expect(component.drafts.map((draft) => draft.id)).toEqual([2, 3, 1]);
    expect(component.drafts.map((draft) => draft.sortOrder)).toEqual([1, 2, 3]);
    expect(component.draggedDraftId).toBeNull();
    expect(component.dragOverDraftId).toBeNull();
  });

  it('does not start row dragging from buttons or form controls', () => {
    const { component } = createComponent();
    component.drafts = [
      createDraft(1, 'University A', 'Program A', 1),
      createDraft(2, 'University B', 'Program B', 2),
    ];
    const preventDefault = vi.fn();
    const button = document.createElement('button');

    component.onDraftDragStart(
      {
        target: button,
        preventDefault,
        dataTransfer: {
          setData: vi.fn(),
        },
      } as unknown as DragEvent,
      component.drafts[0]
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(component.draggedDraftId).toBeNull();
  });

  it('moves removed drafts to the bottom instead of deleting them', () => {
    const { component } = createComponent();
    component.drafts = [
      createDraft(1, 'University A', 'Program A', 1),
      createDraft(2, 'University B', 'Program B', 2),
      createDraft(3, 'University C', 'Program C', 3),
    ];

    component.removeDraft(component.drafts[1]);

    expect(component.drafts.map((draft) => draft.id)).toEqual([1, 3, 2]);
    expect(component.drafts.map((draft) => draft.selected)).toEqual([true, true, false]);
    expect(component.selectedDrafts.map((draft) => draft.id)).toEqual([1, 3]);
    expect(component.removedDrafts.map((draft) => draft.id)).toEqual([2]);
  });

  it('adds a removed draft back to the active list', () => {
    const { component } = createComponent();
    component.drafts = [
      createDraft(1, 'University A', 'Program A', 1),
      createDraft(2, 'University B', 'Program B', 2),
      createDraft(3, 'University C', 'Program C', 3),
    ];
    component.removeDraft(component.drafts[1]);
    component.removeDraft(component.drafts[1]);

    component.restoreDraft(component.drafts[1]);

    expect(component.drafts.map((draft) => draft.id)).toEqual([1, 2, 3]);
    expect(component.drafts.map((draft) => draft.selected)).toEqual([true, true, false]);
    expect(component.selectedDrafts.map((draft) => draft.id)).toEqual([1, 2]);
    expect(component.removedDrafts.map((draft) => draft.id)).toEqual([3]);
  });

  it('updates the selected draft when saving from edit mode', () => {
    const { component } = createComponent();
    component.drafts = [createDraft(1, 'University A', 'Program A', 1)];
    component.universities = [{ id: 9, name: 'University X' }];
    component.newProgramOptions = [{ id: 91, universityId: 9, programName: 'Program X' }];
    component.editingDraftId = '1';
    component.newUniversityName = 'University X';
    component.newUniversityId = 9;
    component.newProgramName = 'Program X';
    component.newProgramId = 91;

    component.addDraft();

    expect(component.drafts).toHaveLength(1);
    expect(component.drafts[0]).toMatchObject({
      id: 1,
      universityId: 9,
      universityName: 'University X',
      programId: 91,
      programName: 'Program X',
      status: 'PREPARING',
      sortOrder: 1,
      selected: true,
    });
    expect(component.addDialogOpen).toBe(false);
    expect(component.editingDraftId).toBeNull();
  });

  it('navigates to the personal application page after confirming stage', () => {
    const { component, graduationStage, router } = createComponent();
    component.drafts = [createDraft(1, 'University A', 'Program A', 1)];
    vi.mocked(graduationStage.confirmStage).mockReturnValue(of([createDraft(1, 'University A', 'Program A', 1)] as any));

    component.confirmGraduationStage();

    expect(graduationStage.confirmStage).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students', '101', 'graduation-applications']);
  });

  it('does not submit removed drafts when confirming stage', () => {
    const { component, graduationStage } = createComponent();
    component.drafts = [
      createDraft(1, 'University A', 'Program A', 1),
      createDraft(2, 'University B', 'Program B', 2),
    ];
    component.removeDraft(component.drafts[1]);
    vi.mocked(graduationStage.confirmStage).mockReturnValue(of([createDraft(1, 'University A', 'Program A', 1)] as any));

    component.confirmGraduationStage();

    expect(graduationStage.confirmStage).toHaveBeenCalledWith(101, [
      {
        universityId: 1,
        programId: 10,
        status: 'PREPARING',
        sourceAspirationId: undefined,
      },
    ]);
  });
});

function createDraft(id: number, universityName: string, programName: string, sortOrder: number) {
  return {
    id,
    studentId: 101,
    universityId: id,
    universityName,
    programId: id * 10,
    programName,
    status: 'PREPARING' as const,
    sortOrder,
    updatedAt: '2026-05-14T00:00:00',
    selected: true,
  };
}
