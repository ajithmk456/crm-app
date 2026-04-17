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

    const sessionUser = this.getSessionUserAuth();
    if (!sessionUser) {
      this.router.navigate(['/login']);
      return false;
    }

    const requiredRole = String(route.data['role'] || '').toLowerCase();
    if (requiredRole === 'superadmin') {
      if (sessionUser.role !== 'superadmin') {
        this.redirectToDashboard(sessionUser.role);
        return false;
      }

      return true;
    }

    if (sessionUser.role === 'superadmin') {
      this.router.navigate(['/superadmin/create-admin']);
      return false;
    }

    if (requiredRole) {
      if (requiredRole === 'admin' && sessionUser.role !== 'admin') {
        this.redirectToDashboard(sessionUser.role);
        return false;
      }

      const canAccessEmployeeRoute = sessionUser.role === 'employee' || sessionUser.isTemporaryAdmin;
      if (requiredRole === 'employee' && !canAccessEmployeeRoute) {
        this.redirectToDashboard(sessionUser.role);
        return false;
      }
    }

    return true;
  }

  private getSessionUserAuth(): { role: 'admin' | 'employee' | 'superadmin'; isTemporaryAdmin: boolean } | null {
    try {
      const raw = sessionStorage.getItem('user');
      if (!raw) return null;

      const user = JSON.parse(raw);
      const role = String(user?.role || '').toLowerCase();
      const isTemporaryAdmin = !!user?.isTemporaryAdmin;

      if (role === 'superadmin') return { role: 'superadmin', isTemporaryAdmin: false };
      if (role === 'admin') return { role: 'admin', isTemporaryAdmin };
      if (role === 'employee' || role === 'user') return { role: 'employee', isTemporaryAdmin: false };

      return null;
    } catch {
      return null;
    }
  }

  private redirectToDashboard(role: 'admin' | 'employee' | 'superadmin'): void {
    if (role === 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }

    if (role === 'superadmin') {
      this.router.navigate(['/superadmin/create-admin']);
      return;
    }

    this.router.navigate(['/employee-dashboard']);
  }
}
