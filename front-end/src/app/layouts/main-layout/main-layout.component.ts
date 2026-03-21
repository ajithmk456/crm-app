import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../features/auth/auth.service';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterModule, CommonModule, BreadcrumbComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {

  showDropdown = false;
  currentUser: any = null;

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
  }

  get userInitials(): string {
    const name: string = this.currentUser?.name || '';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'A';
  }

  get userRole(): string {
    return (this.currentUser?.role || 'user').toLowerCase();
  }

  get isAdmin(): boolean {
    return this.userRole === 'admin';
  }

  get isEmployee(): boolean {
    const role = this.userRole;
    return role === 'employee' || role === 'user';
  }

  get dashboardSubtitle(): string {
    return this.isAdmin ? 'Admin Dashboard' : 'Employee Dashboard';
  }

get isChatRoute(): boolean {
  return this.router.url.includes('manage-chat');
}

get isReminderRoute(): boolean {
  return this.router.url.includes('task-reminders');
}

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  goToReminders() {
    this.showDropdown = false;
    this.router.navigate(['/task-reminders']);
  }

  goToProfile() {
    this.showDropdown = false;
    this.router.navigate(['/profile']);
  }

  logout() {
    this.showDropdown = false;
    this.currentUser = null;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile')) {
      this.showDropdown = false;
    }
  }
}
