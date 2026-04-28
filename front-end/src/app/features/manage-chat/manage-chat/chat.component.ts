import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { Subject, interval, of } from 'rxjs';
import { catchError, startWith, switchMap, takeUntil } from 'rxjs/operators';
import {
  ChatConversation,
  ChatMessage,
  ChatMessageMetadata,
  ChatService,
  RealtimeChatEvent,
  SendMessageResponse,
} from './chat.service';

interface PendingMessage extends ChatMessage {
  isPending?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('messageScroller') private messageScroller?: ElementRef<HTMLDivElement>;

  conversations: ChatConversation[] = [];
  selectedConversation: ChatConversation | null = null;
  messages: PendingMessage[] = [];
  searchTerm = '';
  draftMessage = '';
  isLoadingConversations = false;
  isLoadingMessages = false;
  isSending = false;

  private readonly destroy$ = new Subject<void>();
  private readonly selectedConversation$ = new Subject<string>();
  private readonly mockCampaigns = ['Lead Reactivation', 'KYC Follow-up', 'Payment Reminder', 'Demo Scheduling'];
  private readonly mockJourneySteps = ['new-enquiry', 'documents-pending', 'awaiting-payment', 'follow-up'];
  private readonly mockTags = ['priority', 'ivr-transfer', 'repeat-user', 'new-user', 'escalation'];
  private readonly useMockData = !environment.production;
  private readonly mockConversations: ChatConversation[] = [
    {
      _id: 'mock-conv-1',
      phoneNumber: '+91 98765 43210',
      lastMessage: 'Can you share GST invoice details?',
      updatedAt: this.minutesAgoIso(2),
    },
    {
      _id: 'mock-conv-2',
      phoneNumber: '+91 91234 56789',
      lastMessage: 'Payment done. Please confirm receipt.',
      updatedAt: this.minutesAgoIso(8),
    },
    {
      _id: 'mock-conv-3',
      phoneNumber: '+91 99887 76655',
      lastMessage: 'Need callback at 5 PM regarding filing.',
      updatedAt: this.minutesAgoIso(16),
    },
  ];
  private readonly mockMessagesByConversation: Record<string, ChatMessage[]> = {
    'mock-conv-1': [
      {
        _id: 'mock-msg-1',
        messageId: 'mock-msg-1',
        conversationId: 'mock-conv-1',
        from: '+91 98765 43210',
        to: 'business',
        text: 'Hi, I need help with GST filing for March.',
        type: 'text',
        direction: 'incoming',
        status: 'read',
        timestamp: this.minutesAgoIso(18),
      },
      {
        _id: 'mock-msg-2',
        messageId: 'mock-msg-2',
        conversationId: 'mock-conv-1',
        from: 'business',
        to: '+91 98765 43210',
        text: 'Sure, please share your GSTIN and last month summary.',
        type: 'text',
        direction: 'outgoing',
        status: 'delivered',
        timestamp: this.minutesAgoIso(12),
      },
      {
        _id: 'mock-msg-3',
        messageId: 'mock-msg-3',
        conversationId: 'mock-conv-1',
        from: '+91 98765 43210',
        to: 'business',
        text: 'Can you share GST invoice details?',
        type: 'text',
        direction: 'incoming',
        status: 'read',
        timestamp: this.minutesAgoIso(2),
      },
    ],
    'mock-conv-2': [
      {
        _id: 'mock-msg-4',
        messageId: 'mock-msg-4',
        conversationId: 'mock-conv-2',
        from: '+91 91234 56789',
        to: 'business',
        text: 'I have transferred the pending amount today.',
        type: 'text',
        direction: 'incoming',
        status: 'read',
        timestamp: this.minutesAgoIso(25),
      },
      {
        _id: 'mock-msg-5',
        messageId: 'mock-msg-5',
        conversationId: 'mock-conv-2',
        from: 'business',
        to: '+91 91234 56789',
        text: 'Thank you. We will verify and update your ledger.',
        type: 'text',
        direction: 'outgoing',
        status: 'read',
        timestamp: this.minutesAgoIso(20),
      },
      {
        _id: 'mock-msg-6',
        messageId: 'mock-msg-6',
        conversationId: 'mock-conv-2',
        from: '+91 91234 56789',
        to: 'business',
        text: 'Payment done. Please confirm receipt.',
        type: 'text',
        direction: 'incoming',
        status: 'read',
        timestamp: this.minutesAgoIso(8),
      },
    ],
    'mock-conv-3': [
      {
        _id: 'mock-msg-7',
        messageId: 'mock-msg-7',
        conversationId: 'mock-conv-3',
        from: '+91 99887 76655',
        to: 'business',
        text: 'I am in a meeting now, can we talk later?',
        type: 'text',
        direction: 'incoming',
        status: 'read',
        timestamp: this.minutesAgoIso(35),
      },
      {
        _id: 'mock-msg-8',
        messageId: 'mock-msg-8',
        conversationId: 'mock-conv-3',
        from: 'business',
        to: '+91 99887 76655',
        text: 'No problem. Share a convenient time and we will call you.',
        type: 'text',
        direction: 'outgoing',
        status: 'delivered',
        timestamp: this.minutesAgoIso(30),
      },
      {
        _id: 'mock-msg-9',
        messageId: 'mock-msg-9',
        conversationId: 'mock-conv-3',
        from: '+91 99887 76655',
        to: 'business',
        text: 'Need callback at 5 PM regarding filing.',
        type: 'text',
        direction: 'incoming',
        status: 'read',
        timestamp: this.minutesAgoIso(16),
      },
    ],
  };
  private pendingMessages: PendingMessage[] = [];
  private shouldScrollToBottom = false;

