import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gradient';

@Component({
  imports: [RouterLink],
  selector: 'app-button',
  styleUrl: './button.css',
  templateUrl: './button.html',
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<'default' | 'compact'>('default');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input<boolean>(false);
  readonly icon = input<string>('');
  readonly routerLink = input<string | null>(null);

  protected readonly buttonClasses = computed(() => {
    const base = 'w-full rounded-lg cursor-pointer flex justify-center items-center gap-2';
    const variants: Record<ButtonVariant, string> = {
      primary: 'text-white font-medium bg-[#1A56DB] hover:bg-[#1A3987]/50 active:bg-[#1A56DB]',
      secondary: 'text-gray-900 font-medium border border-gray-200 enabled:hover:bg-gray-200',
      ghost: 'text-[#1C64F2] hover:text-[#1C64F2]/50 active:text-[#1C64F2]',
      gradient:
        'bg-linear-to-r from-[#0A136A] from-75% to-[#00D4FC] font-medium text-white enabled:hover:brightness-110',
    };
    const variant = this.variant();
    const size =
      this.size() === 'compact'
        ? 'min-h-9 px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C64F2] disabled:cursor-not-allowed'
        : variant === 'ghost'
          ? 'text-sm'
          : 'px-5 py-2.5 text-sm';

    return `${base} ${size} ${variants[variant] ?? variants.primary}`;
  });

  readonly onClick = output<void>();
}
