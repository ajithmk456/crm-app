import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Subject, interval, of } from 'rxjs';
import { catchError, startWith, switchMap, takeUntil } from 'rxjs/operators';
import {
  ChatConversation,
  ChatMessage,
  ChatMessageMetadata,
  ChatService,
  RealtimeChatEvent,
  SendFileRequest,
} from './chat.service';

interface PendingMessage extends ChatMessage {
  isPending?: boolean;
}

interface SelectedAttachment {
  file: File;
  name: string;
  mimeType: string;
  isImage: boolean;
  isPdf: boolean;
  previewUrl?: string;
  previewResourceUrl?: SafeResourceUrl | null;
}

interface ActiveFileViewer {
  url: string;
  name: string;
  mimeType: string;
  isImage: boolean;
  isPdf: boolean;
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
  @ViewChild('imageAttachmentInput') private imageAttachmentInput?: ElementRef<HTMLInputElement>;
  @ViewChild('documentAttachmentInput') private documentAttachmentInput?: ElementRef<HTMLInputElement>;

  conversations: ChatConversation[] = [];
  selectedConversation: ChatConversation | null = null;
  messages: PendingMessage[] = [];
  searchTerm = '';
  conversationFilter: 'all' | 'unread' = 'all';
  draftMessage = '';
  attachmentCaption = '';
  isLoadingConversations = false;
  isLoadingMessages = false;
  isSending = false;
  isUploadingAttachment = false;
  uploadProgress = 0;
  sessionState: 'active' | 'expired' = 'active';
  showScrollToBottomButton = false;
  unreadNewMessages = 0;
  selectedAttachment: SelectedAttachment | null = null;
  attachmentQueue: SelectedAttachment[] = [];
  activeAttachmentIndex = -1;
  retryingMessageId: string | null = null;
  activeFileViewer: ActiveFileViewer | null = null;
  activeFileViewerResourceUrl: SafeResourceUrl | null = null;
  isPdfViewerLoading = false;
  isViewerDownloadInProgress = false;
  showAttachmentMenu = false;
  showEmojiPicker = false;
  activeMessageMenuId: string | null = null;
  socketConnected = false;
  readonly quickEmojis = ['😀', '😂', '😊', '😍', '👍', '🙏', '🔥', '🎉', '❤️', '✅', '📌', '👋'];
  private readonly draftStorageKey = 'manage-chat-drafts-v1';

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
  private outgoingFileCaptionByMessageId: Record<string, string> = {};
  private forceScrollOnNextMessageUpdate = false;
  private targetConversationPhone = '';
  private hasSanitizedPhoneQueryParam = false;
  private draftByConversationId: Record<string, string> = {};
  private lastConversationFetchAt = 0;
  private readonly optimisticImagePreviewUrls = new Set<string>();
  private readonly brokenInlineImageMessageIds = new Set<string>();
  private readonly loadedInlineImageMessageIds = new Set<string>();
  isFullscreen = false;

