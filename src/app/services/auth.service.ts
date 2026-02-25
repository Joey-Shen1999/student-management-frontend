import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, tap, catchError, throwError } from 'rxjs';

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | string;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  role: UserRole;
  inviteToken?: string;

  // student fields (optional)
  firstName?: string;
  lastName?: string;
  preferredName?: string;

  // teacher fields (optional)
  displayName?: string;
}

/**
 * 后端当前 login 返回: { userId, role, studentId, teacherId, mustChangePassword? }
 * 不保证返回 username，所以这里不要强制依赖 username 字段。
 */
export interface LoginResponse {
  userId: number;
  role: UserRole;
  username?: string;
  studentId: number | null;
  teacherId: number | null;
  accessToken: string;
  tokenType: string;
  tokenExpiresAt: string;

  mustChangePassword?: boolean;

  [key: string]: any;
}

export interface RegisterResponse {
  userId: number;
  role: UserRole;
  studentId: number | null;
  teacherId: number | null;
  [key: string]: any;
}

export interface StudentInvitePreviewResponse {
  inviteId?: number;
  inviteToken?: string;
  status?: string;
  valid?: boolean;
  expiresAt?: string;
  teacherId?: number | null;
  teacherName?: string;
  [key: string]: any;
}

export interface SetPasswordRequest {
  userId?: number;
  newPassword: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface ApiResponse {
  success?: boolean;
  message?: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = '/api/auth';
  private readonly sessionKey = 'sm_session';

  constructor(private http: HttpClient) {}

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, req).pipe(
      tap((resp) => this.saveSession(resp))
    );
  }

  register(req: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/register`, req);
  }

  getStudentInvitePreview(inviteToken: string): Observable<StudentInvitePreviewResponse> {
    const normalizedToken = encodeURIComponent(String(inviteToken || '').trim());
    return this.http.get<StudentInvitePreviewResponse>(
      `${this.baseUrl}/student-invites/${normalizedToken}`
    );
  }

  setPassword(req: SetPasswordRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/set-password`, req);
  }

  changePassword(req: ChangePasswordRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/change-password`, req);
  }

  logout(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/logout`, {}).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return of({
            success: true,
            message: 'Logged out.',
          } as ApiResponse);
        }
        return throwError(() => error);
      }),
      tap(() => this.clearAuthState())
    );
  }

  clearMustChangePasswordFlag(): void {
    const session = this.getSession();
    if (!session) return;

    this.saveSession({ ...session, mustChangePassword: false });
  }

  markMustChangePasswordRequired(): void {
    const session = this.getSession();
    if (!session) return;

    this.saveSession({ ...session, mustChangePassword: true });
  }

  private saveSession(session: LoginResponse) {
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
  }

  getSession(): LoginResponse | null {
    const raw = localStorage.getItem(this.sessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LoginResponse;
    } catch {
      return null;
    }
  }

  clearAuthState() {
    localStorage.removeItem(this.sessionKey);
  }

  getCurrentUserId(): number | null {
    const userId = this.getSession()?.userId;
    return typeof userId === 'number' && Number.isFinite(userId) && userId > 0 ? userId : null;
  }

  getAuthorizationHeaderValue(): string | null {
    const session = this.getSession();
    const accessToken = (session?.accessToken || '').trim();
    if (!accessToken) return null;

    const tokenType = (session?.tokenType || 'Bearer').trim() || 'Bearer';
    return `${tokenType} ${accessToken}`;
  }

  mustChangePassword(): boolean {
    return !!this.getSession()?.mustChangePassword;
  }
}
