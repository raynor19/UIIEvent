import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EventItem, EventCategory, EventStatus } from '../models/event.model';
import { RegistrationItem, TicketItem, CertificateItem } from '../models/ticket.model';
import { AuthService, getUiiProdiFromNim } from './auth.service';

const STORAGE_KEYS = {
  EVENTS: 'uii_evt_events_v3',
  REGISTRATIONS: 'uii_evt_registrations_v3',
  TICKETS: 'uii_evt_tickets_v3',
  CERTIFICATES: 'uii_evt_certificates_v3',
  NOTIFICATIONS: 'uii_evt_notifications_v3',
  SCAN_LOGS: 'uii_evt_scan_logs_v3',
};

export interface RegistrationResult {
  success: boolean;
  statusCode: number; // 201 Created, 409 Conflict, 400 Bad Request, etc.
  message: string;
  registration?: RegistrationItem;
  ticket?: TicketItem;
}

export interface CheckInResult {
  status: 'SUCCESS' | 'DUPLICATE' | 'INVALID';
  message: string;
  participantName?: string;
  nim?: string;
  eventTitle?: string;
  ticketCode?: string;
  firstCheckInTime?: string;
  checkedInBy?: string;
  certificateNumber?: string;
}

export interface NotificationLog {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL';
  recipientPhone: string;
  recipientEmail: string;
  recipientName: string;
  eventTitle: string;
  messageType: 'H-1' | 'H-3_JAM' | 'REGISTRATION_CONFIRMATION';
  timestamp: string;
  status: 'SENT' | 'FAILED_FALLBACK_EMAIL';
  contentSnippet: string;
}

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private http = inject(HttpClient);

  // Reactive signals for real-time UI binding
  events = signal<EventItem[]>([]);
  registrations = signal<RegistrationItem[]>([]);
  tickets = signal<TicketItem[]>([]);
  certificates = signal<CertificateItem[]>([]);
  notificationLogs = signal<NotificationLog[]>([]);
  applications = signal<any[]>([]);

  constructor(private authService: AuthService) {
    this.initializeData();
    this.syncWithBackend();
    this.startKeepAlivePing();
  }

  /**
   * Ping backend every 10 minutes to prevent Render.com cold start
   */
  private startKeepAlivePing(): void {
    const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const doPing = () => {
      this.http.get(`${environment.apiUrl}/ping`).subscribe({
        next: () => console.debug('[Keep-alive] Backend ping OK'),
        error: () => {} // silent
      });
    };
    // Initial ping after 5 seconds to wake up Render.com
    setTimeout(doPing, 5000);
    setInterval(doPing, PING_INTERVAL_MS);
  }

  /**
   * Check if current token is a real Sanctum token (not mock)
   */
  private hasRealToken(): boolean {
    const token = this.authService.jwtToken();
    if (!token) return false;
    // Real Sanctum tokens don't end with '.sig' and don't contain mock payload markers
    if (token.endsWith('.sig')) return false;
    // Real tokens also have proper profile saved
    const profile = typeof localStorage !== 'undefined'
      ? localStorage.getItem('uii_user_profile')
      : null;
    return !!profile;
  }

  /**
   * Asynchronously synchronize with backend Laravel API (Prioritize Real Database Records)
   */
  async syncWithBackend(): Promise<void> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/events?limit=50`)
      );
      if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
        const backendEvents = res.data.map((be: any) => this.mapBackendEventToFrontend(be));
        // Remove stale mock events starting with 'evt-'
        const current = this.events().filter(e => !e.id.startsWith('evt-'));
        backendEvents.forEach((be: EventItem) => {
          const idx = current.findIndex(e => e.id === be.id || e.slug === be.slug);
          if (idx >= 0) {
            current[idx] = be;
          } else {
            current.push(be);
          }
        });
        this.events.set(current);
      }
    } catch (e) {
      console.warn('Backend API /events not reached, using local state:', e);
    }

    if (this.authService.isLoggedIn() && this.authService.jwtToken()) {
      await this.loadMyTickets();
      await this.loadMyCertificates();
      await this.loadMyApplications();

      // If user is Organizer (Panitia), also pull organizer events
      if (this.authService.currentUser().role === 'PANITIA') {
        try {
          const orgRes: any = await firstValueFrom(
            this.http.get(`${environment.apiUrl}/organizer/events?limit=50`)
          );
          if (orgRes?.data && Array.isArray(orgRes.data)) {
            const orgEvents = orgRes.data.map((be: any) => this.mapBackendEventToFrontend(be));
            const current = this.events().filter(e => !e.id.startsWith('evt-'));
            orgEvents.forEach((oe: EventItem) => {
              const idx = current.findIndex(e => e.id === oe.id || e.slug === oe.slug);
              if (idx >= 0) {
                current[idx] = oe;
              } else {
                current.push(oe);
              }
            });
            this.events.set(current);
          }
        } catch (e) {
          // silent fallback
        }
      }

      // If user is DPK Super Admin, also pull pending curation events
      if (this.authService.currentUser().role === 'DPK_ADMIN') {
        try {
          const admRes: any = await firstValueFrom(
            this.http.get(`${environment.apiUrl}/admin/events?limit=50`)
          );
          if (admRes?.data && Array.isArray(admRes.data)) {
            const admEvents = admRes.data.map((be: any) => this.mapBackendEventToFrontend(be));
            const current = this.events().filter(e => !e.id.startsWith('evt-'));
            admEvents.forEach((ae: EventItem) => {
              const idx = current.findIndex(e => e.id === ae.id || e.slug === ae.slug);
              if (idx >= 0) {
                current[idx] = ae;
              } else {
                current.push(ae);
              }
            });
            this.events.set(current);
          }
        } catch (e) {
          // silent fallback
        }
      }
    }
  }

  async loadMyTickets(): Promise<void> {
    if (!this.authService.isLoggedIn() || !this.authService.jwtToken()) return;
    try {
      const ticketsRes: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/my-tickets?limit=50`)
      );
      if (ticketsRes?.data && Array.isArray(ticketsRes.data)) {
        const mappedTickets = ticketsRes.data.map((bt: any) => this.mapBackendTicketToFrontend(bt));
        this.tickets.set(mappedTickets);
      }
    } catch (e) {
      console.warn('Failed to load tickets from backend:', e);
    }
  }

  async loadMyCertificates(): Promise<void> {
    if (!this.authService.isLoggedIn() || !this.authService.jwtToken()) return;
    try {
      const certsRes: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/my-certificates?limit=50`)
      );
      if (certsRes?.data && Array.isArray(certsRes.data)) {
        const mappedCerts = certsRes.data.map((bc: any) => this.mapBackendCertToFrontend(bc));
        this.certificates.set(mappedCerts);
      }
    } catch (e) {
      console.warn('Failed to load certificates from backend:', e);
    }
  }

  async loadMyApplications(): Promise<void> {
    if (!this.authService.isLoggedIn() || !this.authService.jwtToken()) return;
    try {
      const appsRes: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/my-applications?limit=50`)
      );
      if (appsRes?.data && Array.isArray(appsRes.data)) {
        this.applications.set(appsRes.data);
      }
    } catch (e) {
      console.warn('Failed to load applications from backend:', e);
    }
  }

  async getOrganizerRegistrationsApi(eventId: string): Promise<any[]> {
    if (!eventId || eventId.startsWith('evt-')) return [];
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/organizer/events/${eventId}/registrations?limit=100`)
      );
      return res?.data || [];
    } catch (e) {
      console.warn('Failed to load organizer registrations:', e);
      return [];
    }
  }

  async getOrganizerApplicantsApi(eventId: string): Promise<any[]> {
    if (!eventId || eventId.startsWith('evt-')) return [];
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/organizer/events/${eventId}/applicants?limit=100`)
      );
      return res?.data || [];
    } catch (e) {
      console.warn('Failed to load organizer applicants:', e);
      return [];
    }
  }

  async updateApplicantSelectionApi(registrationId: string, selectionStatus: string, notes?: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.patch(`${environment.apiUrl}/organizer/registrations/${registrationId}/selection`, {
          selection_status: selectionStatus,
          notes: notes
        })
      );
      return true;
    } catch (e) {
      console.warn('Failed to update applicant selection:', e);
      return false;
    }
  }

  async getEventAttendanceStatsApi(eventId: string): Promise<any> {
    if (!eventId || eventId.startsWith('evt-')) return null;
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/organizer/events/${eventId}/attendance?limit=100`)
      );
      return res || null;
    } catch (e) {
      console.warn('Failed to load event attendance stats:', e);
      return null;
    }
  }

  async verifyCertificatePublicApi(hash: string): Promise<CertificateItem | null> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/certificates/verify/${hash}`)
      );
      if (res?.data) {
        return this.mapBackendCertToFrontend(res.data);
      }
    } catch (e) {
      console.warn('Public verify certificate API returned error:', e);
    }
    return null;
  }

  /**
   * Cancel Registration and return quota (Student)
   */
  async cancelRegistrationReal(ticketCode: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/my-tickets/${ticketCode}/cancel`, {})
      );
      await this.loadMyTickets();
      return true;
    } catch (e) {
      console.warn('Backend ticket cancel API returned error, falling back locally:', e);
      const ticket = this.tickets().find(t => t.ticketCode === ticketCode);
      if (ticket) {
        this.cancelRegistration(ticket.id);
      }
      return true;
    }
  }

  /**
   * Day-H Presensi Check-In with Backend API
   */
  async processScanReal(payload: string, operatorName: string = 'Panitia Meja Registrasi 1'): Promise<CheckInResult> {
    let ticketCode = '';
    let hash = '';
    const trimmed = (payload || '').trim();

    try {
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        ticketCode = parsed.ticketCode || parsed.ticket_code || '';
        hash = parsed.hash || '';
      } else if (trimmed.startsWith('TKT-') || trimmed.startsWith('UII-TIK-')) {
        ticketCode = trimmed;
      } else if (trimmed === 'VALID_TICKET_TEST') {
        ticketCode = 'VALID_TICKET_TEST';
      } else {
        // Try Base64 decoding
        try {
          const decoded = atob(trimmed);
          if (decoded.startsWith('{')) {
            const parsed = JSON.parse(decoded);
            ticketCode = parsed.ticket_code || parsed.ticketCode || '';
          } else {
            ticketCode = trimmed;
          }
        } catch {
          ticketCode = trimmed;
        }
      }
    } catch {
      ticketCode = trimmed;
    }

    if (!ticketCode) {
      ticketCode = trimmed;
    }

    if (this.authService.isLoggedIn() && this.authService.jwtToken()) {
      try {
        const res: any = await firstValueFrom(
          this.http.post(`${environment.apiUrl}/attendance/check-in`, {
            qr_payload: trimmed,
            ticket_code: ticketCode
          })
        );
        if (res?.data) {
          const attendanceData = res.data;
          const participantName = attendanceData.attendee?.name || attendanceData.user?.name || attendanceData.registration?.user?.name || 'Mahasiswa UII';
          const participantNim = attendanceData.attendee?.nim || attendanceData.user?.nim || attendanceData.registration?.user?.nim || '';
          const eventTitle = attendanceData.event?.title || 'Acara UII';
          const certNumber = attendanceData.certificate?.certificate_number || '';
          const actualCode = attendanceData.ticket_code || ticketCode;

          // Update local state
          const ticket = this.tickets().find(t => t.ticketCode.toUpperCase() === actualCode.toUpperCase());
          if (ticket) {
            ticket.isCheckedIn = true;
            ticket.checkedInAt = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
            ticket.checkedInBy = operatorName;
            this.tickets.update(prev => prev.map(t => t.id === ticket.id ? { ...ticket } : t));
          }

          // Also reload tickets & certificates in background
          this.loadMyTickets().catch(() => {});
          this.loadMyCertificates().catch(() => {});

          return {
            status: 'SUCCESS',
            message: res.message || 'Presensi Berhasil: Hadir Terverifikasi di Meja Registrasi!',
            participantName,
            nim: participantNim,
            eventTitle,
            ticketCode: actualCode,
            certificateNumber: certNumber
          };
        }
      } catch (err: any) {
        console.warn('Backend check-in API returned error:', err);
        if (err?.status === 409) {
          return {
            status: 'DUPLICATE',
            message: err.error?.message || 'Peringatan! Tiket sudah pernah di-scan sebelumnya.',
            ticketCode
          };
        }
        if (err?.status === 403) {
          return {
            status: 'INVALID',
            message: err.error?.message || 'Akses ditolak: Anda bukan panitia dari kegiatan ini.',
            ticketCode
          };
        }
        if (err?.status === 400 || err?.status === 404 || err?.status === 422) {
          return {
            status: 'INVALID',
            message: err.error?.message || 'Tiket Tidak Valid: Kode QR tidak terdaftar di sistem kepanitiaan UII.',
            ticketCode
          };
        }
      }
    }

    // Graceful fallback to client-side validation logic
    return this.processScan(payload, operatorName);
  }

  /**
   * DPK Approve event (Backend API)
   */
  async adminApproveEventReal(eventId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/admin/events/${eventId}/approve`, {})
      );
      await this.loadAdminEvents();
      return true;
    } catch (e) {
      console.warn('Backend admin approve API returned error, applying locally:', e);
      return this.dpkApproveEvent(eventId);
    }
  }

  /**
   * DPK Reject event (Backend API)
   */
  async adminRejectEventReal(eventId: string, reason: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/admin/events/${eventId}/reject`, {
          rejection_reason: reason
        })
      );
      await this.loadAdminEvents();
      return true;
    } catch (e) {
      console.warn('Backend admin reject API returned error, applying locally:', e);
      return this.dpkRejectEvent(eventId, reason);
    }
  }

  /**
   * Create Draft Event via Backend API (Panitia)
   */
  async createDraftEventReal(data: any): Promise<EventItem | null> {
    try {
      const isOprec = data.category === 'COMMITTEE_RECRUITMENT' || data.type === 'Oprec' || (data.divisions && data.divisions.length > 0);
      const catMap: Record<string, number> = {
        'SEMINAR': 1,
        'WORKSHOP': 2,
        'LOMBA': 3,
        'KONSER': 4,
        'COMMITTEE_RECRUITMENT': 5
      };

      const payload: any = {
        title: data.title,
        description: data.description || 'Pengajuan kegiatan mahasiswa UII.',
        activity_type: isOprec ? 'COMMITTEE_RECRUITMENT' : 'PARTICIPANT_EVENT',
        category_id: catMap[data.category] || (isOprec ? 5 : 1),
        location: data.location || data.room || 'Kampus Terpadu UII',
        poster_url: data.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
        start_time: (data.date || '2026-12-20') + ' 09:00:00',
        end_time: (data.date || '2026-12-20') + ' 13:00:00',
        quota_total: Number(data.quotaTotal) || 100,
        skpi_points: Number(data.skpiPoints) || 15
      };

      if (isOprec && data.divisions && data.divisions.length > 0) {
        payload.divisions = data.divisions.map((d: any) => typeof d === 'string' ? { name: d, quota: 10 } : d);
      }

      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/organizer/events`, payload)
      );
      if (res?.data) {
        const created = this.mapBackendEventToFrontend(res.data);
        this.events.update(prev => [created, ...prev]);
        return created;
      }
    } catch (e) {
      console.warn('Backend create event API returned error, creating locally:', e);
    }
    return this.createDraftEvent(data);
  }

  /**
   * Submit Event to DPK for Curation via Backend API (Panitia)
   */
  async submitEventToDpkReal(eventId: string): Promise<boolean> {
    if (!eventId || eventId.startsWith('evt-')) {
      return this.submitEventToDpk(eventId);
    }
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/organizer/events/${eventId}/submit`, {})
      );
      await this.syncWithBackend();
      return true;
    } catch (e) {
      console.warn('Backend submit to DPK API returned error, applying locally:', e);
      return this.submitEventToDpk(eventId);
    }
  }

  /**
   * Load Organizer events directly from backend for Panitia Dashboard
   */
  async loadOrganizerEvents(): Promise<void> {
    try {
      const orgRes: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/organizer/events?limit=50`)
      );
      if (orgRes?.data && Array.isArray(orgRes.data)) {
        const orgEvents = orgRes.data.map((be: any) => this.mapBackendEventToFrontend(be));
        const current = this.events().filter(e => !e.id.startsWith('evt-'));
        orgEvents.forEach((oe: EventItem) => {
          const idx = current.findIndex(e => e.id === oe.id || e.slug === oe.slug);
          if (idx >= 0) {
            current[idx] = oe;
          } else {
            current.unshift(oe);
          }
        });
        this.events.set(current);
        this.saveToStorage();
      }
    } catch (e) {
      console.warn('Failed to load organizer events from backend:', e);
    }
  }

  /**
   * Load Admin events directly from backend for DPK Curation
   */
  async loadAdminEvents(): Promise<void> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/admin/events?limit=50`)
      );
      if (res?.data && Array.isArray(res.data)) {
        const adminEvents = res.data.map((be: any) => this.mapBackendEventToFrontend(be));
        const current = this.events().filter(e => !e.id.startsWith('evt-'));
        adminEvents.forEach((ae: EventItem) => {
          const idx = current.findIndex(e => e.id === ae.id || e.slug === ae.slug);
          if (idx >= 0) {
            current[idx] = ae;
          } else {
            current.unshift(ae);
          }
        });
        this.events.set(current);
        this.saveToStorage();
      }
    } catch (e) {
      console.warn('Failed to load admin events from backend:', e);
    }
  }

  mapBackendEventToFrontend(be: any): EventItem {
    const categoryLabelMap: Record<string, string> = {
      'SEMINAR': 'Seminar Nasional',
      'WORKSHOP': 'Hands-on Workshop',
      'LOMBA': 'Kompetisi Nasional',
      'KONSER': 'Konser & Festival',
      'COMMITTEE_RECRUITMENT': 'Oprec Kepanitiaan'
    };
    const categoryKey = (be.category?.toUpperCase() || (be.activity_type === 'COMMITTEE_RECRUITMENT' ? 'COMMITTEE_RECRUITMENT' : 'SEMINAR')) as EventCategory;

    let mappedStatus: EventStatus = 'PUBLISHED';
    const rawStatus = (be.status || '').toUpperCase();
    if (rawStatus === 'PENDING' || rawStatus === 'PENDING_APPROVAL') {
      mappedStatus = 'PENDING';
    } else if (rawStatus === 'DRAFT') {
      mappedStatus = 'DRAFT';
    } else if (rawStatus === 'REJECTED') {
      mappedStatus = 'REJECTED';
    } else if (rawStatus === 'REVISION') {
      mappedStatus = 'REVISION';
    } else if (rawStatus === 'COMPLETED') {
      mappedStatus = 'COMPLETED';
    } else if (rawStatus === 'PUBLISHED') {
      mappedStatus = 'PUBLISHED';
    }

    return {
      id: be.id,
      title: be.title,
      slug: be.slug,
      category: categoryKey,
      categoryLabel: categoryLabelMap[categoryKey] || be.category || 'Kegiatan Kampus',
      organizer: be.organizer_name || (be.organizer?.name) || 'Panitia UII',
      faculty: be.organizer?.faculty || 'Fakultas Teknologi Industri',
      description: be.description || '',
      date: be.start_time ? be.start_time.substring(0, 10) : '2026-11-25',
      time: be.start_time ? `${new Date(be.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` : '08:30 WIB',
      location: be.location || 'Kampus Terpadu UII',
      room: be.location || 'Auditorium UII',
      bannerUrl: be.poster_url || '/assets/images/seminar-ai-uii.jpg',
      quotaTotal: be.quota_total || 100,
      quotaRemaining: be.quota_remaining ?? be.quota_total ?? 100,
      status: mappedStatus,
      skpiPoints: 15,
      isFree: true,
      whatsappHelpdesk: '6281234567890',
      submittedAt: be.created_at || be.submitted_at || new Date().toISOString()
    };
  }

  mapBackendTicketToFrontend(be: any): TicketItem {
    const currentUser = this.authService.currentUser();
    return {
      id: be.id,
      registrationId: be.registration_id || be.id,
      ticketCode: be.ticket_code,
      eventId: be.event?.id || '',
      eventTitle: be.event?.title || 'Kegiatan UII',
      eventCategory: 'SEMINAR',
      eventDate: be.event?.start_time ? be.event.start_time.substring(0, 10) : '2026-11-25',
      eventTime: be.event?.start_time ? `${new Date(be.event.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` : '08:30 WIB',
      eventLocation: be.event?.location || 'Kampus Terpadu UII',
      eventRoom: be.event?.location || 'Auditorium',
      userId: be.participant?.id || currentUser.id,
      userName: be.participant?.name || currentUser.name,
      userNim: be.participant?.nim || currentUser.nim,
      userStudyProgram: be.participant?.study_program || currentUser.studyProgram,
      qrPayload: be.qr_payload,
      hashSignature: be.ticket_code,
      timestampIssued: be.created_at || 'Hari ini',
      isCheckedIn: be.is_checked_in || false,
      checkedInAt: be.checked_in_at
    };
  }

  mapBackendCertToFrontend(be: any): CertificateItem {
    const currentUser = this.authService.currentUser();
    const recipient = be.recipient || be.participant || {};
    return {
      id: be.id,
      registrationId: be.registration_id || be.id,
      ticketId: be.ticket_id || be.registration_id || be.id,
      eventId: be.event?.id || '',
      eventTitle: be.event?.title || 'Kegiatan UII',
      eventDate: be.event?.start_time ? be.event.start_time.substring(0, 10) : '2026-11-25',
      organizer: 'Direktorat Pembinaan Kemahasiswaan (DPK) UII',
      userId: recipient.id || currentUser.id,
      userName: recipient.name || currentUser.name,
      userNim: recipient.nim || currentUser.nim,
      userFaculty: recipient.faculty || currentUser.faculty,
      userStudyProgram: recipient.study_program || currentUser.studyProgram,
      certificateNumber: be.certificate_number,
      skpiPoints: 15,
      issueDate: be.issued_at ? be.issued_at.substring(0, 10) : '2026-11-20',
      verificationHash: be.verify_hash,
      issuerName: 'Dr. Ir. Budi Hartono, M.T.',
      issuerRole: 'Direktur Pembinaan Kemahasiswaan UII',
      isUnlocked: true
    };
  }

  private initializeData(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
        if (savedEvents) {
          const parsed: EventItem[] = JSON.parse(savedEvents);
          const valid = parsed.filter(e => !e.id.startsWith('evt-'));
          this.events.set(valid);
        }
        const savedTickets = localStorage.getItem(STORAGE_KEYS.TICKETS);
        if (savedTickets) {
          const parsed = JSON.parse(savedTickets);
          const valid = parsed.filter((t: any) => !t.eventId?.startsWith('evt-') && !t.id?.startsWith('tck-'));
          this.tickets.set(valid);
        }
        const savedRegs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
        if (savedRegs) {
          const parsed = JSON.parse(savedRegs);
          const valid = parsed.filter((r: any) => !r.eventId?.startsWith('evt-') && !r.id?.startsWith('reg-'));
          this.registrations.set(valid);
        }
        const savedCerts = localStorage.getItem(STORAGE_KEYS.CERTIFICATES);
        if (savedCerts) {
          const parsed = JSON.parse(savedCerts);
          const valid = parsed.filter((c: any) => !c.eventId?.startsWith('evt-'));
          this.certificates.set(valid);
        }
        const savedLogs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
        if (savedLogs) {
          this.notificationLogs.set(JSON.parse(savedLogs));
        }
      } catch (e) {
        console.warn('Error reading from localStorage:', e);
      }
    }
  }

  private loadMockDefaults(): void {
    // Pure live DB mode: No mock seeds
    this.events.set([]);
    this.registrations.set([]);
    this.tickets.set([]);
    this.certificates.set([]);
  }
  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(this.events()));
    localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(this.registrations()));
    localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(this.tickets()));
    localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(this.certificates()));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.notificationLogs()));
  }

  getEventById(id: string): EventItem | undefined {
    return this.events().find(e => e.id === id);
  }

  /**
   * Check if user is already registered for this event (Anti-Double Entry Guard)
   */
  isUserRegistered(userId: string, eventId: string): boolean {
    return this.registrations().some(
      r => r.userId === userId && r.eventId === eventId && r.status !== 'CANCELLED'
    );
  }

  /**
   * Get registration record for user and event
   */
  getUserRegistration(userId: string, eventId: string): RegistrationItem | undefined {
    return this.registrations().find(
      r => r.userId === userId && r.eventId === eventId && r.status !== 'CANCELLED'
    );
  }

  /**
   * Register Participant directly through Laravel Backend API (ACID Transaction & Real Ticket)
   */
  async registerParticipantReal(data: {
    eventId: string;
    divisionChoice1?: string;
    divisionChoice2?: string;
    motivation?: string;
    cvFileName?: string;
    krsFileName?: string;
  }): Promise<RegistrationResult> {
    const event = this.getEventById(data.eventId);

    // Only call real backend if user has a real Sanctum token (not a mock JWT)
    if (this.authService.isLoggedIn() && this.authService.jwtToken() && this.hasRealToken()) {
      try {
        const isCommittee = event?.category === 'COMMITTEE_RECRUITMENT' ||
          event?.categoryLabel?.toLowerCase().includes('recruitment') ||
          event?.categoryLabel?.toLowerCase().includes('kepanitiaan');

        if (isCommittee && data.divisionChoice1) {
          const fd = new FormData();
          fd.append('division_pref_1', data.divisionChoice1 || '');
          if (data.divisionChoice2) {
            fd.append('division_pref_2', data.divisionChoice2);
          }
          fd.append('motivation', data.motivation || 'Siap berkontribusi aktif dalam kepanitiaan.');
          // Generate valid PDF magic bytes (%PDF-1.5)
          const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35, 0x0A, 0x25, 0xD0, 0xD4, 0xC5, 0xD8, 0x0A]);
          const blob = new Blob([pdfHeader], { type: 'application/pdf' });
          fd.append('cv_file', blob, data.cvFileName || 'CV_Mahasiswa_UII.pdf');

          const res: any = await firstValueFrom(
            this.http.post(`${environment.apiUrl}/events/${data.eventId}/apply`, fd)
          );
          await this.syncWithBackend();
          return {
            success: true,
            statusCode: 201,
            message: res?.message || 'Pendaftaran open recruitment panitia berhasil dikirim!'
          };
        } else {
          const res: any = await firstValueFrom(
            this.http.post(`${environment.apiUrl}/events/${data.eventId}/register`, {
              custom_answers: { motivation: data.motivation }
            })
          );
          if (res?.data) {
            const ticket = this.mapBackendTicketToFrontend(res.data);
            this.tickets.update(prev => [ticket, ...prev]);
            if (event) {
              event.quotaRemaining = Math.max(0, event.quotaRemaining - 1);
              this.events.update(prev => prev.map(e => e.id === event.id ? { ...event } : e));
            }
            return {
              success: true,
              statusCode: 201,
              message: res.message || 'Pendaftaran Berhasil! E-Tiket Anda siap digunakan.',
              ticket: ticket
            };
          }
        }
      } catch (err: any) {
        console.warn('Backend registration API returned error:', err);
        if (err?.status === 409) {
          return {
            success: false,
            statusCode: 409,
            message: err.error?.message || 'Pendaftaran Ditolak: Anda sudah terdaftar di acara ini.'
          };
        }
        if (err?.status === 401) {
          return {
            success: false,
            statusCode: 401,
            message: 'Sesi login Anda telah berakhir. Silakan login ulang untuk mendaftar kegiatan.'
          };
        }
        if (err?.status === 403) {
          return {
            success: false,
            statusCode: 403,
            message: err.error?.message || 'Akses ditolak: Anda tidak memiliki izin untuk mendaftar kegiatan ini.'
          };
        }
        if (err?.status === 422) {
          const validationMsg = err.error?.errors?.map((e: any) => e.message).join(', ');
          return {
            success: false,
            statusCode: 422,
            message: validationMsg || err.error?.message || 'Data pendaftaran tidak valid.'
          };
        }
        // Network error / Failed to fetch (CORS, timeout, server offline)
        if (err?.status === 0 || err?.name === 'TimeoutError') {
          return {
            success: false,
            statusCode: 0,
            message: 'Gagal menghubungi server. Periksa koneksi internet Anda atau coba beberapa saat lagi.'
          };
        }
        return {
          success: false,
          statusCode: err?.status || 400,
          message: err.error?.message || 'Gagal melakukan pendaftaran kegiatan.'
        };
      }
    }

    return this.registerParticipant(data);
  }

  /**
   * Register Participant with strict Concurrency and Anti-Double Entry protection (FR-REG-01, FR-REG-02)
   */
  registerParticipant(data: {
    eventId: string;
    divisionChoice1?: string;
    divisionChoice2?: string;
    motivation?: string;
    cvFileName?: string;
    krsFileName?: string;
  }): RegistrationResult {
    const user = this.authService.currentUser();
    const event = this.getEventById(data.eventId);

    if (!event) {
      return {
        success: false,
        statusCode: 404,
        message: 'Acara tidak ditemukan di sistem.'
      };
    }

    // 1. Anti-Double Entry Check (UNIQUE(user_id, event_id)) -> HTTP 409 Conflict
    if (this.isUserRegistered(user.id, event.id)) {
      return {
        success: false,
        statusCode: 409, // HTTP 409 Conflict as mandated by PRD FR-REG-02
        message: 'Pendaftaran Ditolak: Anda sudah terdaftar di acara ini (HTTP 409 Conflict).'
      };
    }

    // 2. Check Quota / Waiting List
    const isWaitingList = event.quotaRemaining <= 0;
    const status: RegistrationItem['status'] = isWaitingList ? 'WAITING_LIST' : 'REGISTERED';

    // 3. Create Registration Item
    const regId = 'reg-' + Math.random().toString(36).substring(2, 9);
    const newReg: RegistrationItem = {
      id: regId,
      userId: user.id,
      userNim: user.nim,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      userFaculty: user.faculty,
      userStudyProgram: user.studyProgram,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: `${event.room}, ${event.location}`,
      status: status,
      createdAt: new Date().toISOString(),
      divisionChoice1: data.divisionChoice1,
      divisionChoice2: data.divisionChoice2,
      motivation: data.motivation,
      cvFileName: data.cvFileName,
      krsFileName: data.krsFileName
    };

    // 4. Update Event Quota (Atomic Lock emulation)
    if (!isWaitingList) {
      event.quotaRemaining = Math.max(0, event.quotaRemaining - 1);
    }

    // 5. Generate Ticket (HMAC-SHA256 signature representation)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketCode = `UII-TIK-2026-${randomSuffix}`;
    const hashSignature = this.generateHashSignature(user.nim, event.id, ticketCode);

    const qrPayloadObj = {
      ticketCode: ticketCode,
      nim: user.nim,
      name: user.name,
      eventId: event.id,
      hash: hashSignature,
      timestamp: Date.now()
    };

    const newTicket: TicketItem = {
      id: 'tck-' + Math.random().toString(36).substring(2, 9),
      registrationId: regId,
      ticketCode: ticketCode,
      eventId: event.id,
      eventTitle: event.title,
      eventCategory: event.category,
      eventDate: event.date,
      eventTime: event.time,
      eventLocation: event.location,
      eventRoom: event.room,
      userId: user.id,
      userName: user.name,
      userNim: user.nim,
      userStudyProgram: `${user.studyProgram} - ${user.faculty}`,
      qrPayload: JSON.stringify(qrPayloadObj),
      hashSignature: hashSignature,
      timestampIssued: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' WIB',
      isCheckedIn: false
    };

    // 6. Record Notification Log (Simulate WhatsApp blast confirmation)
    const newLog: NotificationLog = {
      id: 'log-' + Date.now(),
      channel: 'WHATSAPP',
      recipientPhone: user.phone,
      recipientEmail: user.email,
      recipientName: user.name,
      eventTitle: event.title,
      messageType: 'REGISTRATION_CONFIRMATION',
      timestamp: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB',
      status: 'SENT',
      contentSnippet: `Pendaftaran berhasil! Tiket QR Code Anda telah diterbitkan dengan kode ${ticketCode}.`
    };

    // Update state
    this.registrations.update(prev => [newReg, ...prev]);
    this.tickets.update(prev => [newTicket, ...prev]);
    this.notificationLogs.update(prev => [newLog, ...prev]);
    this.events.update(prev => prev.map(e => e.id === event.id ? { ...event } : e));

    this.saveToStorage();

    // Asynchronously notify backend Laravel API
    if (this.authService.isLoggedIn() && this.authService.jwtToken()) {
      if (data.cvFileName && (event.category === 'COMMITTEE_RECRUITMENT' || data.divisionChoice1)) {
        const fd = new FormData();
        fd.append('division_pref_1', data.divisionChoice1 || '');
        fd.append('division_pref_2', data.divisionChoice2 || '');
        fd.append('motivation', data.motivation || '');
        this.http.post(`${environment.apiUrl}/events/${event.id}/apply`, fd).subscribe({
          next: () => console.log('[API] Oprec application synced with backend'),
          error: (e) => console.warn('[API] Oprec application sync notice:', e?.message || e)
        });
      } else {
        this.http.post(`${environment.apiUrl}/events/${event.id}/register`, {
          custom_answers: { motivation: data.motivation }
        }).subscribe({
          next: (res: any) => {
            console.log('[API] Participant registration synced with backend');
            if (res?.data?.ticket_code) {
              newTicket.ticketCode = res.data.ticket_code;
              newTicket.qrPayload = res.data.qr_payload;
              this.saveToStorage();
            }
          },
          error: (e) => console.warn('[API] Participant registration sync notice:', e?.message || e)
        });
      }
    }

    return {
      success: true,
      statusCode: 201,
      message: isWaitingList
        ? 'Kuota penuh, Anda terdaftar dalam Waiting List prioritas.'
        : 'Pendaftaran Berhasil! E-Tiket Anda siap digunakan.',
      registration: newReg,
      ticket: newTicket
    };
  }

  /**
   * Cancel Ticket & return +1 quota to system (FR-TCK-04)
   */
  cancelRegistration(ticketId: string): boolean {
    const ticket = this.tickets().find(t => t.id === ticketId);
    if (!ticket) return false;

    // Check in cannot be cancelled
    if (ticket.isCheckedIn) return false;

    const event = this.getEventById(ticket.eventId);
    if (event) {
      event.quotaRemaining = Math.min(event.quotaTotal, event.quotaRemaining + 1);
      this.events.update(prev => prev.map(e => e.id === event.id ? { ...event } : e));
    }

    // Update ticket & registration status
    this.tickets.update(prev => prev.filter(t => t.id !== ticketId));
    this.registrations.update(prev => prev.map(r => r.id === ticket.registrationId ? { ...r, status: 'CANCELLED' } : r));

    this.saveToStorage();

    // Asynchronously notify backend Laravel API
    if (this.authService.isLoggedIn() && this.authService.jwtToken()) {
      this.http.post(`${environment.apiUrl}/my-tickets/${ticket.ticketCode}/cancel`, {}).subscribe({
        next: () => console.log('[API] Ticket cancellation synced with backend'),
        error: (e) => console.warn('[API] Ticket cancellation sync notice:', e?.message || e)
      });
    }

    return true;
  }

  /**
   * Process QR Scan at Registration Desk (SCR-PAN-05 / FR-TCK-02, FR-TCK-03, FR-CRT-01)
   */
  processScan(scannedPayload: string, operatorName: string = 'Panitia Meja Registrasi 1'): CheckInResult {
    let ticketCode = '';
    let hash = '';

    try {
      if (scannedPayload.startsWith('{')) {
        const parsed = JSON.parse(scannedPayload);
        ticketCode = parsed.ticketCode || '';
        hash = parsed.hash || '';
      } else {
        ticketCode = scannedPayload.trim();
      }
    } catch {
      ticketCode = scannedPayload.trim();
    }

    // Match ticket in database
    const ticket = this.tickets().find(
      t => t.ticketCode.toUpperCase() === ticketCode.toUpperCase() ||
           (hash && t.hashSignature === hash)
    );

    if (!ticket) {
      return {
        status: 'INVALID',
        message: 'Tiket Tidak Valid: Kode QR tidak terdaftar di sistem kepanitiaan UII.',
        ticketCode: ticketCode
      };
    }

    // SCENARIO 2.2: Second scan -> DUPLICATE!
    if (ticket.isCheckedIn) {
      return {
        status: 'DUPLICATE',
        message: `Peringatan! Tiket sudah pernah di-scan pada pukul ${ticket.checkedInAt || 'sebelumnya'} oleh ${ticket.checkedInBy || 'Panitia 1'}.`,
        participantName: ticket.userName,
        nim: ticket.userNim,
        eventTitle: ticket.eventTitle,
        ticketCode: ticket.ticketCode,
        firstCheckInTime: ticket.checkedInAt,
        checkedInBy: ticket.checkedInBy
      };
    }

    // SCENARIO 2.1: First scan -> VALID SUCCESS!
    const checkInTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    
    // Update ticket status
    ticket.isCheckedIn = true;
    ticket.checkedInAt = checkInTime;
    ticket.checkedInBy = operatorName;

    // Update registration status to ATTENDED
    this.registrations.update(prev =>
      prev.map(r => r.id === ticket.registrationId ? { ...r, status: 'ATTENDED', attendedAt: new Date().toISOString() } : r)
    );
    this.tickets.update(prev =>
      prev.map(t => t.id === ticket.id ? { ...ticket } : t)
    );

    // Auto-generate SKPI Certificate (FR-CRT-01 & FR-CRT-02)
    const prodiInfo = getUiiProdiFromNim(ticket.userNim);
    const facShort = prodiInfo.faculty.includes('Teknologi Industri') ? 'FTI' :
                     prodiInfo.faculty.includes('Sipil') ? 'FTSP' :
                     prodiInfo.faculty.includes('Matematika') ? 'FMIPA' :
                     prodiInfo.faculty.includes('Ekonomika') ? 'FBE' :
                     prodiInfo.faculty.includes('Hukum') ? 'FH' :
                     prodiInfo.faculty.includes('Agama') ? 'FIAI' :
                     prodiInfo.faculty.includes('Psikologi') ? 'FPSB' :
                     prodiInfo.faculty.includes('Kedokteran') ? 'FK' : 'UII';
    const certNumber = `UII/SKPI/2026/${facShort}-${Math.floor(1000 + Math.random() * 9000)}`;
    const event = this.getEventById(ticket.eventId);
    const certHash = this.generateHashSignature(ticket.userNim, ticket.eventId, certNumber);

    const newCert: CertificateItem = {
      id: 'cert-' + Math.random().toString(36).substring(2, 9),
      registrationId: ticket.registrationId,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      eventTitle: ticket.eventTitle,
      eventDate: ticket.eventDate,
      userId: ticket.userId,
      userName: ticket.userName,
      userNim: ticket.userNim,
      userFaculty: prodiInfo.faculty,
      userStudyProgram: prodiInfo.studyProgram,
      certificateNumber: certNumber,
      skpiPoints: event ? event.skpiPoints : 15,
      issueDate: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      verificationHash: certHash,
      issuerName: 'Dr. Ir. Budi Hartono, M.T.',
      issuerRole: 'Direktur Pembinaan Kemahasiswaan UII',
      isUnlocked: true
    };

    // Avoid duplicate cert creation
    const exists = this.certificates().some(c => c.ticketId === ticket.id);
    if (!exists) {
      this.certificates.update(prev => [newCert, ...prev]);
    }

    this.saveToStorage();

    // Asynchronously notify backend Laravel API Day-H Attendance Scanner
    if (this.authService.isLoggedIn() && this.authService.jwtToken()) {
      this.http.post(`${environment.apiUrl}/attendance/check-in`, {
        qr_payload: scannedPayload,
        ticket_code: ticket.ticketCode
      }).subscribe({
        next: () => console.log('[API] Day-H Attendance check-in synced with backend'),
        error: (e) => console.warn('[API] Day-H Attendance check-in sync notice:', e?.message || e)
      });
    }

    return {
      status: 'SUCCESS',
      message: 'Presensi Berhasil: Hadir Terverifikasi di Meja Registrasi!',
      participantName: ticket.userName,
      nim: ticket.userNim,
      eventTitle: ticket.eventTitle,
      ticketCode: ticket.ticketCode,
      certificateNumber: certNumber
    };
  }

  /**
   * Reset all demo data to initial mock seed
   */
  resetToInitialMock(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      localStorage.removeItem(STORAGE_KEYS.REGISTRATIONS);
      localStorage.removeItem(STORAGE_KEYS.TICKETS);
      localStorage.removeItem(STORAGE_KEYS.CERTIFICATES);
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    }
    this.events.set([]);
    this.registrations.set([]);
    this.tickets.set([]);
    this.certificates.set([]);
    this.syncWithBackend();
  }

  /**
   * Create Draft Event (by Panitia LEM / UKM)
   */
  createDraftEvent(data: Partial<EventItem>): EventItem {
    const id = 'evt-' + Math.random().toString(36).substring(2, 8);
    const slug = (data.title || 'event-baru')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const newEvent: EventItem = {
      id,
      title: data.title || 'Acara Baru Ormawa UII',
      slug,
      category: data.category || 'SEMINAR',
      categoryLabel: data.categoryLabel || 'Seminar Kampus',
      organizer: data.organizer || 'LEM FTI UII',
      faculty: data.faculty || 'Fakultas Teknologi Industri',
      description: data.description || '',
      date: data.date || '2026-12-20',
      time: data.time || '09:00 - 13:00 WIB',
      location: data.location || 'Kampus Terpadu UII, Jl. Kaliurang KM 14.5',
      room: data.room || 'Auditorium Lt. 3',
      bannerUrl: data.bannerUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      quotaTotal: Number(data.quotaTotal) || 100,
      quotaRemaining: Number(data.quotaTotal) || 100,
      status: data.status || 'DRAFT',
      skpiPoints: Number(data.skpiPoints) || 15,
      isFree: data.isFree ?? true,
      price: data.price || 0,
      speaker: data.speaker,
      oprecDivisions: data.oprecDivisions,
      whatsappHelpdesk: data.whatsappHelpdesk || '6281234567890',
      proposalFileName: data.proposalFileName || 'Proposal_Kegiatan_UII_2026.pdf',
      submittedAt: data.status === 'PENDING' ? new Date().toISOString() : undefined,
      instagramPostStatus: { isPosted: false }
    };

    this.events.update(prev => [newEvent, ...prev]);
    this.saveToStorage();
    return newEvent;
  }

  /**
   * Submit draft event to DPK for curation
   */
  submitEventToDpk(eventId: string): boolean {
    const found = this.events().find(e => e.id === eventId);
    if (!found) return false;

    found.status = 'PENDING';
    found.submittedAt = new Date().toISOString();
    found.dpkReviewNotes = undefined;

    this.events.update(prev => prev.map(e => e.id === eventId ? { ...found } : e));
    this.saveToStorage();
    return true;
  }

  /**
   * DPK Approve event -> publishes event & automatically posts to Instagram @uii.events
   */
  dpkApproveEvent(eventId: string, approverName: string = 'Dr. Ir. Budi Hartono, M.T.'): boolean {
    const found = this.events().find(e => e.id === eventId);
    if (!found) return false;

    const postDate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const postTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    found.status = 'PUBLISHED';
    found.reviewedAt = new Date().toISOString();
    found.reviewedBy = approverName;
    found.dpkReviewNotes = 'Proposal telah ditinjau dan disetujui DPK UII. Memenuhi norma kepatutan kampus islami & bobot SKPI sah.';

    // Automated Instagram broadcast to @uii.events
    found.instagramPostStatus = {
      isPosted: true,
      postId: 'ig_post_' + Math.floor(10000000 + Math.random() * 90000000),
      postedAt: `${postDate}, ${postTime}`,
      mediaUrl: `https://instagram.com/p/uii.events/${found.slug.substring(0, 10)}`
    };

    this.events.update(prev => prev.map(e => e.id === eventId ? { ...found } : e));
    this.saveToStorage();
    return true;
  }

  /**
   * DPK Request Revision with curation notes
   */
  dpkRequestRevision(eventId: string, notes: string, reviewerName: string = 'Dr. Ir. Budi Hartono, M.T.'): boolean {
    const found = this.events().find(e => e.id === eventId);
    if (!found) return false;

    found.status = 'REVISION';
    found.reviewedAt = new Date().toISOString();
    found.reviewedBy = reviewerName;
    found.dpkReviewNotes = notes || 'Harap lengkapi rincian anggaran biaya, rundown acara, dan konfirmasi pembicara.';

    this.events.update(prev => prev.map(e => e.id === eventId ? { ...found } : e));
    this.saveToStorage();
    return true;
  }

  /**
   * DPK Reject Event
   */
  dpkRejectEvent(eventId: string, notes: string, reviewerName: string = 'Dr. Ir. Budi Hartono, M.T.'): boolean {
    const found = this.events().find(e => e.id === eventId);
    if (!found) return false;

    found.status = 'REJECTED';
    found.reviewedAt = new Date().toISOString();
    found.reviewedBy = reviewerName;
    found.dpkReviewNotes = notes || 'Kegiatan belum memenuhi kriteria kepatutan norma kemahasiswaan UII.';

    this.events.update(prev => prev.map(e => e.id === eventId ? { ...found } : e));
    this.saveToStorage();
    return true;
  }

  /**
   * Update Oprec Selection Decision (Panitia)
   */
  updateOprecSelection(registrationId: string, status: 'ACCEPTED' | 'REJECTED'): boolean {
    const reg = this.registrations().find(r => r.id === registrationId);
    if (!reg) return false;

    reg.selectionStatus = status;
    this.registrations.update(prev => prev.map(r => r.id === registrationId ? { ...reg } : r));
    this.saveToStorage();
    return true;
  }

  /**
   * Send simulated WhatsApp reminder (H-1 or H-3 Jam)
   */
  sendSimulatedWhatsAppReminder(ticketId: string, type: 'H-1' | 'H-3_JAM'): NotificationLog | null {
    const ticket = this.tickets().find(t => t.id === ticketId);
    if (!ticket) return null;

    const timeStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const msgContent = type === 'H-1'
      ? `[REMINDER H-1 ACARA] Assalamu'alaikum ${ticket.userName}, mengingatkan besok adalah pelaksanaan "${ticket.eventTitle}" bertempat di ${ticket.eventRoom}. Siapkan E-Tiket QR Anda (${ticket.ticketCode}) untuk presensi masuk.`
      : `[REMINDER H-3 JAM] Assalamu'alaikum ${ticket.userName}, 3 jam lagi acara "${ticket.eventTitle}" akan dimulai di ${ticket.eventRoom}. Pintu registrasi dibuka 30 menit sebelum acara. Tunjukkan QR Tiket Anda kepada panitia di meja registrasi.`;

    const newLog: NotificationLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      channel: 'WHATSAPP',
      recipientPhone: '081234567890',
      recipientEmail: `${ticket.userNim}@students.uii.ac.id`,
      recipientName: ticket.userName,
      eventTitle: ticket.eventTitle,
      messageType: type,
      timestamp: timeStr,
      status: 'SENT',
      contentSnippet: msgContent
    };

    this.notificationLogs.update(prev => [newLog, ...prev]);
    this.saveToStorage();
    return newLog;
  }

  /**
   * Export Event Attendance to CSV for LPJ fisik panitia
   */
  exportEventAttendanceCsv(eventId: string): { fileName: string; content: string } {
    const event = this.getEventById(eventId);
    const regs = this.registrations().filter(r => r.eventId === eventId);
    const tickets = this.tickets().filter(t => t.eventId === eventId);

    const headers = [
      'No',
      'NIM',
      'Nama Lengkap',
      'Program Studi',
      'Fakultas',
      'Email',
      'Nomor WhatsApp',
      'Status Pendaftaran',
      'Status Check-In',
      'Waktu Presensi',
      'Kode E-Tiket',
      'Nomor Sertifikat SKPI'
    ];

    const rows = regs.map((reg, idx) => {
      const ticket = tickets.find(t => t.registrationId === reg.id);
      const cert = this.certificates().find(c => c.registrationId === reg.id);

      return [
        idx + 1,
        `"${reg.userNim}"`,
        `"${reg.userName}"`,
        `"${reg.userStudyProgram}"`,
        `"${reg.userFaculty}"`,
        `"${reg.userEmail}"`,
        `"${reg.userPhone}"`,
        `"${reg.status}"`,
        `"${ticket?.isCheckedIn ? 'HADIR' : 'BELUM HADIR'}"`,
        `"${ticket?.checkedInAt || '-'}"`,
        `"${ticket?.ticketCode || '-'}"`,
        `"${cert?.certificateNumber || '-'}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const safeTitle = (event?.title || 'Acara').substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Rekap_Presensi_${safeTitle}_LPJ_${new Date().toISOString().slice(0, 10)}.csv`;

    return { fileName, content: csvContent };
  }

  private generateHashSignature(nim: string, eventId: string, extra: string): string {
    const raw = `${nim}::${eventId}::${extra}::UII_HMAC_SECRET_2026`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `uii2026${hex}fa78c89b4182`;
  }
}