  constructor(
    private readonly chatService: ChatService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDraftCache();

    this.chatService.onSocketConnectionState()
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        this.socketConnected = connected;
        if (connected) {
          this.refreshConversationsFromApi();
          if (this.selectedConversation) {
            this.selectedConversation$.next(this.selectedConversation._id);
          }
        }
      });

    const statePhone = this.normalizePhone(window.history.state?.targetPhone || '');
    if (statePhone) {
      this.targetConversationPhone = statePhone;
    }

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const queryPhone = this.normalizePhone(params.get('phone') || '');
        if (queryPhone) {
          this.targetConversationPhone = queryPhone;
        }

        if (params.has('phone') && !this.hasSanitizedPhoneQueryParam) {
          this.hasSanitizedPhoneQueryParam = true;
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { phone: null },
            queryParamsHandling: 'merge',
            replaceUrl: true,
          });
        }

        if (!this.targetConversationPhone) {
          return;
        }

        this.trySelectTargetConversation();
      });

    this.startConversationPolling();
    this.startMessagePolling();
    this.startRealtimeUpdates();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    document.body.classList.toggle('chat-fullscreen', this.isFullscreen);
  }

  ngOnDestroy(): void {
    document.body.classList.remove('chat-fullscreen');
    this.resetAttachmentDraftState();
    this.activeFileViewer = null;
    this.activeFileViewerResourceUrl = null;
    this.optimisticImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    this.optimisticImagePreviewUrls.clear();
    this.brokenInlineImageMessageIds.clear();
    this.loadedInlineImageMessageIds.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredConversations(): ChatConversation[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.conversations.filter((conversation) => {
      if (this.conversationFilter === 'unread' && this.getUnreadCount(conversation._id) <= 0) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [conversation.clientName || '', conversation.phoneNumber, conversation.lastMessage]
        .some((value) => (value || '').toLowerCase().includes(term));
    });
  }

  get totalUnreadConversations(): number {
    return this.conversations.reduce((count, conversation) => {
      return count + (this.getUnreadCount(conversation._id) > 0 ? 1 : 0);
    }, 0);
  }

  get activeConversationTitle(): string {
    return this.selectedConversation?.clientName || this.selectedConversation?.phoneNumber || 'Select a conversation';
  }

  get canSend(): boolean {
    return (
      !!this.selectedConversation
      && (!!this.draftMessage.trim() || this.hasAttachmentDrafts)
      && !this.isSending
      && !this.isUploadingAttachment
    );
  }

  get canSendAttachmentPreview(): boolean {
    return !!this.selectedConversation && this.attachmentQueue.length > 0 && !this.isSending && !this.isUploadingAttachment;
  }

  get isImageAttachmentSelected(): boolean {
    const attachment = this.selectedAttachment;
    if (!attachment) {
      return false;
    }

    return attachment.isImage;
  }

  get isPdfAttachmentSelected(): boolean {
    const attachment = this.selectedAttachment;
    if (!attachment) {
      return false;
    }

    return attachment.isPdf;
  }

  get hasAttachmentDrafts(): boolean {
    return this.attachmentQueue.length > 0;
  }

  get isSessionActive(): boolean {
    return this.sessionState === 'active';
  }

  get sessionStateLabel(): string {
    return this.isSessionActive ? 'Active session' : 'Session expired';
  }

  selectConversation(conversation: ChatConversation): void {
    const wasAlreadySelected = this.selectedConversation?._id === conversation._id;

    this.selectedConversation = conversation;
    this.draftMessage = this.draftByConversationId[conversation._id] || '';
    this.markConversationAsRead(conversation, true);

    if (wasAlreadySelected) {
      return;
    }

    this.pendingMessages = [];
    this.messages = [];
    this.isLoadingMessages = true;
    this.showScrollToBottomButton = false;
    this.unreadNewMessages = 0;
    this.forceScrollOnNextMessageUpdate = true;
    this.selectedConversation$.next(conversation._id);
  }

  setConversationFilter(filter: 'all' | 'unread'): void {
    this.conversationFilter = filter;
  }

  getUnreadCount(conversationId: string): number {
    const conversation = this.conversations.find((item) => item._id === conversationId);
    return Number(conversation?.unreadCount || 0);
  }

  onDraftChanged(): void {
    if (!this.selectedConversation) {
      return;
    }

    this.draftByConversationId = {
      ...this.draftByConversationId,
      [this.selectedConversation._id]: this.draftMessage,
    };
    this.persistDraftCache();
  }

  sendMessage(): void {
    const text = this.draftMessage.trim();
    const attachmentText = this.attachmentCaption.trim();
    if (!this.selectedConversation || this.isSending || this.isUploadingAttachment) {
      return;
    }

    if (this.hasAttachmentDrafts) {
      this.sendAttachmentMessage(this.selectedConversation, attachmentText);
      return;
    }

    if (!text) {
      return;
    }

    const selectedConversation = this.selectedConversation;
    const localPendingId = this.buildLocalPendingMessageId();

    this.addOptimisticOutgoingMessage(text, selectedConversation, localPendingId);
    this.draftMessage = '';
    this.onDraftChanged();
    this.syncSelectedConversationPreview(text, selectedConversation._id);
    this.queueScrollToBottom(true);

    this.isSending = true;

    if (this.isMockConversation(selectedConversation._id)) {
      this.isSending = false;
      this.resolvePendingMessage(localPendingId, `mock-${Date.now()}`);
      return;
    }

    this.chatService.sendMessage({
      to: selectedConversation.phoneNumber,
      text,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.isSending = false;
        const messageType = String(response.data?.type || 'text').toLowerCase();
        this.resolvePendingMessage(
          localPendingId,
          response.data?.messageId,
          messageType === 'template' ? { text: `${text}\n(Template sent - session expired)` } : undefined
        );
      },
      error: () => {
        this.isSending = false;
        this.markPendingMessageFailed(localPendingId);
      }
    });
  }

  toggleAttachmentMenu(): void {
    if (this.isSending || this.isUploadingAttachment) {
      return;
    }

    this.showAttachmentMenu = !this.showAttachmentMenu;
    if (this.showAttachmentMenu) {
      this.showEmojiPicker = false;
    }
  }

  openAttachmentType(type: 'image' | 'document'): void {
    this.showAttachmentMenu = false;

    if (type === 'image') {
      this.imageAttachmentInput?.nativeElement.click();
      return;
    }

    this.documentAttachmentInput?.nativeElement.click();
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
    if (this.showEmojiPicker) {
      this.showAttachmentMenu = false;
    }
  }

  insertEmoji(emoji: string): void {
    this.draftMessage += emoji;
    this.showEmojiPicker = false;
  }

  onAttachmentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const normalizedMimeType = String(file.type || '').toLowerCase();
    const normalizedName = String(file.name || '').toLowerCase();
    const isImage = normalizedMimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(normalizedName);
    const isPdf = normalizedMimeType.includes('pdf') || normalizedName.endsWith('.pdf');
    const previewUrl = (isImage || isPdf) ? URL.createObjectURL(file) : undefined;
    const previewResourceUrl = (isPdf && previewUrl)
      ? this.sanitizer.bypassSecurityTrustResourceUrl(previewUrl)
      : null;

    this.attachmentQueue = [
      ...this.attachmentQueue,
      {
        file,
        name: file.name,
        mimeType: file.type,
        isImage,
        isPdf,
        previewUrl,
        previewResourceUrl,
      }
    ];
    this.activeAttachmentIndex = this.attachmentQueue.length - 1;
    this.selectedAttachment = this.attachmentQueue[this.activeAttachmentIndex] || null;
    this.showAttachmentMenu = false;
    this.showEmojiPicker = false;
    this.queueScrollToBottom(true);
  }

  removeSelectedAttachment(): void {
    if (this.activeAttachmentIndex < 0 || this.activeAttachmentIndex >= this.attachmentQueue.length) {
      this.resetAttachmentDraftState();
      return;
    }

    const removed = this.attachmentQueue[this.activeAttachmentIndex];
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
    }

    this.attachmentQueue = this.attachmentQueue.filter((_, index) => index !== this.activeAttachmentIndex);
    if (!this.attachmentQueue.length) {
      this.resetAttachmentDraftState();
      return;
    }

    this.activeAttachmentIndex = Math.min(this.activeAttachmentIndex, this.attachmentQueue.length - 1);
    this.selectedAttachment = this.attachmentQueue[this.activeAttachmentIndex] || null;
  }

  selectAttachmentDraft(index: number): void {
    if (index < 0 || index >= this.attachmentQueue.length) {
      return;
    }

    this.activeAttachmentIndex = index;
    this.selectedAttachment = this.attachmentQueue[index];
  }

  removeAttachmentDraft(index: number): void {
    if (index < 0 || index >= this.attachmentQueue.length) {
      return;
    }

    this.activeAttachmentIndex = index;
    this.removeSelectedAttachment();
  }

  getAttachmentPreviewLabel(index: number): string {
    const item = this.attachmentQueue[index];
    if (!item) {
      return '';
    }

    return item.name || `Attachment ${index + 1}`;
  }

  isActiveAttachmentDraft(index: number): boolean {
    return index === this.activeAttachmentIndex;
  }

  addAnotherAttachment(type: 'image' | 'document'): void {
    this.openAttachmentType(type);
  }

  private resetAttachmentDraftState(): void {
    this.attachmentQueue.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });

    this.selectedAttachment = null;
    this.attachmentQueue = [];
    this.activeAttachmentIndex = -1;
    this.attachmentCaption = '';
    if (this.imageAttachmentInput?.nativeElement) {
      this.imageAttachmentInput.nativeElement.value = '';
    }
    if (this.documentAttachmentInput?.nativeElement) {
      this.documentAttachmentInput.nativeElement.value = '';
    }
  }

  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.showEmojiPicker = false;
    this.showAttachmentMenu = false;
    this.sendMessage();
  }

  onMessageStreamScroll(): void {
    this.activeMessageMenuId = null;

    if (!this.isNearBottom()) {
      return;
    }

    this.showScrollToBottomButton = false;
    this.unreadNewMessages = 0;
  }

  scrollToLatest(): void {
    this.queueScrollToBottom(true);
  }

  trackConversation(_: number, conversation: ChatConversation): string {
    return conversation._id;
  }

  trackMessage(_: number, message: PendingMessage): string {
    return message.messageId || message._id || `${message.timestamp}-${message.text}`;
  }

  shouldShowDateSeparator(index: number): boolean {
    if (index <= 0 || index >= this.messages.length) {
      return index === 0;
    }

    const currentKey = this.getDateGroupingKey(this.messages[index]?.timestamp);
    const previousKey = this.getDateGroupingKey(this.messages[index - 1]?.timestamp);
    return currentKey !== previousKey;
  }

  getDateSeparatorLabel(timestamp: string): string {
    const messageDate = this.toDateOnly(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (messageDate.getTime() === today.getTime()) {
      return 'Today';
    }

    if (messageDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    return messageDate.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  retryFailedMessage(message: PendingMessage): void {
    if (!this.selectedConversation || message.status !== 'failed' || this.retryingMessageId) {
      return;
    }

    if (this.isFileMessage(message)) {
      this.retryFailedFileMessage(message);
      return;
    }

    const retryText = String(message.text || '').trim();
    if (!retryText) {
      return;
    }

    const localPendingId = this.buildLocalPendingMessageId();
    this.addOptimisticOutgoingMessage(retryText, this.selectedConversation, localPendingId);
    this.queueScrollToBottom(true);
    this.retryingMessageId = message.messageId;

    this.chatService.sendMessage({
      to: this.selectedConversation.phoneNumber,
      text: retryText,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.retryingMessageId = null;
        const messageType = String(response.data?.type || 'text').toLowerCase();
        this.resolvePendingMessage(
          localPendingId,
          response.data?.messageId,
          messageType === 'template' ? { text: `${retryText}\n(Template sent - session expired)` } : undefined
        );
      },
      error: () => {
        this.retryingMessageId = null;
        this.markPendingMessageFailed(localPendingId);
      },
    });
  }

  toggleMessageMenu(message: PendingMessage, event: Event): void {
    event.stopPropagation();
    const menuId = this.getMessageMenuId(message);
    this.activeMessageMenuId = this.activeMessageMenuId === menuId ? null : menuId;
  }

  closeMessageMenu(event?: Event): void {
    event?.stopPropagation();
    this.activeMessageMenuId = null;
  }

  createTaskFromMessage(message: PendingMessage, event: Event): void {
    event.stopPropagation();
    this.activeMessageMenuId = null;

    const conversation = this.selectedConversation;
    if (!conversation) {
      return;
    }

    const rawText = String(message.text || message.filename || '').trim();
    const description = rawText || 'Follow up with customer from WhatsApp chat.';
    const title = this.buildTaskTitleFromMessage(description);
    const customerName = String(conversation.clientName || '').trim();
    const customerPhone = String(conversation.phoneNumber || '').trim();

    this.router.navigate(['/manage-task'], {
      state: {
        taskPrefill: {
          title,
          description,
          customerName,
          customerPhone,
        },
      },
    });
  }

  getMessageMenuId(message: PendingMessage): string {
    return message.messageId || message._id || `${message.timestamp}-${message.text}`;
  }

  isFileMessage(message: PendingMessage): boolean {
    return Boolean(message.fileUrl || message.filename);
  }

  isImageFileMessage(message: PendingMessage): boolean {
    if (!this.isFileMessage(message)) {
      return false;
    }

    const fileName = String(message.filename || '').toLowerCase();
    const mimeType = String(message.mimeType || '').toLowerCase();
    const fileUrl = String(message.fileUrl || '').toLowerCase();
    const fallbackText = String(message.text || '').toLowerCase();
    return (
      mimeType.startsWith('image/')
      || /\.(png|jpe?g|gif|webp)$/i.test(fileName)
      || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(fileUrl)
      || fallbackText === 'image'
      || fileUrl.includes('filemanager.gupshup.io')
    );
  }

  shouldRenderImagePreview(message: PendingMessage): boolean {
    const messageId = this.getMessageMenuId(message);
    return this.isImageFileMessage(message) && Boolean(message.fileUrl) && !this.brokenInlineImageMessageIds.has(messageId);
  }

  onInlineImageError(message: PendingMessage): void {
    const messageId = this.getMessageMenuId(message);
    this.brokenInlineImageMessageIds.add(messageId);
    this.loadedInlineImageMessageIds.add(messageId);
  }

  onInlineImageLoad(message: PendingMessage): void {
    const messageId = this.getMessageMenuId(message);
    this.loadedInlineImageMessageIds.add(messageId);
    // Force scroll to bottom once image expands the container.
    this.queueScrollToBottom(true, true);
  }

  isInlineImageLoaded(message: PendingMessage): boolean {
    return this.loadedInlineImageMessageIds.has(this.getMessageMenuId(message));
  }

  onAttachmentCaptionKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.sendMessage();
  }

  canRetryMessage(message: PendingMessage): boolean {
    if (message.status !== 'failed' || !this.selectedConversation) {
      return false;
    }

    if (!this.isFileMessage(message)) {
      return Boolean(String(message.text || '').trim());
    }

    return Boolean(message.fileUrl && message.filename);
  }

  getFileIconClass(message: PendingMessage): string {
    const fileName = String(message.filename || '').toLowerCase();
    const mimeType = String(message.mimeType || '').toLowerCase();

    if (fileName.endsWith('.pdf') || mimeType.includes('pdf')) {
      return 'fa-file-pdf';
    }

    if (
      fileName.endsWith('.jpg')
      || fileName.endsWith('.jpeg')
      || fileName.endsWith('.png')
      || mimeType.startsWith('image/')
    ) {
      return 'fa-file-image';
    }

    if (fileName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
      return 'fa-file-word';
    }

    if (fileName.endsWith('.xlsx') || mimeType.includes('spreadsheetml')) {
      return 'fa-file-excel';
    }

    return 'fa-file';
  }

  isPdfFileMessage(message: PendingMessage): boolean {
    if (!this.isFileMessage(message)) {
      return false;
    }

    const fileName = String(message.filename || '').toLowerCase();
    const mimeType = String(message.mimeType || '').toLowerCase();
    const fileUrl = this.normalizeFileUrl(String(message.fileUrl || '')).toLowerCase();
    const fallbackText = String(message.text || '').toLowerCase();

    return (
      mimeType.includes('pdf')
      || fileName.endsWith('.pdf')
      || /\.pdf(\?|$)/i.test(fileUrl)
      || fallbackText.endsWith('.pdf')
    );
  }

  openFileViewer(message: PendingMessage): void {
    const fileUrl = this.normalizeFileUrl(String(message.fileUrl || ''));
    if (!fileUrl) {
      return;
    }

    const name = String(message.filename || message.text || 'Attachment');
    const mimeType = this.resolveMessageMimeType(message);
    const isImage = this.isImageFileMessage(message);
    const isPdf = this.isPdfFileMessage(message);

    // PDFs from external sources (e.g. Gupshup) can't be embedded via Google Docs viewer
    // because those URLs redirect to signed download links. Open directly in a new tab
    // where the browser's native PDF viewer handles it reliably.
    if (isPdf) {
      window.open(fileUrl, '_blank', 'noopener');
      return;
    }

    this.activeFileViewer = {
      url: fileUrl,
      name,
      mimeType,
      isImage,
      isPdf,
    };

    this.isPdfViewerLoading = false;
    this.activeFileViewerResourceUrl = null;
  }

  onPdfViewerLoad(): void {
    this.isPdfViewerLoading = false;
  }

  closeFileViewer(): void {
    this.activeFileViewer = null;
    this.activeFileViewerResourceUrl = null;
    this.isPdfViewerLoading = false;
    this.isViewerDownloadInProgress = false;
  }

  async downloadFileMessage(message: PendingMessage): Promise<void> {
    const fileUrl = String(message.fileUrl || '').trim();
    if (!fileUrl) {
      return;
    }

    await this.downloadFileFromUrl(fileUrl, String(message.filename || 'attachment'));
  }

  async downloadActiveViewerFile(): Promise<void> {
    const viewer = this.activeFileViewer;
    if (!viewer?.url) {
      return;
    }

    this.isViewerDownloadInProgress = true;
    try {
      await this.downloadFileFromUrl(viewer.url, String(viewer.name || 'attachment'));
    } finally {
      window.setTimeout(() => {
        this.isViewerDownloadInProgress = false;
      }, 900);
    }
  }

  private async downloadFileFromUrl(fileUrl: string, fileName: string): Promise<void> {
    const normalizedUrl = this.normalizeFileUrl(fileUrl);
    if (!normalizedUrl) {
      return;
    }

    const downloadUrl = this.resolveDownloadUrl(normalizedUrl);

    try {
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = fileName || 'attachment';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch {
      window.open(downloadUrl, '_blank', 'noopener');
    }
  }

  getFileTypeLabel(message: PendingMessage): string {
    const mimeType = String(message.mimeType || '').toLowerCase();
    if (mimeType.includes('pdf')) {
      return 'PDF';
    }
    if (mimeType.startsWith('image/')) {
      return 'Image';
    }
    if (mimeType.includes('word')) {
      return 'Word';
    }
    if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return 'Spreadsheet';
    }

    return 'Attachment';
  }

  getSelectedAttachmentIconClass(): string {
    const attachment = this.selectedAttachment;
    if (!attachment) {
      return 'fa-file';
    }

    return this.getFileIconClassByNameAndMimeType(attachment.name, attachment.mimeType);
  }

  getFileIconClassByNameAndMimeType(name: string, mimeType: string): string {
    const normalizedName = String(name || '').toLowerCase();
    const normalizedMimeType = String(mimeType || '').toLowerCase();

    if (normalizedName.endsWith('.pdf') || normalizedMimeType.includes('pdf')) {
      return 'fa-file-pdf';
    }

    if (
      normalizedName.endsWith('.jpg')
      || normalizedName.endsWith('.jpeg')
      || normalizedName.endsWith('.png')
      || normalizedMimeType.startsWith('image/')
    ) {
      return 'fa-file-image';
    }

    if (normalizedName.endsWith('.docx') || normalizedName.endsWith('.doc') || normalizedMimeType.includes('wordprocessingml')) {
      return 'fa-file-word';
    }

    if (normalizedName.endsWith('.xlsx') || normalizedMimeType.includes('spreadsheetml')) {
      return 'fa-file-excel';
    }

    return 'fa-file';
  }

  private resolveMessageMimeType(message: PendingMessage): string {
    const explicitMimeType = String(message.mimeType || '').trim();
    if (explicitMimeType) {
      return explicitMimeType;
    }

    const fileName = String(message.filename || '').toLowerCase();
    const fileUrl = this.normalizeFileUrl(String(message.fileUrl || '')).toLowerCase();
    if (fileName.endsWith('.pdf')) {
      return 'application/pdf';
    }

    if (/\.pdf(\?|$)/i.test(fileUrl)) {
      return 'application/pdf';
    }

    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    if (fileName.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    return 'application/octet-stream';
  }

  private normalizeFileUrl(fileUrl: string): string {
    const trimmedUrl = String(fileUrl || '').trim();
    if (!trimmedUrl) {
      return '';
    }

    return trimmedUrl
      .replace(/\\/g, '/')
      .replace(/ /g, '%20');
  }

  private resolveDownloadUrl(fileUrl: string): string {
    try {
      const parsedUrl = new URL(fileUrl, window.location.origin);
      parsedUrl.searchParams.set('download', 'true');
      return parsedUrl.toString();
    } catch {
      if (/([?&])download=false/i.test(fileUrl)) {
        return fileUrl.replace(/([?&])download=false/ig, '$1download=true');
      }

      if (/([?&])download=true/i.test(fileUrl)) {
        return fileUrl;
      }

      return `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=true`;
    }
  }

  private buildPdfEmbedUrl(fileUrl: string): string {
    const normalizedUrl = this.normalizeFileUrl(fileUrl);
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(normalizedUrl)}`;
  }

  private buildTaskTitleFromMessage(messageText: string): string {
    const compactText = String(messageText || '').replace(/\s+/g, ' ').trim();
    if (!compactText) {
      return 'WhatsApp follow-up';
    }

    const clipped = compactText.length > 56 ? `${compactText.slice(0, 53)}...` : compactText;
    return `Follow up: ${clipped}`;
  }

  private startConversationPolling(): void {
    interval(15000).pipe(
      startWith(0),
      switchMap(() => {
        if (this.socketConnected && this.conversations.length) {
          return of({ success: true, data: this.conversations });
        }

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
      this.conversations = this.sortConversationsForInbox(conversationsToRender);
      this.lastConversationFetchAt = Date.now();

      if (this.trySelectTargetConversation()) {
        return;
      }

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

  private trySelectTargetConversation(): boolean {
    if (!this.targetConversationPhone || !this.conversations.length) {
      return false;
    }

    const match = this.conversations.find((conversation) => {
      return this.normalizePhone(conversation.phoneNumber) === this.targetConversationPhone;
    });

    if (!match) {
      return false;
    }

    this.targetConversationPhone = '';
    if (this.selectedConversation?._id === match._id) {
      return true;
    }

    this.selectConversation(match);
    return true;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeMessageMenuId = null;
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
            if (this.socketConnected && this.messages.length) {
              return of({ success: true, data: this.messages as ChatMessage[] });
            }

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

      const previousLastMessageId = this.messages[this.messages.length - 1]?.messageId || '';
      this.messages = this.mergePendingMessages(this.withMockMetadata(response.data));
      const nextLastMessageId = this.messages[this.messages.length - 1]?.messageId || '';
      const hasNewTailMessage = Boolean(nextLastMessageId && nextLastMessageId !== previousLastMessageId);

      if (this.forceScrollOnNextMessageUpdate) {
        this.forceScrollOnNextMessageUpdate = false;
        this.queueScrollToBottom(true, true); // instant jump on conversation open
        return;
      }

      if (!hasNewTailMessage) {
        return;
      }

      if (this.isNearBottom()) {
        this.queueScrollToBottom();
      } else {
        this.unreadNewMessages += 1;
        this.showScrollToBottomButton = true;
      }
    });
  }

  private refreshConversationsFromApi(force = false): void {
    const minInterval = 1800;
    if (!force && Date.now() - this.lastConversationFetchAt < minInterval) {
      return;
    }

    this.chatService.getConversations()
      .pipe(
        catchError(() => of({ success: false, data: [] as ChatConversation[] })),
        takeUntil(this.destroy$)
      )
      .subscribe((response) => {
        if (!response.success || !response.data.length) {
          return;
        }

        this.lastConversationFetchAt = Date.now();
        this.conversations = this.sortConversationsForInbox(response.data);

        if (this.selectedConversation?._id) {
          const refreshedSelection = this.conversations.find((item) => item._id === this.selectedConversation?._id) || null;
          this.selectedConversation = refreshedSelection;
        }
      });
  }

  private startMessagePollingLegacy(): void {
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

      const previousLastMessageId = this.messages[this.messages.length - 1]?.messageId || '';
      this.messages = this.mergePendingMessages(this.withMockMetadata(response.data));
      const nextLastMessageId = this.messages[this.messages.length - 1]?.messageId || '';
      const hasNewTailMessage = Boolean(nextLastMessageId && nextLastMessageId !== previousLastMessageId);

      if (this.forceScrollOnNextMessageUpdate) {
        this.forceScrollOnNextMessageUpdate = false;
        this.queueScrollToBottom(true, true); // instant jump on conversation open
        return;
      }

      if (!hasNewTailMessage) {
        return;
      }

      if (this.isNearBottom()) {
        this.queueScrollToBottom();
      } else {
        this.unreadNewMessages += 1;
        this.showScrollToBottomButton = true;
      }
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
    this.refreshConversationsFromApi();

    const eventPhone = this.normalizePhone(event.phone || event.destination || event.source || '');
    if (!eventPhone) {
      return;
    }

    if (event.eventType === 'incoming') {
      if (this.selectedConversation && this.normalizePhone(this.selectedConversation.phoneNumber) === eventPhone) {
        this.markConversationAsRead(this.selectedConversation, true);
      } else {
        this.incrementUnreadForPhone(eventPhone);
      }
    }

    if (!this.selectedConversation || this.isMockConversation(this.selectedConversation._id)) {
      return;
    }

    const selectedPhone = this.normalizePhone(this.selectedConversation.phoneNumber);
    if (selectedPhone !== eventPhone) {
      return;
    }

    this.selectedConversation$.next(this.selectedConversation._id);
  }

  private normalizePhone(value: string): string {
    return String(value || '').replace(/^whatsapp:/i, '').replace(/\D/g, '').trim();
  }

  private addOptimisticOutgoingMessage(
    text: string,
    conversation: ChatConversation,
    localPendingId: string
  ): void {
    const now = new Date().toISOString();
    const pendingMessage: PendingMessage = {
      _id: localPendingId,
      messageId: localPendingId,
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
          messageId: localPendingId,
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

  private sendAttachmentMessage(conversation: ChatConversation, text: string): void {
    const attachments = [...this.attachmentQueue];
    if (!attachments.length) {
      return;
    }

    if (this.isMockConversation(conversation._id)) {
      attachments.forEach((item) => this.addMockOutgoingFileMessage(conversation, item));
      this.resetAttachmentDraftState();
      this.syncSelectedConversationPreview(attachments[attachments.length - 1]?.name || text || 'Attachment', conversation._id);
      this.queueScrollToBottom(true);
      return;
    }

    const pendingIds = attachments.map(() => this.buildLocalPendingMessageId());
    attachments.forEach((item, index) => {
      const caption = index === 0 ? text : '';
      this.addOptimisticOutgoingFileMessage(conversation, item, pendingIds[index], caption);
    });
    this.queueScrollToBottom(true);

    this.isSending = true;
    this.isUploadingAttachment = true;
    this.uploadProgress = 0;

    this.sendAttachmentBatch(conversation, attachments, pendingIds, text, 0);
  }

  private sendAttachmentBatch(
    conversation: ChatConversation,
    attachments: SelectedAttachment[],
    pendingIds: string[],
    captionText: string,
    index: number
  ): void {
    if (index >= attachments.length) {
      this.isSending = false;
      this.isUploadingAttachment = false;
      this.uploadProgress = 0;
      this.resetAttachmentDraftState();
      this.syncSelectedConversationPreview(attachments[attachments.length - 1]?.name || 'Attachment', conversation._id);
      this.queueScrollToBottom(true);
      return;
    }

    const attachment = attachments[index];
    const localPendingId = pendingIds[index];
    this.chatService.uploadFile(attachment.file).pipe(takeUntil(this.destroy$)).subscribe({
      next: (uploadEvent) => {
        if (!uploadEvent.done) {
          const baseProgress = (index / attachments.length) * 100;
          const currentProgress = (uploadEvent.progress / attachments.length);
          this.uploadProgress = Math.min(99, Math.round(baseProgress + currentProgress));
          return;
        }

        const uploadedData = uploadEvent.data;
        if (!uploadedData?.url) {
          this.markPendingMessageFailed(localPendingId);
          this.sendAttachmentBatch(conversation, attachments, pendingIds, captionText, index + 1);
          return;
        }

        this.resolvePendingMessage(localPendingId, localPendingId, {
          fileUrl: uploadedData.url,
          filename: uploadedData.filename,
          mimeType: uploadedData.mimeType,
        });

        const sendPayload: SendFileRequest = {
          to: conversation.phoneNumber,
          fileUrl: uploadedData.url,
          filename: uploadedData.filename,
          mimeType: uploadedData.mimeType,
        };

        this.chatService.sendFile(sendPayload).pipe(takeUntil(this.destroy$)).subscribe({
          next: (sendResponse) => {
            const resolvedMessageId = String(sendResponse.data?.messageId || localPendingId);
            if (captionText && index === 0) {
              this.outgoingFileCaptionByMessageId[resolvedMessageId] = captionText;
            }

            this.resolvePendingMessage(localPendingId, sendResponse.data?.messageId, {
              fileUrl: uploadedData?.url,
              filename: uploadedData?.filename,
              mimeType: uploadedData?.mimeType,
            });

            this.sendAttachmentBatch(conversation, attachments, pendingIds, captionText, index + 1);
          },
          error: () => {
            this.markPendingMessageFailed(localPendingId);
            this.sendAttachmentBatch(conversation, attachments, pendingIds, captionText, index + 1);
          },
        });
      },
      error: () => {
        this.markPendingMessageFailed(localPendingId);
        this.sendAttachmentBatch(conversation, attachments, pendingIds, captionText, index + 1);
      },
    });
  }

  private retryFailedFileMessage(message: PendingMessage): void {
    if (!this.selectedConversation || !message.fileUrl || !message.filename) {
      return;
    }

    const localPendingId = this.buildLocalPendingMessageId();
    this.retryingMessageId = message.messageId;

    this.addOptimisticOutgoingFileMessage(
      this.selectedConversation,
      {
        file: new File([], message.filename, { type: message.mimeType || 'application/octet-stream' }),
        name: message.filename,
        mimeType: message.mimeType || '',
        isImage: this.isImageFileMessage(message),
        isPdf: this.isPdfFileMessage(message),
        previewUrl: undefined,
        previewResourceUrl: null,
      },
      localPendingId,
      message.text || message.filename
    );

    this.resolvePendingMessage(localPendingId, localPendingId, {
      fileUrl: message.fileUrl,
      filename: message.filename,
      mimeType: message.mimeType,
    });
    this.queueScrollToBottom(true);

    this.chatService.sendFile({
      to: this.selectedConversation.phoneNumber,
      fileUrl: message.fileUrl,
      filename: message.filename,
      mimeType: message.mimeType,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.retryingMessageId = null;
        this.resolvePendingMessage(localPendingId, response.data?.messageId);
      },
      error: () => {
        this.retryingMessageId = null;
        this.markPendingMessageFailed(localPendingId);
      },
    });
  }

  private addOptimisticOutgoingFileMessage(
    conversation: ChatConversation,
    attachment: SelectedAttachment,
    localPendingId: string,
    fallbackText: string
  ): void {
    const now = new Date().toISOString();
    const localPreviewUrl = attachment.isImage ? URL.createObjectURL(attachment.file) : '';
    if (localPreviewUrl) {
      this.optimisticImagePreviewUrls.add(localPreviewUrl);
    }

    const pendingMessage: PendingMessage = {
      _id: localPendingId,
      messageId: localPendingId,
      conversationId: conversation._id,
      from: 'me',
      to: conversation.phoneNumber,
      text: fallbackText || attachment.name || '',
      type: 'file',
      fileUrl: localPreviewUrl,
      filename: attachment.name,
      mimeType: attachment.mimeType,
      direction: 'outgoing',
      status: 'sent',
      timestamp: now,
      metadata: this.buildMockMetadata(
        {
          messageId: localPendingId,
          direction: 'outgoing',
          type: 'file',
          text: attachment.name,
        },
        0
      ),
      isPending: true,
    };

    this.pendingMessages = [...this.pendingMessages, pendingMessage];
    this.messages = this.mergePendingMessages(this.messages);
  }

  private resolvePendingMessage(
    localPendingId: string,
    providerMessageId?: string,
    patch?: Partial<PendingMessage>
  ): void {
    const resolvedId = String(providerMessageId || localPendingId);
    const existingPending = this.pendingMessages.find((message) => message.messageId === localPendingId);
    const previousFileUrl = String(existingPending?.fileUrl || '');
    const nextFileUrl = String(patch?.fileUrl || '');

    if (previousFileUrl.startsWith('blob:') && nextFileUrl && nextFileUrl !== previousFileUrl) {
      URL.revokeObjectURL(previousFileUrl);
      this.optimisticImagePreviewUrls.delete(previousFileUrl);
    }

    this.pendingMessages = this.pendingMessages.map((message) => {
      if (message.messageId !== localPendingId) {
        return message;
      }

      return {
        ...message,
        ...patch,
        messageId: resolvedId,
        _id: resolvedId,
        isPending: false,
      };
    });

    this.messages = this.mergePendingMessages(this.messages);
  }

  private markPendingMessageFailed(localPendingId: string): void {
    this.pendingMessages = this.pendingMessages.map((message) => {
      if (message.messageId !== localPendingId) {
        return message;
      }

      return {
        ...message,
        status: 'failed',
        isPending: false,
      };
    });

    this.messages = this.mergePendingMessages(this.messages);
  }

  private mergePendingMessages(serverMessages: ChatMessage[]): PendingMessage[] {
    const decoratedServerMessages = serverMessages.map((message) => {
      if (message.type !== 'file' || message.direction !== 'outgoing') {
        return message;
      }

      const caption = this.outgoingFileCaptionByMessageId[message.messageId];
      if (!caption) {
        return message;
      }

      const messageText = String(message.text || '').trim();
      const fileName = String(message.filename || '').trim();
      if (!messageText || (fileName && messageText === fileName) || messageText === 'Attachment') {
        return {
          ...message,
          text: caption,
        };
      }

      return message;
    });

    const seenIds = new Set(decoratedServerMessages.map((message) => message.messageId));
    this.pendingMessages = this.pendingMessages.filter((message) => !seenIds.has(message.messageId));

    return [...decoratedServerMessages, ...this.pendingMessages].sort((a, b) => {
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

  private addMockOutgoingFileMessage(conversation: ChatConversation, attachment: SelectedAttachment): void {
    const now = new Date().toISOString();
    const messageId = `mock-file-${Date.now()}`;
    const nextMessage: ChatMessage = {
      _id: messageId,
      messageId,
      conversationId: conversation._id,
      from: 'business',
      to: conversation.phoneNumber,
      text: attachment.name,
      type: 'file',
      fileUrl: '',
      filename: attachment.name,
      mimeType: attachment.mimeType,
      direction: 'outgoing',
      status: 'read',
      timestamp: now,
      metadata: this.buildMockMetadata(
        {
          messageId,
          direction: 'outgoing',
          type: 'file',
          text: attachment.name,
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
    this.conversations = this.sortConversationsForInbox(this.conversations.map((conversation) => {
      if (conversation._id !== conversationId) {
        return conversation;
      }

      return {
        ...conversation,
        lastMessage: text,
        updatedAt: new Date().toISOString(),
      };
    }));

    if (this.selectedConversation?._id === conversationId) {
      const refreshedSelection = this.conversations.find((conversation) => conversation._id === conversationId) || null;
      this.selectedConversation = refreshedSelection;
    }
  }

  private buildLocalPendingMessageId(): string {
    return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private queueScrollToBottom(force = false, instant = false): void {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.scrollToBottom(force, instant);
      if (instant) {
        // After images load they expand the container — re-scroll once more.
        this.scrollAfterImagesLoad();
      }
    }));
  }

  private scrollToBottom(force = false, instant = false): void {
    const container = this.messageScroller?.nativeElement;
    if (!container) {
      return;
    }

    if (!force && !this.isNearBottom()) {
      this.showScrollToBottomButton = true;
      return;
    }

    // Use direct assignment for instant — guaranteed to reach the bottom.
    if (instant) {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    this.showScrollToBottomButton = false;
    this.unreadNewMessages = 0;
  }

  private scrollAfterImagesLoad(): void {
    const container = this.messageScroller?.nativeElement;
    if (!container) {
      return;
    }

    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'));
    const unloaded = images.filter((img) => !img.complete);
    if (!unloaded.length) {
      return;
    }

    let remaining = unloaded.length;
    const onSettle = () => {
      remaining -= 1;
      if (remaining <= 0) {
        container.scrollTop = container.scrollHeight;
        this.showScrollToBottomButton = false;
        this.unreadNewMessages = 0;
      }
    };

    unloaded.forEach((img) => {
      img.addEventListener('load', onSettle, { once: true });
      img.addEventListener('error', onSettle, { once: true });
    });
  }

  private isNearBottom(threshold = 96): boolean {
    const container = this.messageScroller?.nativeElement;
    if (!container) {
      return true;
    }

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }

  private incrementUnreadForPhone(phone: string): void {
    if (!phone) {
      return;
    }

    this.conversations = this.sortConversationsForInbox(this.conversations.map((conversation) => {
      if (this.normalizePhone(conversation.phoneNumber) !== phone) {
        return conversation;
      }

      return {
        ...conversation,
        unreadCount: Number(conversation.unreadCount || 0) + 1,
      };
    }));
  }

  private markConversationAsRead(conversation: ChatConversation, optimistic = false): void {
    if (!conversation?._id) {
      return;
    }

    if (optimistic) {
      this.conversations = this.conversations.map((item) => {
        if (item._id !== conversation._id) {
          return item;
        }

        return {
          ...item,
          unreadCount: 0,
          lastReadAt: new Date().toISOString(),
        };
      });
      this.selectedConversation = this.conversations.find((item) => item._id === conversation._id) || this.selectedConversation;
    }

    if (this.isMockConversation(conversation._id)) {
      return;
    }

    this.chatService.markConversationAsRead(conversation.phoneNumber)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (!response.success) {
            return;
          }

          this.conversations = this.conversations.map((item) => {
            if (item._id !== conversation._id) {
              return item;
            }

            return {
              ...item,
              unreadCount: Number(response.data?.unreadCount || 0),
              lastReadAt: response.data?.lastReadAt || item.lastReadAt || null,
            };
          });
          this.selectedConversation = this.conversations.find((item) => item._id === conversation._id) || this.selectedConversation;
        },
        error: () => {
          // Ignore transient mark-read failures, next sync will reconcile.
        },
      });
  }

  private sortConversationsForInbox(items: ChatConversation[]): ChatConversation[] {
    return [...items].sort((a, b) => {
      const unreadA = Number(a.unreadCount || 0) > 0 ? 1 : 0;
      const unreadB = Number(b.unreadCount || 0) > 0 ? 1 : 0;
      if (unreadA !== unreadB) {
        return unreadB - unreadA;
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  private loadDraftCache(): void {
    try {
      const raw = localStorage.getItem(this.draftStorageKey);
      if (!raw) {
        this.draftByConversationId = {};
        return;
      }

      const parsed = JSON.parse(raw);
      this.draftByConversationId = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      this.draftByConversationId = {};
    }
  }

  private persistDraftCache(): void {
    try {
      localStorage.setItem(this.draftStorageKey, JSON.stringify(this.draftByConversationId));
    } catch {
      // Ignore storage errors silently to avoid breaking chat input.
    }
  }

  private getDateGroupingKey(timestamp: string): string {
    const date = this.toDateOnly(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  private toDateOnly(timestamp: string): Date {
    const parsed = new Date(timestamp || Date.now());
    if (Number.isNaN(parsed.getTime())) {
      const fallback = new Date();
      return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
    }

    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
}