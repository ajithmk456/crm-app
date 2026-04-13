import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Task, TaskService } from '../manage-task/task.service';

type DashboardFilter = 'all' | 'open' | 'in-progress' | 'report-sent' | 'completed' | 'overdue' | 'high-priority';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-dashboard.component.html',
  styleUrl: './employee-dashboard.component.scss'
})
export class EmployeeDashboardComponent implements OnInit, OnDestroy {
  currentUser = { id: '', name: 'Employee', email: '' };
  allTasks: Task[] = [];
  visibleTasks: Task[] = [];
  selectedTask: Task | null = null;
  isTaskDetailOpen = false;
  activeFilter: DashboardFilter = 'all';
  loading = false;
  actionLoading = new Set<string>();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private taskService: TaskService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadTasks();
    this.refreshTimer = setInterval(() => {
      this.loadTasks(false);
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  get openTasksCount(): number {
    return this.allTasks.filter((task) => task.status === 'Pending').length;
  }

  get inProgressCount(): number {
    return this.allTasks.filter((task) => task.status === 'In Progress' || task.status === 'Report Sent').length;
  }

  get reportSentCount(): number {
    return this.allTasks.filter((task) => task.status === 'Report Sent' || !!task.reportSent).length;
  }

  get completedCount(): number {
    return this.allTasks.filter((task) => task.status === 'Completed').length;
  }

  get overdueCount(): number {
    return this.allTasks.filter((task) => this.isOverdue(task)).length;
  }

  setFilter(filter: DashboardFilter): void {
    this.activeFilter = filter;
    this.applyFilter();
  }

  clearFilter(): void {
    this.setFilter('all');
  }

  refreshTasks(): void {
    this.loadTasks(true);
  }

  goToReminders(): void {
    this.router.navigate(['/task-reminder']);
  }

  startTask(task: Task): void {
    if (task.status !== 'Pending') return;
    this.updateTaskStatus(task, 'In Progress');
  }

  markComplete(task: Task): void {
    if (task.status === 'Completed') return;
    if (!task.reportSent && task.status !== 'Report Sent') return;
    this.updateTaskStatus(task, 'Completed');
  }

  markReportSent(task: Task): void {
    if (task.status === 'Report Sent' || task.reportSent) return;
    this.updateTaskStatus(task, 'Report Sent', true);
  }

  openTaskDetails(task: Task): void {
    this.selectedTask = task;
    this.isTaskDetailOpen = true;
  }

  closeTaskDetails(): void {
    this.isTaskDetailOpen = false;
    this.selectedTask = null;
  }

  isTaskBusy(task: Task | null): boolean {
    if (!task) {
      return false;
    }
    return this.actionLoading.has(task._id || task.title);
  }

  isOverdue(task: Task): boolean {
    if (task.status === 'Completed') return false;
    const due = new Date(task.dueDate).getTime();
    if (Number.isNaN(due)) return false;
    return due < Date.now();
  }

  formatDate(dateString: string): string {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  }

  statusClass(status: Task['status']): string {
    return status.replace(/\s+/g, '-').toLowerCase();
  }

  private loadCurrentUser(): void {
    const user = this.authService.getUser();
    this.currentUser = {
      id: user?._id || user?.id || '',
      name: user?.name || 'Employee',
      email: (user?.email || '').toLowerCase()
    };
  }

  private loadTasks(showLoader = true): void {
    if (showLoader) {
      this.loading = true;
    }
    this.taskService.getTasks().subscribe({
      next: (response) => {
        this.loading = false;
        if (!response.success || !Array.isArray(response.data)) {
          this.allTasks = [];
          this.applyFilter();
          return;
        }

        this.allTasks = response.data
          .filter((task) => this.isAssignedToCurrentUser(task))
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        if (this.selectedTask?._id) {
          const refreshedTask = this.allTasks.find((task) => task._id === this.selectedTask?._id) || null;
          this.selectedTask = refreshedTask;
          if (!refreshedTask) {
            this.isTaskDetailOpen = false;
          }
        }

        this.applyFilter();
      },
      error: () => {
        this.loading = false;
        this.allTasks = [];
        this.applyFilter();
      }
    });
  }

  private applyFilter(): void {
    this.visibleTasks = this.allTasks.filter((task) => {
      if (this.activeFilter === 'all') return true;
      if (this.activeFilter === 'open') return task.status === 'Pending';
      if (this.activeFilter === 'in-progress') return task.status === 'In Progress';
      if (this.activeFilter === 'report-sent') return task.status === 'Report Sent' || !!task.reportSent;
      if (this.activeFilter === 'completed') return task.status === 'Completed';
      if (this.activeFilter === 'overdue') return this.isOverdue(task);
      if (this.activeFilter === 'high-priority') return task.priority === 'High';
      return true;
    });
  }

  private updateTaskStatus(task: Task, status: Task['status'], reportSent?: boolean): void {
    const taskId = task._id;
    const loadingKey = taskId || task.title;
    this.actionLoading.add(loadingKey);

    const previousStatus = task.status;
    const previousReportSent = !!task.reportSent;
    task.status = status;
    if (reportSent !== undefined) {
      task.reportSent = reportSent;
    } else if (status === 'Report Sent') {
      task.reportSent = true;
    }
    this.applyFilter();

    if (!taskId) {
      this.actionLoading.delete(loadingKey);
      return;
    }

    const assignedToId =
      typeof task.assignedTo === 'string'
        ? task.assignedTo
        : task.assignedTo?._id || this.currentUser.id;

    const payload: Task = {
      ...task,
      assignedTo: assignedToId,
      status,
      reportSent: status === 'Report Sent' ? true : !!task.reportSent,
    };

    this.taskService.updateTask(taskId, payload).subscribe({
      next: () => {
        this.actionLoading.delete(loadingKey);
        this.loadTasks(false);
      },
      error: () => {
        task.status = previousStatus;
        task.reportSent = previousReportSent;
        this.applyFilter();
        this.actionLoading.delete(loadingKey);
      }
    });
  }

  private isAssignedToCurrentUser(task: Task): boolean {
    if (!this.currentUser.id && !this.currentUser.email) return false;

    if (typeof task.assignedTo === 'string') {
      return task.assignedTo === this.currentUser.id;
    }

    const assignedId = task.assignedTo?._id || '';
    const assignedEmail = (task.assignedTo?.email || '').toLowerCase();

    return assignedId === this.currentUser.id || (!!assignedEmail && assignedEmail === this.currentUser.email);
  }
}
