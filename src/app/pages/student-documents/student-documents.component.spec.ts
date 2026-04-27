import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { StudentProfileService } from '../../services/student-profile.service';
import { StudentDocumentsComponent } from './student-documents.component';

describe('StudentDocumentsComponent', () => {
  let component: StudentDocumentsComponent;
  let route: Pick<ActivatedRoute, 'snapshot'>;
  let router: Pick<Router, 'navigate'>;
  let profileApi: Pick<
    StudentProfileService,
    | 'listMyDocuments'
    | 'listStudentDocumentsForTeacher'
    | 'uploadMyDocument'
    | 'uploadStudentDocumentForTeacher'
    | 'viewMyDocumentFile'
    | 'viewStudentDocumentFileForTeacher'
    | 'deleteMyDocument'
    | 'deleteStudentDocumentForTeacher'
  >;

  const historyRows = [
    {
      id: 101,
      documentCategory: 'Academic Record',
      academicRecordType: 'transcript',
      reportYear: 2025,
      reportMonth: 'fall',
      title: 'Grade 11 Transcript',
      notes: 'Uploaded for review',
      fileName: 'grade-11-transcript.pdf',
      sizeBytes: 1024,
      uploadedAt: '2026-04-23T12:00:00Z',
      uploadedByRole: 'TEACHER',
      uploadedByName: 'History Teacher',
    },
  ];

  beforeEach(() => {
    localStorage.clear();

    route = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockReturnValue(null),
        },
        paramMap: {
          get: vi.fn().mockReturnValue(null),
        },
      } as any,
    };

    router = {
      navigate: vi.fn(),
    };

    profileApi = {
      listMyDocuments: vi.fn().mockReturnValue(of(historyRows)),
      listStudentDocumentsForTeacher: vi.fn().mockReturnValue(of(historyRows)),
      uploadMyDocument: vi.fn().mockReturnValue(of(historyRows[0])),
      uploadStudentDocumentForTeacher: vi.fn().mockReturnValue(of(historyRows[0])),
      viewMyDocumentFile: vi.fn().mockReturnValue(
        of(
          new HttpResponse<Blob>({
            body: new Blob(['x']),
            headers: new HttpHeaders({
              'content-disposition': 'attachment; filename="grade-11-transcript.pdf"',
            }),
            status: 200,
          })
        )
      ),
      viewStudentDocumentFileForTeacher: vi.fn().mockReturnValue(
        of(
          new HttpResponse<Blob>({
            body: new Blob(['x']),
            headers: new HttpHeaders({
              'content-disposition': 'attachment; filename="grade-11-transcript.pdf"',
            }),
            status: 200,
          })
        )
      ),
      deleteMyDocument: vi.fn().mockReturnValue(of(void 0)),
      deleteStudentDocumentForTeacher: vi.fn().mockReturnValue(of(void 0)),
    };

    component = new StudentDocumentsComponent(
      route as ActivatedRoute,
      router as Router,
      profileApi as StudentProfileService
    );
    component.ngOnInit();
  });

  it('should load history on init', () => {
    expect(profileApi.listMyDocuments).toHaveBeenCalledTimes(1);
    expect(component.documents.length).toBe(1);
    expect(component.displayTitle(component.documents[0])).toBe('Grade 11 Transcript');
    expect(component.displayAcademicRecordTerm(component.documents[0])).toBe('学期：2025 fall');
    expect(component.displayDocumentType(component.documents[0])).toBe('Academic Record · transcript');
    expect(component.displayUploadedBy(component.documents[0])).toBe('上传人：History Teacher（老师）');
  });

  it('displayAcademicRecordTerm should show selected term when backend stores a month name', () => {
    expect(
      component.displayAcademicRecordTerm({
        documentCategory: 'Academic Record',
        reportYear: 2000,
        reportMonth: 'June',
      })
    ).toBe('学期：2000 summer');
  });

  it('should fill academic metadata from local upload override when list payload is missing it', () => {
    component.targetStudentId = 1;
    localStorage.setItem(
      'sm_student_document_academic_metadata_overrides',
      JSON.stringify({
        '1:202': {
          reportYear: 2000,
          reportMonth: 'summer',
        },
      })
    );

    const rows = (component as any).normalizeDocumentList([
      {
        id: 202,
        documentCategory: 'Academic Record',
        academicRecordType: 'transcript',
        title: 'Unit 2 Workbook',
      },
    ]);

    expect(component.displayAcademicRecordTerm(rows[0])).toBe('学期：2000 summer');
  });

  it('displayUploadedBy should fall back to current student session when old list payload has no uploader fields', () => {
    localStorage.setItem(
      'sm_session',
      JSON.stringify({
        userId: 3222,
        role: 'STUDENT',
        studentId: 57,
        teacherId: null,
      })
    );

    expect(
      component.displayUploadedBy({
        id: 202,
        title: 'Trig Formulas',
        fileName: 'Trig Formulas.pdf',
      })
    ).toBe('上传人：本人（学生）');
  });

  it('goBack should navigate to dashboard', () => {
    component.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('submitUpload should call upload api with selected type for academic record', () => {
    const file = new File(['content'], 'grade-12-transcript.pdf', { type: 'application/pdf' });
    component.onDocumentCategoryChange('Academic Record');
    component.form.academicRecordType = 'report card';
    component.form.academicRecordYear = '25';
    component.form.academicRecordTerm = 'winter';
    component.form.title = 'Grade 12 Transcript';
    component.form.file = file;

    component.submitUpload();

    expect(profileApi.uploadMyDocument).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        documentCategory: 'Academic Record',
        academicRecordType: 'report card',
        reportYear: 2025,
        reportMonth: 'winter',
        title: 'Grade 12 Transcript',
      })
    );
  });

  it('submitUpload should not include identity document type for Other category', () => {
    const file = new File(['content'], 'misc-doc.pdf', { type: 'application/pdf' });
    component.onDocumentCategoryChange('Other');
    component.form.title = 'Other Document';
    component.form.file = file;

    component.submitUpload();

    const call = (profileApi.uploadMyDocument as any).mock.calls[0];
    const options = call[1];
    expect(options.documentCategory).toBe('Other');
    expect(options.identityDocumentType).toBeUndefined();
    expect(options.academicRecordType).toBeUndefined();
    expect(options.reportYear).toBeUndefined();
    expect(options.reportMonth).toBeUndefined();
  });

  it('submitUpload should require academic term year for academic record', () => {
    const file = new File(['content'], 'report-card.pdf', { type: 'application/pdf' });
    component.onDocumentCategoryChange('Academic Record');
    component.form.academicRecordType = 'report card';
    component.form.academicRecordYear = '';
    component.form.academicRecordTerm = 'fall';
    component.form.title = 'Grade 10 Report Card';
    component.form.file = file;

    component.submitUpload();

    expect(profileApi.uploadMyDocument).not.toHaveBeenCalled();
    expect(component.uploadError).toContain('学期年份');
  });

  it('submitUpload should require title', () => {
    const file = new File(['content'], 'passport.pdf', { type: 'application/pdf' });
    component.form.file = file;
    component.form.title = '';

    component.submitUpload();

    expect(profileApi.uploadMyDocument).not.toHaveBeenCalled();
    expect(component.uploadError).toContain('标题');
  });

  it('viewDocument should request file download', () => {
    const downloadSpy = vi.spyOn(component as any, 'triggerBlobDownload');
    component.viewDocument(component.documents[0]);

    expect(profileApi.viewMyDocumentFile).toHaveBeenCalledWith(101);
    expect(downloadSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteDocument should delete row when confirmed', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteDocument(component.documents[0]);

    expect(profileApi.deleteMyDocument).toHaveBeenCalledWith(101);
    expect(component.documents).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('should load teacher-target history when studentId is provided in query', () => {
    const teacherRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockImplementation((key: string) => (key === 'studentId' ? '57' : null)),
        },
        paramMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    } as unknown as ActivatedRoute;
    const teacherComponent = new StudentDocumentsComponent(
      teacherRoute,
      router as Router,
      profileApi as StudentProfileService
    );

    teacherComponent.ngOnInit();

    expect(profileApi.listStudentDocumentsForTeacher).toHaveBeenCalledWith(57);
  });

  it('goBack should navigate to teacher students when viewing a specific student', () => {
    const teacherRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockImplementation((key: string) => (key === 'studentId' ? '57' : null)),
        },
        paramMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    } as unknown as ActivatedRoute;
    const teacherComponent = new StudentDocumentsComponent(
      teacherRoute,
      router as Router,
      profileApi as StudentProfileService
    );

    teacherComponent.ngOnInit();
    teacherComponent.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/teacher/students']);
  });

  it('submitUpload should call teacher upload api when viewing a specific student', () => {
    const teacherRoute = {
      snapshot: {
        queryParamMap: {
          get: vi.fn().mockImplementation((key: string) => (key === 'studentId' ? '57' : null)),
        },
        paramMap: {
          get: vi.fn().mockReturnValue(null),
        },
      },
    } as unknown as ActivatedRoute;
    const teacherComponent = new StudentDocumentsComponent(
      teacherRoute,
      router as Router,
      profileApi as StudentProfileService
    );
    const file = new File(['content'], 'grade-12-transcript.pdf', { type: 'application/pdf' });

    teacherComponent.ngOnInit();
    teacherComponent.onDocumentCategoryChange('Academic Record');
    teacherComponent.form.academicRecordType = 'report card';
    teacherComponent.form.academicRecordYear = '25';
    teacherComponent.form.academicRecordTerm = 'winter';
    teacherComponent.form.title = 'Grade 12 Transcript';
    teacherComponent.form.file = file;

    teacherComponent.submitUpload();

    expect(profileApi.uploadStudentDocumentForTeacher).toHaveBeenCalledWith(
      57,
      file,
      expect.objectContaining({
        documentCategory: 'Academic Record',
        academicRecordType: 'report card',
        reportYear: 2025,
        reportMonth: 'winter',
        title: 'Grade 12 Transcript',
      })
    );
  });
});
