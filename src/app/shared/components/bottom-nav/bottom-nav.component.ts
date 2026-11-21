import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.component.html'
})
export class BottomNavComponent {
  eventService = inject(EventService);
  authService = inject(AuthService);

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
}
