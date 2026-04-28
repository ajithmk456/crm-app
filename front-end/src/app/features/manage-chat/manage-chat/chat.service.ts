import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

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
  status: 'sent' | 'delivered' | 'read' | 'failed';
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

export interface RealtimeChatEvent {
  eventType: 'incoming' | 'outgoing' | 'status';
  phone: string;
  messageId?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  text?: string;
  source?: string;
  destination?: string;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly socket: Socket;

  constructor(private readonly http: HttpClient) {
    this.socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }

  getConversations(): Observable<ApiListResponse<ChatConversation[]>> {
    return this.http.get<ApiListResponse<ChatConversation[]>>('/api/chat/conversations');
  }

  getMessages(conversationId: string): Observable<ApiListResponse<ChatMessage[]>> {
    return this.http.get<ApiListResponse<any[]>>(`/api/chat/${encodeURIComponent(conversationId)}`).pipe(
      map((response) => ({
        ...response,
        data: (response.data || []).map((item) => {
          const isIncoming = String(item.direction || '').toLowerCase() === 'in';
          const phone = String(item.phone || conversationId);

          return {
            _id: item.messageId,
            messageId: item.messageId,
            conversationId,
            from: isIncoming ? phone : 'business',
            to: isIncoming ? 'business' : phone,
            text: item.text || '',
            type: 'text',
            direction: isIncoming ? 'incoming' : 'outgoing',
            status: item.status || 'sent',
            timestamp: item.timestamp,
          } satisfies ChatMessage;
        }),
      }))
    );
  }

  sendMessage(data: SendMessageRequest): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>('/api/chat/send', data);
  }

  onRealtimeUpdates(): Observable<RealtimeChatEvent> {
    return new Observable<RealtimeChatEvent>((subscriber) => {
      const handler = (event: RealtimeChatEvent) => subscriber.next(event);
      this.socket.on('chat:update', handler);

      return () => {
        this.socket.off('chat:update', handler);
      };
    });
  }
}