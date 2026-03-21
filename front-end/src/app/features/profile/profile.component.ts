import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  currentUser: any = null;
  saving = false;

  profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: [{ value: '', disabled: true }],
    newPassword: [''],
    confirmPassword: ['']
  });

  get initials(): string {
    const name: string = this.currentUser?.name || '';
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  }

  get passwordMismatch(): boolean {
    const pw = this.profileForm.get('newPassword')?.value;
    const cpw = this.profileForm.get('confirmPassword')?.value;
    return !!pw && !!cpw && pw !== cpw;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly toastr: ToastrService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    if (this.currentUser) {
      this.profileForm.patchValue({
        name: this.currentUser.name,
        email: this.currentUser.email
      });
    }
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.toastr.error('Please fill in all required fields.', 'Validation Error');
      return;
    }

    if (this.passwordMismatch) {
      this.toastr.error('Passwords do not match.', 'Validation Error');
      return;
    }

    const newPassword = this.profileForm.get('newPassword')?.value || '';
    if (newPassword && newPassword.length < 5) {
      this.toastr.error('Password must be at least 5 characters.', 'Validation Error');
      return;
    }

    this.saving = true;

    const payload: { name: string; newPassword?: string } = {
      name: this.profileForm.get('name')?.value || ''
    };
    if (newPassword) {
      payload.newPassword = newPassword;
    }

    this.authService.updateProfile(payload).subscribe({
      next: (res) => {
        if (res?.success) {
          this.applyProfileUpdate(res.data?.name || payload.name, true);
        } else {
          this.saving = false;
          this.toastr.error(res?.message || 'Update failed.', 'Error');
        }
      },
      error: (err) => {
        if (err?.status === 404) {
          this.applyProfileUpdate(payload.name, false);
          return;
        }

        this.saving = false;
        this.toastr.error(err?.error?.message || 'Update failed. Please try again.', 'Error');
      }
    });
  }

  private applyProfileUpdate(name: string, persistedToApi: boolean): void {
    const updatedUser = {
      ...this.currentUser,
      name
    };

    this.authService.saveUser(updatedUser);
    this.currentUser = updatedUser;
    this.saving = false;
    this.profileForm.patchValue({
      name,
      newPassword: '',
      confirmPassword: ''
    });

    if (persistedToApi) {
      this.toastr.success('Profile updated. Please login again.', 'Success');
    } else {
      this.toastr.success('Profile updated locally. Please login again.', 'Success');
    }

    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
