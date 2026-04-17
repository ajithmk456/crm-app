import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../features/auth/auth.service';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly runtimeConfigService: RuntimeConfigService,
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiBaseUrl = this.runtimeConfigService.getApiBaseUrl().replace(/\/$/, '');
    const requestUrl = req.url.startsWith('/api') && apiBaseUrl
      ? `${apiBaseUrl}${req.url}`
      : req.url;

    const token = sessionStorage.getItem('token');
    if (token) {
      const cloned = req.clone({
        url: requestUrl,
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
      return next.handle(cloned).pipe(
        catchError((error) => {
          if ((error?.status === 401 || error?.status === 403) && this.authService.isLoggedIn()) {
            this.authService.logout();
            this.router.navigate(['/login']);
          }
          return throwError(() => error);
        })
      );
    }
    return next.handle(req.clone({ url: requestUrl })).pipe(
      catchError((error) => {
        if ((error?.status === 401 || error?.status === 403) && this.authService.isLoggedIn()) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => error);
      })
    );
  }
}
