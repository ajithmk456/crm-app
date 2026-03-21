import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface Task {
  _id?: string;
  title: string;
  description: string;
  assignedTo: string | { _id?: string; name?: string; fullName?: string; email?: string; phone?: string };
  customerName?: string;
  customerPhone?: string;
  paymentReceived?: boolean;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueDate: string;
  reminderEnabled?: boolean;
  reminderBefore?: string | number;
  reminderTime?: string;
  reminderSent?: boolean;
}

export interface UpcomingReminder {
  taskId: string;
  kind?: 'task' | 'enquiry';
  taskName: string;
  assignedUser: string;
  reminderTime: string;
  dueDate: string;
  taskStatus: 'Pending' | 'In Progress' | 'Completed' | 'New' | 'Closed' | string;
  priority: 'Low' | 'Medium' | 'High';
  reminderStatus: 'upcoming' | 'overdue' | 'sent';
  reminderSent: boolean;
  overdue: boolean;
}

export interface TaskResponse {
  success: boolean;
  data: Task | Task[];
  message?: string;
}

export interface UpcomingReminderResponse {
  success: boolean;
  data: UpcomingReminder[];
  count?: number;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class TaskService {
  constructor(private http: HttpClient) {}

  getTasks(): Observable<TaskResponse> {
    return this.http.get<TaskResponse>('/api/tasks');
  }

  createTask(task: Task): Observable<TaskResponse> {
    return this.http.post<TaskResponse>('/api/tasks', task);
  }

  updateTask(id: string, task: Task): Observable<TaskResponse> {
    return this.http.put<TaskResponse>(`/api/tasks/${id}`, task);
  }

  deleteTask(id: string): Observable<TaskResponse> {
    return this.http.delete<TaskResponse>(`/api/tasks/${id}`);
  }

  getUpcomingReminders(): Observable<UpcomingReminderResponse> {
    return this.http.get<UpcomingReminderResponse>('/api/tasks/reminders/upcoming');
  }

  dismissEnquiry(id: string): Observable<{ success: boolean; message?: string }> {
    return this.http.delete<{ success: boolean; message?: string }>(`/api/contact/${id}`);
  }
}
