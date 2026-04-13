import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface ChatConversation {
  _id: string;
  phoneNumber: string;
  lastMessage: string;
  updatedAt: string;
  createdAt?: string;
}

export interface ChatMessage {
  _id?: string;
  messageId: string;
  conversationId: string;
  from: string;
  to: string;
  text: string;
  type: string;
  direction: 'incoming' | 'outgoing';
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
  replyTo?: string;
  metadata?: ChatMessageMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessageMetadata {
  sourceChannel: 'meta-cloud-api' | 'meta-webhook-sandbox';
  campaign: string;
  journeyStep: string;
  confidence: number;
  tags: string[];
  payloadId: string;
}

export interface ApiListResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface SendMessageRequest {
  to: string;
  message: string;
}

export interface SendMessageResponse {
  success: boolean;
  data?: {
    provider?: string;
    messageId?: string;
  };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private readonly http: HttpClient) {}

  getConversations(): Observable<ApiListResponse<ChatConversation[]>> {
    return this.http.get<ApiListResponse<ChatConversation[]>>('/api/conversations');
  }

  getMessages(conversationId: string): Observable<ApiListResponse<ChatMessage[]>> {
    const params = new HttpParams().set('conversationId', conversationId);
    return this.http.get<ApiListResponse<ChatMessage[]>>('/api/messages', { params });
  }

  sendMessage(data: SendMessageRequest): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>('/api/messages/send', data);
  }
}