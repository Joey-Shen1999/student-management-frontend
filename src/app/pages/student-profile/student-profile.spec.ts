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
