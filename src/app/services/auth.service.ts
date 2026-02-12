import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type UserRole = 'STUDENT' | 'TEACHER';

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

export interface LoginResponse {
  userId: number;
  role: UserRole;
  studentId?: number | null;
  teacherId?: number | null;
}

// ✅ 补上：后端 /register 的返回
export interface RegisterResponse {
  userId: number;
  role: UserRole;
  studentId?: number | null;
  teacherId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // ✅ 关键：用相对路径，走同域名的 nginx 反代
  private readonly baseUrl = '/api/auth';
  private readonly sessionKey = 'sm_session';

  constructor(private http: HttpClient) {}

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, req).pipe(
      tap((resp) => this.saveSession(resp))
    );
  }

  // ✅ 改成返回 RegisterResponse
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
}
