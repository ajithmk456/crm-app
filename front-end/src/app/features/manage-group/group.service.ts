import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface GroupContact {
  name?: string;
  phone: string;
}

export interface GroupClient {
  _id?: string;
  name: string;
  mobile: string;
  notes?: string;
}

export interface Group {
  _id?: string;
  name: string;
  contacts: GroupContact[];
  clients?: (string | GroupClient)[]; // Can be IDs or populated client objects
  numbers?: string[]; // For UI compatibility
}

export interface GroupResponse {
  success: boolean;
  data: Group | Group[] | null;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  constructor(private http: HttpClient) {}

  getGroups(search = ''): Observable<GroupResponse> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<GroupResponse>('/api/groups', { params });
  }

  getGroupById(id: string): Observable<GroupResponse> {
    return this.http.get<GroupResponse>(`/api/groups/${id}`);
  }

  createGroup(group: { name: string; contacts?: GroupContact[]; clients?: string[] }): Observable<GroupResponse> {
    return this.http.post<GroupResponse>('/api/groups', group);
  }

  updateGroup(id: string, group: { name?: string; contacts?: GroupContact[]; clients?: string[] }): Observable<GroupResponse> {
    return this.http.put<GroupResponse>(`/api/groups/${id}`, group);
  }

  deleteGroup(id: string): Observable<GroupResponse> {
    return this.http.delete<GroupResponse>(`/api/groups/${id}`);
  }

  assignClientsToGroup(groupId: string, clientIds: string[]): Observable<GroupResponse> {
    return this.http.post<GroupResponse>(`/api/groups/${groupId}/assign-clients`, { clientIds });
  }
}
