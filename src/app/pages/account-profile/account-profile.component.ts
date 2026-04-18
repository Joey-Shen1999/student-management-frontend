import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { StudentProfilePayload, StudentProfileService } from '../../services/student-profile.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocalizedText, uiText } from '../../shared/i18n/ui-translations';

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  template: `
    <div class="account-profile-page">
      <div class="account-profile-card">
        <h2>{{ ui.title | appTranslate }}</h2>

        <div class="state-row">
          <div *ngIf="loadingProfile" class="state-text">
            {{ ui.loadingCurrentName | appTranslate }}
          </div>
          <button
            type="button"
            class="link-btn"
            (click)="reloadProfile()"
            [disabled]="loadingProfile || saving"
          >
            {{ (loadingProfile ? ui.loading : ui.reloadCurrentName) | appTranslate }}
          </button>
        </div>

        <section class="current-name-card">
          <div class="field-label">{{ ui.currentName | appTranslate }}</div>
          <div class="current-name-value">
            {{ currentDisplayName || '-' }}
          </div>
          <div class="field-note" *ngIf="currentLegalName">
            {{ ui.legalName | appTranslate }}: {{ currentLegalName }}
          </div>
        </section>

        <label class="field-label" for="newFirstName">{{ ui.newFirstName | appTranslate }}</label>
        <input
          id="newFirstName"
          name="newFirstName"
          class="name-input"
          [(ngModel)]="newFirstName"
          [disabled]="saving"
          [placeholder]="currentFirstName || currentDisplayName || (ui.enterFirstName | appTranslate)"
        />

        <label class="field-label" for="newLastName" style="margin-top: 10px;">
          {{ ui.newLastName | appTranslate }}
        </label>
        <input
          id="newLastName"
          name="newLastName"
          class="name-input"
          [(ngModel)]="newLastName"
          [disabled]="saving"
          [placeholder]="currentLastName || (ui.enterLastName | appTranslate)"
        />

        <div class="actions">
          <button type="button" class="save-btn" (click)="submit()" [disabled]="saving">
            {{ (saving ? ui.saving : ui.updateName) | appTranslate }}
          </button>
          <a [routerLink]="['/dashboard']">{{ ui.back | appTranslate }}</a>
        </div>

        <p *ngIf="successMsg" class="success-text">{{ successMsg | appTranslate }}</p>
        <p *ngIf="error" class="error-text">{{ error | appTranslate }}</p>
      </div>
    </div>
  `,
  styleUrl: './account-profile.component.scss',
})
export class AccountProfileComponent implements OnInit {
  readonly ui = {
    title: uiText('\u59d3\u540d\u8bbe\u7f6e', 'Name Settings'),
    loadingCurrentName: uiText(
      '\u6b63\u5728\u52a0\u8f7d\u5f53\u524d\u59d3\u540d...',
      'Loading current name...'
    ),
    loading: uiText('\u52a0\u8f7d\u4e2d...', 'Loading...'),
    reloadCurrentName: uiText(
      '\u91cd\u65b0\u52a0\u8f7d\u5f53\u524d\u59d3\u540d',
      'Reload Current Name'
    ),
    currentName: uiText('\u5f53\u524d\u59d3\u540d', 'Current Name'),
    legalName: uiText('\u6cd5\u5b9a\u59d3\u540d', 'Legal Name'),
    newFirstName: uiText('\u65b0\u540d\u5b57', 'New First Name'),
    newLastName: uiText('\u65b0\u59d3\u6c0f', 'New Last Name'),
    enterFirstName: uiText('\u8bf7\u8f93\u5165\u540d\u5b57', 'Enter your first name'),
    enterLastName: uiText('\u8bf7\u8f93\u5165\u59d3\u6c0f', 'Enter your last name'),
    saving: uiText('\u4fdd\u5b58\u4e2d...', 'Saving...'),
    updateName: uiText('\u66f4\u65b0\u59d3\u540d', 'Update Name'),
    back: uiText('\u8fd4\u56de', 'Back'),
    sessionExpired: uiText(
      '\u767b\u5f55\u4f1a\u8bdd\u5df2\u8fc7\u671f\uff0c\u8bf7\u91cd\u65b0\u767b\u5f55\u3002',
      'Login session expired. Please sign in again.'
    ),
    nameRequired: uiText(
      '\u8bf7\u8f93\u5165\u65b0\u7684\u540d\u5b57\u6216\u59d3\u6c0f\u3002',
      'Please enter a new first name or last name.'
    ),
    firstNameNumbersOnly: uiText(
      '\u540d\u5b57\u4e0d\u80fd\u53ea\u5305\u542b\u6570\u5b57\u3002',
      'First name cannot be numbers only.'
    ),
    lastNameNumbersOnly: uiText(
      '\u59d3\u6c0f\u4e0d\u80fd\u53ea\u5305\u542b\u6570\u5b57\u3002',
      'Last name cannot be numbers only.'
    ),
    sameName: uiText(
      '\u65b0\u59d3\u540d\u4e0e\u5f53\u524d\u59d3\u540d\u76f8\u540c\u3002',
      'New name is the same as current name.'
    ),
    loadCurrentNameFailed: uiText(
      '\u52a0\u8f7d\u5f53\u524d\u59d3\u540d\u5931\u8d25\u3002',
      'Failed to load current name.'
    ),
    nameUpdated: uiText('\u59d3\u540d\u5df2\u66f4\u65b0\u3002', 'Name updated.'),
    nameUpdateFailed: uiText('\u59d3\u540d\u66f4\u65b0\u5931\u8d25\u3002', 'Name update failed.'),
    loadTimedOut: uiText(
      '\u5f53\u524d\u59d3\u540d\u52a0\u8f7d\u8d85\u65f6\uff0c\u8bf7\u70b9\u51fb\u201c\u91cd\u65b0\u52a0\u8f7d\u5f53\u524d\u59d3\u540d\u201d\u91cd\u8bd5\u3002',
      'Loading current name timed out. You can tap "Reload Current Name" to retry.'
    ),
    duplicateSchools: uiText(
      '\u59d3\u540d\u66f4\u65b0\u88ab\u6863\u6848\u4e2d\u91cd\u590d\u5b66\u6821\u8bb0\u5f55\u963b\u6b62\u3002\u8bf7\u8054\u7cfb\u8001\u5e08\u6216\u652f\u6301\u4eba\u5458\u4fee\u590d\u91cd\u590d\u5b66\u6821\u540e\u91cd\u8bd5\u3002',
      'Name update is blocked by duplicate school records in your profile. Please contact support/teacher to fix duplicate schools, then retry.'
    ),
    serverSaveFailed: uiText(
      '\u670d\u52a1\u5668\u4fdd\u5b58\u6863\u6848\u5931\u8d25\u3002\u8fd9\u53ef\u80fd\u662f\u91cd\u590d\u5b66\u6821\u8bb0\u5f55\u5bfc\u81f4\u7684\uff0c\u8bf7\u8054\u7cfb\u8001\u5e08\u6216\u652f\u6301\u4eba\u5458\u4fee\u590d\u540e\u91cd\u8bd5\u3002',
      'Profile save failed on server. This is likely caused by duplicate school records. Please contact support/teacher to fix duplicate schools, then retry.'
    ),
  };

