import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';

import { Router } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  authService = inject(AuthService);
  eventService = inject(EventService);
  private router = inject(Router);

  showOmnichannelModal = signal(false);

  userInitials = computed(() => {
    const parts = this.authService.currentUser().name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0] ? parts[0].substring(0, 2).toUpperCase() : 'UI';
  });

  shortName = computed(() => {
    const parts = this.authService.currentUser().name.split(' ');
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return parts[0] || 'User';
  });

  myTicketsCount = computed(() => {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'MAHASISWA') return 0;
    return this.eventService.tickets().filter(t => 
      t.userId === user.id || (user.nim && t.userNim === user.nim)
    ).length;
  });

  myCertificatesCount = computed(() => {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'MAHASISWA') return 0;
    return this.eventService.certificates().filter(c => 
      c.userId === user.id || (user.nim && c.userNim === user.nim)
    ).length;
  });

  switchPersona(userId: string): void {
    this.authService.switchUser(userId);
    const role = this.authService.currentUser().role;
    if (role === 'PANITIA') {
      this.router.navigate(['/dashboard/panitia']);
    } else if (role === 'DPK_ADMIN') {
      this.router.navigate(['/dashboard/admin']);
    } else {
      this.router.navigate(['/dashboard/mahasiswa']);
    }
  }

  onResetData(): void {
    if (confirm('Reset seluruh data mock kembali ke kondisi awal PRD (termasuk status tiket belum discan)?')) {
      this.eventService.resetToInitialMock();
      window.location.reload();
    }
  }
}
