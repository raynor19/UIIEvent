import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';
import { EventItem } from '../../../core/models/event.model';

export interface WhatsappLogItem {
  id: string;
  waktu: string;
  acara: string;
  penerima: string;
  jenis: string;
  status: 'TERKIRIM' | 'GAGAL' | 'MENUNGGU';
}

export interface EmailLogItem {
  id: string;
  waktu: string;
  acara: string;
  penerima: string;
  pemicu: string;
  status: 'TERKIRIM' | 'GAGAL';
}

export interface InstagramLogItem {
  id: string;
  waktu: string;
  acara: string;
  urlPosting: string;
  isError?: boolean;
  status: 'TERKIRIM' | 'GAGAL';
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  authService = inject(AuthService);
  eventService = inject(EventService);
  router = inject(Router);

  currentUser = this.authService.currentUser;

  // View state: 'CURATION' (SCR-ADM-01) or 'LOGS' (SCR-ADM-02)
  activeNav = signal<'CURATION' | 'LOGS'>('CURATION');
  isMobileMenuOpen = signal<boolean>(false);
  searchQuery = signal<string>('');

  // Toast / feedback message
  actionToast = signal<string>('');

  // ================= SCR-ADM-01: CURATION STATE =================
  selectedEventId = signal<string>('');
  autoPostInstagram = signal<boolean>(true);
  showToastApproved = signal<boolean>(false);
  toastMessage = signal<string>('Acara disetujui dan poster berhasil terbit di @uii.events!');
  showIgErrorBanner = signal<boolean>(false);
  isLoadingSkeleton = signal<boolean>(false);
  showRevisionModal = signal<boolean>(false);
  revisionNotes = signal<string>('');
  revisionError = signal<boolean>(false);
  showRejectModal = signal<boolean>(false);
  rejectionReason = signal<string>('Jadwal bentrok dengan agenda universitas pada tanggal yang sama.');
  rejectionError = signal<boolean>(false);
  showNotifLogModal = signal<boolean>(false);

  // ================= SCR-ADM-02: NOTIFICATION LOGS STATE =================
  activeLogTab = signal<'WHATSAPP' | 'EMAIL' | 'INSTAGRAM'>('WHATSAPP');
  showGatewayError = signal<boolean>(false);
  isEmptyLogs = signal<boolean>(false);
  isLogsLoading = signal<boolean>(false);

  // Pagination states
  currentPageWa = signal<number>(1);
  pageSizeWa = signal<number>(10);
  readonly totalPagesWa = 122;

  currentPageEmail = signal<number>(1);
  pageSizeEmail = signal<number>(10);
  readonly totalPagesEmail = 4;

  currentPageIg = signal<number>(1);
  pageSizeIg = signal<number>(10);
  readonly totalPagesIg = 2;

