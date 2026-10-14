import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { App } from './app';
import { AuthService } from './services/auth.service';

describe('App', () => {
  let session: { accessToken: string; role: string } | null;
  const authMock = {
    getSession: () => session,
    logout: () => of({ success: true }),
    clearAuthState: () => {},
  };

  beforeEach(async () => {
    session = null;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: authMock }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('shows home and one-level back on every signed-in non-home page', () => {
    session = { accessToken: 'test-token', role: 'TEACHER' };
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const setRoute = (url: string) => {
      const navigation = app as unknown as {
        refreshSignOutVisibility: (route: string) => void;
        recordPageRoute: (route: string) => void;
      };
      navigation.refreshSignOutVisibility(url);
      navigation.recordPageRoute(url);
    };

    setRoute('/teacher/students');
    expect(app.showPageNavigation).toBe(true);
    setRoute('/student/documents?studentId=1');
    expect(app.showPageNavigation).toBe(true);
    setRoute('/account/profile');
    expect(app.showPageNavigation).toBe(true);

    setRoute('/teacher/dashboard');
    expect(app.showPageNavigation).toBe(false);
    setRoute('/login');
    expect(app.showPageNavigation).toBe(false);
  });

  it('returns through teacher pages one level at a time and home skips to dashboard', () => {
    session = { accessToken: 'test-token', role: 'TEACHER' };
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const record = (app as unknown as { recordPageRoute: (url: string) => void })
      .recordPageRoute.bind(app);

    record('/teacher/dashboard');
    record('/teacher/graduation');
    record('/teacher/students/7/graduation-applications');
    app.goBack();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/graduation');
    app.goBack();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/dashboard');

    record('/teacher/students/8/graduation-applications');
    app.goHome();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/dashboard');
  });

  it('uses the parent list after opening a teacher detail page directly', () => {
    session = { accessToken: 'test-token', role: 'ADMIN' };
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    (app as unknown as { recordPageRoute: (url: string) => void }).recordPageRoute(
      '/teacher/students/7/graduation-applications/setup'
    );
    app.goBack();
    expect(navigate).toHaveBeenCalledWith('/teacher/students/7/graduation-applications');
  });

  it('does not treat list filter changes as another page level', () => {
    session = { accessToken: 'test-token', role: 'TEACHER' };
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const record = (app as unknown as { recordPageRoute: (url: string) => void })
      .recordPageRoute.bind(app);

    record('/teacher/dashboard');
    record('/teacher/students');
    record('/teacher/students?context=graduation-applications');
    app.goBack();
    expect(navigate).toHaveBeenCalledWith('/teacher/dashboard');
  });

  it('keeps the teacher path when student documents use a student route', () => {
    session = { accessToken: 'test-token', role: 'TEACHER' };
    const app = TestBed.createComponent(App).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const record = (app as unknown as { recordPageRoute: (url: string) => void })
      .recordPageRoute.bind(app);

    record('/teacher/students');
    record('/student/documents?studentId=1');
    app.goBack();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/students');
    app.goHome();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/dashboard');
  });

  it('keeps moving up after a direct deep link instead of bouncing back', () => {
    session = { accessToken: 'test-token', role: 'TEACHER' };
    const app = TestBed.createComponent(App).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const record = (app as unknown as { recordPageRoute: (url: string) => void })
      .recordPageRoute.bind(app);

    record('/student/documents?studentId=1');
    app.goBack();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/students');
    record('/teacher/students');
    app.goBack();
    expect(navigate).toHaveBeenLastCalledWith('/teacher/dashboard');
  });

  it('returns a student to the student dashboard', () => {
    session = { accessToken: 'test-token', role: 'STUDENT' };
    const app = TestBed.createComponent(App).componentInstance;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    (app as unknown as { recordPageRoute: (url: string) => void }).recordPageRoute(
      '/student/documents'
    );
    app.goBack();
    expect(navigate).toHaveBeenLastCalledWith('/dashboard');
    app.goHome();
    expect(navigate).toHaveBeenLastCalledWith('/dashboard');
  });
});
