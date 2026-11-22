import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';

export interface PanitiaEventItem {
  id: string;
  title: string;
  dateStr: string;
  dateRaw: string;
  type: 'Peserta' | 'Oprec';
  registeredCount: number;
  quota: number;
  status: 'DIPUBLIKASIKAN' | 'PERLU_REVISI' | 'MENUNGGU' | 'DRAF' | 'DITOLAK' | 'SELESAI';
  hasScanner: boolean;
  category: string;
  location: string;
  bannerUrl: string;
  speaker?: string;
  revisionNote?: string;
  rejectionReason?: string;
}

export interface CustomQuestion {
  id: string;
  title: string;
  type: 'SELECT' | 'TEXT';
  options?: string[];
}

export interface ParticipantItem {
  no: number;
  id?: string;
  ticketCode?: string;
  nim: string;
  name: string;
  prodi: string;
  whatsapp: string;
  registeredAt: string;
  status: 'HADIR' | 'BELUM_HADIR' | 'BATAL';
}

export interface ApplicantItem {
  nim: string;
  name: string;
  division1: string;
  division2: string;
  fileUrl: string;
  status: 'MENUNGGU_REVIEW' | 'WAWANCARA_DIJADWALKAN' | 'DITERIMA' | 'DITOLAK';
  interviewDate?: string;
  interviewTime?: string;
  interviewRoom?: string;
  whatsapp?: string;
}

