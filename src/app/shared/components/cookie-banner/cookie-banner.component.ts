import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../../../core/services/cookie-consent.service';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.component.html',
})
export class CookieBannerComponent {
  readonly consent = inject(CookieConsentService);
}
