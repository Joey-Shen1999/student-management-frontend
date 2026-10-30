import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegistrationHandoffService } from './registration-handoff.service';
import { Login } from '../pages/login/login';
import { RegisterComponent } from '../pages/register/register.component';

// Synthetic credentials only; no server requests or persistent storage.
describe('Registration onboarding handoff', () => {
  let handoff: RegistrationHandoffService;
  beforeEach(() => { vi.useFakeTimers(); handoff = new RegistrationHandoffService(); });
  afterEach(() => { handoff.clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('expires at the original 60-second deadline and keeps only the username', () => {
    handoff.start('new-student', 'Example1!');
    vi.advanceTimersByTime(59999);
    expect(handoff.peek()?.password).toBe('Example1!');
    vi.advanceTimersByTime(1);
    expect(handoff.take()).toMatchObject({ username: 'new-student', password: '' });
    expect(handoff.take()).toBeNull();
    expect(new RegistrationHandoffService().peek()).toBeNull();
  });

  it('prefills login once, disables password persistence, and clears it at the original deadline', () => {
    handoff.start('new-student', 'Example1!');
    vi.advanceTimersByTime(20000);
    const login = new Login({} as any, {} as any, { markForCheck: vi.fn() } as any, handoff);
    login.ngOnInit();
    expect(login.username).toBe('new-student');
    expect(login.password).toBe('Example1!');
    expect(login.rememberPassword).toBe(false);
    expect(handoff.take()).toBeNull();
    vi.advanceTimersByTime(40000);
    expect(login.password).toBe('');
    expect(login.username).toBe('new-student');
    login.ngOnDestroy();
  });

  it('does not erase a password that the student manually replaces', () => {
    handoff.start('new-student', 'Example1!');
    const login = new Login({} as any, {} as any, { markForCheck: vi.fn() } as any, handoff);
    login.ngOnInit();
    login.password = 'ManuallyEntered2!';
    vi.advanceTimersByTime(60000);
    expect(login.password).toBe('ManuallyEntered2!');
    login.ngOnDestroy();
    expect(login.password).toBe('');
  });

  function register(fails = false) {
    const auth = { register: vi.fn().mockReturnValue(fails ? throwError(() => new Error('offline')) : of({})),
      getStudentInvitePreview: () => of({ valid: true }) };
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    const component = new RegisterComponent(auth as any, router as any,
      { snapshot: { queryParamMap: convertToParamMap({ inviteToken: 'synthetic-invite' }) } } as any,
      handoff, { markForCheck: vi.fn() } as any);
    component.ngOnInit();
    Object.assign(component, { username: 'new-student', password: 'Example1!', confirmPassword: 'Example1!',
      firstName: 'Example', lastName: 'Student' });
    component.submit();
    return { component, router, auth };
  }

  it('copies credentials on explicit request and passes them to login without router state or URL params', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { component, router, auth } = register();
    expect(component.registered).toBe(true);
    expect(component.revealPassword).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
    await component.copyCredentials('all');
    expect(writeText).toHaveBeenCalledWith('Username: new-student\nPassword: Example1!');
    expect(component.copyStatus).toEqual(component.ui.copied);
    component.submit();
    expect(auth.register).toHaveBeenCalledTimes(1);
    await component.goToLogin();
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    component.ngOnDestroy();
    expect(handoff.take()?.password).toBe('Example1!');
  });

  it('handles unavailable clipboard, stops password copying after expiry, and clears on page hide', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const { component } = register();
    await component.copyCredentials('all');
    expect(component.copyStatus).toEqual(component.ui.copyFailed);
    vi.advanceTimersByTime(60000);
    expect(component.savedPassword).toBe('');
    expect(component.remainingSeconds).toBe(0);
    component.clearOnPageHide();
    expect(handoff.peek()).toBeNull();
    component.ngOnDestroy();
  });

  it('supports copying on HTTP deployments without leaving a password field in the DOM', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const original = document.execCommand;
    const copy = vi.fn().mockImplementation(() => {
      expect((document.activeElement as HTMLTextAreaElement).value).toBe('Example1!');
      return true;
    });
    document.execCommand = copy;
    const { component } = register();
    try {
      await component.copyCredentials('password');
      expect(copy).toHaveBeenCalledWith('copy');
      expect(component.copyStatus).toEqual(component.ui.copied);
      expect(document.querySelector('textarea')).toBeNull();
    } finally { document.execCommand = original; component.ngOnDestroy(); }
  });

  it('does not offer success credentials when registration fails', () => {
    const { component } = register(true);
    expect(component.registered).toBe(false);
    expect(handoff.peek()).toBeNull();
    component.ngOnDestroy();
  });
});
