import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const apiBaseUrl = environment.apiBaseUrl?.replace(/\/$/, '') || '';
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
      return next.handle(cloned);
    }
    return next.handle(req.clone({ url: requestUrl }));
  }
}
