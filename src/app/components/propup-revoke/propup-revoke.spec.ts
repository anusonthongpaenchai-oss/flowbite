import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropupRevoke } from './propup-revoke';

describe('PropupRevoke', () => {
  let component: PropupRevoke;
  let fixture: ComponentFixture<PropupRevoke>;

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
      imports: [PropupRevoke],
    }).compileComponents();

    fixture = TestBed.createComponent(PropupRevoke);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
