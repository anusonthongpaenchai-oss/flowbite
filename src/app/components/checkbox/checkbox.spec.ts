import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Checkbox } from './checkbox';

@Component({
  imports: [Checkbox, ReactiveFormsModule],
  template: `<form [formGroup]="form">
    <app-checkbox formControlName="remember" label="Remember" />
  </form>`,
})
class ReactiveCheckboxHost {
  readonly form = new FormGroup({ remember: new FormControl(false, { nonNullable: true }) });
}

@Component({
  imports: [Checkbox],
  template: `<app-checkbox [(checked)]="checked" [disabled]="disabled()" label="Remember" />`,
})
class LegacyCheckboxHost {
  checked = signal(false);
  disabled = signal(false);
}

describe('Checkbox', () => {
  let component: Checkbox;
  let fixture: ComponentFixture<Checkbox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Checkbox],
    }).compileComponents();

    fixture = TestBed.createComponent(Checkbox);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('syncs native changes, form values, touched, disabled and reset through formControlName', async () => {
    const host = TestBed.createComponent(ReactiveCheckboxHost);
    await host.whenStable();
    const control = host.componentInstance.form.controls.remember;
    const input = host.nativeElement.querySelector('input') as HTMLInputElement;

    input.click();
    expect(control.value).toBe(true);
    expect(control.touched).toBe(false);
    input.dispatchEvent(new Event('blur'));
    expect(control.touched).toBe(true);

    control.disable();
    await host.whenStable();
    expect(input.disabled).toBe(true);
    input.click();
    expect(control.value).toBe(true);

    control.enable();
    control.reset();
    await host.whenStable();
    expect(input.disabled).toBe(false);
    expect(input.checked).toBe(false);
    expect(control.pristine).toBe(true);
    expect(control.untouched).toBe(true);

    control.setValue(true);
    await host.whenStable();
    expect(input.checked).toBe(true);
  });

  it('preserves checkedChange and disabled bindings outside Reactive Forms', async () => {
    const host = TestBed.createComponent(LegacyCheckboxHost);
    await host.whenStable();
    const input = host.nativeElement.querySelector('input') as HTMLInputElement;

    input.click();
    expect(host.componentInstance.checked()).toBe(true);
    await host.whenStable();
    host.componentInstance.checked.set(false);
    host.componentInstance.disabled.set(true);
    await host.whenStable();
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(true);
    input.click();
    expect(host.componentInstance.checked()).toBe(false);
  });
});
