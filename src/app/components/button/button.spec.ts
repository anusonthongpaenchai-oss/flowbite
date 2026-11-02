import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Button } from './button';

describe('Button', () => {
  let component: Button;
  let fixture: ComponentFixture<Button>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Button],
    }).compileComponents();

    fixture = TestBed.createComponent(Button);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply primary variant classes by default', () => {
    const buttonEl = fixture.nativeElement.querySelector('button');
    expect(buttonEl.className).toContain('bg-blue-600');
  });

  it('should apply ghost variant classes when variant is ghost', async () => {
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.detectChanges();
    await fixture.whenStable();

    const buttonEl = fixture.nativeElement.querySelector('button');
    expect(buttonEl.className).toContain('bg-transparent');
  });
});
