import { ActivatedRoute } from '@angular/router';
import { Component, inject } from '@angular/core';
@Component({
  selector: 'app-account-placeholder',
  host: { class: 'block' },
  templateUrl: './account-placeholder.html',
})
export class AccountPlaceholder {
  readonly label = inject(ActivatedRoute).snapshot.data['label'] as string;
}