@Component({
  selector: 'app-panitia-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './panitia-dashboard.component.html'
})
export class PanitiaDashboardComponent implements OnInit {
  authService = inject(AuthService);
  eventService = inject(EventService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  currentUser = this.authService.currentUser;

  constructor() {
    effect(() => {
      const allSvc = this.eventService.events();
      this.syncEventsFromService(allSvc);
    }, { allowSignalWrites: true });
  }

  // View state: 'DASHBOARD' | 'CREATE' | 'REKAP_PESERTA' | 'SELEKSI_OPREC'
  activeView = signal<'DASHBOARD' | 'CREATE' | 'REKAP_PESERTA' | 'SELEKSI_OPREC'>('DASHBOARD');

  // Filter pills for Dashboard
  selectedFilter = signal<string>('SEMUA');
  searchQuery = signal<string>('');

  // Mobile sidebar toggle for small screens (HP responsiveness)
  mobileMenuOpen = signal<boolean>(false);

  // Success toast
  toastMessage = signal<string>('');

  // Modals
  showSubmitConfirmationModal = signal<boolean>(false);
  showRevisionModal = signal<boolean>(false);
  selectedEventForDetail = signal<PanitiaEventItem | null>(null);

  // 4-Step Wizard State
  currentStep = signal<number>(1);
  isRevisionMode = signal<boolean>(false);

  // Step 1: Info Dasar
  formTitle = signal<string>('Seminar Etika Profesi Informatika');
  formCategory = signal<string>('Seminar');
  formExecutionType = signal<'Offline' | 'Online' | 'Hybrid'>('Offline');
  formLocation = signal<string>('Ruang Audiovisual FTI UII');
  formZoomLink = signal<string>('https://uii-ac-id.zoom.us/j/98127391823');
  formStartDate = signal<string>('2026-12-09');
  formStartTime = signal<string>('09:00');
  formEndDate = signal<string>('2026-12-09');
  formEndTime = signal<string>('12:00');
  formSpeaker = signal<string>('Dr. Ir. Hari Purnomo, M.T., IPU (Ketua Komite Etik PII)');
  formRevisionNote = signal<string>(
    'Cantumkan nama pembicara dan pastikan poster memakai rasio 4:5 atau 1:1. Jadwal selesai belum diisi.'
  );

  // Step 2: Media
  formPosterUrl = signal<string>('/assets/images/seminar-ai-uii.jpg');
  formPosterFileName = signal<string>('poster-seminar-etika-4x5.jpg');

  // Step 3: Mode Pendaftaran
  formRegistrationMode = signal<'PESERTA' | 'OPREC'>('PESERTA');
  formDivisions = signal<string[]>([
    'Divisi Acara',
    'Divisi Humas & Sponsorship',
    'Divisi Logistik & Perlengkapan',
    'Divisi Publikasi, Dekorasi & Dokumentasi',
    'Divisi Konsumsi'
  ]);
  newDivisionInput = signal<string>('');

  // Step 4: Kuota & Form
  formQuota = signal<number>(150);
  formDeadlineDate = signal<string>('2026-12-08');
  formDeadlineTime = signal<string>('23:59');
  formSkpiPoints = signal<number>(15);
  formCustomQuestions = signal<CustomQuestion[]>([
    {
      id: 'q1',
      title: 'Ukuran Kaos',
      type: 'SELECT',
      options: ['S', 'M', 'L', 'XL', 'XXL']
    },
    {
      id: 'q2',
      title: 'Riwayat Alergi Makanan',
      type: 'TEXT'
    }
  ]);
  newQuestionTitle = signal<string>('');
  newQuestionType = signal<'SELECT' | 'TEXT'>('SELECT');

  // Master event list synchronized directly with EventService (strictly matching Catalog & DPK)
  events = signal<PanitiaEventItem[]>([]);

  // ========================================================
  // SCR-PAN-03: REKAP PESERTA & PRESENSI DATA & STATE
  // ========================================================
  selectedRekapEventId = signal<string>('');
  isEventDropdownOpen = signal<boolean>(false);
  realOrganizerParticipants = signal<ParticipantItem[]>([]);
  isLoadingParticipants = signal<boolean>(false);

  toggleEventDropdown(): void {
    this.isEventDropdownOpen.update(v => !v);
  }

  closeEventDropdown(): void {
    this.isEventDropdownOpen.set(false);
  }

  selectedRekapEvent = computed(() => {
    const currentId = this.selectedRekapEventId();
    const list = this.eventsWithDynamicCounts();
    const found = list.find(e => e.id === currentId);
    return found || list[0] || null;
  });

  async selectRekapEvent(eventId: string): Promise<void> {
    this.selectedRekapEventId.set(eventId);
    this.currentPageParticipants.set(1);
    this.participantSearchQuery.set('');
    this.isEventDropdownOpen.set(false);

    await this.loadParticipantsForEvent(eventId);

    const ev = this.events().find(e => e.id === eventId);
    if (ev?.type === 'Oprec') {
      this.activeView.set('SELEKSI_OPREC');
    } else {
      this.activeView.set('REKAP_PESERTA');
    }
  }

  async loadParticipantsForEvent(eventId: string): Promise<void> {
    if (!eventId) return;
    this.isLoadingParticipants.set(true);
    try {
      const ev = this.events().find(e => e.id === eventId);
      if (ev?.type === 'Oprec') {
        const applicantsData = await this.eventService.getOrganizerApplicantsApi(eventId);
        if (Array.isArray(applicantsData) && applicantsData.length > 0) {
          const mappedApplicants: ApplicantItem[] = applicantsData.map((item: any, idx: number) => {
            let mappedStatus: 'MENUNGGU_REVIEW' | 'WAWANCARA_DIJADWALKAN' | 'DITERIMA' | 'DITOLAK' = 'MENUNGGU_REVIEW';
            if (item.selection_status === 'ACCEPTED') mappedStatus = 'DITERIMA';
            else if (item.selection_status === 'REJECTED') mappedStatus = 'DITOLAK';
            else if (item.selection_status === 'INTERVIEW') mappedStatus = 'WAWANCARA_DIJADWALKAN';

            return {
              nim: item.user?.nim || '',
              name: item.user?.name || 'Mahasiswa UII',
              division1: item.division_choice_1 || item.division_pref_1 || 'Divisi Acara',
              division2: item.division_choice_2 || item.division_pref_2 || 'Divisi Humas',
              fileUrl: item.cv_file_url || '#',
              whatsapp: item.user?.phone_number || '081234567890',
              status: mappedStatus
            };
          });
          this.applicants.set(mappedApplicants);
        }
      } else {
        const data = await this.eventService.getOrganizerRegistrationsApi(eventId);
        if (Array.isArray(data) && data.length > 0) {
          const mapped: ParticipantItem[] = data.map((item: any, idx: number) => {
            let status: 'HADIR' | 'BELUM_HADIR' | 'BATAL' = 'BELUM_HADIR';
            if (item.status === 'CANCELLED') {
              status = 'BATAL';
            } else if (item.status === 'ATTENDED' || item.ticket?.is_checked_in) {
              status = 'HADIR';
            }

            const dateObj = new Date(item.registered_at);
            const formattedDate = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
              : item.registered_at;

            return {
              no: idx + 1,
              id: item.id,
              ticketCode: item.ticket?.ticket_code || '-',
              nim: item.user?.nim || '-',
              name: item.user?.name || 'Mahasiswa UII',
              prodi: item.user?.study_program || item.user?.faculty || 'Informatika',
              whatsapp: item.user?.phone_number || '081234567890',
              registeredAt: formattedDate,
              status: status
            };
          });
          this.realOrganizerParticipants.set(mapped);
        } else {
          this.realOrganizerParticipants.set([]);
        }
      }
    } catch (e) {
      console.warn('Failed to load participants for event:', e);
    } finally {
      this.isLoadingParticipants.set(false);
    }
  }

  currentEventParticipants = computed(() => {
    const real = this.realOrganizerParticipants();
    if (real.length > 0) {
      return real.map((p, idx) => ({ ...p, no: idx + 1 }));
    }

    const targetEvent = this.selectedRekapEvent();
    if (!targetEvent) return [];

    const targetId = targetEvent.id;
    const targetTitle = targetEvent.title.toLowerCase().trim();
    const allRegs = this.eventService.registrations();
    const allTickets = this.eventService.tickets();

    // 1. Get registrations from EventService matching this specific event
    const serviceMatching = allRegs.filter(r => {
      if (r.eventId === targetId) return true;
      if (r.eventTitle && r.eventTitle.toLowerCase().trim() === targetTitle) return true;
      return false;
    });

    const mappedFromService: ParticipantItem[] = serviceMatching.map((reg, idx) => {
      const ticket = allTickets.find(t => t.registrationId === reg.id || t.eventId === reg.eventId);
      let status: 'HADIR' | 'BELUM_HADIR' | 'BATAL' = 'BELUM_HADIR';
      if (reg.status === 'CANCELLED') {
        status = 'BATAL';
      } else if (reg.status === 'ATTENDED' || ticket?.isCheckedIn) {
        status = 'HADIR';
      }

      const dateObj = new Date(reg.createdAt);
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : reg.createdAt;

      return {
        no: idx + 1,
        nim: reg.userNim,
        name: reg.userName,
        prodi: reg.userStudyProgram || 'Informatika',
        whatsapp: reg.userPhone || '081234567890',
        registeredAt: formattedDate,
        status: status
      };
    });

    // 2. Local participants explicitly assigned to this event
    const localMatching = this.participants().filter(p => (p as any).eventId === targetId);

    const combined = [...mappedFromService];
    for (const p of localMatching) {
      if (!combined.some(c => c.nim === p.nim)) {
        combined.push(p);
      }
    }

    return combined.map((p, idx) => ({ ...p, no: idx + 1 }));
  });

  participants = signal<ParticipantItem[]>(this.generateInitialParticipants());

  currentPageParticipants = signal<number>(1);
  pageSizeParticipants = signal<number>(10);

  participantSearchQuery = signal<string>('');
  participantFilter = signal<'SEMUA' | 'HADIR' | 'BELUM_HADIR' | 'BATAL'>('SEMUA');

  filteredParticipants = computed(() => {
    let list = this.currentEventParticipants();
    const filter = this.participantFilter();
    const query = this.participantSearchQuery().trim().toLowerCase();

    if (filter !== 'SEMUA') {
      list = list.filter(p => p.status === filter);
    }

    if (query) {
      list = list.filter(p =>
        p.nim.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.prodi.toLowerCase().includes(query) ||
        (p.ticketCode && p.ticketCode.toLowerCase().includes(query))
      );
    }

    return list;
  });

  totalPagesParticipants = computed(() => {
    return Math.max(1, Math.ceil(this.filteredParticipants().length / this.pageSizeParticipants()));
  });

  pagedParticipants = computed(() => {
    const list = this.filteredParticipants();
    const page = this.currentPageParticipants();
    const size = this.pageSizeParticipants();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  participantRangeText = computed(() => {
    const total = this.filteredParticipants().length;
    if (total === 0) return '0 data';
    const start = (this.currentPageParticipants() - 1) * this.pageSizeParticipants() + 1;
    const end = Math.min(start + this.pageSizeParticipants() - 1, total);
    return `Menampilkan ${start}–${end} dari ${total} data`;
  });

  setPageParticipants(page: number): void {
    if (page >= 1 && page <= this.totalPagesParticipants()) {
      this.currentPageParticipants.set(page);
    }
  }

  onPageSizeParticipantsChange(size: any): void {
    this.pageSizeParticipants.set(Number(size));
    this.currentPageParticipants.set(1);
  }

  private generateInitialParticipants(): ParticipantItem[] {
    return [];
  }

  // Dynamic participant counts per selected event
  terdaftarAktifCount = computed(() => {
    return this.currentEventParticipants().filter(p => p.status !== 'BATAL').length;
  });

  hadirCount = computed(() => {
    return this.currentEventParticipants().filter(p => p.status === 'HADIR').length;
  });

  belumHadirCount = computed(() => {
    return this.currentEventParticipants().filter(p => p.status === 'BELUM_HADIR').length;
  });

  batalCount = computed(() => {
    return this.currentEventParticipants().filter(p => p.status === 'BATAL').length;
  });

  // ========================================================
  // SCR-PAN-04: SELEKSI OPREC PANITIA DATA & STATE
  // ========================================================
  applicants = signal<ApplicantItem[]>(this.generateInitialApplicants());

  currentPageApplicants = signal<number>(1);
  pageSizeApplicants = signal<number>(10);

  applicantSearchQuery = signal<string>('');
  applicantDivisionFilter = signal<string>('SEMUA');

  filteredApplicants = computed(() => {
    let list = this.applicants();
    const div = this.applicantDivisionFilter();
    const query = this.applicantSearchQuery().trim().toLowerCase();

    if (div !== 'SEMUA') {
      list = list.filter(a => a.division1.toLowerCase().includes(div.toLowerCase()) || a.division2.toLowerCase().includes(div.toLowerCase()));
    }

    if (query) {
      list = list.filter(a =>
        a.nim.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.division1.toLowerCase().includes(query)
      );
    }

    return list;
  });

  totalPagesApplicants = computed(() => {
    return Math.max(1, Math.ceil(this.filteredApplicants().length / this.pageSizeApplicants()));
  });

  pagedApplicants = computed(() => {
    const list = this.filteredApplicants();
    const page = this.currentPageApplicants();
    const size = this.pageSizeApplicants();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  applicantRangeText = computed(() => {
    const total = this.filteredApplicants().length;
    if (total === 0) return '0 data';
    const start = (this.currentPageApplicants() - 1) * this.pageSizeApplicants() + 1;
    const end = Math.min(start + this.pageSizeApplicants() - 1, total);
    return `Menampilkan ${start}–${end} dari ${total} data`;
  });

  setPageApplicants(page: number): void {
    if (page >= 1 && page <= this.totalPagesApplicants()) {
      this.currentPageApplicants.set(page);
    }
  }

  onPageSizeApplicantsChange(size: any): void {
    this.pageSizeApplicants.set(Number(size));
    this.currentPageApplicants.set(1);
  }

  private generateInitialApplicants(): ApplicantItem[] {
    return [];
  }

  // Modal Jadwalkan Wawancara State
  selectedApplicantForInterview = signal<ApplicantItem | null>(null);
  interviewDate = signal<string>('Kamis, 10 Des 2026');
  interviewTime = signal<string>('13.00 WIB');
  interviewRoom = signal<string>('Sekretariat LEM UII, Gedung Student Center');

  whatsappPreviewMessage = computed(() => {
    const app = this.selectedApplicantForInterview();
    if (!app) return '';
    return `Halo ${app.name}, Anda dijadwalkan wawancara Oprec Panitia PKKMB 2026 pada ${this.interviewDate()} pukul ${this.interviewTime()} di ${this.interviewRoom()}.`;
  });

  // Filtered list for Dashboard
  eventsWithDynamicCounts = computed(() => {
    let rawEvents = this.events();
    if (rawEvents.some(e => !e.id.startsWith('evt-'))) {
      rawEvents = rawEvents.filter(e => !e.id.startsWith('evt-'));
    }
    const allRegs = this.eventService.registrations();
    return rawEvents.map(e => {
      const matchCount = allRegs.filter(r => 
        r.eventId === e.id || (e.title && r.eventTitle?.toLowerCase().trim() === e.title.toLowerCase().trim())
      ).length;
      return {
        ...e,
        registeredCount: matchCount > 0 ? matchCount : e.registeredCount
      };
    });
  });

  filteredEvents = computed(() => {
    let list = this.eventsWithDynamicCounts();
    const filter = this.selectedFilter();
    const query = this.searchQuery().trim().toLowerCase();

    if (filter !== 'SEMUA') {
      list = list.filter(e => e.status === filter);
    }

    if (query) {
      list = list.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.location.toLowerCase().includes(query) ||
        e.category.toLowerCase().includes(query)
      );
    }

    return list;
  });

  // Metrics matching SCR-PAN-01
  totalAcara = computed(() => this.events().length);
  publishedCount = computed(() => this.eventsWithDynamicCounts().filter(e => e.status === 'DIPUBLIKASIKAN').length);
  completedCount = computed(() => this.eventsWithDynamicCounts().filter(e => e.status === 'SELESAI').length);

  totalPendaftar = computed(() => {
    return this.eventsWithDynamicCounts().reduce((acc, curr) => acc + curr.registeredCount, 0);
  });

  sisaKuota = computed(() => {
    const published = this.eventsWithDynamicCounts().filter(e => e.status === 'DIPUBLIKASIKAN');
    return published.reduce((acc, curr) => acc + (curr.quota - curr.registeredCount), 0);
  });

  totalKuotaPublished = computed(() => {
    const published = this.eventsWithDynamicCounts().filter(e => e.status === 'DIPUBLIKASIKAN');
    return published.reduce((acc, curr) => acc + curr.quota, 0);
  });

  // Revision item check
  revisionEvent = computed(() => {
    return this.events().find(e => e.status === 'PERLU_REVISI') || null;
  });

  async ngOnInit(): Promise<void> {
    const url = this.router.url;
    if (url.includes('/participants')) {
      this.activeView.set('REKAP_PESERTA');
    } else if (url.includes('/applicants')) {
      this.activeView.set('SELEKSI_OPREC');
    } else if (url.includes('/new')) {
      this.openCreateWizard(false);
    }

    this.syncEventsFromService();
    await this.eventService.loadOrganizerEvents();
    this.syncEventsFromService();

    const evts = this.events();
    if (evts.length > 0) {
      const targetEvt = evts.find(e => e.status === 'DIPUBLIKASIKAN') || evts[0];
      this.selectedRekapEventId.set(targetEvt.id);
      await this.loadParticipantsForEvent(targetEvt.id);
    }
  }

  syncEventsFromService(allSvcEvents = this.eventService.events()): void {
    const realEvents = allSvcEvents.filter(pe => !pe.id.startsWith('evt-'));
    const sourceList = realEvents.length > 0 ? realEvents : allSvcEvents;
    const mappedItems: PanitiaEventItem[] = sourceList.map(pe => {
      const mappedStatus = this.mapServiceStatusToPanitia(pe.status);
      const loc = pe.room ? `${pe.room}, ${pe.location}` : (pe.location || 'Kampus Terpadu UII');
      return {
        id: pe.id,
        title: pe.title,
        dateStr: this.formatDateRowPanitia(pe.date),
        dateRaw: pe.date,
        type: pe.category === 'COMMITTEE_RECRUITMENT' ? 'Oprec' : 'Peserta',
        registeredCount: Math.max(0, pe.quotaTotal - pe.quotaRemaining),
        quota: pe.quotaTotal,
        status: mappedStatus,
        hasScanner: mappedStatus === 'DIPUBLIKASIKAN' || mappedStatus === 'SELESAI',
        category: pe.categoryLabel || pe.category,
        location: loc,
        bannerUrl: pe.bannerUrl,
        speaker: pe.speaker?.name,
        revisionNote: pe.dpkReviewNotes,
        rejectionReason: pe.dpkReviewNotes
      };
    });

    this.events.set(mappedItems);
  }

  private mapServiceStatusToPanitia(svcStatus: string): 'DIPUBLIKASIKAN' | 'PERLU_REVISI' | 'MENUNGGU' | 'DRAF' | 'DITOLAK' | 'SELESAI' {
    switch (svcStatus) {
      case 'PUBLISHED':
        return 'DIPUBLIKASIKAN';
      case 'REVISION':
        return 'PERLU_REVISI';
      case 'REJECTED':
        return 'DITOLAK';
      case 'DRAFT':
        return 'DRAF';
      case 'COMPLETED':
        return 'SELESAI';
      case 'PENDING':
      case 'PENDING_APPROVAL':
      default:
        return 'MENUNGGU';
    }
  }

  // Navigation handlers
  openDashboard(): void {
    this.activeView.set('DASHBOARD');
    this.mobileMenuOpen.set(false);
  }

  async openAcaraSaya(): Promise<void> {
    // When clicking "Acara Saya" on sidebar, navigate to the active event recap (SCR-PAN-03)
    this.activeView.set('REKAP_PESERTA');
    this.mobileMenuOpen.set(false);
    const currId = this.selectedRekapEventId();
    if (currId) {
      await this.loadParticipantsForEvent(currId);
    }
  }

  openSeleksiOprec(): void {
    this.activeView.set('SELEKSI_OPREC');
    this.mobileMenuOpen.set(false);
  }

  openCreateWizard(isRevision: boolean = false): void {
    this.activeView.set('CREATE');
    this.currentStep.set(1);
    this.isRevisionMode.set(isRevision);
    this.mobileMenuOpen.set(false);

    if (isRevision) {
      const rev = this.revisionEvent();
      this.formTitle.set(rev?.title || 'Kegiatan Mahasiswa UII');
      this.formCategory.set(rev?.category || 'Seminar');
      this.formExecutionType.set('Offline');
      this.formLocation.set(rev?.location || 'Ruang Audiovisual FTI UII');
      this.formStartDate.set(rev?.dateRaw || '2026-12-09');
      this.formStartTime.set('09:00');
      this.formEndDate.set(rev?.dateRaw || '2026-12-09');
      this.formEndTime.set('12:00');
      this.formSpeaker.set(rev?.speaker || '');
      this.formPosterUrl.set(rev?.bannerUrl || '/assets/images/seminar-ai-uii.jpg');
      this.formRegistrationMode.set(rev?.type === 'Oprec' ? 'OPREC' : 'PESERTA');
      this.formQuota.set(rev?.quota || 150);
    } else {
      this.formTitle.set('');
      this.formSpeaker.set('');
      this.formEndTime.set('');
    }
  }

  setFilter(filter: string): void {
    this.selectedFilter.set(filter);
  }

  // Wizard Navigation
  goToStep(step: number): void {
    if (step >= 1 && step <= 4) {
      this.currentStep.set(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextStep(): void {
    if (this.currentStep() === 1) {
      if (!this.formTitle().trim()) {
        alert('Judul kegiatan wajib diisi.');
        return;
      }
      if (!this.formEndTime()) {
        alert('Jam selesai wajib diisi!');
        return;
      }
    }
    if (this.currentStep() < 4) {
      this.currentStep.update(s => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Step 2 Poster selection
  selectPresetPoster(url: string, fileName: string): void {
    this.formPosterUrl.set(url);
    this.formPosterFileName.set(fileName);
  }

  onPosterFileChange(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.formPosterFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.formPosterUrl.set(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  // Step 3 Division handlers
  addDivision(): void {
    const name = this.newDivisionInput().trim();
    if (name && !this.formDivisions().includes(name)) {
      this.formDivisions.update(list => [...list, name]);
      this.newDivisionInput.set('');
    }
  }

  removeDivision(index: number): void {
    this.formDivisions.update(list => list.filter((_, i) => i !== index));
  }

  // Step 4 Custom question handlers
  addCustomQuestion(): void {
    const title = this.newQuestionTitle().trim();
    if (title) {
      const newQ: CustomQuestion = {
        id: 'q_' + Date.now(),
        title,
        type: this.newQuestionType(),
        options: this.newQuestionType() === 'SELECT' ? ['Pilihan 1', 'Pilihan 2', 'Pilihan 3'] : undefined
      };
      this.formCustomQuestions.update(list => [...list, newQ]);
      this.newQuestionTitle.set('');
    }
  }

  removeCustomQuestion(id: string): void {
    this.formCustomQuestions.update(list => list.filter(q => q.id !== id));
  }

  // Save Draft
  saveAsDraft(): void {
    this.showToast('Draf acara berhasil disimpan! Anda dapat melanjutkannya kapan saja.');
    this.activeView.set('DASHBOARD');
  }

  // Trigger modal submit
  promptSubmitToDpk(): void {
    this.showSubmitConfirmationModal.set(true);
  }

  // Confirm submit to DPK
  async confirmSubmitToDpk(): Promise<void> {
    this.showSubmitConfirmationModal.set(false);

    if (this.isRevisionMode()) {
      const targetRevId = this.revisionEvent()?.id || this.selectedEventForDetail()?.id;
      if (targetRevId) {
        await this.eventService.submitEventToDpkReal(targetRevId);
        await this.eventService.loadOrganizerEvents();
        this.syncEventsFromService();
      }
      this.showToast('Revisi berhasil diajukan kembali ke DPK UII! Status saat ini: Menunggu Persetujuan.');
    } else {
      const eventTitle = this.formTitle() || 'Acara Baru Ormawa FTI';
      const eventCategory = this.formCategory() === 'Oprec Kepanitiaan' ? 'COMMITTEE_RECRUITMENT' : (this.formCategory() === 'Lomba' ? 'LOMBA' : (this.formCategory() === 'Workshop' ? 'WORKSHOP' : 'SEMINAR'));
      const eventDate = this.formStartDate() || '2026-12-20';
      const eventLoc = this.formExecutionType() === 'Online' ? 'Daring (Zoom Meeting)' : (this.formLocation() || 'Auditorium KH Mas Mansyur');
      const poster = this.formPosterUrl() || (this.formRegistrationMode() === 'OPREC' ? '/assets/images/dies-natalis-uii.jpg' : '/assets/images/seminar-ai-uii.jpg');

      // 1. Register into EventService & backend API so Admin DPK immediately sees it in Curation table
      const createdItem = await this.eventService.createDraftEventReal({
        title: eventTitle,
        category: eventCategory,
        categoryLabel: this.formCategory() || 'Seminar Kampus',
        organizer: 'Panitia UII',
        faculty: 'Fakultas Teknologi Industri',
        description: 'Pengajuan kegiatan mahasiswa Fakultas Teknologi Industri UII.',
        date: eventDate,
        time: (this.formStartTime() || '09:00') + ' - ' + (this.formEndTime() || '13:00') + ' WIB',
        location: eventLoc,
        room: eventLoc,
        bannerUrl: poster,
        quotaTotal: Number(this.formQuota()) || 100,
        quotaRemaining: Number(this.formQuota()) || 100,
        status: 'PENDING',
        skpiPoints: Number(this.formSkpiPoints()) || 15,
        isFree: true,
        speaker: this.formSpeaker() ? { name: this.formSpeaker(), role: 'Pembicara Acara', company: 'UII' } : undefined,
        proposalFileName: 'Proposal_' + eventTitle.replace(/\s+/g, '_') + '.pdf',
        divisions: this.formDivisions(),
        submittedAt: new Date().toISOString()
      });

      if (createdItem) {
        await this.eventService.submitEventToDpkReal(createdItem.id);
      }

      await this.eventService.loadOrganizerEvents();
      this.syncEventsFromService();
      this.showToast(`Acara "${createdItem?.title || eventTitle}" berhasil diajukan ke DPK UII untuk penerbitan izin resmi!`);
    }

    this.activeView.set('DASHBOARD');
  }

  private formatDateRowPanitia(dateStr: string): string {
    if (!dateStr) return 'Rab, 09 Des 2026';
    try {
      const d = new Date(dateStr);
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 4500);
  }

  // Row "Lihat Rekap" click in Table:
  async viewEventDetail(event: PanitiaEventItem): Promise<void> {
    this.selectedRekapEventId.set(event.id);
    this.currentPageParticipants.set(1);
    this.participantSearchQuery.set('');
    await this.loadParticipantsForEvent(event.id);
    if (event.type === 'Oprec') {
      this.activeView.set('SELEKSI_OPREC');
    } else {
      this.activeView.set('REKAP_PESERTA');
    }
  }

  closeEventDetail(): void {
    this.selectedEventForDetail.set(null);
  }

  // ==========================================
  // PARTICIPANTS / REKAP ACTIONS
  // ==========================================
  setParticipantFilter(filter: 'SEMUA' | 'HADIR' | 'BELUM_HADIR' | 'BATAL'): void {
    this.participantFilter.set(filter);
  }

  clearParticipantSearch(): void {
    this.participantSearchQuery.set('');
  }

  exportParticipantsExcel(): void {
    const ev = this.selectedRekapEvent();
    const eventName = ev?.title || 'Acara';
    const filename = `Rekap_Presensi_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    let csv = 'NO,NIM,NAMA,PRODI,NO_WHATSAPP,WAKTU_DAFTAR,STATUS\n';
    this.currentEventParticipants().forEach(p => {
      csv += `${p.no},${p.nim},"${p.name}","${p.prodi}",${p.whatsapp},"${p.registeredAt}",${p.status}\n`;
    });
    this.downloadFile(csv, filename);
    this.showToast(`Berkas "${filename}" berhasil diunduh ke Excel/CSV!`);
  }

  // ==========================================
  // APPLICANTS / OPREC ACTIONS
  // ==========================================
  setApplicantDivisionFilter(div: string): void {
    this.applicantDivisionFilter.set(div);
  }

  clearApplicantSearch(): void {
    this.applicantSearchQuery.set('');
  }

  openInterviewModal(applicant: ApplicantItem): void {
    this.selectedApplicantForInterview.set(applicant);
    this.interviewDate.set('Kamis, 10 Des 2026');
    this.interviewTime.set('13.00 WIB');
    this.interviewRoom.set('Sekretariat LEM UII, Gedung Student Center');
  }

  closeInterviewModal(): void {
    this.selectedApplicantForInterview.set(null);
  }

  sendInterviewSchedule(): void {
    const app = this.selectedApplicantForInterview();
    if (!app) return;

    // Update status to WAWANCARA_DIJADWALKAN
    this.applicants.update(list =>
      list.map(a => {
        if (a.nim === app.nim) {
          return {
            ...a,
            status: 'WAWANCARA_DIJADWALKAN',
            interviewDate: this.interviewDate(),
            interviewTime: this.interviewTime(),
            interviewRoom: this.interviewRoom()
          };
        }
        return a;
      })
    );

    this.showToast(`Undangan wawancara via WhatsApp berhasil dikirim ke ${app.name} (${app.whatsapp})!`);
    this.closeInterviewModal();
  }

  async acceptApplicant(applicant: ApplicantItem): Promise<void> {
    const regId = (applicant as any).id || (applicant as any).registrationId;
    if (regId) {
      await this.eventService.updateApplicantSelectionApi(regId, 'ACCEPTED', 'Dinyatakan diterima oleh panitia');
    }
    this.applicants.update(list =>
      list.map(a => a.nim === applicant.nim ? { ...a, status: 'DITERIMA' } : a)
    );
    this.showToast(`Pelamar ${applicant.name} dinyatakan DITERIMA di ${applicant.division1}!`);
  }

  async rejectApplicant(applicant: ApplicantItem): Promise<void> {
    const regId = (applicant as any).id || (applicant as any).registrationId;
    if (regId) {
      await this.eventService.updateApplicantSelectionApi(regId, 'REJECTED', 'Dinyatakan belum lolos seleksi');
    }
    this.applicants.update(list =>
      list.map(a => a.nim === applicant.nim ? { ...a, status: 'DITOLAK' } : a)
    );
    this.showToast(`Pelamar ${applicant.name} dinyatakan DITOLAK.`);
  }

  exportApplicantsExcel(): void {
    let csv = 'NIM,NAMA,DIVISI_1,DIVISI_2,STATUS\n';
    this.applicants().forEach(a => {
      csv += `${a.nim},"${a.name}","${a.division1}","${a.division2}",${a.status}\n`;
    });
    this.downloadFile(csv, 'Seleksi_Pelamar_Oprec_PKKMB_2026.csv');
    this.showToast('Berkas "Seleksi_Pelamar_Oprec_PKKMB_2026.csv" berhasil diunduh ke Excel/CSV!');
  }

  copyOprecLink(): void {
    navigator.clipboard?.writeText('https://uii-event.id/register/oprec-pesta-uii-2027');
    this.showToast('Tautan pendaftaran oprec berhasil disalin ke clipboard!');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private downloadFile(content: string, fileName: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}