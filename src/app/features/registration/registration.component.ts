import { Component, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as QRCode from 'qrcode';
import { EventService, RegistrationResult } from '../../core/services/event.service';
import { AuthService, getUiiProdiFromNim } from '../../core/services/auth.service';
import { EventItem } from '../../core/models/event.model';
import { TicketItem } from '../../core/models/ticket.model';

@Component({
  selector: 'app-registration',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './registration.component.html'
})
export class RegistrationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  eventService = inject(EventService);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  event = signal<EventItem | undefined>(undefined);
  phoneInput = '';
  dietaryOrNotes = '';
  agreeTerms = true;
  isSubmitting = signal<boolean>(false);

  // Oprec fields (SCR-REG-02)
  divisionChoice1 = 'Divisi Acara & Kreatif';
  divisionChoice2 = 'Divisi Humas & Publikasi';
  motivation = '';
  uploadedFileName = '';
  uploadedFileSize = '';

  // Conflict state & Success State (SCR-REG-03)
  conflictError = signal<boolean>(false);
  errorMessage = signal<string>('');
  registrationSuccess = signal<boolean>(false);
  successMessage = '';
  createdTicket = signal<TicketItem | null>(null);
  qrDataUrl = signal<string>('');

  divisions = [
    'Divisi Acara & Kreatif',
    'Divisi Humas & Eksternal',
    'Divisi Desain & Multimedia',
    'Divisi Perlengkapan & Logistik',
    'Divisi Konsumsi & Akomodasi',
    'Divisi Keamanan & Kedisiplinan'
  ];

  get isOprecEvent(): boolean {
    const evt = this.event();
    if (!evt) return false;
    return evt.category === 'COMMITTEE_RECRUITMENT' || 
           evt.categoryLabel?.toLowerCase().includes('oprec') || 
           evt.categoryLabel?.toLowerCase().includes('kepanitiaan') ||
           (evt.oprecDivisions !== undefined && evt.oprecDivisions.length > 0);
  }

  get activeDivisions(): string[] {
    const evt = this.event();
    if (evt?.oprecDivisions && evt.oprecDivisions.length > 0) {
      return evt.oprecDivisions;
    }
    return this.divisions;
  }

  get userStudyProgram(): string {
    const user = this.authService.currentUser();
    if (user.role === 'MAHASISWA' && user.nim) {
      return getUiiProdiFromNim(user.nim).studyProgram;
    }
    return user.studyProgram || 'Teknik Mesin';
  }

  get userFaculty(): string {
    const user = this.authService.currentUser();
    if (user.role === 'MAHASISWA' && user.nim) {
      return getUiiProdiFromNim(user.nim).faculty;
    }
    return user.faculty || 'Fakultas Teknologi Industri';
  }

  get userDeptInfo(): { studyProgram: string; faculty: string; angkatan: string; code: string } {
    const user = this.authService.currentUser();
    return getUiiProdiFromNim(user.nim);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = this.eventService.getEventById(id);
      this.event.set(found);
      if (found?.oprecDivisions && found.oprecDivisions.length > 0) {
        this.divisionChoice1 = found.oprecDivisions[0];
        this.divisionChoice2 = found.oprecDivisions.length > 1 ? found.oprecDivisions[1] : found.oprecDivisions[0];
      }
    }
    this.phoneInput = this.authService.currentUser().phone;
  }

  get isAlreadyRegistered(): boolean {
    const evt = this.event();
    if (!evt) return false;
    return this.eventService.isUserRegistered(this.authService.currentUser().id, evt.id);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran berkas melebihi batas maksimal 5 MB!');
        input.value = '';
        return;
      }
      this.uploadedFileName = file.name;
      this.uploadedFileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    }
  }

  async onSubmitRegistration(): Promise<void> {
    const evt = this.event();
    if (!evt) return;
    this.isSubmitting.set(true);
    this.conflictError.set(false);
    this.cdr.detectChanges();

    const isOprec = this.isOprecEvent;
    const result: RegistrationResult = await this.eventService.registerParticipantReal({
      eventId: evt.id,
      divisionChoice1: isOprec ? this.divisionChoice1 : undefined,
      divisionChoice2: isOprec ? this.divisionChoice2 : undefined,
      motivation: this.motivation,
      cvFileName: this.uploadedFileName || 'CV_Mahasiswa_UII.pdf',
      krsFileName: 'KRS_Aktif_Semester_Gasal_2026.pdf'
    });

    this.isSubmitting.set(false);

    if (!result.success) {
      if (result.statusCode === 409) {
        // HTTP 409 Conflict handling (US-01 / FR-REG-02)
        this.conflictError.set(true);
      } else {
        this.errorMessage.set(result.message);
      }
    } else {
      this.registrationSuccess.set(true);
      this.successMessage = result.message;
      
      // If ticket is directly returned or sync from backend
      let targetTicket: TicketItem | null = null;
      if (result.ticket) {
        targetTicket = result.ticket;
      } else {
        const currentUser = this.authService.currentUser();
        const userTickets = this.eventService.tickets().filter(t => 
          (t.userId === currentUser.id || t.userNim === currentUser.nim) && 
          t.eventId === evt.id
        );
        if (userTickets.length > 0) {
          targetTicket = userTickets[userTickets.length - 1];
        }
      }

      if (targetTicket) {
        this.createdTicket.set(targetTicket);
        const qrPayloadToUse = targetTicket.qrPayload || targetTicket.ticketCode;
        QRCode.toDataURL(qrPayloadToUse, {
          margin: 1,
          width: 240,
          color: { dark: '#002B66', light: '#FFFFFF' }
        }).then(url => {
          this.qrDataUrl.set(url);
          this.cdr.detectChanges();
        }).catch(err => {
          console.error('Failed to generate registration QR code', err);
          QRCode.toDataURL(targetTicket!.ticketCode, { margin: 1, width: 240 })
            .then(url => {
              this.qrDataUrl.set(url);
              this.cdr.detectChanges();
            });
        });
      }
    }
    this.cdr.detectChanges();
  }

  addToGoogleCalendar(): void {
    const evt = this.event();
    if (!evt) return;
    const title = encodeURIComponent(evt.title);
    const details = encodeURIComponent(`E-Tiket UII Event\nRuang: ${evt.room}\nLokasi: ${evt.location}`);
    const location = encodeURIComponent(`${evt.room}, ${evt.location}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(url, '_blank');
  }
}
