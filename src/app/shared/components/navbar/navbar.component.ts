import { Component, inject, computed, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertsService } from '../../../core/services/alerts.service';
import { ThemeService } from '../../../core/services/theme.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly alertsService = inject(AlertsService);

  menuOpen = false;
  triggeredCount = 0;

  readonly userInitial = computed(() => {
    const email = this.auth.user()?.email ?? '';
    return email.charAt(0).toUpperCase();
  });

  ngOnInit(): void {
    this.loadAlertCount();
  }

  private async loadAlertCount(): Promise<void> {
    try {
      this.triggeredCount = await this.alertsService.getTriggeredAlertsCount();
    } catch {
      this.triggeredCount = 0;
    }
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
