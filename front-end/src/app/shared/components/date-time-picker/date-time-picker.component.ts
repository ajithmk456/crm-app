import { AfterViewInit, Component, ElementRef, forwardRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import type { Instance } from 'flatpickr/dist/types/instance';

@Component({
  selector: 'app-date-time-picker',
  standalone: true,
  template: '<input #pickerInput type="text" class="date-time-input" [placeholder]="placeholder" />',
  styleUrl: './date-time-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateTimePickerComponent),
      multi: true,
    },
  ],
})
export class DateTimePickerComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  @Input() placeholder = 'Select date and time';
  @Input() defaultToCurrentTime = false;

  @ViewChild('pickerInput', { static: true }) pickerInput!: ElementRef<HTMLInputElement>;

  private flatpickrInstance: Instance | null = null;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue: string | null = null;

  ngAfterViewInit(): void {
    const now = new Date();

    this.flatpickrInstance = flatpickr(this.pickerInput.nativeElement, {
      enableTime: true,
      time_24hr: true,
      dateFormat: 'd-m-Y H:i',
      minuteIncrement: 5,
      defaultHour: now.getHours(),
      defaultMinute: now.getMinutes(),
      disableMobile: true,
      onChange: (selectedDates) => {
        const selectedDate = selectedDates[0];
        this.onChange(selectedDate ? selectedDate.toISOString() : '');
      },
      onClose: () => {
        this.onTouched();
      },
      onReady: () => {
        if (this.pendingValue) {
          this.setPickerDate(this.pendingValue);
          this.pendingValue = null;
          return;
        }

        if (this.defaultToCurrentTime) {
          this.flatpickrInstance?.setDate(now, true);
          this.onChange(now.toISOString());
        }
      },
    });
  }

  writeValue(value: string | null): void {
    if (!value) {
      if (this.flatpickrInstance) {
        this.flatpickrInstance.clear();
      }
      return;
    }

    if (!this.flatpickrInstance) {
      this.pendingValue = value;
      return;
    }

    this.setPickerDate(value);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (!this.flatpickrInstance) {
      return;
    }

    this.flatpickrInstance.input.disabled = isDisabled;
  }

  ngOnDestroy(): void {
    this.flatpickrInstance?.destroy();
  }

  private setPickerDate(value: string): void {
    const parsedDate = this.parseValue(value);
    if (parsedDate) {
      this.flatpickrInstance?.setDate(parsedDate, true);
    }
  }

  private parseValue(value: string): Date | null {
    const isoDate = new Date(value);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate;
    }

    const [datePart, timePart] = value.split(' ');
    if (!datePart || !timePart) {
      return null;
    }

    const [day, month, year] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    const parsed = new Date(year, month - 1, day, hours, minutes);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}