  currentFirstName = '';
  currentLastName = '';
  currentPreferredName = '';
  newFirstName = '';
  newLastName = '';

  loadingProfile = false;
  saving = false;
  error: string | LocalizedText = '';
  successMsg: string | LocalizedText = '';

  private profileSnapshot: StudentProfilePayload = {};
  private readonly loadProfileTimeoutMs = 5000;

  constructor(
    private auth: AuthService,
    private profileApi: StudentProfileService,
    private cdr: ChangeDetectorRef = { detectChanges: () => {} } as ChangeDetectorRef
  ) {}

  get currentDisplayName(): string {
    const legalName = this.currentLegalName;
    if (legalName) return legalName;
    return this.toText(this.currentPreferredName);
  }

  get currentLegalName(): string {
    return this.buildLastFirstName(this.currentLastName, this.currentFirstName);
  }

  ngOnInit(): void {
    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = this.ui.sessionExpired;
      this.cdr.detectChanges();
      return;
    }

    this.seedNamesFromNavigationState();
    this.seedNamesFromSession();
    const hasFullLegalName =
      !!this.toText(this.currentFirstName) && !!this.toText(this.currentLastName);
    if (hasFullLegalName) {
      this.profileSnapshot = this.buildNameSnapshot();
      this.cdr.detectChanges();
      return;
    }

