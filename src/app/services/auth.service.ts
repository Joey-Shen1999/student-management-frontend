import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | string;

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  role: UserRole;

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

export interface SetPasswordRequest {
  userId: number;
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

  setPassword(req: SetPasswordRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.baseUrl}/set-password`, req);
  }

  clearMustChangePasswordFlag(): void {
    const session = this.getSession();
    if (!session) return;

    this.saveSession({ ...session, mustChangePassword: false });
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

  logout() {
    localStorage.removeItem(this.sessionKey);
  }

  getCurrentUserId(): number | null {
    const userId = this.getSession()?.userId;
    return typeof userId === 'number' && Number.isFinite(userId) && userId > 0 ? userId : null;
  }

  mustChangePassword(): boolean {
    return !!this.getSession()?.mustChangePassword;
  }
}
