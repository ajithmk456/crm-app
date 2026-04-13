import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group, GroupService } from '../manage-group/group.service';
import { ToastrService } from 'ngx-toastr';
import { BulkMessageService, MessageChannel, SendBulkMessagePayload } from './bulk-message.service';
@Component({
  selector: 'app-manage-bulk-message',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-bulk-message.component.html',
  styleUrl: './manage-bulk-message.component.scss'
})
export class ManageBulkMessageComponent implements OnInit {
  groups: Group[] = [];
  selectedGroup: Group | null = null;
  messageText = '';
  selectedChannel: MessageChannel = 'sms';
  isLoadingGroups = false;
  isSending = false;

  constructor(
    private readonly groupService: GroupService,
    private readonly toastr: ToastrService,
    private readonly bulkMessageService: BulkMessageService,
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  get hasGroups(): boolean {
    return this.groups.length > 0;
  }

  get selectedGroupMemberCount(): number {
    if (!this.selectedGroup) {
      return 0;
    }

    return this.selectedGroup.numbers?.length || this.selectedGroup.contacts?.length || 0;
  }

  get canSend(): boolean {
    return !!this.selectedGroup && !!this.messageText.trim();
  }

  loadGroups(): void {
    this.isLoadingGroups = true;
    this.groupService.getGroups().subscribe({
      next: (response) => {
        this.isLoadingGroups = false;
        if (!response.success || !response.data) {
          this.groups = [];
          return;
        }

        const groups = Array.isArray(response.data) ? response.data : [response.data];
        this.groups = groups.map((group) => ({
          ...group,
          numbers: group.numbers || group.contacts.map((contact) => contact.phone)
        }));
      },
      error: () => {
        this.isLoadingGroups = false;
        this.groups = [];
        this.toastr.error('Failed to load groups', 'Error');
      }
    });
  }

  onGroupChange(): void {
    // No-op, retained for template select change binding.
  }

  sendBulkMessage(): void {
    if (!this.canSend || this.isSending) {
      return;
    }

    if (!this.selectedGroup?._id) {
      this.toastr.error('Please select a valid group', 'Validation');
      return;
    }

    const payload: SendBulkMessagePayload = {
      groupId: this.selectedGroup._id,
      message: this.messageText.trim(),
      channel: this.selectedChannel,
    };

    this.isSending = true;
    this.bulkMessageService.sendBulkMessage(payload).subscribe({
      next: (response) => {
        this.isSending = false;
        if (!response.success) {
          this.toastr.error(response.message || 'Failed to send message', 'Error');
          return;
        }

        this.toastr.success(
          `${response.sentCount} recipient(s) queued via ${this.selectedChannel.toUpperCase()}`,
          'Bulk Message Sent'
        );
      },
      error: (error) => {
        this.isSending = false;
        this.toastr.error(error?.error?.message || 'Failed to send bulk message', 'Error');
      }
    });
  }
}