    this.loadProfile();
  }

  reloadProfile(): void {
    if (this.loadingProfile) return;
    this.loadProfile();
  }

  submit(): void {
    this.error = '';
    this.successMsg = '';

    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = this.ui.sessionExpired;
      this.cdr.detectChanges();
      return;
    }

    if (this.saving) return;

    const nextFirstNameInput = this.toText(this.newFirstName);
    const nextLastNameInput = this.toText(this.newLastName);
    const currentFirstName = this.toText(this.currentFirstName);
    const currentLastName = this.toText(this.currentLastName);

    if (!nextFirstNameInput && !nextLastNameInput) {
      this.error = this.ui.nameRequired;
      this.cdr.detectChanges();
      return;
    }

    if (nextFirstNameInput && !this.hasReadableNameText(nextFirstNameInput)) {
      this.error = this.ui.firstNameNumbersOnly;
      this.cdr.detectChanges();
      return;
    }

    if (nextLastNameInput && !this.hasReadableNameText(nextLastNameInput)) {
      this.error = this.ui.lastNameNumbersOnly;
      this.cdr.detectChanges();
      return;
    }

    const nextFirstName = nextFirstNameInput || currentFirstName;
    const nextLastName = nextLastNameInput || currentLastName;

    if (nextFirstName === currentFirstName && nextLastName === currentLastName) {
      this.error = this.ui.sameName;
      this.cdr.detectChanges();
      return;
    }

    this.saving = true;
    this.cdr.detectChanges();
    this.saveProfile({
      legalFirstName: nextFirstName,
      legalLastName: nextLastName,
    });
  }

  private loadProfile(): void {
    this.loadingProfile = true;
    this.error = '';
    this.successMsg = '';
    this.cdr.detectChanges();

    this.profileApi
      .getMyProfile()
      .pipe(
        timeout(this.loadProfileTimeoutMs),
        finalize(() => {
          this.loadingProfile = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          this.profileSnapshot = this.normalizeProfilePayload(resp);
          this.applyNamesFromProfile(this.profileSnapshot);
          if (!this.currentPreferredName && !this.currentLegalName) {
            this.seedNamesFromSession();
          }
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          this.error = this.extractErrorMessage(err) || this.ui.loadCurrentNameFailed;
          this.cdr.detectChanges();
        },
      });
  }

  private applyNamesFromProfile(profile: StudentProfilePayload): void {
    const nameParts = this.resolveNameFromPayload(profile);
    if (nameParts.firstName) this.currentFirstName = nameParts.firstName;
    if (nameParts.lastName) this.currentLastName = nameParts.lastName;
    if (nameParts.directName) this.currentPreferredName = nameParts.directName;
  }

  private saveProfile(payload: StudentProfilePayload): void {
    this.profileApi
      .saveMyProfile(payload)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (resp) => {
          const profile = this.normalizeProfilePayload(resp);
          this.profileSnapshot = { ...payload, ...profile };
          this.applyNamesFromProfile(this.profileSnapshot);
          this.newFirstName = '';
          this.newLastName = '';

          this.successMsg = this.extractSuccessMessage(resp) || this.ui.nameUpdated;
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || this.ui.nameUpdateFailed;
          this.cdr.detectChanges();
        },
      });
  }

  private seedNamesFromSession(): void {
    const nameParts = this.resolveNameFromPayload(this.auth.getSession());
    if (!this.currentFirstName && nameParts.firstName) this.currentFirstName = nameParts.firstName;
    if (!this.currentLastName && nameParts.lastName) this.currentLastName = nameParts.lastName;
    if (!this.currentPreferredName && nameParts.directName) {
      this.currentPreferredName = nameParts.directName;
    }
  }

  private seedNamesFromNavigationState(): void {
    const state = this.toRecord(globalThis?.history?.state) || {};

    const fromStateLastName = this.toText(state['currentLastName']);
    const fromStateFirstName = this.toText(state['currentFirstName']);
    if (!this.currentLastName && fromStateLastName) this.currentLastName = fromStateLastName;
    if (!this.currentFirstName && fromStateFirstName) this.currentFirstName = fromStateFirstName;
    if (this.currentFirstName && this.currentLastName) {
      return;
    }

    const fromState = this.toText(state['currentDisplayName']);
    if (!fromState) return;
    if (fromState.toLowerCase() === 'student') return;

    const nameTokens = fromState.split(/\s+/).filter(Boolean);
    if (nameTokens.length >= 2) {
      if (!this.currentLastName) this.currentLastName = nameTokens[0];
      if (!this.currentFirstName) this.currentFirstName = nameTokens.slice(1).join(' ');
      return;
    }

    if (!this.currentPreferredName) {
      this.currentPreferredName = fromState;
    }
  }

  private buildNameSnapshot(): StudentProfilePayload {
    const snapshot: StudentProfilePayload = {};
    const legalFirstName = this.toText(this.currentFirstName);
    const legalLastName = this.toText(this.currentLastName);
    const preferredName = this.toText(this.currentPreferredName);

    if (legalFirstName) snapshot.legalFirstName = legalFirstName;
    if (legalLastName) snapshot.legalLastName = legalLastName;
    if (preferredName) snapshot.preferredName = preferredName;

    return snapshot;
  }

  private hasReadableNameText(value: string): boolean {
    return /[A-Za-z\u4e00-\u9fff]/.test(this.toText(value));
  }

  private normalizeProfilePayload(payload: unknown): StudentProfilePayload {
    if (!payload || typeof payload !== 'object') return {};

    const root = payload as Record<string, unknown>;
    const profileNode = root['profile'];
    if (profileNode && typeof profileNode === 'object') {
      return { ...(profileNode as StudentProfilePayload) };
    }

    return { ...(root as StudentProfilePayload) };
  }

  private extractSuccessMessage(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';

    const root = payload as Record<string, unknown>;
    const rootMessage = this.toText(root['message']);
    if (rootMessage) return rootMessage;

    const profileNode = root['profile'];
    if (!profileNode || typeof profileNode !== 'object') return '';

    return this.toText((profileNode as Record<string, unknown>)['message']);
  }

  private extractErrorMessage(err: unknown): string {
    if (err && typeof err === 'object') {
      const timeoutName = String((err as { name?: unknown }).name || '')
        .trim()
        .toLowerCase();
      if (timeoutName === 'timeouterror') {
        return this.ui.loadTimedOut.en;
      }
    }

    if (!(err instanceof HttpErrorResponse)) {
      return this.toText((err as { message?: unknown } | null | undefined)?.message);
    }

    const payload = err?.error;
    const normalizedErrorText = this.collectErrorText(err);
    if (this.isDuplicateSchoolConflictError(normalizedErrorText)) {
      return this.ui.duplicateSchools.en;
    }
    if (
      err.status >= 500 &&
      this.toText(err.url).includes('/api/student/profile') &&
      normalizedErrorText.includes('server error')
    ) {
      return this.ui.serverSaveFailed.en;
    }

    if (payload && typeof payload === 'object') {
      const details = this.extractValidationDetails(payload as Record<string, unknown>);
      const message = this.toText((payload as any).message || (payload as any).error);
      if (!message) return details;
      if (!details || message.includes(details)) return message;
      return `${message} ${details}`;
    }

    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        const details = this.extractValidationDetails(parsed as Record<string, unknown>);
        const message = this.toText(parsed?.message || parsed?.error || payload);
        if (!message) return details;
        if (!details || message.includes(details)) return message;
        return `${message} ${details}`;
      } catch {
        return payload;
      }
    }

    return this.toText(err.message);
  }

  private collectErrorText(err: HttpErrorResponse): string {
    const parts: string[] = [
      this.toText(err.message),
      this.toText(err.statusText),
      this.toText(err.url),
    ];

    const payload = err.error;
    if (typeof payload === 'string') {
      parts.push(this.toText(payload));
    } else if (payload && typeof payload === 'object') {
      const node = payload as Record<string, unknown>;
      parts.push(this.toText(node['message']));
      parts.push(this.toText(node['error']));
      parts.push(this.toText(node['details']));
      try {
        parts.push(JSON.stringify(payload));
      } catch {
        // ignore non-serializable payload
      }
    }

    return parts
      .map((item) => this.toText(item).toLowerCase())
      .filter(Boolean)
      .join(' | ');
  }

  private isDuplicateSchoolConflictError(normalizedText: string): boolean {
    if (!normalizedText) return false;

    return (
      normalizedText.includes('uk_student_school_record_unique_school_per_student') ||
      normalizedText.includes('duplicate key value violates unique constraint') ||
      normalizedText.includes('duplicate schools detected in profile payload') ||
      normalizedText.includes('sqlstate: 23505') ||
      (normalizedText.includes('student_school_record') && normalizedText.includes('duplicate'))
    );
  }

  private extractValidationDetails(payload: Record<string, unknown>): string {
    const details = payload['details'];
    if (!Array.isArray(details) || details.length <= 0) return '';

    const normalized: string[] = [];
    for (const item of details) {
      if (item === null || item === undefined) continue;

      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        const text = String(item).trim();
        if (text) normalized.push(text);
        continue;
      }

      if (typeof item === 'object') {
        const node = item as Record<string, unknown>;
        const field = this.toText(node['field'] || node['path']);
        const message = this.toText(node['message'] || node['error']);
        if (field && message) {
          normalized.push(`${field} ${message}`);
          continue;
        }
        if (message) {
          normalized.push(message);
        }
      }
    }

    return normalized.join('; ');
  }

  private toText(value: unknown): string {
    return String(value ?? '').trim();
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  }

  private resolveNameFromPayload(payload: unknown): {
    directName: string;
    firstName: string;
    lastName: string;
  } {
    const source = this.toRecord(payload);
    if (!source) return { directName: '', firstName: '', lastName: '' };

    const queue: Record<string, unknown>[] = [];
    const visited = new Set<Record<string, unknown>>();
    const maxNodeCount = 30;
    const enqueue = (value: unknown): void => {
      const node = this.toRecord(value);
      if (!node || visited.has(node) || queue.length >= maxNodeCount) return;
      visited.add(node);
      queue.push(node);
    };

    enqueue(source);

    const nestedKeys = [
      'profile',
      'student',
      'user',
      'data',
      'result',
      'payload',
      'account',
      'currentUser',
      'current_user',
      'loginUser',
      'login_user',
      'userInfo',
      'user_info',
      'me',
    ];

    while (queue.length > 0) {
      const node = queue.shift() as Record<string, unknown>;

      const directName = this.pickFirstText(node, [
        'preferredName',
        'preferred_name',
        'nickName',
        'nickname',
        'displayName',
        'display_name',
        'fullName',
        'full_name',
        'name',
      ]);
      const lastName = this.pickFirstText(node, [
        'legalLastName',
        'lastName',
        'surname',
        'familyName',
        'legal_last_name',
        'last_name',
        'family_name',
      ]);
      const firstName = this.pickFirstText(node, [
        'legalFirstName',
        'firstName',
        'givenName',
        'legal_first_name',
        'first_name',
        'given_name',
      ]);

      if (directName || lastName || firstName) {
        return { directName, firstName, lastName };
      }

      for (const key of nestedKeys) {
        enqueue(node[key]);
      }
    }

    return { directName: '', firstName: '', lastName: '' };
  }

  private pickFirstText(node: Record<string, unknown>, keys: string[]): string {
    const targets = new Set(keys.map((key) => key.toLowerCase()));
    for (const [key, value] of Object.entries(node)) {
      if (!targets.has(String(key).toLowerCase())) continue;

      const text = this.toText(value);
      if (text) return text;
    }
    return '';
  }

  private buildLastFirstName(lastName: unknown, firstName: unknown): string {
    return [this.toText(lastName), this.toText(firstName)].filter(Boolean).join(' ').trim();
  }
}
