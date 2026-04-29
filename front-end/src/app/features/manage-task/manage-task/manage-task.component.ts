import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { TaskService, Task } from '../task.service';
import { EmployeeService, Employee } from '../../manage-employee/employee.service';
import { AuthService } from '../../auth/auth.service';
import { DateTimePickerComponent } from '../../../shared/components/date-time-picker/date-time-picker.component';

@Component({
  selector: 'app-manage-task',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DateTimePickerComponent],
  templateUrl: './manage-task.component.html',
  styleUrls: ['./manage-task.component.scss']
})
export class ManageTaskComponent {
  isTaskModalOpen = false;
  isDeleteModalOpen = false;
  isEditMode = false;
  currentUser: any = null;
  isAdmin = false;
  isEmployee = false;
  selectedTaskId: string | null = null;

  tasks: Task[] = [];
  filteredTasks: Task[] = [];
  employees: Employee[] = [];
  loading = false;
  loadingSave = false;
  message = '';
  messageType: 'success' | 'error' = 'success';

  readonly reminderOptions = [
    { label: '10 Minutes Before', value: 10 },
    { label: '30 Minutes Before', value: 30 },
    { label: '1 Hour Before', value: 60 },
    { label: '1 Day Before', value: 1440 }
  ];

  readonly filterForm: FormGroup;
  readonly taskForm: FormGroup;

  editingTaskId: string | null = null;

