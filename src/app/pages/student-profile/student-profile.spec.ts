import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, of, throwError } from 'rxjs';
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
    | 'uploadMySchoolTranscript'
    | 'uploadStudentSchoolTranscriptForTeacher'
    | 'downloadMySchoolTranscript'
    | 'downloadStudentSchoolTranscriptForTeacher'
    | 'uploadMyIdentityFile'
    | 'uploadStudentIdentityFileForTeacher'
    | 'downloadMyIdentityFile'
    | 'downloadStudentIdentityFileForTeacher'
  >;
  let routeParams$: BehaviorSubject<any>;
  let activatedRouteStub: {
    paramMap: ReturnType<BehaviorSubject<any>['asObservable']>;
    snapshot: {
      queryParamMap: ReturnType<typeof convertToParamMap>;
    };
  };
  let router: Pick<Router, 'navigate'>;

  beforeEach(async () => {
    profileApi = {
      getMyProfile: vi.fn(() => of({})),
      saveMyProfile: vi.fn(() => of({})),
      getStudentProfileForTeacher: vi.fn(() => of({})),
      saveStudentProfileForTeacher: vi.fn(() => of({})),
      searchCanadianHighSchools: vi.fn(() => of([])),
      searchOntarioCourseProviders: vi.fn(() => of([])),
      uploadMySchoolTranscript: vi.fn(() =>
        of({
          schoolRecordId: 1,
          transcriptFileName: 'transcript.pdf',
          transcriptSizeBytes: 123,
          transcriptUploadedAt: '2026-03-02T10:00:00',
          hasTranscript: true,
        })
      ),
      uploadStudentSchoolTranscriptForTeacher: vi.fn(() =>
        of({
          schoolRecordId: 1,
          transcriptFileName: 'transcript.pdf',
          transcriptSizeBytes: 123,
          transcriptUploadedAt: '2026-03-02T10:00:00',
          hasTranscript: true,
        })
      ),
      downloadMySchoolTranscript: vi.fn(() =>
        of(new HttpResponse<Blob>({ body: new Blob(['x']), status: 200 }))
      ),
      downloadStudentSchoolTranscriptForTeacher: vi.fn(() =>
        of(new HttpResponse<Blob>({ body: new Blob(['x']), status: 200 }))
      ),
      uploadMyIdentityFile: vi.fn(() =>
        of({
          identityFileId: 1,
          identityFileName: 'passport.pdf',
          identityFileSizeBytes: 123,
          identityFileUploadedAt: '2026-03-02T10:00:00',
        })
      ),
      uploadStudentIdentityFileForTeacher: vi.fn(() =>
        of({
          identityFileId: 1,
          identityFileName: 'passport.pdf',
          identityFileSizeBytes: 123,
          identityFileUploadedAt: '2026-03-02T10:00:00',
        })
      ),
      downloadMyIdentityFile: vi.fn(() =>
        of(new HttpResponse<Blob>({ body: new Blob(['x']), status: 200 }))
      ),
      downloadStudentIdentityFileForTeacher: vi.fn(() =>
        of(new HttpResponse<Blob>({ body: new Blob(['x']), status: 200 }))
      ),
    };
    routeParams$ = new BehaviorSubject(convertToParamMap({}));
    activatedRouteStub = {
      paramMap: routeParams$.asObservable(),
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [StudentProfile],
      providers: [
        { provide: StudentProfileService, useValue: profileApi },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: activatedRouteStub,
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

  it('should enter edit mode when onboarding flag is present in self profile route', () => {
    activatedRouteStub.snapshot.queryParamMap = convertToParamMap({ onboarding: '1' });
    routeParams$.next(convertToParamMap({}));

    expect(component.editing).toBe(true);
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

  it('should render birthday, gender and email in view mode', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        birthday: '2008-09-01',
        gender: 'Other: Non-binary',
        email: 'student@example.com',
      })
    );

    component.loadProfile();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('2008-09-01');
    expect(text).toContain('Other (Non-binary)');
    expect(text).toContain('student@example.com');
  });

  it('should render uploaded transcript filename as clickable download button', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        schools: [
          {
            schoolRecordId: 88,
            schoolType: 'MAIN',
            schoolName: 'Unionville High School',
            transcriptFileName: 'Transcript-UHS.pdf',
            hasTranscript: true,
          },
        ],
      })
    );

    component.loadProfile();
    fixture.detectChanges();

    const clickSpy = vi.spyOn(component, 'downloadHighSchoolTranscript');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const fileButton = buttons.find((button) => button.textContent?.includes('Transcript-UHS.pdf')) || null;

    expect(fileButton).not.toBeNull();
    fileButton?.click();
    expect(clickSpy).toHaveBeenCalledWith(0, 0);
  });

  it('should render form controls in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name=\"birthday\"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select[name=\"gender\"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name=\"phone\"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name=\"email\"]')).not.toBeNull();
  });

  it('should prioritize citizenship options with China, Canada, USA, Taiwan, Hong Kong', () => {
    expect(component.citizenshipOptions.slice(0, 5)).toEqual([
      '\u4e2d\u56fd',
      '\u52a0\u62ff\u5927',
      '\u7f8e\u56fd',
      '\u4e2d\u56fd\u53f0\u6e7e',
      '\u4e2d\u56fd\u9999\u6e2f',
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

  it('should render OUAC gender helper text in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('OUAC');
    expect(text).toContain('Male / Female / Other');
  });

  it('should render OEN helper text in edit mode', () => {
    component.enterEditMode();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Ontario Student Transcript');
    expect(text).not.toContain('OEN 缂栧彿锛堝彲閫夛級');
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
        schoolRecordId: null,
        schoolType: '',
        schoolName: 'Current High School',
        streetAddress: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
        startTime: '2025-09-01',
        endTime: '',
        transcriptFileName: '',
        transcriptSizeBytes: null,
        transcriptUploadedAt: '',
        hasTranscript: false,
        transcripts: [],
      },
      {
        schoolRecordId: null,
        schoolType: 'MAIN',
        schoolName: 'Previous High School',
        streetAddress: '',
        city: '',
        state: '',
        country: 'Canada',
        postal: '',
        startTime: '2024-09-01',
        endTime: '2025-06-30',
        transcriptFileName: '',
        transcriptSizeBytes: null,
        transcriptUploadedAt: '',
        hasTranscript: false,
        transcripts: [],
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

  it('should upload transcript directly when schoolRecordId exists', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(profileApi.uploadMySchoolTranscript).toHaveBeenCalledWith(101, file);
    expect(component.model.highSchools[0].hasTranscript).toBe(true);
    expect(component.model.highSchools[0].transcriptFileName).toBe('transcript.pdf');
  });

  it('should append newly uploaded transcript to existing transcript list', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;
    component.model.highSchools[0].transcripts = [
      {
        transcriptFileName: 'old-transcript.pdf',
        transcriptSizeBytes: 111,
        transcriptUploadedAt: '2026-03-01T10:00:00',
      },
    ];

    (profileApi.uploadMySchoolTranscript as any).mockReturnValueOnce(
      of({
        transcriptFileName: 'new-transcript.pdf',
        transcriptSizeBytes: 222,
        transcriptUploadedAt: '2026-03-02T10:00:00',
        hasTranscript: true,
      })
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(component.model.highSchools[0].transcripts.length).toBe(2);
    expect(component.model.highSchools[0].transcripts[0].transcriptFileName).toBe('old-transcript.pdf');
    expect(component.model.highSchools[0].transcripts[1].transcriptFileName).toBe('new-transcript.pdf');
    expect(component.model.highSchools[0].hasTranscript).toBe(true);
  });

  it('should keep all uploads even when transcript filename repeats', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    (profileApi.uploadMySchoolTranscript as any)
      .mockReturnValueOnce(
        of({
          transcriptFileName: 'repeat.pdf',
          transcriptSizeBytes: 100,
          transcriptUploadedAt: '2026-03-01T10:00:00',
          hasTranscript: true,
        })
      )
      .mockReturnValueOnce(
        of({
          transcriptFileName: 'repeat.pdf',
          transcriptSizeBytes: 100,
          transcriptUploadedAt: '2026-03-02T10:00:00',
          hasTranscript: true,
        })
      )
      .mockReturnValueOnce(
        of({
          transcriptFileName: 'repeat.pdf',
          transcriptSizeBytes: 100,
          transcriptUploadedAt: '2026-03-03T10:00:00',
          hasTranscript: true,
        })
      );

    const createEvent = (name: string): Event => {
      const file = new File(['pdf-content'], name, { type: 'application/pdf' });
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });
      return { target: input } as unknown as Event;
    };

    component.onHighSchoolTranscriptFileSelected(0, createEvent('a.pdf'));
    component.onHighSchoolTranscriptFileSelected(0, createEvent('b.pdf'));
    component.onHighSchoolTranscriptFileSelected(0, createEvent('c.pdf'));

    expect(component.model.highSchools[0].transcripts.length).toBe(3);
    expect(component.model.highSchools[0].hasTranscript).toBe(true);
  });

  it('should remove selected transcript from school transcript list', () => {
    component.enterEditMode();
    component.model.highSchools[0].transcripts = [
      {
        transcriptFileName: 'transcript-1.pdf',
        transcriptSizeBytes: 111,
        transcriptUploadedAt: '2026-03-01T10:00:00',
      },
      {
        transcriptFileName: 'transcript-2.pdf',
        transcriptSizeBytes: 222,
        transcriptUploadedAt: '2026-03-02T10:00:00',
      },
    ];

    component.removeHighSchoolTranscript(0, 0);

    expect(component.model.highSchools[0].transcripts.length).toBe(1);
    expect(component.model.highSchools[0].transcripts[0].transcriptFileName).toBe('transcript-2.pdf');
    expect(component.model.highSchools[0].hasTranscript).toBe(true);

    component.removeHighSchoolTranscript(0, 0);
    expect(component.model.highSchools[0].transcripts.length).toBe(0);
    expect(component.model.highSchools[0].hasTranscript).toBe(false);
  });

  it('should upload multiple identity files and append to existing list', () => {
    component.enterEditMode();
    component.model.identityFiles = [
      {
        identityFileId: 7,
        identityFileName: 'existing-passport.pdf',
        identityFileSizeBytes: 90,
        identityFileUploadedAt: '2026-03-01T10:00:00',
      },
    ];

    (profileApi.uploadMyIdentityFile as any)
      .mockReturnValueOnce(
        of({
          identityFileId: 8,
          identityFileName: 'new-passport.pdf',
          identityFileSizeBytes: 120,
          identityFileUploadedAt: '2026-03-02T10:00:00',
        })
      )
      .mockReturnValueOnce(
        of({
          identityFileId: 9,
          identityFileName: 'new-permit.pdf',
          identityFileSizeBytes: 140,
          identityFileUploadedAt: '2026-03-03T10:00:00',
        })
      );

    const fileOne = new File(['passport'], 'new-passport.pdf', { type: 'application/pdf' });
    const fileTwo = new File(['permit'], 'new-permit.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [fileOne, fileTwo],
      configurable: true,
    });

    component.onIdentityFileSelected({ target: input } as unknown as Event);

    expect(profileApi.uploadMyIdentityFile).toHaveBeenCalledTimes(2);
    expect(profileApi.uploadMyIdentityFile).toHaveBeenNthCalledWith(1, fileOne);
    expect(profileApi.uploadMyIdentityFile).toHaveBeenNthCalledWith(2, fileTwo);
    expect(component.model.identityFiles.length).toBe(3);
    expect(component.model.identityFiles[1].identityFileName).toBe('new-passport.pdf');
    expect(component.model.identityFiles[2].identityFileName).toBe('new-permit.pdf');
  });

  it('should queue identity upload until current save finishes', () => {
    vi.useFakeTimers();
    try {
      component.enterEditMode();
      (component as any).saveInProgress = true;
      (component as any).saving = true;

      setTimeout(() => {
        (component as any).saveInProgress = false;
        (component as any).saving = false;
      }, 240);

      const file = new File(['passport'], 'queued-passport.pdf', { type: 'application/pdf' });
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });

      component.onIdentityFileSelected({ target: input } as unknown as Event);

      expect(profileApi.uploadMyIdentityFile).not.toHaveBeenCalled();
      vi.advanceTimersByTime(500);

      expect(profileApi.uploadMyIdentityFile).toHaveBeenCalledTimes(1);
      expect(profileApi.uploadMyIdentityFile).toHaveBeenCalledWith(file);
      expect(component.error).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should remove identity file and auto-save remaining list', () => {
    component.enterEditMode();
    component.model.identityFiles = [
      {
        identityFileId: 11,
        identityFileName: 'passport.pdf',
        identityFileSizeBytes: 120,
        identityFileUploadedAt: '2026-03-02T10:00:00',
      },
      {
        identityFileId: 12,
        identityFileName: 'permit.pdf',
        identityFileSizeBytes: 140,
        identityFileUploadedAt: '2026-03-03T10:00:00',
      },
    ];

    component.removeIdentityFile(0);

    expect(component.model.identityFiles.length).toBe(1);
    expect(component.model.identityFiles[0].identityFileId).toBe(12);
    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        identityFiles: [
          expect.objectContaining({
            identityFileId: 12,
            identityFileName: 'permit.pdf',
          }),
        ],
      })
    );
  });

  it('should download identity file by identityFileId', () => {
    const triggerDownloadSpy = vi.spyOn(component as any, 'triggerBlobDownload');
    component.model.identityFiles = [
      {
        identityFileId: 88,
        identityFileName: 'passport.pdf',
        identityFileSizeBytes: 120,
        identityFileUploadedAt: '2026-03-02T10:00:00',
      },
    ];

    component.downloadIdentityFile(0);

    expect(profileApi.downloadMyIdentityFile).toHaveBeenCalledWith(88);
    expect(triggerDownloadSpy).toHaveBeenCalledTimes(1);
  });

  it('should auto-save and then upload transcript when schoolRecordId is missing', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = null;
    component.model.highSchools[0].schoolName = 'Unionville High School';

    (profileApi.saveMyProfile as any).mockReturnValueOnce(
      of({
        schools: [
          {
            schoolRecordId: 88,
            schoolType: 'MAIN',
            schoolName: 'Unionville High School',
            country: 'Canada',
          },
        ],
      })
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
    expect(profileApi.uploadMySchoolTranscript).toHaveBeenCalledWith(88, file);
  });

  it('should refresh profile and continue transcript upload when save response misses schoolRecordId', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = null;
    component.model.highSchools[0].schoolName = 'Unionville High School';
    component.model.highSchools[0].city = 'Markham';
    component.model.highSchools[0].postal = 'L3R 8G5';

    (profileApi.saveMyProfile as any).mockReturnValueOnce(of({}));
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        schools: [
          {
            schoolRecordId: 188,
            schoolType: 'MAIN',
            schoolName: 'Unionville High School',
            city: 'Markham',
            country: 'Canada',
            postal: 'L3R 8G5',
          },
        ],
      })
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
    expect(profileApi.getMyProfile).toHaveBeenCalled();
    expect(profileApi.uploadMySchoolTranscript).toHaveBeenCalledWith(188, file);
  });

  it('should queue transcript upload until current save finishes', () => {
    vi.useFakeTimers();
    try {
      component.enterEditMode();
      component.model.highSchools[0].schoolRecordId = null;
      component.model.highSchools[0].schoolName = 'Unionville High School';

      (component as any).saveInProgress = true;
      (component as any).saving = true;
      setTimeout(() => {
        (component as any).saveInProgress = false;
        (component as any).saving = false;
      }, 240);

      (profileApi.saveMyProfile as any).mockReturnValueOnce(
        of({
          schools: [
            {
              schoolRecordId: 288,
              schoolType: 'MAIN',
              schoolName: 'Unionville High School',
              country: 'Canada',
            },
          ],
        })
      );

      const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: [file],
        configurable: true,
      });

      component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);
      expect(profileApi.saveMyProfile).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);

      expect(profileApi.saveMyProfile).toHaveBeenCalledTimes(1);
      expect(profileApi.uploadMySchoolTranscript).toHaveBeenCalledWith(288, file);
      expect(component.error).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should stop upload when auto-save fails before transcript upload', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = null;
    component.model.highSchools[0].schoolName = 'Unionville High School';

    (profileApi.saveMyProfile as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { message: '淇濆瓨澶辫触' },
          })
      )
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(profileApi.uploadMySchoolTranscript).not.toHaveBeenCalled();
    expect(component.error).toContain('淇濆瓨澶辫触');
  });

  it('should show complete validation details from backend error payload', () => {
    component.enterEditMode();

    (profileApi.saveMyProfile as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              message: 'Validation failed.',
              details: [
                { field: 'schools[0].schoolName', message: 'is required' },
                { field: 'schools[0].startTime', message: 'is required' },
              ],
            },
          })
      )
    );

    component.save();

    expect(component.error).toContain('高中学校第1项的学校名称为必填项');
    expect(component.error).toContain('高中学校第1项的开始日期为必填项');
    expect(component.error).not.toContain('Validation failed');
  });

  it('should humanize validation path when backend returns raw message only', () => {
    component.enterEditMode();

    (profileApi.saveMyProfile as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              message: 'schools[0].schoolName is required',
            },
          })
      )
    );

    component.save();

    expect(component.error).toContain('高中学校第1项的学校名称为必填项');
    expect(component.error).not.toContain('schools[0].schoolName is required');
  });

  it('should clear uploading state when transcript upload fails', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    (profileApi.uploadMySchoolTranscript as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { message: '涓婁紶澶辫触' },
          })
      )
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(component.highSchoolTranscriptUploading[0]).toBe(false);
    expect(component.error).toContain('涓婁紶澶辫触');
  });

  it('should show connection-aborted hint when transcript upload returns status 0', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    (profileApi.uploadMySchoolTranscript as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            statusText: 'Unknown Error',
          })
      )
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(component.highSchoolTranscriptUploading[0]).toBe(false);
    expect(component.error).toContain('\u4e0a\u4f20\u8fde\u63a5\u88ab\u4e2d\u65ad');
  });

  it('should show payload-too-large hint when transcript upload returns status 413', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    (profileApi.uploadMySchoolTranscript as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 413,
            statusText: 'Payload Too Large',
          })
      )
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(component.highSchoolTranscriptUploading[0]).toBe(false);
    expect(component.error).toContain('\u6587\u4ef6\u8fc7\u5927');
  });

  it('should show server-limit hint with file size when transcript upload aborts for file larger than 1MB', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    (profileApi.uploadMySchoolTranscript as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 0,
            statusText: 'Unknown Error',
          })
      )
    );

    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(component.highSchoolTranscriptUploading[0]).toBe(false);
    expect(component.error).toContain('\u4e0a\u4f20\u4e0a\u9650\u8fc7\u5c0f');
  });

  it('should show login-expired hint when backend returns UNAUTHENTICATED payload', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;

    (profileApi.uploadMySchoolTranscript as any).mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              status: 401,
              code: 'UNAUTHENTICATED',
              message: 'Unauthenticated.',
            },
          })
      )
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(component.highSchoolTranscriptUploading[0]).toBe(false);
    expect(component.error).toContain('\u767b\u5f55\u72b6\u6001\u5df2\u5931\u6548');
  });

  it('should refresh profile and retry upload when existing schoolRecordId is stale', () => {
    component.enterEditMode();
    component.model.highSchools[0].schoolRecordId = 101;
    component.model.highSchools[0].schoolName = 'Unionville High School';
    component.model.highSchools[0].city = 'Markham';
    component.model.highSchools[0].postal = 'L3R 8G5';

    (profileApi.uploadMySchoolTranscript as any)
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { message: 'School record not found.' },
            })
        )
      )
      .mockReturnValueOnce(
        of({
          schoolRecordId: 301,
          transcriptFileName: 'transcript.pdf',
          transcriptSizeBytes: 123,
          transcriptUploadedAt: '2026-03-02T10:00:00',
          hasTranscript: true,
        })
      );
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        schools: [
          {
            schoolRecordId: 301,
            schoolType: 'MAIN',
            schoolName: 'Unionville High School',
            city: 'Markham',
            country: 'Canada',
            postal: 'L3R 8G5',
          },
        ],
      })
    );

    const file = new File(['pdf-content'], 'grade12.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });

    component.onHighSchoolTranscriptFileSelected(0, { target: input } as unknown as Event);

    expect(profileApi.uploadMySchoolTranscript).toHaveBeenNthCalledWith(1, 101, file);
    expect(profileApi.getMyProfile).toHaveBeenCalled();
    expect(profileApi.uploadMySchoolTranscript).toHaveBeenNthCalledWith(2, 301, file);
    expect(component.error).toBe('');
  });

  it('should map uploaded transcript fields from legacy backend names', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        schools: [
          {
            schoolType: 'MAIN',
            schoolName: 'Unionville High School',
            transcriptOriginalFilename: 'Transcript-UHS.pdf',
            sizeBytes: 2048,
            uploadedAt: '2026-03-02T10:00:00',
            transcriptAvailable: true,
          },
        ],
      })
    );

    component.loadProfile();

    expect(component.model.highSchools[0].transcriptFileName).toBe('Transcript-UHS.pdf');
    expect(component.model.highSchools[0].transcriptSizeBytes).toBe(2048);
    expect(component.model.highSchools[0].transcriptUploadedAt).toBe('2026-03-02T10:00:00');
    expect(component.model.highSchools[0].hasTranscript).toBe(true);
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

  it('should map Other gender with detail from API', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        gender: 'Other: Non-binary',
      })
    );

    component.loadProfile();

    expect(component.model.gender).toBe('Other');
    expect(component.model.genderOther).toBe('Non-binary');
  });

  it('should map structured genderOther from API', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(
      of({
        gender: 'Other',
        genderOther: 'Prefer not to answer',
      })
    );

    component.loadProfile();

    expect(component.model.gender).toBe('Other');
    expect(component.model.genderOther).toBe('Prefer not to answer');
  });

  it('should save Other gender with detail', () => {
    component.enterEditMode();
    component.onGenderSelectionChange('Other');
    component.onGenderOtherInputChange('Prefer not to specify');

    component.save();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: 'Other',
        genderOther: 'Prefer not to specify',
      })
    );
  });

  it('should clear genderOther when gender is switched to Male or Female', () => {
    component.model.gender = 'Other';
    component.model.genderOther = 'Non-binary';

    component.onGenderSelectionChange('Female');

    expect(component.model.gender).toBe('Female');
    expect(component.model.genderOther).toBe('');
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

  it('should not auto save when focus moves to transcript file input', () => {
    component.enterEditMode();
    component.model.phone = '1234567890';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    component.onFormFocusOut({
      target: textInput,
      relatedTarget: fileInput,
    } as unknown as FocusEvent);

    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
  });

  it('should not auto save when file input itself loses focus', () => {
    component.enterEditMode();
    component.model.phone = '1234567890';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    component.onFormFocusOut({ target: fileInput } as unknown as FocusEvent);

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
      statusInCanada: '\u7559\u5b66\u751f(Study permit)',
    }));

    component.loadProfile();

    expect(component.statusInCanadaSelection).toBe('\u7559\u5b66\u751f(Study permit)');
    expect(component.statusInCanadaOtherText).toBe('');
  });

  it('should map custom statusInCanada to other input', () => {
    (profileApi.getMyProfile as any).mockReturnValueOnce(of({
      statusInCanada: '瀹楁暀搴囨姢',
    }));

    component.loadProfile();

    expect(component.statusInCanadaSelection).toBe(component.statusInCanadaOtherOptionValue);
    expect(component.statusInCanadaOtherText).toBe('瀹楁暀搴囨姢');
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

    component.onStatusInCanadaSelectionChange('璁块棶(Visitor)');
    expect(component.model.statusInCanada).toBe('璁块棶(Visitor)');

    component.onStatusInCanadaSelectionChange(component.statusInCanadaOtherOptionValue);
    component.onStatusInCanadaOtherTextChange('鍏朵粬涓存椂韬唤');
    expect(component.model.statusInCanada).toBe('鍏朵粬涓存椂韬唤');
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

