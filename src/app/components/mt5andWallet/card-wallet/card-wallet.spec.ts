import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CardWallet } from './card-wallet';

describe('CardWallet', () => {
  let component: CardWallet;
  let fixture: ComponentFixture<CardWallet>;

  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    await TestBed.configureTestingModule({
      imports: [CardWallet],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CardWallet);
    fixture.componentRef.setInput('accountNumber', '000738475');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
