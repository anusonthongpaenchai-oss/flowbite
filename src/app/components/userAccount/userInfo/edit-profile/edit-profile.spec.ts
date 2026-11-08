import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EditProfile } from './edit-profile';

describe('EditProfile', () => {
  let component: EditProfile;
  let fixture: ComponentFixture<EditProfile>;
  const member = {
    m_name: 'Test',
    m_lastname: 'Member',
    m_phone: '0812345678',
    m_gender: '',
    m_country: 'Thailand',
  };
  const memberFields = { ...member, phoneCode: '+66' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditProfile],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfile);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function button(label: string): HTMLButtonElement {
    const element = fixture.nativeElement as HTMLElement;
    return [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === label,
    )!;
  }

  async function goToAddress(): Promise<void> {
    component.editProfileForm.controls.member.setValue(memberFields);
    button('Next').click();
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it.each([
    ['m_name', 'Test'],
    ['m_lastname', 'Member'],
    ['m_country', 'Thailand'],
    ['m_phone', '0812345678'],
    ['m_gender', 'OTHER'],
  ] as const)('updates member.%s when editing the field', async (name, value) => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[formControlName="${name}"]:is(input, select), app-input[formControlName="${name}"] input`,
    )!;

    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    await fixture.whenStable();

    expect(component.editProfileForm.controls.member.controls[name].value).toBe(value);
  });

  it('displays values from the form and clears the input on reset', async () => {
    const control = component.editProfileForm.controls.member.controls.m_name;
    const input = fixture.nativeElement.querySelector(
      'app-input[formControlName="m_name"] input',
    ) as HTMLInputElement;

    control.setValue('Updated');
    await fixture.whenStable();
    expect(input.value).toBe('Updated');

    control.reset();
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(control.hasError('required')).toBe(true);
  });

  it('marks the control touched on blur and synchronizes its disabled state', async () => {
    const control = component.editProfileForm.controls.member.controls.m_name;
    const input = fixture.nativeElement.querySelector(
      'app-input[formControlName="m_name"] input',
    ) as HTMLInputElement;

    expect(control.touched).toBe(false);
    input.dispatchEvent(new Event('blur'));
    expect(control.touched).toBe(true);

    control.disable();
    await fixture.whenStable();
    expect(input.disabled).toBe(true);

    control.enable();
    await fixture.whenStable();
    expect(input.disabled).toBe(false);
  });

  it('shows Next and the profile fields on the first page', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(component.pg()).toBe(0);
    expect(button('Next').type).toBe('submit');
    expect(element.querySelector('[formControlName="m_name"]')).not.toBeNull();
    expect(element.querySelector('[formControlName="address_no"]')).toBeNull();
  });

  it('keeps incomplete profile fields on the first page and shows an error', async () => {
    button('Next').click();
    await fixture.whenStable();

    expect(component.pg()).toBe(0);
    expect(component.editProfileForm.controls.member.controls.m_name.touched).toBe(true);
    expect(component.editProfileForm.controls.address.touched).toBe(false);
    expect(fixture.nativeElement.querySelector('#edit-profile-error').textContent).toContain(
      'Please complete all required profile fields.',
    );
  });

  it('shows Save and the address fields after Next even when the address is incomplete', async () => {
    await goToAddress();
    const element = fixture.nativeElement as HTMLElement;

    expect(component.pg()).toBe(1);
    expect(component.editProfileForm.invalid).toBe(true);
    expect(button('Save').type).toBe('submit');
    expect(element.querySelector('[formControlName="m_name"]')).toBeNull();
    expect(element.querySelector('[formControlName="address_no"]')).not.toBeNull();
    expect(element.querySelectorAll('app-input')).toHaveLength(5);
  });

  it('advances to the address page when submitting the first page with Enter', async () => {
    const submit = vi.spyOn(component, 'onSubmit');
    component.editProfileForm.controls.member.setValue(memberFields);

    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(component.pg()).toBe(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it('preserves both pages of values when going Back and Next', async () => {
    const close = vi.spyOn(component.backEdit, 'emit');
    await goToAddress();
    const backdropClick = vi.spyOn(component, 'onBackdropClick');
    component.editProfileForm.controls.address.controls.address.controls.address_no.setValue(
      '123 Main Road',
    );

    button('Back').click();
    await fixture.whenStable();

    expect(component.pg()).toBe(0);
    expect(close).not.toHaveBeenCalled();
    expect(backdropClick).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('app-input[formControlName="m_name"] input').value,
    ).toBe('Test');

    button('Next').click();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('app-input[formControlName="address_no"] input').value,
    ).toBe('123 Main Road');
  });

  it('requests closing when Back makes pg negative', () => {
    const close = vi.spyOn(component.backEdit, 'emit');

    button('Back').click();

    expect(component.pg()).toBe(-1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1])('closes only for backdrop clicks on page %s', async (pg) => {
    const close = vi.spyOn(component.backEdit, 'emit');
    if (pg === 1) {
      await goToAddress();
    }
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLElement>('[role="dialog"]')!.click();
    element.querySelector<HTMLInputElement>('app-input input')!.click();
    expect(close).not.toHaveBeenCalled();

    element.querySelector<HTMLElement>('div')!.click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('validates the address, binds all address fields, and submits Save once', async () => {
    const update = vi.spyOn(component.updateProfile, 'emit');
    await goToAddress();

    button('Save').click();
    await fixture.whenStable();

    expect(update).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#edit-profile-error').textContent).toContain(
      'Please complete all required fields.',
    );
    const address = {
      address_no: '123 Main Road',
      address_district: 'Khlong Tan Nuea',
      address_city: 'Watthana',
      address_state: 'Bangkok',
      address_zipcode: '10110',
    };

    for (const [name, value] of Object.entries(address)) {
      const input = fixture.nativeElement.querySelector(
        `app-input[formControlName="${name}"] input`,
      ) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();

    expect(component.editProfileForm.controls.address.controls.address.getRawValue()).toEqual(
      address,
    );
    button('Save').click();
    await fixture.whenStable();

    expect(update).toHaveBeenCalledExactlyOnceWith({
      member: { ...member, m_phone: '+66812345678' },
      address,
    });
    expect(component.pg()).toBe(1);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    ['United States', '+12025550123', '', '+1', '2025550123'],
    ['Thailand', '66812345678', '+66', '+66', '812345678'],
    ['Thailand', '+6*****668', '+66', '+66', '+6*****668'],
    ['United Kingdom', '+12025550123', '+44', '+44', '2025550123'],
  ])(
    'prefills a %s profile and displays its email as read-only',
    async (country, storedPhone, storedCode, phoneCode, nationalNumber) => {
      fixture = TestBed.createComponent(EditProfile);
      component = fixture.componentInstance;
      const address = {
        address_no: '123 Main Road',
        address_district: 'Khlong Tan Nuea',
        address_city: 'Watthana',
        address_state: 'Bangkok',
        address_zipcode: '10110',
      };
      fixture.componentRef.setInput('profile', {
        member: { ...member, m_country: country, m_phone: storedPhone },
        address,
      });
      fixture.componentRef.setInput('phoneCode', storedCode);
      fixture.componentRef.setInput('email', 'member@example.com');
      await fixture.whenStable();

      expect(component.editProfileForm.getRawValue()).toEqual({
        member: {
          ...memberFields,
          m_country: country,
          phoneCode,
          m_phone: nationalNumber,
        },
        address: { address },
      });
      const element = fixture.nativeElement as HTMLElement;
      const options = (name: string) =>
        [
          ...element.querySelectorAll<HTMLOptionElement>(
            `select[formControlName="${name}"] option`,
          ),
        ].map((option) => option.value);
      expect(options('m_gender')).toEqual(['MALE', 'FEMALE', 'OTHER']);
      expect(options('m_country')).toEqual(['Thailand', 'United Kingdom', 'United States']);
      expect(options('phoneCode')).toEqual(['+66', '+44', '+1']);
      expect(
        element.querySelector<HTMLSelectElement>('select[formControlName="phoneCode"]')!.value,
      ).toBe(phoneCode);
      expect(
        element.querySelector<HTMLSelectElement>('select[formControlName="m_gender"]')!.value,
      ).toBe('');
      const email = fixture.nativeElement.querySelector('input[type="email"]') as HTMLInputElement;
      expect(email.value).toBe('member@example.com');
      expect(email.readOnly).toBe(true);
    },
  );

  it.each([
    ['m_name', '   ', 'required'],
    ['m_lastname', 'Member123', 'English letters'],
    ['m_name', 'a'.repeat(101), '100 characters'],
    ['m_phone', '08123abc', '7–15 digits'],
    ['m_phone', '1234', '7–15 digits'],
    ['address_state', '   ', 'required'],
    ['address_zipcode', '10110!', 'postal code'],
  ] as const)('shows a field error for invalid %s', async (name, value, message) => {
    if (name.startsWith('address_')) {
      await goToAddress();
    }
    const control =
      component.editProfileForm.controls.member.get(name) ??
      component.editProfileForm.controls.address.controls.address.get(name);
    control!.setValue(value);
    control!.markAsTouched();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>(
      `input[formControlName="${name}"], app-input[formControlName="${name}"] input`,
    )!;
    const error =
      input.closest('app-input')?.querySelector('[role="alert"]') ??
      element.querySelector('#edit-profile-phone-error');
    expect(error?.textContent).toContain(message);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('normalizes whitespace and retains optional gender in the flat API payload', async () => {
    const update = vi.spyOn(component.updateProfile, 'emit');
    component.editProfileForm.controls.member.setValue({
      ...memberFields,
      m_name: ' Test ',
      m_gender: ' MALE ',
    });
    component.onNext();
    const address = {
      address_no: ' 123 Main Road ',
      address_district: ' Khlong Tan Nuea ',
      address_city: ' Watthana ',
      address_state: ' Bangkok ',
      address_zipcode: ' 10110 ',
    };
    component.editProfileForm.controls.address.controls.address.setValue(address);

    component.onSubmit();

    expect(update).toHaveBeenCalledExactlyOnceWith({
      member: { ...member, m_phone: '+66812345678', m_gender: 'MALE' },
      address: {
        address_no: '123 Main Road',
        address_district: 'Khlong Tan Nuea',
        address_city: 'Watthana',
        address_state: 'Bangkok',
        address_zipcode: '10110',
      },
    });
  });

  it('disables the form and prevents closing or submitting again while saving', async () => {
    await goToAddress();
    const update = vi.spyOn(component.updateProfile, 'emit');
    const close = vi.spyOn(component.backEdit, 'emit');
    fixture.componentRef.setInput('isUpdating', true);
    fixture.componentRef.setInput('serverError', 'An update error.');
    await fixture.whenStable();

    expect(button('Saving…').disabled).toBe(true);
    expect(button('Back').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
    fixture.nativeElement.querySelector('div').click();
    component.onSubmit();

    expect(update).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('An update error.');
  });
});
