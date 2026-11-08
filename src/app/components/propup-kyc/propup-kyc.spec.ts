import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropupKyc } from './propup-kyc';

describe('PropupKyc', () => {
  let component: PropupKyc;
  let fixture: ComponentFixture<PropupKyc>;

  beforeEach(async () => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    await TestBed.configureTestingModule({
      imports: [PropupKyc],
    }).compileComponents();

    fixture = TestBed.createComponent(PropupKyc);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
