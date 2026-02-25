import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import { StudentProfile } from './student-profile';
import { StudentProfileService } from '../../services/student-profile.service';

describe('StudentProfile', () => {
  let component: StudentProfile;
  let fixture: ComponentFixture<StudentProfile>;
  let profileApi: Pick<
    StudentProfileService,
    'getMyProfile' | 'saveMyProfile' | 'getStudentProfileForTeacher' | 'saveStudentProfileForTeacher'
  >;
  let routeParams$: BehaviorSubject<any>;
  let router: Pick<Router, 'navigate'>;

  beforeEach(async () => {
    profileApi = {
      getMyProfile: vi.fn(() => of({})),
      saveMyProfile: vi.fn(() => of({})),
      getStudentProfileForTeacher: vi.fn(() => of({})),
      saveStudentProfileForTeacher: vi.fn(() => of({})),
    };
    routeParams$ = new BehaviorSubject(convertToParamMap({}));
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StudentProfile],
      providers: [
        { provide: StudentProfileService, useValue: profileApi },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams$.asObservable(),
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(StudentProfile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should stay in view mode by default', () => {
    expect(component.editing).toBe(false);
  });

  it('should render read-only content in view mode', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('基础信息');
  });

  it('should render form controls in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name=\"phone\"]')).not.toBeNull();
  });

  it('enterEditMode should switch to edit mode', () => {
    component.enterEditMode();
    expect(component.editing).toBe(true);
  });

  it('save should exit edit mode after successful save', () => {
    component.enterEditMode();
    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
    expect(component.editing).toBe(false);
  });

  it('should auto save on field blur while editing without exiting edit mode', () => {
    component.enterEditMode();
    component.model.phone = '1234567890';

    const input = document.createElement('input');
    input.type = 'text';
    component.onFormFocusOut({ target: input } as unknown as FocusEvent);

    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
    expect(component.editing).toBe(true);
  });

  it('should not auto save on field blur in view mode', () => {
    const input = document.createElement('input');
    input.type = 'text';
    component.onFormFocusOut({ target: input } as unknown as FocusEvent);

    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
  });

  it('should skip duplicate auto save when payload is unchanged', () => {
    component.enterEditMode();
    component.model.phone = '1234567890';

    const input = document.createElement('input');
    input.type = 'text';
    const blurEvent = { target: input } as unknown as FocusEvent;

    component.onFormFocusOut(blurEvent);
    component.onFormFocusOut(blurEvent);

    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
  });

  it('should auto save when removing external course in edit mode', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(of({
      otherCourses: [
        {
          schoolType: 'OTHER',
          schoolName: 'Summer School',
          courseCode: 'MHF4U',
          mark: 95,
          gradeLevel: 12,
          startTime: '2025-07-01',
          endTime: '2025-08-01',
        },
      ],
    }));
    component.loadProfile();
    component.enterEditMode();

    expect(component.model.externalCourses.length).toBe(1);
    component.removeExternalCourse(0);

    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
  });

  it('should load self profile for /student/profile route', () => {
    expect(profileApi.getMyProfile).toHaveBeenCalledTimes(1);
    expect(profileApi.getStudentProfileForTeacher).not.toHaveBeenCalled();
  });

  it('should load teacher-managed student profile for /teacher/students/:id/profile route', () => {
    routeParams$.next(convertToParamMap({ studentId: '12' }));

    expect(profileApi.getStudentProfileForTeacher).toHaveBeenCalledWith(12);
  });

  it('should save teacher-managed student profile via teacher API', () => {
    routeParams$.next(convertToParamMap({ studentId: '12' }));
    component.save();

    expect(profileApi.saveStudentProfileForTeacher).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        otherCourses: expect.any(Array),
      })
    );
    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
  });

  it('back should return to student-management in teacher-managed mode', () => {
    routeParams$.next(convertToParamMap({ studentId: '12' }));

    component.back();
    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students']);
  });
});
