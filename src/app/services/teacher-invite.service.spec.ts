import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TeacherInviteService } from './teacher-invite.service';

describe('TeacherInviteService', () => {
  let service: TeacherInviteService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TeacherInviteService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TeacherInviteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('createInvite should post username + optional displayName', () => {
    service.createInvite('teacher_new', 'Mr. Smith').subscribe();

    const req = httpMock.expectOne('/api/teacher/invites');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'teacher_new', displayName: 'Mr. Smith' });
    req.flush({ username: 'teacher_new', tempPassword: 'A1b2C3d!' });
  });

  it('createInvite should omit displayName when empty', () => {
    service.createInvite('teacher_new', '   ').subscribe();

    const req = httpMock.expectOne('/api/teacher/invites');
    expect(req.request.body).toEqual({ username: 'teacher_new' });
    req.flush({ username: 'teacher_new', tempPassword: 'A1b2C3d!' });
  });
});
