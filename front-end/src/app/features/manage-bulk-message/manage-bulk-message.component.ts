import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group, GroupService } from '../manage-group/group.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-manage-bulk-message',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-bulk-message.component.html',
  styleUrl: './manage-bulk-message.component.scss'
})
export class ManageBulkMessageComponent implements OnInit, OnDestroy {
  groups: Group[] = [];
  selectedGroup: Group | null = null;
  messageText = '';
  selectedFile: File | null = null;
  imagePreviewUrl: string | null = null;
  isLoadingGroups = false;

  constructor(
    private readonly groupService: GroupService,
    private readonly toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  ngOnDestroy(): void {
    this.clearPreviewUrl();
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
    console.log('Selected group:', this.selectedGroup);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.selectedFile = file;
    this.clearPreviewUrl();

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.selectedFile = null;
      input.value = '';
      this.toastr.error('Please select an image file', 'Invalid file');
      return;
    }

    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  sendBulkMessage(): void {
    if (!this.canSend) {
      return;
    }

    const payload = {
      group: this.selectedGroup,
      message: this.messageText.trim(),
      file: this.selectedFile
    };

    console.log('Sending bulk message:', payload);
    this.toastr.success('Message ready to send', 'Success');
  }

  private clearPreviewUrl(): void {
    if (this.imagePreviewUrl) {
      URL.revokeObjectURL(this.imagePreviewUrl);
      this.imagePreviewUrl = null;
    }
  }
}
