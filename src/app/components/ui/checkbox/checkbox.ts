import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  Output,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-checkbox',
  templateUrl: './checkbox.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Checkbox),
      multi: true,
    },
  ],
})
export class Checkbox implements ControlValueAccessor {
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private onValueChange: (value: boolean) => void = () => {};
  private onTouched: () => void = () => {};

  @Input() label: string = '';
  @Input() checked: boolean = false;
  @Input() disabled: boolean = false;
  @Output() checkedChange = new EventEmitter<boolean>();

  writeValue(value: boolean | null | undefined): void {
    this.checked = value ?? false;
    this.changeDetectorRef.markForCheck();
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onValueChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.changeDetectorRef.markForCheck();
  }

  onBlur(): void {
    this.onTouched();
  }

  onChange(event: Event): void {
    if (this.disabled) {
      return;
    }
    this.checked = (event.target as HTMLInputElement).checked;
    this.onValueChange(this.checked);
    this.checkedChange.emit(this.checked);
  }
}
