import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { StudentProfilePayload, StudentProfileService } from '../../services/student-profile.service';

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div style="max-width:760px;margin:40px auto;font-family:Arial">
      <h2>Account Profile</h2>

      <p style="color:#666; line-height:1.6;">
        Update your legal first name, legal last name, and preferred name (nickname).
      </p>

      <div style="margin-top:14px; padding:12px; border:1px solid #ddd; border-radius:8px;">
        <div *ngIf="loadingProfile" style="color:#666;">Loading current profile...</div>

        <ng-container *ngIf="!loadingProfile">
          <label style="display:block;margin:12px 0 6px;">Legal Last Name</label>
          <input
            [(ngModel)]="lastName"
            [disabled]="saving"
            style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
          />

          <label style="display:block;margin:12px 0 6px;">Legal First Name</label>
          <input
            [(ngModel)]="firstName"
            [disabled]="saving"
            style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
          />

          <label style="display:block;margin:12px 0 6px;">Preferred Name (Nickname)</label>
          <input
            [(ngModel)]="preferredName"
            [disabled]="saving"
            style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"
          />

          <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;">
            <button type="button" (click)="submit()" [disabled]="saving" style="padding:10px 12px;">
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>

            <a [routerLink]="['/dashboard']">Back</a>
          </div>
        </ng-container>

        <p *ngIf="successMsg" style="color:#0b6b0b;margin:10px 0 0;">{{ successMsg }}</p>
        <p *ngIf="error" style="color:#b00020;margin:10px 0 0;">{{ error }}</p>
      </div>
    </div>
  `,
})
export class AccountProfileComponent implements OnInit {
  firstName = '';
  lastName = '';
  preferredName = '';

  loadingProfile = false;
  saving = false;
  error = '';
  successMsg = '';

  private profileSnapshot: StudentProfilePayload = {};

  constructor(
    private auth: AuthService,
    private profileApi: StudentProfileService
  ) {}

  ngOnInit(): void {
    const authHeader = this.auth.getAuthorizationHeaderValue();
    if (!authHeader) {
      this.error = 'Login session expired. Please sign in again.';
      return;
    }

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

    const nextFirstName = this.toText(this.firstName);
    const nextLastName = this.toText(this.lastName);
    const nextPreferredName = this.toText(this.preferredName);

    if (!nextFirstName && !nextLastName && !nextPreferredName) {
      this.error = 'Please provide at least one name field.';
      return;
    }

    const payload: StudentProfilePayload = {
      ...this.profileSnapshot,
      legalFirstName: nextFirstName,
      legalLastName: nextLastName,
      preferredName: nextPreferredName,
    };

    this.saving = true;
    this.profileApi
      .saveMyProfile(payload)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (resp) => {
          const profile = this.normalizeProfilePayload(resp);
          this.profileSnapshot = { ...payload, ...profile };
          this.applyNamesFromProfile(this.profileSnapshot);

          this.successMsg = this.extractSuccessMessage(resp) || 'Profile updated.';
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || 'Profile update failed.';
        },
      });
  }

  private loadProfile(): void {
    this.loadingProfile = true;
    this.error = '';
    this.successMsg = '';

    this.profileApi
      .getMyProfile()
      .pipe(finalize(() => (this.loadingProfile = false)))
      .subscribe({
        next: (resp) => {
          this.profileSnapshot = this.normalizeProfilePayload(resp);
          this.applyNamesFromProfile(this.profileSnapshot);
        },
        error: (err: HttpErrorResponse) => {
          this.error = this.extractErrorMessage(err) || 'Failed to load current profile.';
        },
      });
  }

  private applyNamesFromProfile(profile: StudentProfilePayload): void {
    const source = (profile || {}) as Record<string, unknown>;
    this.firstName = this.toText(source['legalFirstName'] || source['firstName']);
    this.lastName = this.toText(source['legalLastName'] || source['lastName']);
    this.preferredName = this.toText(
      source['preferredName'] || source['nickName'] || source['nickname']
    );
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

  private extractErrorMessage(err: HttpErrorResponse): string {
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

    return this.toText(err?.message);
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
}
