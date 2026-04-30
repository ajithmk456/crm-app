import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';

export interface ChatConversation {
  _id: string;
  phoneNumber: string;
  clientName?: string;
  lastMessage: string;
  unreadCount?: number;
  lastReadAt?: string | null;
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
  type: 'text' | 'file';
  fileUrl?: string;
  filename?: string;
  mimeType?: string;
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
  text: string;
  message?: string;
}

export interface SendMessageResponse {
  success: boolean;
  data?: {
    provider?: string;
    messageId?: string;
    type?: 'text' | 'template';
  };
  message?: string;
}

export interface UploadFileResponse {
  success: boolean;
  data?: {
    url: string;
    filename: string;
    mimeType: string;
  };
  message?: string;
}

export interface UploadFileProgressEvent {
  done: boolean;
  progress: number;
  data?: UploadFileResponse['data'];
  message?: string;
}

export interface SendFileRequest {
  to: string;
  fileUrl: string;
  filename: string;
  mimeType?: string;
}

export interface SendTemplateRequest {
  to: string;
  templateId: string;
  params: string[];
}

export interface RealtimeChatEvent {
  eventType: 'incoming' | 'outgoing' | 'status' | 'read';
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
  private readonly apiBaseUrl = String(environment.apiBaseUrl || '').replace(/\/$/, '');
  private readonly socketBaseUrl = this.apiBaseUrl || window.location.origin;

  constructor(private readonly http: HttpClient) {
    this.socket = io(this.socketBaseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }

  onSocketConnectionState(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      const emitState = () => subscriber.next(this.socket.connected);
      const onConnect = () => subscriber.next(true);
      const onDisconnect = () => subscriber.next(false);

      emitState();
      this.socket.on('connect', onConnect);
      this.socket.on('disconnect', onDisconnect);

      return () => {
        this.socket.off('connect', onConnect);
        this.socket.off('disconnect', onDisconnect);
      };
    });
  }

  getConversations(): Observable<ApiListResponse<ChatConversation[]>> {
    return this.http.get<ApiListResponse<ChatConversation[]>>('/api/chat/conversations');
  }

  getMessages(conversationId: string): Observable<ApiListResponse<ChatMessage[]>> {
    return this.http.get<ApiListResponse<any[]>>(`/api/chat/${encodeURIComponent(conversationId)}`).pipe(
      map((response) => ({
        ...response,
        data: (response.data || []).reduce<ChatMessage[]>((acc, item) => {
          const normalizedText = String(item.text || '').trim();
          const rawFileUrl = String(item.fileUrl || item.url || '').trim();
          const fileUrl = this.toAbsoluteFileUrl(rawFileUrl);
          const inferredNameFromUrl = fileUrl ? decodeURIComponent(fileUrl.split('?')[0].split('/').pop() || '') : '';
          const filename = String(item.filename || inferredNameFromUrl || '').trim();
          const mimeType = String(item.mimeType || item.mimetype || '').trim();
          const rawType = String(item.type || 'text').toLowerCase();
          const looksLikeMediaText = ['image', 'document', 'video', 'audio', 'file', 'sticker'].includes(normalizedText.toLowerCase());
          const isFileMessage = rawType === 'file' || Boolean(fileUrl || filename || looksLikeMediaText);

          if (!normalizedText && !isFileMessage) {
            return acc;
          }

          const normalizedDirection = String(item.direction || '').toLowerCase();
          const isIncoming = normalizedDirection === 'in' || normalizedDirection === 'incoming';
          const normalizedStatus = String(item.status || 'sent').toLowerCase();
          const phone = String(item.phone || conversationId);

          acc.push({
            _id: item.messageId,
            messageId: item.messageId,
            conversationId,
            from: isIncoming ? phone : 'business',
            to: isIncoming ? 'business' : phone,
            text: normalizedText || filename || inferredNameFromUrl || 'Attachment',
            type: isFileMessage ? 'file' : 'text',
            fileUrl: fileUrl || undefined,
            filename: (filename || normalizedText || inferredNameFromUrl) || undefined,
            mimeType: mimeType || undefined,
            direction: isIncoming ? 'incoming' : 'outgoing',
            status: (['sent', 'delivered', 'read', 'failed'].includes(normalizedStatus) ? normalizedStatus : 'sent') as ChatMessage['status'],
            timestamp: item.timestamp,
          });

          return acc;
        }, []),
      }))
    );
  }

  sendMessage(data: SendMessageRequest): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>('/api/chat/send', {
      to: data.to,
      text: data.text,
      message: data.message || data.text,
    });
  }

  uploadFile(file: File): Observable<UploadFileProgressEvent> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadFileResponse>('/api/files/upload', formData, {
      observe: 'events',
      reportProgress: true,
    }).pipe(
      map((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total || 1;
          return {
            done: false,
            progress: Math.min(100, Math.round((event.loaded / total) * 100)),
          } as UploadFileProgressEvent;
        }

        if (event.type === HttpEventType.Response) {
          return {
            done: true,
            progress: 100,
            data: event.body?.data,
            message: event.body?.message,
          } as UploadFileProgressEvent;
        }

        return {
          done: false,
          progress: 0,
        } as UploadFileProgressEvent;
      })
    );
  }

  sendFile(data: SendFileRequest): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>('/api/chat/send-file', data);
  }

  sendTemplate(data: SendTemplateRequest): Observable<SendMessageResponse> {
    return this.http.post<SendMessageResponse>('/api/chat/send-template', data);
  }

  markConversationAsRead(phone: string): Observable<{ success: boolean; data?: { phoneNumber: string; unreadCount: number; lastReadAt?: string | null } }> {
    return this.http.post<{ success: boolean; data?: { phoneNumber: string; unreadCount: number; lastReadAt?: string | null } }>(`/api/chat/${encodeURIComponent(phone)}/read`, {});
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

  private toAbsoluteFileUrl(url: string): string {
    const normalized = String(url || '').trim();
    if (!normalized) {
      return '';
    }

    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }

    if (normalized.startsWith('/')) {
      return this.apiBaseUrl ? `${this.apiBaseUrl}${normalized}` : normalized;
    }

    return this.apiBaseUrl ? `${this.apiBaseUrl}/${normalized}` : normalized;
  }
}