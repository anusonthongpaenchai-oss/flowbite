import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

@Component({
  imports: [RouterLink],
  selector: 'app-button',
  styleUrl: './button.css',
  templateUrl: './button.html',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly icon = input<string>('');
  readonly routerLink = input<string | null>(null);

  protected readonly buttonClasses = computed(() => {
    const base = 'w-full rounded-lg cursor-pointer flex justify-center items-center gap-2';
    const variants: Record<ButtonVariant, string> = {
      primary:
        'text-white text-sm font-medium bg-[#1A56DB] px-5 py-2.5 hover:bg-[#1A3987]/50 active:bg-[#1A56DB]',
      secondary:
        'text-gray-900 text-sm font-medium px-5 py-2.5 border border-gray-200 hover:bg-gray-200 ',
      ghost: 'text-sm text-[#1C64F2] hover:text-[#1C64F2]/50 active:text-[#1C64F2]',
    };

    return `${base} ${variants[this.variant()] ?? variants.primary}`;
  });

  readonly onClick = output<void>();
}
