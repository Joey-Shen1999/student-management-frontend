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
    | 'getMyProfile'
    | 'saveMyProfile'
    | 'getStudentProfileForTeacher'
    | 'saveStudentProfileForTeacher'
    | 'searchCanadianHighSchools'
    | 'searchOntarioCourseProviders'
  >;
  let routeParams$: BehaviorSubject<any>;
  let router: Pick<Router, 'navigate'>;

  beforeEach(async () => {
    profileApi = {
      getMyProfile: vi.fn(() => of({})),
      saveMyProfile: vi.fn(() => of({})),
      getStudentProfileForTeacher: vi.fn(() => of({})),
      saveStudentProfileForTeacher: vi.fn(() => of({})),
      searchCanadianHighSchools: vi.fn(() => of([])),
      searchOntarioCourseProviders: vi.fn(() => of([])),
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
    expect(fixture.nativeElement.querySelectorAll('fieldset').length).toBeGreaterThan(0);
  });

  it('should render phone in view mode', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        phone: '1234567890',
      })
    );

    component.loadProfile();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('(123) 456-7890');
  });

  it('should render form controls in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name=\"phone\"]')).not.toBeNull();
  });

  it('should prioritize citizenship options with China, Canada, USA, Taiwan, Hong Kong', () => {
    expect(component.citizenshipOptions.slice(0, 5)).toEqual([
      '中国',
      '加拿大',
      '美国',
      '中国台湾',
      '中国香港',
    ]);
  });

  it('should render citizenship input with datalist suggestions', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const citizenshipInput = fixture.nativeElement.querySelector('input[name=\"citizenship\"]');
    const citizenshipDatalist = fixture.nativeElement.querySelector('datalist#citizenshipOptions');

    expect(citizenshipInput).not.toBeNull();
    expect(citizenshipInput.getAttribute('list')).toBe('citizenshipOptions');
    expect(citizenshipDatalist).not.toBeNull();
    expect(citizenshipDatalist.querySelectorAll('option').length).toBeGreaterThan(5);
  });

  it('should prioritize first-language options with Chinese, English, French, Japanese, Korean', () => {
    expect(component.firstLanguageOptions.slice(0, 5)).toEqual([
      '\u4e2d\u6587',
      '\u82f1\u8bed',
      '\u6cd5\u8bed',
      '\u65e5\u8bed',
      '\u97e9\u8bed',
    ]);
  });

  it('should render first-language input with datalist suggestions', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const firstLanguageInput = fixture.nativeElement.querySelector('input[name=\"firstLanguage\"]');
    const firstLanguageDatalist = fixture.nativeElement.querySelector('datalist#firstLanguageOptions');

    expect(firstLanguageInput).not.toBeNull();
    expect(firstLanguageInput.getAttribute('list')).toBe('firstLanguageOptions');
    expect(firstLanguageDatalist).not.toBeNull();
    expect(firstLanguageDatalist.querySelectorAll('option').length).toBeGreaterThan(5);
  });

  it('should prioritize city options with major GTA areas first', () => {
    expect(component.cityOptions.slice(0, 5)).toEqual([
      'Toronto',
      'North York',
      'Scarborough',
      'Etobicoke',
      'Markham',
    ]);
  });

  it('should render city input with datalist suggestions', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const cityInput = fixture.nativeElement.querySelector('input[name=\"city\"]');
    const cityDatalist = fixture.nativeElement.querySelector('datalist#cityOptions');

    expect(cityInput).not.toBeNull();
    expect(cityInput.getAttribute('list')).toBe('cityOptions');
    expect(cityDatalist).not.toBeNull();
    expect(cityDatalist.querySelectorAll('option').length).toBeGreaterThan(10);
  });

  it('should prioritize province options with Ontario first', () => {
    expect(component.provinceOptions.slice(0, 3)).toEqual([
      'Ontario',
      'Quebec',
      'British Columbia',
    ]);
  });

  it('should render province input with datalist suggestions', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const provinceInput = fixture.nativeElement.querySelector('input[name=\"state\"]');
    const provinceDatalist = fixture.nativeElement.querySelector('datalist#provinceOptions');

    expect(provinceInput).not.toBeNull();
    expect(provinceInput.getAttribute('list')).toBe('provinceOptions');
    expect(provinceDatalist).not.toBeNull();
    expect(provinceDatalist.querySelectorAll('option').length).toBeGreaterThan(10);
  });

  it('should prioritize country options with Canada, China, United States first', () => {
    expect(component.countryOptions.slice(0, 3)).toEqual([
      'Canada',
      'China',
      'United States',
    ]);
  });

  it('should render country input with datalist suggestions', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const countryInput = fixture.nativeElement.querySelector('input[name=\"country\"]');
    const countryDatalist = fixture.nativeElement.querySelector('datalist#countryOptions');

    expect(countryInput).not.toBeNull();
    expect(countryInput.getAttribute('list')).toBe('countryOptions');
    expect(countryDatalist).not.toBeNull();
    expect(countryDatalist.querySelectorAll('option').length).toBeGreaterThan(10);
  });

  it('should format postal code as XXX XXX', () => {
    component.onPostalInputChange('m1m1m1');
    expect(component.model.address.postal).toBe('M1M 1M1');
  });

  it('should format postal code as 12345-6789 for United States', () => {
    component.onCountryInputChange('United States');
    component.onPostalInputChange('123456789');
    expect(component.model.address.postal).toBe('12345-6789');
  });

  it('should format postal code as 6 digits for China', () => {
    component.onCountryInputChange('China');
    component.onPostalInputChange('200080ABC');
    expect(component.model.address.postal).toBe('200080');
  });

  it('should reformat existing postal code when country changes', () => {
    component.model.address.postal = '123456789';
    component.onCountryInputChange('United States');
    expect(component.model.address.postal).toBe('12345-6789');
  });

  it('should block save and show error when OEN is not 9 digits', () => {
    component.enterEditMode();
    component.onOenInputChange('12345');

    component.save();

    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
    expect(component.oenError).toContain('9');
  });

  it('should allow save when OEN is 9 digits', () => {
    component.enterEditMode();
    component.onOenInputChange('123456789');

    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        oenNumber: '123456789',
      })
    );
    expect(component.oenError).toBe('');
  });

  it('should render first-entry-date helper text in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      '\u8bf7\u586b\u5199\u5165\u5883\u767b\u9646\u6216\u8005\u5f00\u59cb\u5b66\u4e60\u7684\u65f6\u95f4\uff0c\u65c5\u6e38\u4e0d\u7b97\u3002'
    );
  });

  it('should render OEN helper text in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ontario Student Transcript');
    expect(text).not.toContain('\u53ef\u9009');
  });

  it('should initialize with one current high school record', () => {
    expect(component.model.highSchools.length).toBe(1);
    expect(component.model.highSchools[0].schoolType).toBe('MAIN');
  });

  it('should add past high school records as OTHER', () => {
    component.addHighSchool();

    expect(component.model.highSchools.length).toBe(2);
    expect(component.model.highSchools[1].schoolType).toBe('OTHER');
  });

  it('should keep current high school when trying to remove index 0', () => {
    component.removeHighSchool(0);

    expect(component.model.highSchools.length).toBe(1);
    expect(component.model.highSchools[0].schoolType).toBe('MAIN');
  });

  it('should normalize schools payload to one MAIN followed by OTHER', () => {
    component.enterEditMode();
    component.model.highSchools = [
      {
        schoolType: '',
        schoolName: 'Current High School',
        streetAddress: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
        startTime: '2025-09-01',
        endTime: '',
      },
      {
        schoolType: 'MAIN',
        schoolName: 'Previous High School',
        streetAddress: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
        startTime: '2024-09-01',
        endTime: '2025-06-30',
      },
    ];

    component.save();

    const payload = (profileApi.saveMyProfile as any).mock.calls[0][0];
    expect(payload.schools[0]).toEqual(
      expect.objectContaining({
        schoolType: 'MAIN',
        schoolName: 'Previous High School',
      })
    );
    expect(payload.schools[1]).toEqual(
      expect.objectContaining({
        schoolType: 'OTHER',
        schoolName: 'Current High School',
      })
    );
  });

  it('should auto fill high school address from lookup result', () => {
    vi.useFakeTimers();
    try {
      (profileApi.searchCanadianHighSchools as any).mockReturnValueOnce(
        of([
          {
            name: 'North Toronto Collegiate Institute',
            streetAddress: '17 Broadway Avenue',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            postal: 'M4P1T7',
            displayAddress: '17 Broadway Avenue, Toronto, Ontario, M4P 1T7, Canada',
            lookupKey: 'way:34227662:North Toronto Collegiate Institute',
          },
        ])
      );

      component.onHighSchoolNameInputChange(0, 'North Toronto Collegiate Institute');
      vi.advanceTimersByTime(300);

      expect(profileApi.searchCanadianHighSchools).toHaveBeenCalledWith('North Toronto Collegiate Institute');
      expect(component.model.highSchools[0].streetAddress).toBe('17 Broadway Avenue');
      expect(component.model.highSchools[0].city).toBe('Toronto');
      expect(component.model.highSchools[0].state).toBe('Ontario');
      expect(component.model.highSchools[0].country).toBe('Canada');
      expect(component.model.highSchools[0].postal).toBe('M4P 1T7');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not auto fill high school address on partial name match', () => {
    vi.useFakeTimers();
    try {
      (profileApi.searchCanadianHighSchools as any).mockReturnValueOnce(
        of([
          {
            name: 'Unionville High School',
            streetAddress: '201 Town Centre Boulevard',
            city: 'Markham',
            state: 'Ontario',
            country: 'Canada',
            postal: 'L3R8G5',
            displayAddress: '201 Town Centre Boulevard, Markham, Ontario, L3R 8G5, Canada',
            lookupKey: 'unionville-high-school',
          },
        ])
      );

      component.onHighSchoolNameInputChange(0, 'Unionville');
      vi.advanceTimersByTime(300);

      expect(component.model.highSchools[0].streetAddress).toBe('');
      expect(component.model.highSchools[0].city).toBe('');
      expect(component.model.highSchools[0].state).toBe('');
      expect(component.model.highSchools[0].country).toBe('Canada');
      expect(component.model.highSchools[0].postal).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should render external-course provider datalist in edit mode', async () => {
    component.enterEditMode();
    component.addExternalCourse();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const schoolInput = fixture.nativeElement.querySelector('input[list=\"externalCourseProviderOptions_0\"]');
    const schoolDatalist = fixture.nativeElement.querySelector('datalist#externalCourseProviderOptions_0');

    expect(schoolInput).not.toBeNull();
    expect(schoolDatalist).not.toBeNull();
  });

  it('should normalize external-course school name on exact provider match', () => {
    vi.useFakeTimers();
    try {
      (profileApi.searchOntarioCourseProviders as any).mockReturnValueOnce(
        of([
          {
            name: 'Bayview Secondary Night School',
            streetAddress: '1000 Finch Ave W',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            postal: 'M3J2V5',
            displayAddress: '1000 Finch Ave W, Toronto, Ontario, M3J 2V5, Canada',
            lookupKey: 'bayview-night-school',
            boardName: 'Toronto DSB',
            schoolSpecialConditions: 'Continuing Education',
          },
        ])
      );

      component.addExternalCourse();
      component.onExternalCourseSchoolNameInputChange(0, 'Bayview Secondary Night School');
      vi.advanceTimersByTime(300);

      expect(profileApi.searchOntarioCourseProviders).toHaveBeenCalledWith('Bayview Secondary Night School');
      expect(component.model.externalCourses[0].schoolName).toBe('Bayview Secondary Night School');
      expect(component.model.externalCourses[0].streetAddress).toBe('1000 Finch Ave W');
      expect(component.model.externalCourses[0].city).toBe('Toronto');
      expect(component.model.externalCourses[0].state).toBe('Ontario');
      expect(component.model.externalCourses[0].country).toBe('Canada');
      expect(component.model.externalCourses[0].postal).toBe('M3J 2V5');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should not override external-course school name on partial provider match', () => {
    vi.useFakeTimers();
    try {
      (profileApi.searchOntarioCourseProviders as any).mockReturnValueOnce(
        of([
          {
            name: 'Bayview Secondary Night School',
            streetAddress: '1000 Finch Ave W',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            postal: 'M3J2V5',
            displayAddress: '1000 Finch Ave W, Toronto, Ontario, M3J 2V5, Canada',
            lookupKey: 'bayview-night-school',
            boardName: 'Toronto DSB',
            schoolSpecialConditions: 'Continuing Education',
          },
        ])
      );

      component.addExternalCourse();
      component.onExternalCourseSchoolNameInputChange(0, 'Bayview Secondary');
      vi.advanceTimersByTime(300);

      expect(component.model.externalCourses[0].schoolName).toBe('Bayview Secondary');
    } finally {
      vi.useRealTimers();
    }
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

  it('should format phone input as (xxx) xxx-xxxx', () => {
    component.onPhoneInputChange('1234567890');
    expect(component.model.phone).toBe('(123) 456-7890');
  });

  it('should save phone as digits only', () => {
    component.enterEditMode();
    component.model.phone = '(123) 456-7890';

    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '1234567890',
      })
    );
  });

  it('should map firstEntryDateInCanada from API to firstBoardingDate model', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        firstEntryDateInCanada: '2025-01-15',
      })
    );

    component.loadProfile();

    expect(component.model.firstBoardingDate).toBe('2025-01-15');
  });

  it('should save first entry date to backend compatibility fields', () => {
    component.enterEditMode();
    component.model.firstBoardingDate = '2025-01-15';

    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        firstBoardingDate: '2025-01-15',
        firstEntryDateInCanada: '2025-01-15',
      })
    );
  });

  it('should normalize country from API to standard English', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        address: {
          country: '\u7f8e\u56fd',
        },
      })
    );

    component.loadProfile();

    expect(component.model.address.country).toBe('United States');
  });

  it('should normalize country aliases to standard English when saving', () => {
    component.enterEditMode();
    component.model.address.country = '\u4e2d\u56fd';

    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({
          country: 'China',
        }),
      })
    );
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

  it('should map preset statusInCanada to dropdown selection', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(of({
      statusInCanada: '留学生(Study permit)',
    }));

    component.loadProfile();

    expect(component.statusInCanadaSelection).toBe('留学生(Study permit)');
    expect(component.statusInCanadaOtherText).toBe('');
  });

  it('should map custom statusInCanada to other input', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(of({
      statusInCanada: '宗教庇护',
    }));

    component.loadProfile();

    expect(component.statusInCanadaSelection).toBe(component.statusInCanadaOtherOptionValue);
    expect(component.statusInCanadaOtherText).toBe('宗教庇护');
  });

  it('should normalize phone from API to formatted display', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        phone: '1234567890',
      })
    );

    component.loadProfile();

    expect(component.model.phone).toBe('(123) 456-7890');
  });

  it('should write selected status to model', () => {
    component.enterEditMode();

    component.onStatusInCanadaSelectionChange('访问(Visitor)');
    expect(component.model.statusInCanada).toBe('访问(Visitor)');

    component.onStatusInCanadaSelectionChange(component.statusInCanadaOtherOptionValue);
    component.onStatusInCanadaOtherTextChange('其他临时身份');
    expect(component.model.statusInCanada).toBe('其他临时身份');
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

  it('should include external-course school address in save payload', () => {
    component.enterEditMode();
    component.addExternalCourse();
    component.model.externalCourses[0] = {
      schoolName: 'Bayview Secondary Night School',
      streetAddress: '1000 Finch Ave W',
      city: 'Toronto',
      state: 'Ontario',
      country: 'Canada',
      postal: 'M3J2V5',
      courseCode: 'MHF4U',
      mark: 95,
      gradeLevel: 12,
      startTime: '2025-07-01',
      endTime: '2025-08-01',
    };

    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        otherCourses: [
          expect.objectContaining({
            schoolName: 'Bayview Secondary Night School',
            streetAddress: '1000 Finch Ave W',
            city: 'Toronto',
            state: 'Ontario',
            country: 'Canada',
            postal: 'M3J 2V5',
            address: expect.objectContaining({
              streetAddress: '1000 Finch Ave W',
              city: 'Toronto',
              state: 'Ontario',
              country: 'Canada',
              postal: 'M3J 2V5',
            }),
          }),
        ],
      })
    );
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
