import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { finalize } from 'rxjs/operators';

export type UserRole = 'STUDENT' | 'TEACHER' | string;

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = '/api/auth';
  private readonly sessionKey = 'sm_session';

  constructor(private http: HttpClient) {}

  login(req: LoginRequest): Observable<LoginResponse> {

    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, req).pipe(
      tap({
        next: (resp) => {
          this.saveSession(resp);
        },
        error: (err) => {
        },
      }),
      finalize(() => {
      })
    );
  }

  register(req: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/register`, req);
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

  mustChangePassword(): boolean {
    return !!this.getSession()?.mustChangePassword;
  }
}
