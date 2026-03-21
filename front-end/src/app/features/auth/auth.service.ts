import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    user: any;
  };
  message?: string;
}

export interface CheckUserResponse {
  success: boolean;
  data?: {
    exists: boolean;
    hasPassword: boolean;
  };
  message?: string;
}

export interface SetPasswordRequest {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private http: HttpClient) {}

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', payload);
  }

  checkUser(email: string): Observable<CheckUserResponse> {
    return this.http.post<CheckUserResponse>('/api/auth/check-user', { email });
  }

  setPassword(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/set-password', { email, password });
  }

  setToken(token: string): void {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  clearToken(): void {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
  }

  saveUser(user: any): void {
    sessionStorage.setItem('user', JSON.stringify(user));
    localStorage.removeItem('user');
  }

  getUser(): any {
    const raw = sessionStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  }

  clearUser(): void {
    sessionStorage.removeItem('user');
    localStorage.removeItem('user');
  }

  logout(): void {
    this.clearToken();
    this.clearUser();
  }

  updateProfile(data: { name?: string; newPassword?: string }): Observable<any> {
    return this.http.put<any>('/api/auth/profile', data);
  }

  getUserRole(): string {
    const user = this.getUser();
    return (user?.role || 'user').toLowerCase();
  }

  isAdmin(): boolean {
    return this.getUserRole() === 'admin';
  }

  isEmployee(): boolean {
    const role = this.getUserRole();
    return role === 'employee' || role === 'user';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
