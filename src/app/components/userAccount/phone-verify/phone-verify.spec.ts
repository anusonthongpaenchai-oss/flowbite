import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PhoneVerify } from './phone-verify';

describe('PhoneVerify', () => {
  let component: PhoneVerify;
  let fixture: ComponentFixture<PhoneVerify>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhoneVerify],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PhoneVerify);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
