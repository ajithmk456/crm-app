import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DateTimePickerComponent } from '../../../shared/components/date-time-picker/date-time-picker.component';
import { ToastrService } from 'ngx-toastr';
import { TaskService, Task as ApiTask } from '../../manage-task/task.service';
import { Employee, EmployeeService } from '../../manage-employee/employee.service';
import { AuthService } from '../../auth/auth.service';

interface ChatMessage {
  id: number;
  text: string;
  time: string;
  sender: 'incoming' | 'outgoing';
  read?: boolean;
}

interface ChatContact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  preview: string;
  lastMessageTime: string;
  unreadCount: number;
  taskCount: number;
  openTaskCount: number;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-manage-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DateTimePickerComponent],
  templateUrl: './manage-chat.component.html',
  styleUrls: ['./manage-chat.component.scss']
})
export class ManageChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('messageContainer') messageContainer?: ElementRef<HTMLDivElement>;

  isTaskModalOpen = false;
  isEditMode = false;
  showTasks = false;
  loadingTasks = false;
  loadingSave = false;
  selectedMessageId: number | null = null;
  searchTerm = '';
  currentUser: any;
  isAdmin = false;
  isEmployee = false;

  /* =========================
     CHAT DATA (Customers)
  ========================== */

  contacts: ChatContact[] = this.createFallbackContacts();
  selectedChat: ChatContact = this.contacts[0];
  employees: Employee[] = [];

  /* =========================
     TASK STATE
  ========================== */

  tasks: ApiTask[] = [];
  allTasks: ApiTask[] = [];

  readonly reminderOptions = [
    { label: '10 Minutes Before', value: 10 },
    { label: '30 Minutes Before', value: 30 },
    { label: '1 Hour Before', value: 60 },
    { label: '1 Day Before', value: 1440 }
  ];

  readonly taskForm;
  private shouldScrollToBottom = false;

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private employeeService: EmployeeService,
    private toastr: ToastrService,
    private authService: AuthService
  ) {
    this.taskForm = this.fb.group({
      title: [''],
      description: [''],
      assignedTo: [''],
      priority: ['Medium'],
      status: ['Pending'],
      dueDate: [new Date().toISOString()],
      reminderEnabled: [false],
      reminderBefore: [10]
    });
  }

  ngOnInit(): void {
    this.currentUser = this.authService.getUser();
    this.isAdmin = this.authService.isAdmin();
    this.isEmployee = this.authService.isEmployee();
    this.loadEmployees();
    this.loadTasks();
    this.queueScrollToBottom();
  }

  ngAfterViewChecked(): void {
    if (!this.shouldScrollToBottom) {
      return;
    }

    const container = this.messageContainer?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }

    this.shouldScrollToBottom = false;
  }

  get messages(): ChatMessage[] {
    return this.selectedChat?.messages ?? [];
  }

  get filteredContacts(): ChatContact[] {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.contacts;
    }

    return this.contacts.filter((contact) => {
      return [contact.name, contact.phone, contact.preview]
        .some((value) => value.toLowerCase().includes(term));
    });
  }

  /* =========================
     MODAL METHODS
  ========================== */

  openTaskModal(message?: ChatMessage) {
    const draftText = message?.text || this.getLatestIncomingMessage()?.text || '';

    if (message) {
      this.selectedMessageId = message.id;
    }

    this.taskForm.reset({
      title: draftText,
      description: draftText,
      assignedTo: '',
      priority: 'Medium',
      status: 'Pending',
      dueDate: new Date().toISOString(),
      reminderEnabled: false,
      reminderBefore: 10
    });

    this.isTaskModalOpen = true;
  }

  closeTaskModal() {
    this.isTaskModalOpen = false;
    this.loadingSave = false;
  }

  /* =========================
     TASK METHODS
  ========================== */

  loadTasks() {
    if (!this.selectedChat?.id) {
      this.allTasks = [];
      this.tasks = [];
      return;
    }

    this.loadingTasks = true;
    this.taskService.getTasks().subscribe({
      next: (response) => {
        this.loadingTasks = false;
        if (response.success && Array.isArray(response.data)) {
          this.allTasks = response.data;
          this.syncTaskState();
          return;
        }

        this.allTasks = [];
        this.tasks = [];
        this.syncTaskCounts();
      },
      error: () => {
        this.loadingTasks = false;
        this.allTasks = [];
        this.tasks = [];
        this.syncTaskCounts();
      }
    });
  }

  saveTask() {
    const formValue = this.taskForm.getRawValue();

    if (!formValue.title?.trim()) {
      this.toastr.error('Task title is required', 'Error');
      return;
    }

    if (!formValue.assignedTo) {
      this.toastr.error('Assigned employee is required', 'Error');
      return;
    }

    this.loadingSave = true;
    const payload: ApiTask = {
      title: formValue.title.trim(),
      description: (formValue.description || formValue.title).trim(),
      assignedTo: formValue.assignedTo,
      customerName: this.selectedChat.name,
      customerPhone: this.selectedChat.phone,
      priority: (formValue.priority || 'Medium') as ApiTask['priority'],
      status: (formValue.status || 'Pending') as ApiTask['status'],
      dueDate: formValue.dueDate || new Date().toISOString(),
      reminderEnabled: !!formValue.reminderEnabled,
      reminderBefore: formValue.reminderBefore || 10
    };

    this.taskService.createTask(payload).subscribe({
      next: (response) => {
        this.loadingSave = false;
        if (response.success) {
          this.toastr.success('Task created and assigned successfully', 'Success');
          this.closeTaskModal();
          this.loadTasks();
          return;
        }

        this.toastr.error(response.message || 'Failed to create task', 'Error');
      },
      error: (error) => {
        this.loadingSave = false;
        this.toastr.error(error.error?.message || 'Failed to create task', 'Error');
      }
    });
  }

  toggleTaskPanel() {
    this.showTasks = !this.showTasks;
    if (this.showTasks) {
      this.loadTasks();
    }
  }

  /* =========================
     MESSAGE SEND (UI ONLY)
  ========================== */

  sendMessage(input: HTMLInputElement) {
    if (!input.value.trim()) return;

    const nextMessage: ChatMessage = {
      id: Date.now(),
      text: input.value.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sender: 'outgoing',
      read: false
    };

    this.selectedChat.messages = [...this.selectedChat.messages, nextMessage];
    this.selectedChat.preview = nextMessage.text;
    this.selectedChat.lastMessageTime = this.formatChatTime(new Date());
    this.selectedMessageId = nextMessage.id;

    input.value = '';
    this.queueScrollToBottom();
  }

  selectChat(contact: ChatContact) {
    this.selectedChat = contact;
    this.selectedMessageId = null;
    this.syncTaskState();
    this.queueScrollToBottom();
  }

  selectMessage(message: ChatMessage) {
    this.selectedMessageId = message.id;
  }

  trackByContact(_index: number, contact: ChatContact): string {
    return contact.id;
  }

  trackByMessage(_index: number, message: ChatMessage): number {
    return message.id;
  }

  getTaskSummary(task: ApiTask): string {
    return this.getAssignedEmployeeName(task);
  }

  clearSearch() {
    this.searchTerm = '';
  }

  /* =========================
     HELPER
  ========================== */

  openAddTask() {
    this.isEditMode = false;
    this.openTaskModal();
  }

  openEditTask() {
    this.isEditMode = true;
    this.isTaskModalOpen = true;
  }

  get reminderEnabled(): boolean {
    return !!this.taskForm.get('reminderEnabled')?.value;
  }

  private loadEmployees() {
    this.employeeService.getEmployees().subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          this.employees = response.data;
        }
      },
      error: () => {
        this.employees = [];
      }
    });
  }

  private createFallbackContacts(): ChatContact[] {
    return [
      {
        id: 'customer-1',
        name: 'John Mathew',
        phone: '+91 9876543210',
        avatar: 'JM',
        preview: 'Need GST filing help for this month.',
        lastMessageTime: '10:32',
        unreadCount: 2,
        taskCount: 0,
        openTaskCount: 0,
        messages: this.createMockMessages('John Mathew', 'GST filing help for this month')
      },
      {
        id: 'customer-2',
        name: 'Arun Raj',
        phone: '+91 9123456780',
        avatar: 'AR',
        preview: 'Need support for TDS document update.',
        lastMessageTime: '09:14',
        unreadCount: 1,
        taskCount: 0,
        openTaskCount: 0,
        messages: this.createMockMessages('Arun Raj', 'support for TDS document update')
      }
    ];
  }

  private createMockMessages(contactName: string, requirement: string): ChatMessage[] {
    return [
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        text: `Hi, I need ${requirement}, ${contactName}.`,
        time: '10:30 AM',
        sender: 'incoming'
      },
      {
        id: Date.now() + Math.floor(Math.random() * 1000) + 1,
        text: 'Noted. I will create a task for the concerned employee.',
        time: '10:32 AM',
        sender: 'outgoing',
        read: true
      }
    ];
  }

  private getLatestIncomingMessage(): ChatMessage | undefined {
    return [...this.messages].reverse().find((message) => message.sender === 'incoming');
  }

  private isTaskForSelectedChat(task: ApiTask): boolean {
    return this.isTaskForContact(task, this.selectedChat);
  }

  private syncTaskState() {
    let filteredTasks = this.allTasks.filter((task) => this.isTaskForSelectedChat(task));
    
    // Employees see only tasks assigned to them
    if (this.isEmployee && this.currentUser) {
      filteredTasks = filteredTasks.filter((task) => this.isTaskAssignedToUser(task));
    }
    
    this.tasks = filteredTasks;
    this.syncTaskCounts();
  }

  private syncTaskCounts() {
    this.contacts = this.contacts.map((contact) => {
      const contactTasks = this.allTasks.filter((task) => this.isTaskForContact(task, contact));
      const openTaskCount = contactTasks.filter((task) => task.status !== 'Completed').length;

      return {
        ...contact,
        taskCount: contactTasks.length,
        openTaskCount
      };
    });

    const activeContact = this.contacts.find((contact) => contact.id === this.selectedChat?.id);
    if (activeContact) {
      this.selectedChat = activeContact;
    }
  }

  private isTaskForContact(task: ApiTask, contact: ChatContact): boolean {
    const customerName = (task.customerName || '').trim().toLowerCase();
    const customerPhone = (task.customerPhone || '').replace(/\s+/g, '');
    const contactName = contact.name.trim().toLowerCase();
    const contactPhone = contact.phone.replace(/\s+/g, '');

    return customerName === contactName || customerPhone === contactPhone;
  }

  private getAssignedEmployeeName(task: ApiTask): string {
    if (typeof task.assignedTo === 'string') {
      const employee = this.employees.find((item) => item._id === task.assignedTo);
      return employee?.fullName || task.assignedTo;
    }

    return task.assignedTo?.fullName || task.assignedTo?.name || task.assignedTo?.email || 'Unassigned';
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private formatChatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private isTaskAssignedToUser(task: ApiTask): boolean {
    if (!this.currentUser) return false;
    const assignedTo = task.assignedTo;
    const userId = this.currentUser._id;
    if (typeof assignedTo === 'string') {
      return assignedTo === userId;
    }
    return assignedTo?._id === userId;
  }

  private queueScrollToBottom() {
    this.shouldScrollToBottom = true;
  }
}
