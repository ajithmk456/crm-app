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

  onToggle(): void {
    this.toggle.emit();
  }
}
