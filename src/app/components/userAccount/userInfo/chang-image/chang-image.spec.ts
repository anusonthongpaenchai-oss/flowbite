import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { api, type ApiResponse } from '../../../../../shared/api/api';
import { clearAuthSession, setAuthSession } from '../../../../../shared/guard/auth';
import { ChangImage } from './chang-image';

describe('ChangImage', () => {
  let component: ChangImage;
  let fixture: ComponentFixture<ChangImage>;
  const file = new File(['image contents'], 'profile.png', { type: 'image/png' });
  const upload = vi.fn<typeof api.post>();
  const createObjectURL = vi.fn<(file: Blob) => string>();
  const revokeObjectURL = vi.fn();

  beforeEach(async () => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value() {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value() {
          this.open = false;
        },
      },
    });
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    createObjectURL.mockReset().mockReturnValue('blob:profile-preview');
    revokeObjectURL.mockReset();
    upload.mockReset().mockResolvedValue({ status: 200, data: { result: true } } as ApiResponse);
    vi.spyOn(api, 'post').mockImplementation(upload);
    clearAuthSession();
    setAuthSession({
      require2FA: false,
      member: {
        id: 1,
        username: 'member',
        email: 'member@example.com',
        m_image_url: '',
        m_image_path: '',
        m_name: 'Test',
        m_lastname: 'Member',
        isKYC: 0,
        ib: 0,
        ibType: 0,
        mt5_category: 0,
        member_roles: [],
      },
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresIn: 3600,
      sessionUid: 'test-session',
    });

    await TestBed.configureTestingModule({
      imports: [ChangImage],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangImage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    clearAuthSession();
    vi.restoreAllMocks();
  });

  function selectFile(image: File | null): void {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { configurable: true, value: image ? [image] : [] });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function button(selector: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(selector);
  }

  it('opens the preview dialog with the current image and disables Save until a file is chosen', () => {
    fixture.componentRef.setInput('imageUrl', '/current-profile.png');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('dialog').open).toBe(true);
    expect(
      fixture.nativeElement.querySelector('img[alt="Profile image preview"]').getAttribute('src'),
    ).toBe('/current-profile.png');
    expect(button('.save-button').disabled).toBe(true);
  });

  it('previews a selected image and uploads it only after Save is clicked', async () => {
    const saved = vi.fn();
    component.saved.subscribe(saved);
    selectFile(file);

    expect(
      fixture.nativeElement.querySelector('img[alt="Profile image preview"]').getAttribute('src'),
    ).toBe('blob:profile-preview');
    expect(button('.save-button').disabled).toBe(false);
    expect(upload).not.toHaveBeenCalled();

    button('.save-button').click();
    await fixture.whenStable();

    expect(upload).toHaveBeenCalledExactlyOnceWith(
      '/v1/member/profile/image',
      expect.any(FormData),
      expect.any(Object),
    );
    expect((upload.mock.calls[0][1] as FormData).get('profileImage')).toBe(file);
    expect(saved).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('dialog').open).toBe(false);
  });

  it('opens the chooser from Upload another image', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');

    button('.upload-button').click();

    expect(click).toHaveBeenCalledOnce();
    expect(input.name).toBe('profileImage');
    expect(input.accept).toContain('image/png');
  });

  it.each([
    [new File(['gif'], 'profile.gif', { type: 'image/gif' }), 'JPEG, JPG, or PNG'],
    [new File([], 'profile.jpg', { type: 'image/jpeg' }), 'Please select an image file'],
    [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'profile.png', { type: 'image/png' }), '5MB'],
  ])('blocks invalid selections before previewing or uploading (%#)', async (image, message) => {
    selectFile(image);
    await component.save();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
    expect(button('.save-button').disabled).toBe(true);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('preserves the selected image when the chooser is cancelled', () => {
    selectFile(file);
    selectFile(null);

    expect(component.selectedFile()).toBe(file);
    expect(component.previewUrl()).toBe('blob:profile-preview');
  });

  it('releases previews when replacing the image and when the dialog is destroyed', () => {
    selectFile(file);
    createObjectURL.mockReturnValueOnce('blob:next-preview');
    selectFile(new File(['next'], 'next.jpg', { type: 'image/jpeg' }));

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview');
    fixture.destroy();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:next-preview');
  });

  it('blocks closing and duplicate saves while uploading, then allows retrying after failure', async () => {
    let rejectUpload!: (error: Error) => void;
    upload.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectUpload = reject;
      }),
    );
    const closed = vi.fn();
    component.closed.subscribe(closed);
    selectFile(file);

    const request = component.save();
    fixture.detectChanges();
    await component.save();
    component.close();
    fixture.nativeElement
      .querySelector('dialog')
      .dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(button('.save-button').disabled).toBe(true);
    expect(button('.upload-button').disabled).toBe(true);
    expect(button('.close-button button').disabled).toBe(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalled();

    rejectUpload(new Error('Unable to connect.'));
    await request;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Unable to connect',
    );
    expect(component.selectedFile()).toBe(file);
    expect(button('.save-button').disabled).toBe(false);

    button('.save-button').click();
    await fixture.whenStable();
    expect(upload).toHaveBeenCalledTimes(2);
    expect(component.errorMessage()).toBe('');
  });

  it.each(['close', 'backdrop', 'escape'])('closes the preview from %s', (action) => {
    const closed = vi.fn();
    component.closed.subscribe(closed);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;

    if (action === 'close') {
      button('.close-button button').click();
    } else if (action === 'backdrop') {
      dialog.click();
    } else {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    }

    expect(closed).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });
});