  // Seed data from SCR-ADM-02 Figma Handoff (Page 1)
  whatsappLogs = signal<WhatsappLogItem[]>([
    { id: 'wa-001', waktu: '20 Nov 2026, 09.00', acara: 'Seminar Nasional AI & Karir Teknologi 2026', penerima: '6281234567890', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-002', waktu: '20 Nov 2026, 09.00', acara: 'Seminar Nasional AI & Karir Teknologi 2026', penerima: '6281234567891', jenis: 'Pengingat H-1', status: 'GAGAL' },
    { id: 'wa-003', waktu: '20 Nov 2026, 09.00', acara: 'Seminar Nasional AI & Karir Teknologi 2026', penerima: '6281234567892', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-004', waktu: '20 Nov 2026, 08.01', acara: 'Workshop UI/UX', penerima: '6281234567893', jenis: 'Pengingat H-1', status: 'MENUNGGU' },
    { id: 'wa-005', waktu: '19 Nov 2026, 15.42', acara: 'Open Recruitment Panitia PKKMB 2026', penerima: '6281234567890', jenis: 'Jadwal wawancara', status: 'TERKIRIM' },
    { id: 'wa-006', waktu: '19 Nov 2026, 05.30', acara: 'Workshop Robotika', penerima: '6281234567894', jenis: 'Pengingat H-3 jam', status: 'GAGAL' },
    { id: 'wa-007', waktu: '19 Nov 2026, 05.30', acara: 'Workshop Robotika', penerima: '6281234567895', jenis: 'Pengingat H-3 jam', status: 'TERKIRIM' },
    { id: 'wa-008', waktu: '18 Nov 2026, 14.10', acara: 'Seminar Etika Profesi Informatika', penerima: '6281234567896', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-009', waktu: '18 Nov 2026, 10.05', acara: 'Turnamen E-Sport Antarfakultas', penerima: '6281234567897', jenis: 'Undangan Match', status: 'TERKIRIM' },
    { id: 'wa-010', waktu: '18 Nov 2026, 08.00', acara: 'Dies Natalis FTI 44', penerima: '6281234567898', jenis: 'Pengingat H-1', status: 'TERKIRIM' }
  ]);

  whatsappLogsPage2 = signal<WhatsappLogItem[]>([
    { id: 'wa-011', waktu: '18 Nov 2026, 07.45', acara: 'Seminar Nasional AI & Karir Teknologi 2026', penerima: '6281234567810', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-012', waktu: '18 Nov 2026, 07.45', acara: 'Seminar Nasional AI & Karir Teknologi 2026', penerima: '6281234567811', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-013', waktu: '17 Nov 2026, 20.30', acara: 'Pelatihan Kepemimpinan Pengurus LEM', penerima: '6281234567812', jenis: 'Jadwal Gladi', status: 'TERKIRIM' },
    { id: 'wa-014', waktu: '17 Nov 2026, 16.00', acara: 'Workshop UI/UX', penerima: '6281234567813', jenis: 'Konfirmasi Seat', status: 'TERKIRIM' },
    { id: 'wa-015', waktu: '17 Nov 2026, 14.20', acara: 'Oprec Panitia Dies Natalis', penerima: '6281234567814', jenis: 'Jadwal Wawancara', status: 'GAGAL' },
    { id: 'wa-016', waktu: '17 Nov 2026, 11.00', acara: 'Pameran Karya Mahasiswa', penerima: '6281234567815', jenis: 'Pengingat Registrasi', status: 'TERKIRIM' },
    { id: 'wa-017', waktu: '17 Nov 2026, 09.30', acara: 'Workshop Cyber Security', penerima: '6281234567816', jenis: 'Konfirmasi Lab', status: 'TERKIRIM' },
    { id: 'wa-018', waktu: '16 Nov 2026, 18.00', acara: 'Webinar Persiapan Magang 2026', penerima: '6281234567817', jenis: 'Link Zoom & E-Tiket', status: 'TERKIRIM' },
    { id: 'wa-019', waktu: '16 Nov 2026, 14.00', acara: 'Grand Launching Tech Startup', penerima: '6281234567818', jenis: 'Pengingat Acara', status: 'TERKIRIM' },
    { id: 'wa-020', waktu: '16 Nov 2026, 10.15', acara: 'Porsematik HMIF UII 2026', penerima: '6281234567819', jenis: 'Tiket Masuk', status: 'TERKIRIM' }
  ]);

  whatsappLogsPage3 = signal<WhatsappLogItem[]>([
    { id: 'wa-021', waktu: '16 Nov 2026, 08.00', acara: 'Pelatihan Public Speaking', penerima: '6281234567820', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-022', waktu: '15 Nov 2026, 21.00', acara: 'Lomba UI Design Sprint', penerima: '6281234567821', jenis: 'Brief Lomba', status: 'TERKIRIM' },
    { id: 'wa-023', waktu: '15 Nov 2026, 19.30', acara: 'Seminar Kewirausahaan Mahasiswa', penerima: '6281234567822', jenis: 'Link Streaming', status: 'TERKIRIM' },
    { id: 'wa-024', waktu: '15 Nov 2026, 16.15', acara: 'Workshop Python Data Science', penerima: '6281234567823', jenis: 'Dataset Download', status: 'GAGAL' },
    { id: 'wa-025', waktu: '15 Nov 2026, 14.00', acara: 'Turnamen Mobile Legends UII', penerima: '6281234567824', jenis: 'Bracket Match', status: 'TERKIRIM' },
    { id: 'wa-026', waktu: '14 Nov 2026, 17.00', acara: 'Bedah Buku & Literasi Islam', penerima: '6281234567825', jenis: 'E-Sertifikat Terbit', status: 'TERKIRIM' },
    { id: 'wa-027', waktu: '14 Nov 2026, 13.30', acara: 'Pelatihan Penulisan Proposal PKM', penerima: '6281234567826', jenis: 'Jadwal Bimbingan', status: 'TERKIRIM' },
    { id: 'wa-028', waktu: '14 Nov 2026, 10.00', acara: 'Diskusi Panel AI & Etika Digital', penerima: '6281234567827', jenis: 'Reminder Acara', status: 'TERKIRIM' },
    { id: 'wa-029', waktu: '13 Nov 2026, 15.45', acara: 'Workshop IoT Smart Campus', penerima: '6281234567828', jenis: 'Alat Praktikum', status: 'TERKIRIM' },
    { id: 'wa-030', waktu: '13 Nov 2026, 09.00', acara: 'Orientasi UKM Kampus UII', penerima: '6281234567829', jenis: 'Konfirmasi Kehadiran', status: 'TERKIRIM' }
  ]);

  whatsappLogsPage4 = signal<WhatsappLogItem[]>([
    { id: 'wa-031', waktu: '12 Nov 2026, 19.00', acara: 'Konser Amal Mahasiswa', penerima: '6281234567830', jenis: 'E-Ticket Gate QR', status: 'TERKIRIM' },
    { id: 'wa-032', waktu: '12 Nov 2026, 14.30', acara: 'Talkshow Karir & BUMN', penerima: '6281234567831', jenis: 'Link Zoom', status: 'TERKIRIM' },
    { id: 'wa-033', waktu: '12 Nov 2026, 11.00', acara: 'Workshop Cloud Computing AWS', penerima: '6281234567832', jenis: 'Akses Sandbox', status: 'GAGAL' },
    { id: 'wa-034', waktu: '11 Nov 2026, 16.20', acara: 'Festival Film Mahasiswa UII', penerima: '6281234567833', jenis: 'Jadwal Screening', status: 'TERKIRIM' },
    { id: 'wa-035', waktu: '11 Nov 2026, 13.00', acara: 'Lomba Karya Tulis Ilmiah Al-Quran', penerima: '6281234567834', jenis: 'Jadwal Presentasi', status: 'TERKIRIM' },
    { id: 'wa-036', waktu: '10 Nov 2026, 15.00', acara: 'Webinar Beasiswa Luar Negeri', penerima: '6281234567835', jenis: 'Reminder Acara', status: 'TERKIRIM' },
    { id: 'wa-037', waktu: '10 Nov 2026, 10.00', acara: 'Seminar Kesehatan Mental Mahasiswa', penerima: '6281234567836', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-038', waktu: '09 Nov 2026, 14.00', acara: 'Workshop Git & GitHub Praktis', penerima: '6281234567837', jenis: 'Repo Starter', status: 'TERKIRIM' },
    { id: 'wa-039', waktu: '09 Nov 2026, 09.30', acara: 'Forum Diskusi Dekan FTI', penerima: '6281234567838', jenis: 'Undangan Mahasiswa', status: 'TERKIRIM' },
    { id: 'wa-040', waktu: '08 Nov 2026, 16.00', acara: 'Expo Inovasi Teknologi UII', penerima: '6281234567839', jenis: 'Stand Booth No', status: 'TERKIRIM' }
  ]);

  whatsappLogsPage5 = signal<WhatsappLogItem[]>([
    { id: 'wa-041', waktu: '08 Nov 2026, 13.00', acara: 'Workshop Flutter Mobile App', penerima: '6281234567840', jenis: 'Pengingat H-1', status: 'TERKIRIM' },
    { id: 'wa-042', waktu: '07 Nov 2026, 10.30', acara: 'Seminar Karir Big Data & AI', penerima: '6281234567841', jenis: 'E-Sertifikat Terbit', status: 'TERKIRIM' },
    { id: 'wa-043', waktu: '06 Nov 2026, 15.00', acara: 'Simposium Riset Informatika', penerima: '6281234567842', jenis: 'Jadwal Presentasi', status: 'TERKIRIM' },
    { id: 'wa-044', waktu: '05 Nov 2026, 09.00', acara: 'Klinik Karir Mahasiswa UII', penerima: '6281234567843', jenis: 'Review CV', status: 'TERKIRIM' }
  ]);

  displayedWhatsappLogs = computed(() => {
    const page = this.currentPageWa();
    if (page === 1) return this.whatsappLogs();
    if (page === 2) return this.whatsappLogsPage2();
    if (page === 3) return this.whatsappLogsPage3();
    if (page === 4) return this.whatsappLogsPage4();
    return this.whatsappLogsPage5();
  });

  emailLogs = signal<EmailLogItem[]>([
    { id: 'em-001', waktu: '20 Nov 2026, 09.00', acara: 'Seminar Nasional AI & Karir Te...', penerima: '21523002@students.uii.ac.id', pemicu: 'Timeout 30 dtk', status: 'TERKIRIM' },
    { id: 'em-002', waktu: '19 Nov 2026, 05.31', acara: 'Workshop Robotika', penerima: '21523115@students.uii.ac.id', pemicu: 'Nomor tidak aktif', status: 'TERKIRIM' },
    { id: 'em-003', waktu: '18 Nov 2026, 09.00', acara: 'Lomba UI Design Sprint', penerima: '21523077@students.uii.ac.id', pemicu: 'Gateway 503', status: 'GAGAL' }
  ]);

  emailLogsPage2 = signal<EmailLogItem[]>([
    { id: 'em-011', waktu: '17 Nov 2026, 14.21', acara: 'Oprec Panitia Dies Natalis', penerima: '21523088@students.uii.ac.id', pemicu: 'Nomor tidak aktif', status: 'TERKIRIM' },
    { id: 'em-012', waktu: '15 Nov 2026, 16.16', acara: 'Workshop Python Data Science', penerima: '21523099@students.uii.ac.id', pemicu: 'Timeout 30 dtk', status: 'TERKIRIM' },
    { id: 'em-013', waktu: '12 Nov 2026, 11.02', acara: 'Workshop Cloud Computing AWS', penerima: '21523104@students.uii.ac.id', pemicu: 'Gateway 503', status: 'GAGAL' }
  ]);

  emailLogsPage3 = signal<EmailLogItem[]>([
    { id: 'em-021', waktu: '11 Nov 2026, 10.00', acara: 'Webinar Persiapan Magang 2026', penerima: '21523120@students.uii.ac.id', pemicu: 'Timeout 30 dtk', status: 'TERKIRIM' },
    { id: 'em-022', waktu: '10 Nov 2026, 08.45', acara: 'Seminar Kesehatan Mental', penerima: '21523135@students.uii.ac.id', pemicu: 'Nomor tidak aktif', status: 'TERKIRIM' }
  ]);

  emailLogsPage4 = signal<EmailLogItem[]>([
    { id: 'em-031', waktu: '08 Nov 2026, 16.00', acara: 'Expo Inovasi Teknologi UII', penerima: '21523140@students.uii.ac.id', pemicu: 'Timeout 30 dtk', status: 'TERKIRIM' }
  ]);

  displayedEmailLogs = computed(() => {
    const page = this.currentPageEmail();
    if (page === 1) return this.emailLogs();
    if (page === 2) return this.emailLogsPage2();
    if (page === 3) return this.emailLogsPage3();
    return this.emailLogsPage4();
  });

  instagramLogs = signal<InstagramLogItem[]>([
    { id: 'ig-001', waktu: '19 Nov 2026, 16.02', acara: 'Workshop UI/UX', urlPosting: 'instagram.com/p/DUIEVT0281', status: 'TERKIRIM' },
    { id: 'ig-002', waktu: '18 Nov 2026, 14.31', acara: 'Lomba UI Design Sprint', urlPosting: 'instagram.com/p/DUIEVT0277', status: 'TERKIRIM' },
    { id: 'ig-003', waktu: '18 Nov 2026, 14.30', acara: 'Konser Kampus Tahunan', urlPosting: '(Gagal publish: URL gambar tidak publik)', isError: true, status: 'GAGAL' }
  ]);

  instagramLogsPage2 = signal<InstagramLogItem[]>([
    { id: 'ig-011', waktu: '15 Nov 2026, 10.00', acara: 'Webinar Persiapan Magang 2026', urlPosting: 'instagram.com/p/DUIEVT0255', status: 'TERKIRIM' },
    { id: 'ig-012', waktu: '10 Nov 2026, 09.15', acara: 'Seminar Etika Profesi Informatika', urlPosting: 'instagram.com/p/DUIEVT0244', status: 'TERKIRIM' }
  ]);

  displayedInstagramLogs = computed(() => {
    return this.currentPageIg() === 1 ? this.instagramLogs() : this.instagramLogsPage2();
  });

  // Range text for display
  waRangeText = computed(() => {
    const p = this.currentPageWa();
    const start = (p - 1) * 10 + 1;
    const end = Math.min(p * 10, 1214);
    return `Menampilkan ${start}-${end} dari 1214 data`;
  });

  emailRangeText = computed(() => {
    const p = this.currentPageEmail();
    const start = (p - 1) * 10 + 1;
    const end = Math.min(p * 10, 38);
    return `Menampilkan ${start}-${end} dari 38 data`;
  });

  igRangeText = computed(() => {
    const p = this.currentPageIg();
    const start = (p - 1) * 10 + 1;
    const end = Math.min(p * 10, 12);
    return `Menampilkan ${start}-${end} dari 12 data`;
  });

  async ngOnInit(): Promise<void> {
    await this.eventService.loadAdminEvents();
    this.checkRoute();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.checkRoute());
  }

  private checkRoute(): void {
    const url = (this.router.url || '').toLowerCase();
    if (url.includes('notification')) {
      this.activeNav.set('LOGS');
    } else {
      this.activeNav.set('CURATION');
    }
  }

  switchNav(nav: 'CURATION' | 'LOGS'): void {
    this.activeNav.set(nav);
    this.isMobileMenuOpen.set(false);
    if (nav === 'CURATION') {
      this.router.navigate(['/admin/curation']);
    } else {
      this.router.navigate(['/admin/notifications']);
    }
  }

  // ================= PAGINATION METHODS =================
  setPageWa(page: number): void {
    if (page >= 1 && page <= this.totalPagesWa) {
      this.currentPageWa.set(page);
    }
  }

  prevPageWa(): void {
    if (this.currentPageWa() > 1) {
      this.currentPageWa.set(this.currentPageWa() - 1);
    }
  }

  nextPageWa(): void {
    if (this.currentPageWa() < this.totalPagesWa) {
      this.currentPageWa.set(this.currentPageWa() + 1);
    }
  }

  setPageEmail(page: number): void {
    if (page >= 1 && page <= this.totalPagesEmail) {
      this.currentPageEmail.set(page);
    }
  }

  prevPageEmail(): void {
    if (this.currentPageEmail() > 1) {
      this.currentPageEmail.set(this.currentPageEmail() - 1);
    }
  }

  nextPageEmail(): void {
    if (this.currentPageEmail() < this.totalPagesEmail) {
      this.currentPageEmail.set(this.currentPageEmail() + 1);
    }
  }

  setPageIg(page: number): void {
    if (page >= 1 && page <= this.totalPagesIg) {
      this.currentPageIg.set(page);
    }
  }

  prevPageIg(): void {
    if (this.currentPageIg() > 1) {
      this.currentPageIg.set(this.currentPageIg() - 1);
    }
  }

  nextPageIg(): void {
    if (this.currentPageIg() < this.totalPagesIg) {
      this.currentPageIg.set(this.currentPageIg() + 1);
    }
  }

  // ================= COMPUTED FOR CURATION =================
  pendingEvents = computed(() => {
    return this.eventService.events().filter(e => e.status === 'PENDING' || (e.status as any) === 'PENDING_APPROVAL');
  });

  filteredPendingEvents = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.pendingEvents();
    if (!q) return list;
    return list.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.organizer.toLowerCase().includes(q)
    );
  });

  selectedEvent = computed(() => {
    const list = this.filteredPendingEvents();
    if (list.length === 0) return null;
    const found = list.find(e => e.id === this.selectedEventId());
    return found || list[0];
  });

  formatDateRow(dateStr: string): string {
    if (!dateStr) return '-';
    if (dateStr === '2026-12-18') return 'Jum, 18 Des 2026';
    if (dateStr === '2026-12-14') return 'Sen, 14 Des 2026';
    if (dateStr === '2026-12-19') return 'Sab, 19 Des 2026';
    try {
      const d = new Date(dateStr);
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  formatDateDetail(dateStr: string): string {
    if (!dateStr) return '-';
    if (dateStr === '2026-12-18') return 'Jumat, 18 Desember 2026';
    if (dateStr === '2026-12-14') return 'Senin, 14 Desember 2026';
    if (dateStr === '2026-12-19') return 'Sabtu, 19 Desember 2026';
    try {
      const d = new Date(dateStr);
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  formatSubmittedAt(item: EventItem): string {
    if (item.submittedAt) {
      try {
        const d = new Date(item.submittedAt);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${d.getDate()} ${months[d.getMonth()]}, ${hours}.${mins}`;
      } catch {
        return 'Hari ini';
      }
    }
    return '-';
  }

  selectEvent(item: EventItem): void {
    this.selectedEventId.set(item.id);
  }

  async approveEvent(event: EventItem | null): Promise<void> {
    if (!event) return;
    const success = await this.eventService.adminApproveEventReal(event.id);
    if (success) {
      this.toastMessage.set('✓ Acara disetujui dan poster berhasil terbit di @uii.events!');
      this.showToastApproved.set(true);
      setTimeout(() => this.showToastApproved.set(false), 5000);

      const remaining = this.pendingEvents().filter(e => e.id !== event.id);
      if (remaining.length > 0) {
        this.selectedEventId.set(remaining[0].id);
      }
    }
  }

  openRevisionModal(): void {
    this.revisionNotes.set('');
    this.revisionError.set(false);
    this.showRevisionModal.set(true);
  }

  closeRevisionModal(): void {
    this.showRevisionModal.set(false);
    this.revisionError.set(false);
  }

  submitRevision(): void {
    const notes = this.revisionNotes().trim();
    if (!notes) {
      this.revisionError.set(true);
      return;
    }
    const current = this.selectedEvent();
    if (!current) return;

    this.eventService.dpkRequestRevision(current.id, notes, this.currentUser().name);
    this.closeRevisionModal();
  }

  openRejectModal(): void {
    this.rejectionReason.set('Jadwal bentrok dengan agenda universitas pada tanggal yang sama.');
    this.rejectionError.set(false);
    this.showRejectModal.set(true);
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.rejectionError.set(false);
  }

  async submitReject(): Promise<void> {
    const reason = this.rejectionReason().trim();
    if (!reason) {
      this.rejectionError.set(true);
      return;
    }
    const current = this.selectedEvent();
    if (!current) return;

    await this.eventService.adminRejectEventReal(current.id, reason);
    this.closeRejectModal();
  }

  resetFigmaSubmissions(): void {
    this.eventService.resetToInitialMock();
    this.selectedEventId.set('');
    this.showToastApproved.set(false);
    this.showIgErrorBanner.set(false);
  }

  resendWhatsapp(item: WhatsappLogItem): void {
    item.status = 'TERKIRIM';
    this.triggerToast(`✓ Pesan pengingat WhatsApp berhasil dikirim ulang ke ${item.penerima}!`);
  }

  resendEmail(item: EmailLogItem): void {
    item.status = 'TERKIRIM';
    this.triggerToast(`✓ Pesan fallback email berhasil dikirim ulang ke ${item.penerima}!`);
  }

  resendInstagram(item: InstagramLogItem): void {
    item.status = 'TERKIRIM';
    item.urlPosting = 'instagram.com/p/DUIEVT0299';
    item.isError = false;
    this.triggerToast(`✓ Poster ${item.acara} berhasil diposting ulang ke @uii.events!`);
  }

  reconnectGateway(): void {
    this.showGatewayError.set(false);
    this.triggerToast('✓ WhatsApp Gateway berhasil terhubung kembali!');
  }

  exportLogs(): void {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Channel,Waktu,Acara,Penerima/URL,Jenis/Pemicu,Status\n';

    this.displayedWhatsappLogs().forEach(l => {
      csvContent += `WhatsApp,"${l.waktu}","${l.acara}","${l.penerima}","${l.jenis}","${l.status}"\n`;
    });
    this.displayedEmailLogs().forEach(l => {
      csvContent += `Email,"${l.waktu}","${l.acara}","${l.penerima}","${l.pemicu}","${l.status}"\n`;
    });
    this.displayedInstagramLogs().forEach(l => {
      csvContent += `Instagram,"${l.waktu}","${l.acara}","${l.urlPosting}","Auto-Post","${l.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'log_notifikasi_uii_event.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.triggerToast('✓ Berkas log_notifikasi_uii_event.csv berhasil diunduh!');
  }

  private triggerToast(msg: string): void {
    this.actionToast.set(msg);
    setTimeout(() => this.actionToast.set(''), 4500);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}