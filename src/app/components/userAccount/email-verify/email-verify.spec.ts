import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmailVerify } from './email-verify';

describe('EmailVerify', () => {
  let component: EmailVerify;
  let fixture: ComponentFixture<EmailVerify>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailVerify],
    }).compileComponents();

    fixture = TestBed.createComponent(EmailVerify);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
