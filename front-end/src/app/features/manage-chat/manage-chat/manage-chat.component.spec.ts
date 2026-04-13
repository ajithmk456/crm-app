import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ManageChatComponent } from './manage-chat.component';
import { ChatService } from './chat.service';

describe('ManageChatComponent', () => {
  let component: ManageChatComponent;
  let fixture: ComponentFixture<ManageChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageChatComponent],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getConversations: () => of({ success: true, data: [] }),
            getMessages: () => of({ success: true, data: [] }),
            sendMessage: () => of({ success: true, data: { messageId: 'msg-1' } })
          }
        }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ManageChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