  constructor(
    private taskService: TaskService,
    private employeeService: EmployeeService,
    private authService: AuthService,
    private toastr: ToastrService,
    private fb: FormBuilder,
    private route: ActivatedRoute
  ) {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      statusFilter: ['All Status'],
      employeeFilter: ['All Employees'],
      fromDate: [''],
      toDate: ['']
    });

    this.taskForm = this.fb.group({
      title: [''],
      description: [''],
      assignedTo: [''],
      customerName: [''],
      customerPhone: [''],
      paymentReceived: [false],
      reportSent: [false],
      priority: ['Medium'],
      status: ['Pending'],
      dueDate: [new Date().toISOString()],
      reminderEnabled: [false],
      reminderBefore: [10]
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isTaskModalOpen) {
      this.closeTaskModal();
    }
  }

  ngOnInit() {
    this.currentUser = this.authService.getUser();
    this.isAdmin = this.authService.isAdmin();
    this.isEmployee = this.authService.isEmployee();
    this.loadEmployees();
    this.loadTasks();

    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.applyTaskPrefillFromNavigationState();

    this.route.queryParams.subscribe((params) => {
      if (params['customerName'] || params['customerPhone'] || params['taskTitle'] || params['taskDescription']) {
        this.openAddTask();
        this.taskForm.patchValue({
          title: params['taskTitle'] || '',
          description: params['taskDescription'] || '',
          customerName: params['customerName'] || '',
          customerPhone: params['customerPhone'] || ''
        });
      }
    });
  }

  private resolveDefaultAssigneeId(): string {
    if (!this.isAdmin || !this.employees.length) {
      return '';
    }

    const currentEmail = String(this.currentUser?.email || '').toLowerCase();
    const matchedSelf = this.employees.find((emp) => String(emp.email || '').toLowerCase() === currentEmail);
    if (matchedSelf?._id) {
      return matchedSelf._id;
    }

    return this.employees[0]?._id || '';
  }

  private applyTaskPrefillFromNavigationState(): void {
    const prefill = window.history.state?.taskPrefill;
    if (!prefill || typeof prefill !== 'object') {
      return;
    }

    this.openAddTask();
    this.taskForm.patchValue({
      title: prefill.title || '',
      description: prefill.description || '',
      customerName: prefill.customerName || '',
      customerPhone: prefill.customerPhone || '',
    });
  }

  loadEmployees() {
    this.employeeService.getEmployees().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.employees = res.data;

          if (this.isTaskModalOpen && this.isAdmin && !this.taskForm.get('assignedTo')?.value) {
            const defaultAssignee = this.resolveDefaultAssigneeId();
            if (defaultAssignee) {
              this.taskForm.patchValue({ assignedTo: defaultAssignee });
            }
          }
        }
      },
      error: () => {
        this.toastr.error('Failed to load employees', 'Error');
      }
    });
  }

  loadTasks() {
    this.loading = true;
    this.message = '';
    this.taskService.getTasks().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && Array.isArray(res.data)) {
          this.tasks = res.data;
          this.applyFilters();
        } else {
          this.showMessage('Unable to load tasks', 'error');
        }
      },
      error: () => {
        this.loading = false;
        this.showMessage('Unable to load tasks', 'error');
      }
    });
  }

  applyFilters() {
    const searchTerm = (this.filterForm.get('searchTerm')?.value || '').toLowerCase();
    const statusFilter = this.filterForm.get('statusFilter')?.value || 'All Status';
    const employeeFilter = this.filterForm.get('employeeFilter')?.value || 'All Employees';
    const fromDateStr = this.filterForm.get('fromDate')?.value;
    const toDateStr = this.filterForm.get('toDate')?.value;

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (fromDateStr) {
      fromDate = new Date(fromDateStr);
      fromDate.setHours(0, 0, 0, 0);
    }

    if (toDateStr) {
      toDate = new Date(toDateStr);
      toDate.setHours(23, 59, 59, 999);
    }

    this.filteredTasks = this.tasks.filter((task) => {
      const matchesSearch = !searchTerm
        ? true
        : [task.title, task.description, task.customerName || '', task.customerPhone || '']
            .some((value) => value.toLowerCase().includes(searchTerm));

      const matchesStatus = statusFilter === 'All Status' || task.status === statusFilter;

      const taskDueDate = new Date(task.dueDate);
      const matchesFromDate = !fromDate || taskDueDate >= fromDate;
      const matchesToDate = !toDate || taskDueDate <= toDate;

      const assignedId = typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?._id || '';
      const matchesEmployeeFilter = this.isAdmin
        ? employeeFilter === 'All Employees' || assignedId === employeeFilter
        : true;

      const matchesEmployee = this.isAdmin ? true : this.isTaskAssignedToUser(task);

      return matchesSearch && matchesStatus && matchesFromDate && matchesToDate && matchesEmployeeFilter && matchesEmployee;
    });
  }

  private isTaskAssignedToUser(task: Task): boolean {
    if (!this.currentUser) return false;
    const assignedTo = task.assignedTo;
    const userId = this.currentUser._id || this.currentUser.id;
    const userEmail = (this.currentUser.email || '').toLowerCase();

    if (typeof assignedTo === 'string') {
      return assignedTo === userId;
    }

    const assignedId = assignedTo?._id || '';
    const assignedEmail = (assignedTo?.email || '').toLowerCase();
    return assignedId === userId || (!!userEmail && assignedEmail === userEmail);
  }

  openAddTask() {
    const defaultAssignee = this.resolveDefaultAssigneeId();

    this.isEditMode = false;
    this.editingTaskId = null;
    this.taskForm.reset({
      title: '',
      description: '',
      assignedTo: defaultAssignee,
      customerName: '',
      customerPhone: '',
      paymentReceived: false,
      reportSent: false,
      priority: 'Medium',
      status: 'Pending',
      dueDate: new Date().toISOString(),
      reminderEnabled: false,
      reminderBefore: 10
    });
    this.isTaskModalOpen = true;
  }

  openEditTask(task: Task) {
    this.isEditMode = true;
    this.editingTaskId = task._id || null;
    this.taskForm.reset({
      title: task.title,
      description: task.description,
      assignedTo: typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?._id || task.assignedTo?.fullName || task.assignedTo?.name || '',
      customerName: task.customerName || '',
      customerPhone: task.customerPhone || '',
      paymentReceived: !!task.paymentReceived,
      reportSent: !!task.reportSent,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      reminderEnabled: !!task.reminderEnabled,
      reminderBefore: Number(task.reminderBefore) || 10
    });
    this.isTaskModalOpen = true;
  }

  closeTaskModal() {
    this.isTaskModalOpen = false;
  }

  saveTask() {
    const formValue = this.taskForm.getRawValue();

    if (!formValue.title?.trim()) {
      this.showMessage('Task title is required', 'error');
      return;
    }

    if (!String(formValue.assignedTo || '').trim()) {
      this.showMessage('Please select an employee for this task', 'error');
      return;
    }

    const nextReportSent = formValue.status === 'Report Sent' ? true : !!formValue.reportSent;
    if (formValue.status === 'Completed' && !nextReportSent) {
      this.showMessage('Mark report as sent before completing the task', 'error');
      return;
    }

    this.loadingSave = true;
    const payload: Task = {
      title: formValue.title,
      description: formValue.description,
      assignedTo: formValue.assignedTo,
      customerName: formValue.customerName || '',
      customerPhone: formValue.customerPhone || '',
      paymentReceived: !!formValue.paymentReceived,
      reportSent: nextReportSent,
      priority: formValue.priority,
      status: formValue.status,
      dueDate: formValue.dueDate,
      reminderEnabled: formValue.reminderEnabled,
      reminderBefore: formValue.reminderBefore
    };

    if (this.isEditMode && this.editingTaskId) {
      this.taskService.updateTask(this.editingTaskId, payload).subscribe({
        next: (res) => {
          this.loadingSave = false;
          if (res.success) {
            const updatedTask = res.data && !Array.isArray(res.data) ? (res.data as Task) : null;
            this.tasks = this.tasks.map((item) => {
              if (item._id !== this.editingTaskId) {
                return item;
              }
              return {
                ...item,
                ...(updatedTask || {}),
                paymentReceived: !!formValue.paymentReceived,
                reportSent: nextReportSent,
              };
            });
            this.applyFilters();
            this.showMessage('Task updated successfully', 'success');
            this.closeTaskModal();
          } else {
            this.showMessage(res.message || 'Failed to update task', 'error');
          }
        },
        error: () => {
          this.loadingSave = false;
          this.showMessage('Failed to update task', 'error');
        }
      });
    } else {
      this.taskService.createTask(payload).subscribe({
        next: (res) => {
          this.loadingSave = false;
          if (res.success) {
            this.showMessage('Task created successfully', 'success');
            this.closeTaskModal();
            this.loadTasks();
          } else {
            this.showMessage(res.message || 'Failed to create task', 'error');
          }
        },
        error: () => {
          this.loadingSave = false;
          this.showMessage('Failed to create task', 'error');
        }
      });
    }
  }

  openDeleteModal(task: Task) {
    this.selectedTaskId = task._id || null;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.selectedTaskId = null;
  }

  confirmDelete() {
    if (!this.selectedTaskId) {
      return;
    }
    this.taskService.deleteTask(this.selectedTaskId).subscribe({
      next: (res) => {
        if (res.success) {
          this.showMessage('Task deleted successfully', 'success');
          this.closeDeleteModal();
          this.loadTasks();
        } else {
          this.showMessage(res.message || 'Failed to delete task', 'error');
        }
      },
      error: () => {
        this.showMessage('Failed to delete task', 'error');
      }
    });
  }

  showMessage(message: string, type: 'success' | 'error') {
    this.message = message;
    this.messageType = type;
    if (type === 'success') {
      this.toastr.success(message, 'Success');
    } else {
      this.toastr.error(message, 'Error');
    }
  }

  getAssignedUserName(task: Task): string {
    return typeof task.assignedTo === 'string'
      ? task.assignedTo
      : task.assignedTo?.fullName || task.assignedTo?.name || task.assignedTo?.email || '';
  }

  getCustomerLabel(task: Task): string {
    const name = task.customerName?.trim();
    const phone = task.customerPhone?.trim();

    if (name && phone) {
      return `${name} (${phone})`;
    }

    return name || phone || 'Manual task';
  }

  get reminderEnabled(): boolean {
    return !!this.taskForm.get('reminderEnabled')?.value;
  }

  get reportSentSelected(): boolean {
    return !!this.taskForm.get('reportSent')?.value || this.taskForm.get('status')?.value === 'Report Sent';
  }
}