  constructor(private readonly chatService: ChatService) {}

  ngOnInit(): void {
    this.startConversationPolling();
    this.startMessagePolling();
    this.startRealtimeUpdates();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredConversations(): ChatConversation[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.conversations;
    }

    return this.conversations.filter((conversation) => {
      return [conversation.phoneNumber, conversation.lastMessage]
        .some((value) => (value || '').toLowerCase().includes(term));
    });
  }

  get activeConversationTitle(): string {
    return this.selectedConversation?.phoneNumber || 'Select a conversation';
  }

  get canSend(): boolean {
    return !!this.selectedConversation && !!this.draftMessage.trim() && !this.isSending;
  }

  selectConversation(conversation: ChatConversation): void {
    if (this.selectedConversation?._id === conversation._id) {
      return;
    }

    this.selectedConversation = conversation;
    this.pendingMessages = [];
    this.messages = [];
    this.isLoadingMessages = true;
    this.selectedConversation$.next(conversation._id);
  }

  sendMessage(): void {
    const text = this.draftMessage.trim();
    if (!text || !this.selectedConversation || this.isSending) {
      return;
    }

    this.isSending = true;
    const selectedConversation = this.selectedConversation;

    if (this.isMockConversation(selectedConversation._id)) {
      this.isSending = false;
      this.addMockOutgoingMessage(text, selectedConversation);
      this.draftMessage = '';
      this.syncSelectedConversationPreview(text, selectedConversation._id);
      this.queueScrollToBottom();
      return;
    }

    this.chatService.sendMessage({
      to: selectedConversation.phoneNumber,
      message: text,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.isSending = false;
        this.addPendingOutgoingMessage(text, response, selectedConversation);
        this.draftMessage = '';
        this.syncSelectedConversationPreview(text, selectedConversation._id);
        this.queueScrollToBottom();
      },
      error: () => {
        this.isSending = false;
      }
    });
  }

  trackConversation(_: number, conversation: ChatConversation): string {
    return conversation._id;
  }

  trackMessage(_: number, message: PendingMessage): string {
    return message.messageId || message._id || `${message.timestamp}-${message.text}`;
  }

  private startConversationPolling(): void {
    interval(4000).pipe(
      startWith(0),
      switchMap(() => {
        this.isLoadingConversations = !this.conversations.length;
        return this.chatService.getConversations().pipe(
          catchError(() => of({ success: false, data: [] as ChatConversation[] }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((response) => {
      this.isLoadingConversations = false;

      const apiConversations = response.success ? response.data : [];
      const fallbackConversations = this.useMockData && !apiConversations.length
        ? this.mockConversations
        : [];
      const conversationsToRender = apiConversations.length ? apiConversations : fallbackConversations;

      if (!conversationsToRender.length) {
        this.conversations = [];
        return;
      }

      const previousSelectionId = this.selectedConversation?._id;
      this.conversations = [...conversationsToRender].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      if (previousSelectionId) {
        const refreshedSelection = this.conversations.find((item) => item._id === previousSelectionId);
        if (refreshedSelection) {
          this.selectedConversation = refreshedSelection;
          return;
        }
      }

      if (!this.selectedConversation && this.conversations.length) {
        this.selectConversation(this.conversations[0]);
      }
    });
  }

  private startMessagePolling(): void {
    this.selectedConversation$.pipe(
      switchMap((conversationId) => {
        if (this.isMockConversation(conversationId)) {
          return interval(4000).pipe(
            startWith(0),
            switchMap(() => {
              this.isLoadingMessages = !this.messages.length;
              return of({
                success: true,
                data: [...(this.mockMessagesByConversation[conversationId] || [])],
              });
            })
          );
        }

        return interval(4000).pipe(
          startWith(0),
          switchMap(() => {
            this.isLoadingMessages = !this.messages.length;
            return this.chatService.getMessages(conversationId).pipe(
              catchError(() => of({ success: false, data: [] as ChatMessage[] }))
            );
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((response) => {
      this.isLoadingMessages = false;
      if (!response.success) {
        return;
      }

      this.messages = this.mergePendingMessages(this.withMockMetadata(response.data));
      this.queueScrollToBottom();
    });
  }

  private startRealtimeUpdates(): void {
    this.chatService.onRealtimeUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        this.handleRealtimeUpdate(event);
      });
  }

  private handleRealtimeUpdate(event: RealtimeChatEvent): void {
    if (!this.selectedConversation || this.isMockConversation(this.selectedConversation._id)) {
      return;
    }

    const selectedPhone = this.normalizePhone(this.selectedConversation.phoneNumber);
    const eventPhone = this.normalizePhone(event.phone || event.destination || event.source || '');

    if (!eventPhone || selectedPhone !== eventPhone) {
      return;
    }

    this.selectedConversation$.next(this.selectedConversation._id);
  }

  private normalizePhone(value: string): string {
    return String(value || '').replace(/^whatsapp:/i, '').trim();
  }

  private addPendingOutgoingMessage(
    text: string,
    response: SendMessageResponse,
    conversation: ChatConversation
  ): void {
    const now = new Date().toISOString();
    const pendingMessage: PendingMessage = {
      _id: `pending-${Date.now()}`,
      messageId: response.data?.messageId || `pending-${Date.now()}`,
      conversationId: conversation._id,
      from: 'me',
      to: conversation.phoneNumber,
      text,
      type: 'text',
      direction: 'outgoing',
      status: 'sent',
      timestamp: now,
      metadata: this.buildMockMetadata(
        {
          messageId: response.data?.messageId || `pending-${Date.now()}`,
          direction: 'outgoing',
          type: 'text',
          text,
        },
        0
      ),
      isPending: true,
    };

    this.pendingMessages = [...this.pendingMessages, pendingMessage];
    this.messages = this.mergePendingMessages(this.messages);
  }

  private mergePendingMessages(serverMessages: ChatMessage[]): PendingMessage[] {
    const seenIds = new Set(serverMessages.map((message) => message.messageId));
    this.pendingMessages = this.pendingMessages.filter((message) => !seenIds.has(message.messageId));

    return [...serverMessages, ...this.pendingMessages].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  private withMockMetadata(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((message, index) => {
      if (message.metadata) {
        return message;
      }

      return {
        ...message,
        metadata: this.buildMockMetadata(message, index),
      };
    });
  }

  private buildMockMetadata(message: Pick<ChatMessage, 'messageId' | 'direction' | 'text' | 'type'>, index: number): ChatMessageMetadata {
    const seed = this.hashSeed(`${message.messageId}-${message.type}-${index}`);
    const campaign = this.mockCampaigns[seed % this.mockCampaigns.length];
    const journeyStep = this.mockJourneySteps[(seed + 1) % this.mockJourneySteps.length];
    const primaryTag = this.mockTags[(seed + 2) % this.mockTags.length];
    const secondaryTag = this.mockTags[(seed + 3) % this.mockTags.length];

    return {
      sourceChannel: message.direction === 'outgoing' ? 'meta-cloud-api' : 'meta-webhook-sandbox',
      campaign,
      journeyStep,
      confidence: Number((0.72 + ((seed % 25) / 100)).toFixed(2)),
      tags: [primaryTag, secondaryTag],
      payloadId: `mock-meta-${message.messageId.slice(0, 10)}`,
    };
  }

  private hashSeed(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    return Math.abs(hash);
  }

  private isMockConversation(conversationId: string): boolean {
    return conversationId.startsWith('mock-conv-');
  }

  private addMockOutgoingMessage(text: string, conversation: ChatConversation): void {
    const now = new Date().toISOString();
    const messageId = `mock-msg-local-${Date.now()}`;
    const nextMessage: ChatMessage = {
      _id: messageId,
      messageId,
      conversationId: conversation._id,
      from: 'business',
      to: conversation.phoneNumber,
      text,
      type: 'text',
      direction: 'outgoing',
      status: 'read',
      timestamp: now,
      metadata: this.buildMockMetadata(
        {
          messageId,
          direction: 'outgoing',
          type: 'text',
          text,
        },
        0
      ),
    };

    const existing = this.mockMessagesByConversation[conversation._id] || [];
    this.mockMessagesByConversation[conversation._id] = [...existing, nextMessage];
    this.messages = this.mergePendingMessages(this.withMockMetadata(this.mockMessagesByConversation[conversation._id]));
  }

  private minutesAgoIso(minutes: number): string {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
  }

  private syncSelectedConversationPreview(text: string, conversationId: string): void {
    this.conversations = this.conversations.map((conversation) => {
      if (conversation._id !== conversationId) {
        return conversation;
      }

      return {
        ...conversation,
        lastMessage: text,
        updatedAt: new Date().toISOString(),
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (this.selectedConversation?._id === conversationId) {
      const refreshedSelection = this.conversations.find((conversation) => conversation._id === conversationId) || null;
      this.selectedConversation = refreshedSelection;
    }
  }

  private queueScrollToBottom(): void {
    this.shouldScrollToBottom = true;
    setTimeout(() => this.scrollToBottom(), 0);
  }

  private scrollToBottom(): void {
    if (!this.shouldScrollToBottom) {
      return;
    }

    const container = this.messageScroller?.nativeElement;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    this.shouldScrollToBottom = false;
  }
}