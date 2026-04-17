import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-superadmin-create-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './superadmin-create-admin.component.html',
  styleUrl: './superadmin-create-admin.component.scss'
})
export class SuperadminCreateAdminComponent implements OnInit {
  loggingIn = false;
  submitting = false;

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(5)]],
  });

  readonly adminForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly toastr: ToastrService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (!user) {
      return;
    }

    const role = String(user.role || '').toLowerCase();
    if (role === 'superadmin') {
      this.loginForm.patchValue({ email: user.email || '' });
      return;
    }

    this.router.navigate([role === 'admin' ? '/dashboard' : '/employee-dashboard']);
  }

  get isAuthorized(): boolean {
    return this.authService.isLoggedIn() && this.authService.isSuperadmin();
  }

  get currentUserName(): string {
    return this.authService.getUser()?.name || 'Superadmin';
  }

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.toastr.error('Enter the superadmin email and password.', 'Validation Error');
      return;
    }

    this.loggingIn = true;
    const { email, password } = this.loginForm.getRawValue();

    this.authService.login({
      email: email?.trim() || '',
      password: password || '',
    }).subscribe({
      next: (response) => {
        this.loggingIn = false;
        if (!response.success || !response.data?.token || !response.data.user) {
          this.toastr.error(response.message || 'Login failed.', 'Error');
          return;
        }

        const role = String(response.data.user.role || '').toLowerCase();
        if (role !== 'superadmin') {
          this.authService.logout();
          this.toastr.error('Only superadmin can use this page.', 'Access Denied');
          return;
        }

        this.authService.setToken(response.data.token);
        this.authService.saveUser(response.data.user);
        this.toastr.success('Superadmin access granted.', 'Authenticated');
      },
      error: (error) => {
        this.loggingIn = false;
        const message = error?.error?.message || 'Login failed.';
        this.toastr.error(message, 'Error');
      }
    });
  }

  submit(): void {
    if (this.adminForm.invalid) {
      this.adminForm.markAllAsTouched();
      this.toastr.error('Enter a valid name, email, and password.', 'Validation Error');
      return;
    }

    this.submitting = true;
    const { name, email, password } = this.adminForm.getRawValue();

    this.authService.createAdmin({
      name: name?.trim() || '',
      email: email?.trim() || '',
      password: password || '',
    }).subscribe({
      next: (response) => {
        this.submitting = false;
        if (!response.success || !response.data) {
          this.toastr.error(response.message || 'Unable to create admin.', 'Error');
          return;
        }

        this.toastr.success(`Admin created for ${response.data.email}`, 'Admin Created');
        this.adminForm.reset();
      },
      error: (error) => {
        this.submitting = false;
        const message = error?.error?.message || 'Unable to create admin.';
        if (error?.status === 401 || error?.status === 403) {
          this.authService.logout();
        }
        this.toastr.error(message, 'Error');
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.loginForm.reset();
    this.router.navigate(['/superadmin/create-admin']);
  }
}