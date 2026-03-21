import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../features/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.checkAccess(route);
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    return this.checkAccess(childRoute);
  }

  private checkAccess(route: ActivatedRouteSnapshot): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const userRole = this.getRoleFromSessionStorage();
    if (!userRole) {
      this.router.navigate(['/login']);
      return false;
    }

    const requiredRole = String(route.data['role'] || '').toLowerCase();
    if (requiredRole) {
      if (requiredRole === 'admin' && userRole !== 'admin') {
        this.redirectToDashboard(userRole);
        return false;
      }

      if (requiredRole === 'employee' && userRole !== 'employee') {
        this.redirectToDashboard(userRole);
        return false;
      }
    }

    return true;
  }

  private getRoleFromSessionStorage(): 'admin' | 'employee' | null {
    try {
      const raw = sessionStorage.getItem('user');
      if (!raw) return null;

      const user = JSON.parse(raw);
      const role = String(user?.role || '').toLowerCase();

      if (role === 'admin') return 'admin';
      if (role === 'employee' || role === 'user') return 'employee';

      return null;
    } catch {
      return null;
    }
  }

  private redirectToDashboard(role: 'admin' | 'employee'): void {
    if (role === 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.router.navigate(['/employee-dashboard']);
  }
}
