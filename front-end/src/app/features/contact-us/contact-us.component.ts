import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

interface ContactResponse {
  success?: boolean;
  message?: string;
}

@Component({
  selector: 'app-contact-us',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact-us.component.html',
  styleUrl: './contact-us.component.scss'
})
export class ContactUsComponent {
  readonly adminPhone = '+91 85081 69948';
  submitting = false;

  readonly contactForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
    message: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly toastr: ToastrService
  ) {}

  submitContact(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.toastr.error('Please fill all fields correctly.', 'Validation Error');
      return;
    }

    this.submitting = true;
    const payload = {
      name: this.contactForm.value.name?.trim() || '',
      phone: this.contactForm.value.phone?.trim() || '',
      message: this.contactForm.value.message?.trim() || '',
    };

    this.http.post<ContactResponse>('/api/contact', payload).subscribe({
      next: (response) => {
        this.submitting = false;
        if (response?.success === false) {
          this.toastr.error(response.message || 'Failed to send message.', 'Error');
          return;
        }

        this.toastr.success(response?.message || 'Message sent successfully.', 'Success');
        this.contactForm.reset();
      },
      error: () => {
        this.submitting = false;
        this.toastr.error('Unable to send message right now.', 'Error');
      }
    });
  }

  openWhatsApp(): void {
    const text = this.contactForm.value.message?.trim()
      ? `Hi, I would like to contact you.\n\nMessage: ${this.contactForm.value.message}`
      : 'Hi, I would like to contact you.';

    const phone = this.adminPhone.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}