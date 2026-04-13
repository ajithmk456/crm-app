import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Report, ReportStatus } from '../report.service';
import { DateTimePickerComponent } from '../../../shared/components/date-time-picker/date-time-picker.component';

@Component({
  selector: 'app-report-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DateTimePickerComponent],
  templateUrl: './report-list.component.html',
  styleUrls: ['./report-list.component.scss']
})
export class ReportListComponent {
  @Input() reports: Report[] = [];
  @Input() loading = false;

  @Output() create = new EventEmitter<void>();
  @Output() view = new EventEmitter<Report>();
  @Output() edit = new EventEmitter<Report>();
  @Output() remove = new EventEmitter<Report>();
  @Output() download = new EventEmitter<Report>();

  searchTerm = '';
  statusFilter: 'All' | ReportStatus = 'All';
  fromDate = '';
  toDate = '';

  get filteredReports(): Report[] {
    const term = this.searchTerm.trim().toLowerCase();
    const from = this.fromDate ? new Date(this.fromDate) : null;
    const to = this.toDate ? new Date(this.toDate) : null;
    const toHasTime = /T\d{2}:\d{2}/.test(this.toDate);

    if (to && !toHasTime) {
      to.setHours(23, 59, 59, 999);
    }

    return this.reports.filter((report) => {
      const reportDate = new Date(report.date);
      const matchesSearch = !term
        || report.invoiceNumber.toLowerCase().includes(term)
        || report.client.name.toLowerCase().includes(term);

      const matchesStatus = this.statusFilter === 'All' || report.status === this.statusFilter;
      const matchesFrom = !from || reportDate >= from;
      const matchesTo = !to || reportDate <= to;

      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }

  trackById(_: number, report: Report): string {
    return report._id;
  }
}
