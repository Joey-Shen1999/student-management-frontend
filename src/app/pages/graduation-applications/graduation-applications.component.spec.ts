import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { GraduationApplicationsComponent } from './graduation-applications.component';
import {
  GraduationApplication,
  GraduationApplicationStageService,
} from '../../services/graduation-application-stage.service';

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
      updateApplication: vi.fn().mockReturnValue(
        of({
          ...createApplication(1, 'University A', 'Program A', 1),
          status: 'SUBMITTED',
        })
      ),
      statusLabel: (status: string) => status,
    } as unknown as GraduationApplicationStageService;
    const cdr = {
      markForCheck: vi.fn(),
    };

    const component = new GraduationApplicationsComponent(
      route,
      router,
      graduationStage,
      cdr as any
    );

    return { component, router, graduationStage };
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
