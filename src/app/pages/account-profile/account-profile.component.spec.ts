import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { StudentProfileService } from '../../services/student-profile.service';
import { AccountProfileComponent } from './account-profile.component';

describe('AccountProfileComponent', () => {
  let auth: Pick<AuthService, 'getAuthorizationHeaderValue' | 'getSession'>;
  let profileApi: Pick<StudentProfileService, 'getMyProfile' | 'saveMyProfile'>;

  function createComponent(): AccountProfileComponent {
    return new AccountProfileComponent(auth as AuthService, profileApi as StudentProfileService);
  }

  beforeEach(() => {
    window.history.replaceState({}, document.title);

    auth = {
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-1'),
      getSession: vi.fn().mockReturnValue({
        username: 'alice.wang',
      }),
    };

    profileApi = {
      getMyProfile: vi.fn().mockReturnValue(
        of({
          profile: {
            legalFirstName: 'Alice',
            legalLastName: 'Wang',
            preferredName: 'Ali',
            phone: '1234567890',
          },
        })
      ),
      saveMyProfile: vi.fn().mockReturnValue(of({ message: 'updated' })),
    };
  });

  afterEach(() => {
    window.history.replaceState({}, document.title);
  });

  it('ngOnInit should block when token is missing', () => {
    (auth.getAuthorizationHeaderValue as any).mockReturnValue(null);
    const component = createComponent();

    component.ngOnInit();

    expect(component.error).toBe('Login session expired. Please sign in again.');
    expect(profileApi.getMyProfile).not.toHaveBeenCalled();
  });

  it('ngOnInit should load names from legal fields', () => {
    const component = createComponent();

    component.ngOnInit();

    expect(profileApi.getMyProfile).toHaveBeenCalledTimes(1);
    expect(component.currentFirstName).toBe('Alice');
    expect(component.currentLastName).toBe('Wang');
    expect(component.currentPreferredName).toBe('Ali');
    expect(component.currentDisplayName).toBe('Wang Alice');
    expect(component.currentLegalName).toBe('Wang Alice');
  });

  it('ngOnInit should load names from fallback fields', () => {
    (profileApi.getMyProfile as any).mockReturnValue(
      of({
        firstName: 'Tom',
        lastName: 'Zhang',
        nickName: 'Tommy',
      })
    );
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentFirstName).toBe('Tom');
    expect(component.currentLastName).toBe('Zhang');
    expect(component.currentPreferredName).toBe('Tommy');
    expect(component.currentDisplayName).toBe('Zhang Tom');
  });

  it('ngOnInit should continue loading profile when session has only displayName', () => {
    (auth.getSession as any).mockReturnValue({
      username: 'student_01',
      displayName: 'Session Name',
    });
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentDisplayName).toBe('Wang Alice');
    expect(profileApi.getMyProfile).toHaveBeenCalledTimes(1);
  });

  it('ngOnInit should use navigation state name and skip profile request', () => {
    window.history.replaceState({ currentDisplayName: 'Chen Xiao' }, document.title);
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentDisplayName).toBe('Chen Xiao');
    expect(profileApi.getMyProfile).not.toHaveBeenCalled();
  });

  it('ngOnInit should use navigation first/last state and skip profile request', () => {
    window.history.replaceState({ currentLastName: 'Chen', currentFirstName: 'Xiao' }, document.title);
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentLastName).toBe('Chen');
    expect(component.currentFirstName).toBe('Xiao');
    expect(component.currentDisplayName).toBe('Chen Xiao');
    expect(profileApi.getMyProfile).not.toHaveBeenCalled();
  });

  it('ngOnInit should parse snake_case session name and skip profile request', () => {
    (auth.getSession as any).mockReturnValue({
      profile: {
        last_name: 'Li',
        first_name: 'Lei',
      },
    });
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentDisplayName).toBe('Li Lei');
    expect(profileApi.getMyProfile).not.toHaveBeenCalled();
  });

  it('ngOnInit should parse deeply nested session name and skip profile request', () => {
    (auth.getSession as any).mockReturnValue({
      data: {
        profile: {
          legal_last_name: 'Chen',
          legal_first_name: 'Xiao',
        },
      },
    });
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentDisplayName).toBe('Chen Xiao');
    expect(profileApi.getMyProfile).not.toHaveBeenCalled();
  });

  it('ngOnInit should continue loading profile when session only has first name', () => {
    (auth.getSession as any).mockReturnValue({
      profile: {
        firstName: 'OnlyFirst',
      },
    });
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentFirstName).toBe('Alice');
    expect(component.currentLastName).toBe('Wang');
    expect(profileApi.getMyProfile).toHaveBeenCalledTimes(1);
  });

  it('ngOnInit should not use username as student name fallback', () => {
    (profileApi.getMyProfile as any).mockReturnValue(of({ profile: {} }));
    (auth.getSession as any).mockReturnValue({
      username: 'student_01',
    });
    const component = createComponent();

    component.ngOnInit();

    expect(component.currentDisplayName).toBe('');
  });

  it('submit should require new name', () => {
    const component = createComponent();
    component.ngOnInit();

    component.newFirstName = '   ';
    component.newLastName = ' ';
    component.submit();

    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
    expect(component.error).toBe('Please enter a new first name or last name.');
  });

  it('submit should block same name update', () => {
    const component = createComponent();
    component.ngOnInit();

    component.newFirstName = 'Alice';
    component.newLastName = 'Wang';
    component.submit();

    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
    expect(component.error).toBe('New name is the same as current name.');
  });

  it('submit should reject numeric-only names before request', () => {
    const component = createComponent();
    component.ngOnInit();

    component.newFirstName = '44';
    component.submit();

    expect(profileApi.saveMyProfile).not.toHaveBeenCalled();
    expect(component.error).toBe('First name cannot be numbers only.');
  });

  it('submit should send merged payload and keep existing profile fields', () => {
    const component = createComponent();
    component.ngOnInit();

    component.newFirstName = ' NewFirst ';
    component.newLastName = ' NewLast ';
    component.submit();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith({
      legalFirstName: 'NewFirst',
      legalLastName: 'NewLast',
    });
    expect(component.currentFirstName).toBe('NewFirst');
    expect(component.currentLastName).toBe('NewLast');
    expect(component.currentDisplayName).toBe('NewLast NewFirst');
    expect(component.newFirstName).toBe('');
    expect(component.newLastName).toBe('');
    expect(component.successMsg).toBe('updated');
  });

  it('submit should support updating only last name', () => {
    const component = createComponent();
    component.ngOnInit();

    component.newLastName = ' Zhang ';
    component.submit();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith({
      legalFirstName: 'Alice',
      legalLastName: 'Zhang',
    });
  });

  it('submit should only send name fields payload', () => {
    const component = createComponent();
    component.ngOnInit();

    component.newLastName = 'Li';
    component.submit();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith({
      legalFirstName: 'Alice',
      legalLastName: 'Li',
    });
  });

  it('submit should expose backend validation details', () => {
    (profileApi.saveMyProfile as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              message: 'Validation failed.',
              details: [{ field: 'legalFirstName', message: 'is required' }],
            },
          })
      )
    );
    const component = createComponent();
    component.ngOnInit();

    component.newFirstName = 'New';
    component.submit();

    expect(component.error).toContain('Validation failed.');
    expect(component.error).toContain('legalFirstName is required');
  });

  it('submit should show actionable message for duplicate school unique constraint', () => {
    (profileApi.saveMyProfile as any).mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              message:
                'ERROR: duplicate key value violates unique constraint "uk_student_school_record_unique_school_per_student"',
            },
          })
      )
    );
    const component = createComponent();
    component.ngOnInit();

    component.newFirstName = 'Amy';
    component.submit();

    expect(component.error).toContain('duplicate school records');
  });
});
