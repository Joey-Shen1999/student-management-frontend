import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StudentProfileService } from './student-profile.service';

describe('StudentProfileService', () => {
  let service: StudentProfileService;
  let httpMock: HttpTestingController;
  const sessionKey = 'sm_session';

  beforeEach(() => {
    localStorage.removeItem(sessionKey);
    TestBed.configureTestingModule({
      providers: [StudentProfileService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(StudentProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(sessionKey);
    httpMock.verify();
  });

  it('getMyProfile should call GET /api/student/profile', () => {
    service.getMyProfile().subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('saveMyProfile should call PUT /api/student/profile', () => {
    service
      .saveMyProfile({
        phone: '(111) 222-3333',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      phone: '(111) 222-3333',
    });
    req.flush({});
  });

  it('getStudentProfileForTeacher should call GET /api/teacher/students/{id}/profile', () => {
    service.getStudentProfileForTeacher(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('saveStudentProfileForTeacher should call PUT /api/teacher/students/{id}/profile', () => {
    service
      .saveStudentProfileForTeacher(12, {
        phone: '(111) 222-3333',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      phone: '(111) 222-3333',
    });
    req.flush({});
  });

  it('uploadMySchoolTranscript should call POST /api/student/profile/schools/{id}/transcript with multipart body', () => {
    const file = new File(['pdf-content'], 'transcript.pdf', { type: 'application/pdf' });

    service.uploadMySchoolTranscript(9, file).subscribe();

    const req = httpMock.expectOne('/api/student/profile/schools/9/transcript');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const formData = req.request.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('transcript')).toBeNull();
    req.flush({});
  });

  it('uploadStudentSchoolTranscriptForTeacher should call teacher upload endpoint with multipart body', () => {
    const file = new File(['pdf-content'], 'transcript.pdf', { type: 'application/pdf' });

    service.uploadStudentSchoolTranscriptForTeacher(12, 33, file).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile/schools/33/transcript');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const formData = req.request.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('transcript')).toBeNull();
    req.flush({});
  });

  it('uploadMySchoolTranscript should retry with transcript field when primary upload fails', () => {
    const file = new File(['pdf-content'], 'transcript.pdf', { type: 'application/pdf' });
    const nextSpy = vi.fn();

    service.uploadMySchoolTranscript(9, file).subscribe(nextSpy);

    const firstReq = httpMock.expectOne('/api/student/profile/schools/9/transcript');
    const firstBody = firstReq.request.body as FormData;
    expect(firstBody.get('file')).toBe(file);
    expect(firstBody.get('transcript')).toBeNull();
    firstReq.flush({ message: 'Unsupported media type' }, { status: 415, statusText: 'Unsupported Media Type' });

    const retryReq = httpMock.expectOne('/api/student/profile/schools/9/transcript');
    const retryBody = retryReq.request.body as FormData;
    expect(retryBody.get('file')).toBeNull();
    expect(retryBody.get('transcript')).toBe(file);
    retryReq.flush({ ok: true });

    expect(nextSpy).toHaveBeenCalledWith({ ok: true });
  });

  it('searchCanadianHighSchools should keep boardName from richer duplicate rows', () => {
    const nextSpy = vi.fn();
    service.searchCanadianHighSchools('Unionville').subscribe(nextSpy);

    const req = httpMock.expectOne(
      (request) =>
        request.url === '/api/reference/canadian-high-schools/search' &&
        request.params.get('q') === 'Unionville'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('Unionville');

    req.flush({
      items: [
        {
          name: 'Unionville High School',
          streetAddress: '201 Town Centre Boulevard',
          city: 'Markham',
          state: 'Ontario',
          country: 'Canada',
          postal: 'L3R 8G5',
          boardName: '',
        },
        {
          name: 'Unionville High School',
          streetAddress: '201 Town Centre Boulevard',
          city: 'Markham',
          state: 'Ontario',
          country: 'Canada',
          postal: 'L3R 8G5',
          boardName: 'YRDSB',
        },
      ],
    });

    expect(nextSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Unionville High School',
        boardName: 'YRDSB',
      }),
    ]);
  });

  it('searchCanadianHighSchools should infer boardName from education-board library when payload boardName is missing', () => {
    const nextSpy = vi.fn();
    service.searchCanadianHighSchools('Alexander MacKenzie').subscribe(nextSpy);

    const req = httpMock.expectOne(
      (request) =>
        request.url === '/api/reference/canadian-high-schools/search' &&
        request.params.get('q') === 'Alexander MacKenzie'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      items: [
        {
          id: 'on-public:B66095:904040',
          name: 'Alexander MacKenzie High School',
          streetAddress: '300 Major MacKenzie Dr W',
          city: 'Richmond Hill',
          state: 'Ontario',
          country: 'Canada',
          postal: 'L4C 3S3',
          boardName: '',
        },
      ],
    });

    expect(nextSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Alexander MacKenzie High School',
        boardName: 'YRDSB',
      }),
    ]);
  });

  it('uploadMyIdentityFile should call POST /api/student/profile/identity-files with multipart body', () => {
    const file = new File(['doc-content'], 'passport.pdf', { type: 'application/pdf' });

    service.uploadMyIdentityFile(file).subscribe();

    const req = httpMock.expectOne('/api/student/profile/identity-files');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const formData = req.request.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('identity')).toBeNull();
    req.flush({});
  });

  it('uploadStudentIdentityFileForTeacher should call teacher identity upload endpoint with multipart body', () => {
    const file = new File(['doc-content'], 'passport.pdf', { type: 'application/pdf' });

    service.uploadStudentIdentityFileForTeacher(12, file).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile/identity-files');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const formData = req.request.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('identity')).toBeNull();
    req.flush({});
  });

  it('uploadMyIdentityFile should retry with identity field when primary upload fails', () => {
    const file = new File(['doc-content'], 'passport.pdf', { type: 'application/pdf' });
    const nextSpy = vi.fn();

    service.uploadMyIdentityFile(file).subscribe(nextSpy);

    const firstReq = httpMock.expectOne('/api/student/profile/identity-files');
    const firstBody = firstReq.request.body as FormData;
    expect(firstBody.get('file')).toBe(file);
    expect(firstBody.get('identity')).toBeNull();
    firstReq.flush({ message: 'Unsupported media type' }, { status: 415, statusText: 'Unsupported Media Type' });

    const retryReq = httpMock.expectOne('/api/student/profile/identity-files');
    const retryBody = retryReq.request.body as FormData;
    expect(retryBody.get('file')).toBeNull();
    expect(retryBody.get('identity')).toBe(file);
    retryReq.flush({ ok: true });

    expect(nextSpy).toHaveBeenCalledWith({ ok: true });
  });

  it('downloadMyIdentityFile should call GET /api/student/profile/identity-files/{id} with blob response', () => {
    service.downloadMyIdentityFile(77).subscribe();

    const req = httpMock.expectOne('/api/student/profile/identity-files/77');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('downloadStudentIdentityFileForTeacher should call GET /api/teacher/students/{id}/profile/identity-files/{fileId} with blob response', () => {
    service.downloadStudentIdentityFileForTeacher(12, 77).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile/identity-files/77');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('should attach Authorization header when session exists', () => {
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        userId: 9,
        role: 'STUDENT',
        studentId: 1001,
        teacherId: null,
        accessToken: 'token-xyz',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-25T12:00:00.000',
        mustChangePassword: false,
      })
    );

    service.getMyProfile().subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-xyz');
    req.flush({});
  });

  it('uploadMySchoolTranscript should attach Authorization header when session exists', () => {
    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        userId: 9,
        role: 'STUDENT',
        studentId: 1001,
        teacherId: null,
        accessToken: 'token-xyz',
        tokenType: 'Bearer',
        tokenExpiresAt: '2026-02-25T12:00:00.000',
        mustChangePassword: false,
      })
    );

    const file = new File(['pdf-content'], 'transcript.pdf', { type: 'application/pdf' });
    service.uploadMySchoolTranscript(9, file).subscribe();

    const req = httpMock.expectOne('/api/student/profile/schools/9/transcript');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-xyz');
    req.flush({});
  });
});
