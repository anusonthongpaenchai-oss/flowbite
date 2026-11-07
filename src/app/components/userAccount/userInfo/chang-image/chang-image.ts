import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { imgUpdate, profileImageError } from '../../../../../shared/api/userInfo/imgUpdate';
import { Button } from '../../../ui/button/button';

@Component({
  imports: [Button],
  selector: 'app-chang-image',
  templateUrl: './chang-image.html',
})
export class ChangImage implements AfterViewInit, OnDestroy {
  readonly imageUrl = input('');
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly selectedFile = signal<File | null>(null);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  private readonly selectedPreview = signal('');
  readonly previewUrl = computed(() => this.selectedPreview() || this.imageUrl());

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('imageDialog');
  private readonly pendingTasks = inject(PendingTasks);
  private readonly destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  onFileSelected(input: HTMLInputElement): void {
    if (this.isSaving()) {
      return;
    }

    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const message = profileImageError(file);
    this.errorMessage.set(message);
    if (message) {
      this.releasePreview();
      this.selectedFile.set(null);
      return;
    }

    this.releasePreview();
    this.selectedFile.set(file);
    this.selectedPreview.set(URL.createObjectURL(file));
  }

  onPreviewError(): void {
    if (this.selectedFile()) {
      this.releasePreview();
      this.selectedFile.set(null);
      this.errorMessage.set('Unable to preview this image. Please select another image.');
    }
  }

  close(): void {
    if (!this.isSaving()) {
      this.dialog().nativeElement.close();
      this.closed.emit();
    }
  }

  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  async save(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    const completeTask = this.pendingTasks.add();

    try {
      await imgUpdate(file);
      if (!this.destroyRef.destroyed) {
        this.dialog().nativeElement.close();
        this.saved.emit();
      }
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'Unable to update your profile image. Please try again.',
      );
    } finally {
      this.isSaving.set(false);
      completeTask();
    }
  }

  ngOnDestroy(): void {
    this.releasePreview();
    if (this.dialog().nativeElement.open) {
      this.dialog().nativeElement.close();
    }
  }

  private releasePreview(): void {
    if (this.selectedPreview()) {
      URL.revokeObjectURL(this.selectedPreview());
      this.selectedPreview.set('');
    }
  }
}
