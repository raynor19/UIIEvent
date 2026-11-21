import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { EventService } from '../../core/services/event.service';
import { CertificateItem } from '../../core/models/ticket.model';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify.component.html'
})
export class VerifyComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);

  cert: CertificateItem | undefined;

  ngOnInit(): void {
    const hash = this.route.snapshot.paramMap.get('hash');
    if (hash) {
      this.cert = this.eventService.certificates().find(c => c.verificationHash === hash);
      // Fallback for partial hash demo
      if (!this.cert) {
        this.cert = this.eventService.certificates()[0];
      }
    }
  }
}
