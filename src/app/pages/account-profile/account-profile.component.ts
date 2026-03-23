import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { StudentProfilePayload, StudentProfileService } from '../../services/student-profile.service';

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="account-profile-page">
      <div class="account-profile-card">
        <h2>Name Settings</h2>
        <p class="subtitle">Display your current name and update first/last name quickly.</p>

        <div class="state-row">
          <div *ngIf="loadingProfile" class="state-text">Loading current name...</div>
          <button
            type="button"
            class="link-btn"
            (click)="reloadProfile()"
            [disabled]="loadingProfile || saving"
          >
            {{ loadingProfile ? 'Loading...' : 'Reload Current Name' }}
          </button>
        </div>

        <section class="current-name-card">
          <div class="field-label">Current Name</div>
          <div class="current-name-value">
            {{ currentDisplayName || '-' }}
          </div>
          <div class="field-note" *ngIf="currentLegalName">
            Legal Name: {{ currentLegalName }}
          </div>
        </section>

        <label class="field-label" for="newFirstName">New First Name</label>
        <input
          id="newFirstName"
          name="newFirstName"
          class="name-input"
          [(ngModel)]="newFirstName"
          [disabled]="saving"
          [placeholder]="currentFirstName || currentDisplayName || 'Enter your first name'"
        />

        <label class="field-label" for="newLastName" style="margin-top: 10px;">New Last Name</label>
        <input
          id="newLastName"
          name="newLastName"
          class="name-input"
          [(ngModel)]="newLastName"
          [disabled]="saving"
          [placeholder]="currentLastName || 'Enter your last name'"
        />

        <div class="actions">
          <button type="button" class="save-btn" (click)="submit()" [disabled]="saving">
            {{ saving ? 'Saving...' : 'Update Name' }}
          </button>
          <a [routerLink]="['/dashboard']">Back</a>
        </div>

        <p *ngIf="successMsg" class="success-text">{{ successMsg }}</p>
        <p *ngIf="error" class="error-text">{{ error }}</p>
      </div>
    </div>
  `,
  styleUrl: './account-profile.component.scss',
})
export class AccountProfileComponent implements OnInit {
  currentFirstName = '';
  currentLastName = '';
  currentPreferredName = '';
  newFirstName = '';
  newLastName = '';

  loadingProfile = false;
  saving = false;
  error = '';
  successMsg = '';

  private profileSnapshot: StudentProfilePayload = {};
  private readonly loadProfileTimeoutMs = 5000;

  constructor(
    private auth: AuthService,
    private profileApi: StudentProfileService
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
      this.error = 'Login session expired. Please sign in again.';
      return;
    }

    this.seedNamesFromNavigationState();
    this.seedNamesFromSession();
    const hasFullLegalName =
      !!this.toText(this.currentFirstName) && !!this.toText(this.currentLastName);
    if (hasFullLegalName) {
      this.profileSnapshot = this.buildNameSnapshot();
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
      this.error = 'Login session expired. Please sign in again.';
      return;
    }

    if (this.saving) return;

    const nextFirstNameInput = this.toText(this.newFirstName);
    const nextLastNameInput = this.toText(this.newLastName);
    const currentFirstName = this.toText(this.currentFirstName);
    const currentLastName = this.toText(this.currentLastName);

    if (!nextFirstNameInput && !nextLastNameInput) {
      this.error = 'Please enter a new first name or last name.';
      return;
    }

    const nextFirstName = nextFirstNameInput || currentFirstName;
    const nextLastName = nextLastNameInput || currentLastName;

    if (nextFirstName === currentFirstName && nextLastName === currentLastName) {
      this.error = 'New name is the same as current name.';
      return;
    }

    const payload: StudentProfilePayload = { ...this.profileSnapshot };
    if (nextFirstName) payload.legalFirstName = nextFirstName;
    if (nextLastName) payload.legalLastName = nextLastName;

    const safePreferredName = this.toText(this.currentPreferredName);
    if (safePreferredName) payload.preferredName = safePreferredName;

    this.saving = true;
    this.profileApi
      .saveMyProfile(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (resp) => {
          const profile = this.normalizeProfilePayload(resp);
          this.profileSnapshot = { ...payload, ...profile };
          this.applyNamesFromProfile(this.profileSnapshot);
          this.newFirstName = '';
          this.newLastName = '';

          this.successMsg = this.extractSuccessMessage(resp) || 'Name updated.';
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || 'Name update failed.';
        },
      });
  }

  private loadProfile(): void {
    this.loadingProfile = true;
    this.error = '';
    this.successMsg = '';

    this.profileApi
      .getMyProfile()
      .pipe(
        timeout(this.loadProfileTimeoutMs),
        finalize(() => (this.loadingProfile = false))
      )
      .subscribe({
        next: (resp) => {
          this.profileSnapshot = this.normalizeProfilePayload(resp);
          this.applyNamesFromProfile(this.profileSnapshot);
          if (!this.currentPreferredName && !this.currentLegalName) {
            this.seedNamesFromSession();
          }
        },
        error: (err: unknown) => {
          this.error = this.extractErrorMessage(err) || 'Failed to load current name.';
        },
      });
  }

  private applyNamesFromProfile(profile: StudentProfilePayload): void {
    const nameParts = this.resolveNameFromPayload(profile);
    if (nameParts.firstName) this.currentFirstName = nameParts.firstName;
    if (nameParts.lastName) this.currentLastName = nameParts.lastName;
    if (nameParts.directName) this.currentPreferredName = nameParts.directName;
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
        return 'Loading current name timed out. You can tap "Reload Current Name" to retry.';
      }
    }

    if (!(err instanceof HttpErrorResponse)) {
      return this.toText((err as { message?: unknown } | null | undefined)?.message);
    }

    const payload = err?.error;

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
