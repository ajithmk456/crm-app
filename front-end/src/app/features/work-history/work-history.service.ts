import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface WorkHistoryItem {
  _id: string;
  type: 'message' | 'task' | 'assignment' | 'report' | 'payment';
  title: string;
  referenceId: string;
  taskId?: { _id: string; title: string } | string;
  clientId?: { _id: string; name: string; mobile: string } | string;
  employeeId?: { _id: string; fullName?: string; email?: string } | string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkHistoryResponse {
  success: boolean;
  count: number;
  data: WorkHistoryItem[];
}

export interface HistoryFilter {
  clientId?: string;
  taskId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class WorkHistoryService {
  constructor(private readonly http: HttpClient) {}

  getHistory(filter: HistoryFilter): Observable<WorkHistoryResponse> {
    let params = new HttpParams();
    if (filter.clientId) params = params.set('clientId', filter.clientId);
    if (filter.taskId) params = params.set('taskId', filter.taskId);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    params = params.set('limit', String(filter.limit || 200));

    return this.http.get<WorkHistoryResponse>('/api/history', { params });
  }
}
