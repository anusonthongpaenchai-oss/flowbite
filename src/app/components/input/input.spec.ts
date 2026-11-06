import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InputComponent } from './input';

describe('Input', () => {
  let component: InputComponent;
  let fixture: ComponentFixture<InputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InputComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows and hides the password without changing its value or submitting the form', () => {
    fixture.componentRef.setInput('type', 'password');
    fixture.componentRef.setInput('value', 'test-password');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input')!;
    const button = element.querySelector('button')!;
    const changed = vi.fn();
    component.registerOnChange(changed);
    const valueChanged = vi.spyOn(component.valueChange, 'emit');
    const form = document.createElement('form');
    const submitted = vi.fn((event: Event) => event.preventDefault());
    form.addEventListener('submit', submitted);
    element.before(form);
    form.append(element);

    expect(input.type).toBe('password');
    button.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
    expect(input.value).toBe('test-password');
    expect(button.getAttribute('aria-label')).toBe('Hide password');

    button.click();
    fixture.detectChanges();

    expect(input.type).toBe('password');
    expect(input.value).toBe('test-password');
    expect(button.getAttribute('aria-label')).toBe('Show password');
    expect(changed).not.toHaveBeenCalled();
    expect(valueChanged).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
    form.replaceWith(element);
  });

  it('does not show a password toggle for other input types', () => {
    fixture.componentRef.setInput('type', 'email');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.querySelector('input').type).toBe('email');
  });

  it('disables the toggle when the form control is disabled', () => {
    fixture.componentRef.setInput('type', 'password');
    component.setDisabledState(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input').type).toBe('password');
  });
});
