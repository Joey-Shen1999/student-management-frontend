import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { StudentProfileService } from '../../services/student-profile.service';
import { AccountProfileComponent } from './account-profile.component';

describe('AccountProfileComponent', () => {
  let auth: Pick<AuthService, 'getAuthorizationHeaderValue'>;
  let profileApi: Pick<StudentProfileService, 'getMyProfile' | 'saveMyProfile'>;

  function createComponent(): AccountProfileComponent {
    return new AccountProfileComponent(auth as AuthService, profileApi as StudentProfileService);
  }

  beforeEach(() => {
    auth = {
      getAuthorizationHeaderValue: vi.fn().mockReturnValue('Bearer token-1'),
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
    expect(component.firstName).toBe('Alice');
    expect(component.lastName).toBe('Wang');
    expect(component.preferredName).toBe('Ali');
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

    expect(component.firstName).toBe('Tom');
    expect(component.lastName).toBe('Zhang');
    expect(component.preferredName).toBe('Tommy');
  });

  it('submit should send merged payload and keep existing profile fields', () => {
    const component = createComponent();
    component.ngOnInit();

    component.firstName = ' NewFirst ';
    component.lastName = ' NewLast ';
    component.preferredName = ' NewNick ';
    component.submit();

    expect(profileApi.saveMyProfile).toHaveBeenCalledWith({
      legalFirstName: 'NewFirst',
      legalLastName: 'NewLast',
      preferredName: 'NewNick',
      phone: '1234567890',
    });
    expect(component.successMsg).toBe('updated');
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

    component.firstName = '';
    component.lastName = 'Wang';
    component.preferredName = '';
    component.submit();

    expect(component.error).toContain('Validation failed.');
    expect(component.error).toContain('legalFirstName is required');
  });
});
