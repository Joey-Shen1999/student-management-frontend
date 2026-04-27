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

  it('getMyProfileHistory should call GET /api/student/profile/history with pagination', () => {
    service.getMyProfileHistory({ page: 1, size: 20 }).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === '/api/student/profile/history' &&
        request.params.get('page') === '1' &&
        request.params.get('size') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
  });

  it('getMyProfileHistory should default to size 20', () => {
    service.getMyProfileHistory().subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === '/api/student/profile/history' &&
        request.params.get('page') === null &&
        request.params.get('size') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
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

  it('saveMyProfile should attach version and change-source headers from save context', () => {
    service.setProfileSaveContext({
      ifMatchVersion: 12,
      changeSource: 'manual_save',
    });

    service.saveMyProfile({ phone: '(111) 222-3333' }).subscribe();

    const req = httpMock.expectOne('/api/student/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe('12');
    expect(req.request.headers.get('X-Profile-Change-Source')).toBe('manual_save');
    req.flush({});
  });

  it('getStudentProfileForTeacher should call GET /api/teacher/students/{id}/profile', () => {
    service.getStudentProfileForTeacher(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/profile');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getStudentProfileHistoryForTeacher should call teacher history endpoint', () => {
    service.getStudentProfileHistoryForTeacher(12, { size: 20 }).subscribe();

    const req = httpMock.expectOne(
      (request) =>
        request.url === '/api/teacher/students/12/profile/history' &&
        request.params.get('size') === '20'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
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

  it('save context should be consumed once', () => {
    service.setProfileSaveContext({
      ifMatchVersion: 7,
      changeSource: 'auto_save',
    });

    service.saveMyProfile({ phone: '(111) 222-3333' }).subscribe();
    const firstReq = httpMock.expectOne('/api/student/profile');
    expect(firstReq.request.headers.get('If-Match')).toBe('7');
    expect(firstReq.request.headers.get('X-Profile-Change-Source')).toBe('auto_save');
    firstReq.flush({});

    service.saveMyProfile({ phone: '(111) 222-3333' }).subscribe();
    const secondReq = httpMock.expectOne('/api/student/profile');
    expect(secondReq.request.headers.has('If-Match')).toBe(false);
    expect(secondReq.request.headers.has('X-Profile-Change-Source')).toBe(false);
    secondReq.flush({});
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

  it('uploadStudentDocumentForTeacher should call teacher documents endpoint with multipart body', () => {
    const file = new File(['doc-content'], 'report-card.pdf', { type: 'application/pdf' });

    service
      .uploadStudentDocumentForTeacher(12, file, {
        documentCategory: 'Academic Record',
        academicRecordType: 'report card',
        reportYear: 2026,
        reportMonth: 'winter',
        title: 'Grade 11 Report Card',
        notes: 'teacher upload',
      })
      .subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/documents');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const formData = req.request.body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('documentCategory')).toBe('Academic Record');
    expect(formData.get('academicRecordType')).toBe('report card');
    expect(formData.get('reportYear')).toBe('2026');
    expect(formData.get('reportMonth')).toBe('January');
    expect(formData.get('title')).toBe('Grade 11 Report Card');
    expect(formData.get('notes')).toBe('teacher upload');
    req.flush({});
  });

  it('uploadStudentDocumentForTeacher should fallback to teacher profile documents endpoint when primary path is unsupported', () => {
    const file = new File(['doc-content'], 'transcript.pdf', { type: 'application/pdf' });
    const nextSpy = vi.fn();

    service
      .uploadStudentDocumentForTeacher(12, file, {
        documentCategory: 'Academic Record',
        academicRecordType: 'transcript',
        title: 'Grade 12 Transcript',
      })
      .subscribe(nextSpy);

    const primaryReq = httpMock.expectOne('/api/teacher/students/12/documents');
    expect(primaryReq.request.method).toBe('POST');
    primaryReq.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    const fallbackReq = httpMock.expectOne('/api/teacher/students/12/profile/documents');
    expect(fallbackReq.request.method).toBe('POST');
    const fallbackBody = fallbackReq.request.body as FormData;
    expect(fallbackBody.get('file')).toBe(file);
    expect(fallbackBody.get('documentCategory')).toBe('Academic Record');
    expect(fallbackBody.get('academicRecordType')).toBe('transcript');
    expect(fallbackBody.get('title')).toBe('Grade 12 Transcript');
    fallbackReq.flush({ ok: true });

    expect(nextSpy).toHaveBeenCalledWith({ ok: true });
  });

  it('listStudentDocumentsForTeacher should call teacher documents endpoint', () => {
    service.listStudentDocumentsForTeacher(12).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/documents');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('listStudentDocumentsForTeacher should fallback to teacher profile documents endpoint when primary path is unsupported', () => {
    const nextSpy = vi.fn();

    service.listStudentDocumentsForTeacher(12).subscribe(nextSpy);

    const primaryReq = httpMock.expectOne('/api/teacher/students/12/documents');
    expect(primaryReq.request.method).toBe('GET');
    primaryReq.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    const fallbackReq = httpMock.expectOne('/api/teacher/students/12/profile/documents');
    expect(fallbackReq.request.method).toBe('GET');
    fallbackReq.flush([{ id: 1 }]);

    expect(nextSpy).toHaveBeenCalledWith([{ id: 1 }]);
  });

  it('viewStudentDocumentFileForTeacher should call teacher document file endpoint with blob response', () => {
    service.viewStudentDocumentFileForTeacher(12, 35).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/documents/35/file');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('viewStudentDocumentFileForTeacher should fallback to teacher profile document file endpoint when primary path is unsupported', () => {
    const nextSpy = vi.fn();

    service.viewStudentDocumentFileForTeacher(12, 35).subscribe(nextSpy);

    const primaryReq = httpMock.expectOne('/api/teacher/students/12/documents/35/file');
    expect(primaryReq.request.method).toBe('GET');
    primaryReq.flush(new Blob(['Not found']), { status: 404, statusText: 'Not Found' });

    const fallbackReq = httpMock.expectOne('/api/teacher/students/12/profile/documents/35/file');
    expect(fallbackReq.request.method).toBe('GET');
    expect(fallbackReq.request.responseType).toBe('blob');
    fallbackReq.flush(new Blob(['y']));

    expect(nextSpy).toHaveBeenCalled();
  });

  it('deleteStudentDocumentForTeacher should call teacher documents endpoint', () => {
    service.deleteStudentDocumentForTeacher(12, 35).subscribe();

    const req = httpMock.expectOne('/api/teacher/students/12/documents/35');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('deleteStudentDocumentForTeacher should fallback to teacher profile documents endpoint when primary path is unsupported', () => {
    const nextSpy = vi.fn();

    service.deleteStudentDocumentForTeacher(12, 35).subscribe(nextSpy);

    const primaryReq = httpMock.expectOne('/api/teacher/students/12/documents/35');
    expect(primaryReq.request.method).toBe('DELETE');
    primaryReq.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    const fallbackReq = httpMock.expectOne('/api/teacher/students/12/profile/documents/35');
    expect(fallbackReq.request.method).toBe('DELETE');
    fallbackReq.flush({});

    expect(nextSpy).toHaveBeenCalled();
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
