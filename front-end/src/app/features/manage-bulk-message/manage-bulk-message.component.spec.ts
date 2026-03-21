import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageBulkMessageComponent } from './manage-bulk-message.component';

describe('ManageBulkMessageComponent', () => {
  let component: ManageBulkMessageComponent;
  let fixture: ComponentFixture<ManageBulkMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageBulkMessageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ManageBulkMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
