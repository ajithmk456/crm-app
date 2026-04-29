import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientService, Client } from '../manage-client/client.service';
import { TaskService, Task } from '../manage-task/task.service';
import { WorkHistoryItem, WorkHistoryService } from './work-history.service';

@Component({
  selector: 'app-work-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './work-history.component.html',
  styleUrl: './work-history.component.scss',
})
export class WorkHistoryComponent implements OnInit {
  items: WorkHistoryItem[] = [];
  clients: Client[] = [];
  tasks: Task[] = [];

  selectedClientId = '';
  selectedTaskId = '';
  fromDate = '';
  toDate = '';
  isLoading = false;
  expandedId: string | null = null;

  constructor(
    private readonly historyService: WorkHistoryService,
    private readonly clientService: ClientService,
    private readonly taskService: TaskService,
  ) {}

  ngOnInit(): void {
    this.loadFilters();
    this.loadHistory();
  }

  loadFilters(): void {
    this.clientService.getClients({ page: 1, limit: 200, sort: 'desc' }).subscribe({
      next: (res) => {
        if (res.success) {
          this.clients = res.data;
        }
      },
    });

    this.taskService.getTasks().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.tasks = res.data;
        }
      },
    });
  }

  loadHistory(): void {
    this.isLoading = true;
    this.historyService.getHistory({
      clientId: this.selectedClientId || undefined,
      taskId: this.selectedTaskId || undefined,
      fromDate: this.fromDate ? new Date(this.fromDate).toISOString() : undefined,
      toDate: this.toDate ? new Date(this.toDate).toISOString() : undefined,
      limit: 300,
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.items = res.success ? res.data : [];
      },
      error: () => {
        this.isLoading = false;
        this.items = [];
      },
    });
  }

  resetFilters(): void {
    this.selectedClientId = '';
    this.selectedTaskId = '';
    this.fromDate = '';
    this.toDate = '';
    this.loadHistory();
  }

  toggleExpanded(itemId: string): void {
    this.expandedId = this.expandedId === itemId ? null : itemId;
  }

  getBadgeClass(type: string): string {
    if (type === 'payment' || type === 'report') return 'success';
    if (type === 'assignment' || type === 'task') return 'warning';
    return 'info';
  }

  getIconClass(type: string): string {
    switch (type) {
      case 'message':
        return 'fa-comments';
      case 'task':
        return 'fa-list-check';
      case 'assignment':
        return 'fa-user-check';
      case 'report':
        return 'fa-file-circle-check';
      case 'payment':
        return 'fa-money-bill-wave';
      default:
        return 'fa-circle';
    }
  }

  getEmployeeLabel(item: WorkHistoryItem): string {
    if (item.employeeId && typeof item.employeeId === 'object') {
      return item.employeeId.fullName || item.employeeId.email || 'System';
    }

    return 'System';
  }

  asKeyValues(meta: Record<string, unknown> | undefined): Array<{ key: string; value: string }> {
    if (!meta) {
      return [];
    }

    return Object.entries(meta).map(([key, value]) => ({ key, value: String(value) }));
  }
}
