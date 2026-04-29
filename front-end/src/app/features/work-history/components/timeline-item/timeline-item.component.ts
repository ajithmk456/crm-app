import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkHistoryItem } from '../../work-history.service';

@Component({
  selector: 'app-timeline-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline-item.component.html',
  styleUrl: './timeline-item.component.scss',
})
export class TimelineItemComponent {
  @Input() item!: WorkHistoryItem;
  @Input() latest = false;
  @Input() expanded = false;
  @Input() title = '';
  @Input() employeeLabel = 'System';
  @Input() relativeTime = '';
  @Input() exactTime = '';
  @Input() iconClass = 'fa-circle';
  @Input() colorClass = 'info';
  @Input() metadata: Array<{ key: string; value: string }> = [];

  @Output() toggle = new EventEmitter<void>();

  get hasDetails(): boolean {
    return this.metadata.length > 0;
  }

  get hasExpandableContent(): boolean {
    return Boolean(
      this.item?.description ||
      this.taskName ||
      this.taskStatus ||
      this.assignedUser ||
      this.messageContent ||
      this.paymentSummary ||
      this.hasDetails,
    );
  }

  get taskName(): string {
    if (this.item?.taskId && typeof this.item.taskId === 'object') {
      return this.item.taskId.title || '';
    }

    return this.metaValue(['taskName', 'taskTitle', 'title']);
  }

  get taskStatus(): string {
    return this.metaValue(['taskStatus', 'status']);
  }

  get assignedUser(): string {
    if (this.item?.employeeId && typeof this.item.employeeId === 'object') {
      return this.item.employeeId.fullName || this.item.employeeId.email || '';
    }

    return this.metaValue(['assignedTo', 'employee', 'employeeName']);
  }

  get messageContent(): string {
    return this.metaValue(['message', 'messageContent', 'content', 'text']);
  }

  get paymentSummary(): string {
    const amount = this.metaValue(['amount', 'paymentAmount']);
    const mode = this.metaValue(['paymentMode', 'mode']);
    const status = this.metaValue(['paymentStatus', 'status']);
    const reference = this.metaValue(['reference', 'transactionId']);

    const parts = [amount ? `Amount: ${amount}` : '', mode ? `Mode: ${mode}` : '', status ? `Status: ${status}` : '', reference ? `Ref: ${reference}` : '']
      .filter(Boolean);

    return parts.join(' | ');
  }

  onToggle(): void {
    this.toggle.emit();
  }

  private metaValue(keys: string[]): string {
    const meta = this.item?.metadata;
    if (!meta) {
      return '';
    }

    for (const key of keys) {
      const value = meta[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }

    return '';
  }
}
