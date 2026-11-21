import { Injectable, signal } from '@angular/core';
import { EventItem, EventCategory } from '../models/event.model';
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
  // Reactive signals for real-time UI binding
  events = signal<EventItem[]>([]);
  registrations = signal<RegistrationItem[]>([]);
  tickets = signal<TicketItem[]>([]);
  certificates = signal<CertificateItem[]>([]);
  notificationLogs = signal<NotificationLog[]>([]);

  constructor(private authService: AuthService) {
    this.initializeData();
  }

  private initializeData(): void {
    if (typeof localStorage === 'undefined') {
      this.loadMockDefaults();
      return;
    }

    const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const savedRegs = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
    const savedTickets = localStorage.getItem(STORAGE_KEYS.TICKETS);
    const savedCerts = localStorage.getItem(STORAGE_KEYS.CERTIFICATES);
    const savedLogs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);

    if (savedEvents && savedRegs && savedTickets) {
      try {
        let eventsList: EventItem[] = JSON.parse(savedEvents);
        // Filter out dummy pending events (evt-adm-01, evt-adm-02, evt-adm-03)
        eventsList = eventsList.filter(e => !['evt-adm-01', 'evt-adm-02', 'evt-adm-03'].includes(e.id));
        eventsList.forEach(e => {
          if (e.id === 'evt-001' || (e.title.toLowerCase().includes('seminar') && e.title.toLowerCase().includes('ai'))) {
            e.bannerUrl = '/assets/images/seminar-ai-uii.jpg';
          }
          if (e.id === 'evt-002' || (e.category === 'WORKSHOP' && e.bannerUrl?.includes('unsplash'))) {
            e.bannerUrl = '/assets/images/workshop-ai-uii.jpg';
            if (e.id === 'evt-002') {
              e.title = 'Workshop Pengelola Website: Pengelolaan Konten Berbasis SEO dan AI';
              e.location = 'Gedung Prof. Dr. Sardjito UII, Kampus Terpadu';
              e.room = 'Ruang Teatrikal Gedung Prof. Dr. Sardjito';
              e.quotaRemaining = 15;
            }
          }
          if (e.id === 'evt-003' || (e.title.toLowerCase().includes('pesta') && e.category === 'COMMITTEE_RECRUITMENT')) {
            e.bannerUrl = '/assets/images/oprec-pesta-uii.jpg';
          }
          if (e.id === 'evt-adm-02' || e.title.toLowerCase().includes('dies natalis')) {
            e.bannerUrl = '/assets/images/dies-natalis-uii.jpg';
          }
          if (e.id === 'evt-007' || e.title.toLowerCase().includes('startup')) {
            e.status = 'PUBLISHED';
            e.category = 'SEMINAR';
            e.categoryLabel = 'Seminar Nasional';
          }
          if (e.id === 'evt-008' || e.title.toLowerCase().includes('porsematik')) {
            e.category = 'COMMITTEE_RECRUITMENT';
            e.categoryLabel = 'Oprec Kepanitiaan';
            e.bannerUrl = '/assets/images/campus/uii-kampus-terpadu-hd.jpg';
            e.oprecDivisions = [
              'Divisi Acara & Pertandingan',
              'Divisi Humas & Publikasi (Medsos)',
              'Divisi IT, Web & Presensi Scanner',
              'Divisi Logistik & Perlengkapan',
              'Divisi Konsumsi & Medis',
              'Divisi Wasit & Keamanan'
            ];
          }
        });
        this.events.set(eventsList);
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(eventsList));
        
        let currentTickets: TicketItem[] = JSON.parse(savedTickets);
        let currentRegs: RegistrationItem[] = JSON.parse(savedRegs);

        // Check if Porsematik ticket is present, if missing or wiped, restore it for Raynor and Rian
        const hasPorsematikTicket = currentTickets.some(t => 
          t.eventId === 'evt-008' || t.eventTitle?.toLowerCase().includes('porsematik')
        );

        const porsematikTicketCode = 'UII-TIK-2026-8899';
        const porsematikHash = this.generateHashSignature('23525055', 'evt-008', porsematikTicketCode);
        const porsematikQrPayload = JSON.stringify({
          ticketCode: porsematikTicketCode,
          nim: '23525055',
          name: 'Muhammad Raynor Athaillah',
          eventId: 'evt-008',
          hash: porsematikHash,
          timestamp: 1763640000000
        });

        const porsematikTicket: TicketItem = {
          id: 'tck-porsematik-raynor-001',
          registrationId: 'reg-porsematik-raynor-001',
          ticketCode: porsematikTicketCode,
          eventId: 'evt-008',
          eventTitle: 'Porsematik HMIF UII 2026',
          eventCategory: 'COMMITTEE_RECRUITMENT',
          eventDate: '2026-12-05',
          eventTime: '08:00 - 17:00 WIB',
          eventLocation: 'GOR Ki Bagoes Hadikoesoemo & Hall FTI UII',
          eventRoom: 'GOR Utama Kampus Terpadu UII',
          userId: 'usr-raynor-001',
          userName: 'Muhammad Raynor Athaillah',
          userNim: '23525055',
          userStudyProgram: 'Teknik Mesin - Fakultas Teknologi Industri',
          qrPayload: porsematikQrPayload,
          hashSignature: porsematikHash,
          timestampIssued: '20 November 2026, 14:15 WIB',
          isCheckedIn: false
        };

        // Filter out legacy Ahmad Fikri and test data so user only sees Muhammad Raynor Athaillah
        currentTickets = currentTickets.filter(t => !t.userName?.toLowerCase().includes('ahmad fikri') && t.userId !== 'usr-rian-001');
        currentRegs = currentRegs.filter(r => !r.userName?.toLowerCase().includes('ahmad fikri') && r.userId !== 'usr-rian-001');

        if (!hasPorsematikTicket) {
          currentTickets.unshift(porsematikTicket);
        }

        const hasPorsematikReg = currentRegs.some(r => 
          r.eventId === 'evt-008' || r.eventTitle?.toLowerCase().includes('porsematik')
        );
        if (!hasPorsematikReg) {
          currentRegs.unshift({
            id: 'reg-porsematik-raynor-001',
            userId: 'usr-raynor-001',
            userNim: '23525055',
            userName: 'Muhammad Raynor Athaillah',
            userEmail: '23525055@students.uii.ac.id',
            userPhone: '081234567890',
            userFaculty: 'Fakultas Teknologi Industri',
            userStudyProgram: 'Teknik Mesin',
            eventId: 'evt-008',
            eventTitle: 'Porsematik HMIF UII 2026',
            eventDate: '2026-12-05',
            eventLocation: 'GOR Utama Kampus Terpadu UII, GOR Ki Bagoes Hadikoesoemo & Hall FTI UII',
            status: 'REGISTERED',
            createdAt: '2026-11-20T14:15:00.000Z'
          });
        }

        // Check if National Islamic Technology Competition (evt-004) ticket is present, if not present restore it
        const hasNitcTicket = currentTickets.some(t => 
          t.eventId === 'evt-004' || t.eventTitle?.toLowerCase().includes('national islamic')
        );

        const nitcTicketCode = 'UII-TIK-2026-7721';
        const nitcHash = this.generateHashSignature('23525055', 'evt-004', nitcTicketCode);
        const nitcQrPayload = JSON.stringify({
          ticketCode: nitcTicketCode,
          nim: '23525055',
          name: 'Muhammad Raynor Athaillah',
          eventId: 'evt-004',
          hash: nitcHash,
          timestamp: 1763640000000
        });

        const nitcTicket: TicketItem = {
          id: 'tck-nitc-raynor-001',
          registrationId: 'reg-nitc-raynor-001',
          ticketCode: nitcTicketCode,
          eventId: 'evt-004',
          eventTitle: 'National Islamic Technology Competition (NITC 2026): Sharia FinTech & GovTech',
          eventCategory: 'LOMBA',
          eventDate: '2026-12-10',
          eventTime: '08:00 - 16:00 WIB',
          eventLocation: 'Auditorium FMIPA UII, Kampus Terpadu',
          eventRoom: 'Hall K.H. Mas Mansyur Lt. 3',
          userId: 'usr-raynor-001',
          userName: 'Muhammad Raynor Athaillah',
          userNim: '23525055',
          userStudyProgram: 'Teknik Mesin - Fakultas Teknologi Industri',
          qrPayload: nitcQrPayload,
          hashSignature: nitcHash,
          timestampIssued: '21 November 2026, 09:30 WIB',
          isCheckedIn: false
        };

        const hasNitcReg = currentRegs.some(r => 
          r.eventId === 'evt-004' || r.eventTitle?.toLowerCase().includes('national islamic')
        );
        if (!hasNitcReg) {
          currentRegs.push({
            id: 'reg-nitc-raynor-001',
            userId: 'usr-raynor-001',
            userNim: '23525055',
            userName: 'Muhammad Raynor Athaillah',
            userEmail: '23525055@students.uii.ac.id',
            userPhone: '081234567890',
            userFaculty: 'Fakultas Teknologi Industri',
            userStudyProgram: 'Teknik Mesin',
            eventId: 'evt-004',
            eventTitle: 'National Islamic Technology Competition (NITC 2026): Sharia FinTech & GovTech',
            eventDate: '2026-12-10',
            eventLocation: 'Hall K.H. Mas Mansyur Lt. 3, Auditorium FMIPA UII, Kampus Terpadu',
            status: 'REGISTERED',
            createdAt: '2026-11-21T09:30:00.000Z'
          });
        }
        if (!hasNitcTicket) {
          currentTickets.push(nitcTicket);
        }

        // Sanitize tickets data to guarantee correct department mapping
        currentTickets = currentTickets.map(t => {
          if (t.userId === 'usr-raynor-001' || t.userNim === '23525055' || t.userNim === '23523055') {
            return {
              ...t,
              userId: 'usr-raynor-001',
              userName: 'Muhammad Raynor Athaillah',
              userNim: '23525055',
              userStudyProgram: 'Teknik Mesin - Fakultas Teknologi Industri'
            };
          }
          return t;
        });

        this.registrations.set(currentRegs);
        this.tickets.set(currentTickets);
        this.saveToStorage();
        if (!eventsList.some(e => e.id === 'evt-001')) {
          this.loadMockDefaults();
          return;
        }
        let certList: CertificateItem[] = savedCerts ? JSON.parse(savedCerts) : [];
        if (!certList.some(c => c.id === '0491' || c.certificateNumber?.includes('0491'))) {
          this.loadMockDefaults();
          return;
        }

        // Sanitize certificate list: ensure NIM 23525055 and Teknik Mesin
        certList = certList.map(c => {
          if (c.userNim === '23523055' || c.userNim === '23525055' || c.userId === 'usr-raynor-001' || c.userName?.toLowerCase().includes('raynor')) {
            return {
              ...c,
              userId: 'usr-raynor-001',
              userName: 'Muhammad Raynor Athaillah',
              userNim: '23525055',
              userStudyProgram: 'Teknik Mesin',
              userFaculty: 'Fakultas Teknologi Industri'
            };
          } else if (c.userNim) {
            const info = getUiiProdiFromNim(c.userNim);
            return {
              ...c,
              userStudyProgram: info.studyProgram,
              userFaculty: info.faculty
            };
          }
          return c;
        });

        this.certificates.set(certList);
        this.notificationLogs.set(savedLogs ? JSON.parse(savedLogs) : []);
        return;
      } catch (e) {
        console.error('Failed to parse saved state, reloading seed:', e);
      }
    }

    this.loadMockDefaults();
  }

  private loadMockDefaults(): void {
    const seedEvents: EventItem[] = [
      {
        id: 'evt-001',
        title: 'Seminar Nasional AI 2026: Generative Intelligence for Industrial Transformation',
        slug: 'seminar-nasional-ai-2026',
        category: 'SEMINAR',
        categoryLabel: 'Seminar Nasional',
        organizer: 'LEM FTI UII x Jurusan Informatika',
        faculty: 'Fakultas Teknologi Industri',
        description: 'Eksplorasi mendalam arsitektur model AI tingkat lanjut, strategi adopsi industri 5.0, serta etika kepatuhan data kecerdasan buatan di era otomasi tinggi. Disertai sertifikasi kompetensi SKPI resmi UII.',
        date: '2026-11-22',
        time: '08:30 - 12:30 WIB',
        location: 'Kampus Terpadu UII, Jl. Kaliurang KM 14.5',
        room: 'Auditorium Prof. K.H. Abdul Kahar Mudzakkir',
        bannerUrl: '/assets/images/seminar-ai-uii.jpg',
        quotaTotal: 300,
        quotaRemaining: 300,
        status: 'PUBLISHED',
        skpiPoints: 15,
        isFree: true,
        speaker: {
          name: 'Prof. Dr. Ir. Hari Purnomo, M.T.',
          role: 'Head of Center for AI Innovation & Data Science',
          company: 'Universitas Islam Indonesia'
        },
        instagramPostStatus: {
          isPosted: true,
          postId: 'ig_post_883921049',
          postedAt: '18 Nov 2026, 14:10 WIB',
          mediaUrl: 'https://instagram.com/p/uii.events/883921'
        },
        whatsappHelpdesk: '6281234567890'
      },
      {
        id: 'evt-002',
        title: 'Workshop Pengelola Website: Pengelolaan Konten Berbasis SEO dan AI',
        slug: 'workshop-pengelola-website-seo-ai-uii',
        category: 'WORKSHOP',
        categoryLabel: 'Hands-on Workshop',
        organizer: 'Direktorat Sistem Informasi x LEM UII',
        faculty: 'Universitas Islam Indonesia',
        description: 'Pelatihan intensif pengelolaan konten website institusi dan ormawa berbasis SEO dan AI untuk memperkuat visibilitas digital ekosistem UII. Diselenggarakan di Gedung Prof. Dr. Sardjito.',
        date: '2026-11-25',
        time: '09:00 - 15:30 WIB',
        location: 'Gedung Prof. Dr. Sardjito UII, Kampus Terpadu',
        room: 'Ruang Teatrikal Gedung Prof. Dr. Sardjito',
        bannerUrl: '/assets/images/workshop-ai-uii.jpg',
        quotaTotal: 60,
        quotaRemaining: 60,
        status: 'PUBLISHED',
        skpiPoints: 20,
        isFree: true,
        speaker: {
          name: 'Pakar Konten SEO & AI UII',
          role: 'Konsultan Optimasi Web',
          company: 'Direktorat Sistem & Teknologi Informasi'
        },
        instagramPostStatus: {
          isPosted: true,
          postId: 'ig_post_991823712',
          postedAt: '17 Nov 2026, 10:00 WIB',
          mediaUrl: 'https://instagram.com/p/uii.events/991823'
        },
        whatsappHelpdesk: '6281298765432'
      },
      {
        id: 'evt-003',
        title: 'Open Recruitment Panitia PESTA UII 2027 (Pekan Seni & Ta\'aruf Mahasiswa)',
        slug: 'oprec-panitia-pesta-uii-2027',
        category: 'COMMITTEE_RECRUITMENT',
        categoryLabel: 'Oprec Kepanitiaan',
        organizer: 'Lembaga Eksekutif Mahasiswa (LEM) Universitas',
        faculty: 'Tingkat Universitas',
        description: 'Panggilan kepemimpinan bagi seluruh mahasiswa aktif UII untuk bergabung dalam kepanitiaan penyambutan mahasiswa baru terbesar di UII. Tersedia divisi strategis dan teknis.',
        date: '2026-12-01',
        time: '09:00 - 17:00 WIB (Wawancara)',
        location: 'Student Center UII',
        room: 'Ruang Sidang Utama LEM UII Lt. 2',
        bannerUrl: '/assets/images/oprec-pesta-uii.jpg',
        quotaTotal: 120,
        quotaRemaining: 120,
        status: 'PUBLISHED',
        skpiPoints: 25,
        isFree: true,
        oprecDivisions: [
          'Divisi Acara & Manajemen Panggung',
          'Divisi Humas & Publikasi (Medsos)',
          'Divisi IT & Presensi Web Scanner',
          'Divisi Logistik & Konsumsi',
          'Divisi Kreatif & Visual Branding'
        ],
        instagramPostStatus: {
          isPosted: true,
          postId: 'ig_post_55123984',
          postedAt: '19 Nov 2026, 08:00 WIB',
          mediaUrl: 'https://instagram.com/p/uii.events/551239'
        },
        whatsappHelpdesk: '6281122334455'
      },
      {
        id: 'evt-004',
        title: 'National Islamic Technology Competition (NITC 2026): Sharia FinTech & GovTech',
        slug: 'national-islamic-technology-competition-2026',
        category: 'LOMBA',
        categoryLabel: 'Kompetisi Nasional',
        organizer: 'Dewan Riset Mahasiswa Sains & Teknologi UII',
        faculty: 'Fakultas Matematika & Ilmu Pengetahuan Alam',
        description: 'Ajang kompetisi inovasi perangkat lunak berbasis nilai keislaman dan kebermanfaatan umat dengan total hadiah puluhan juta rupiah serta sertifikat berbobot SKPI.',
        date: '2026-12-10',
        time: '08:00 - 16:00 WIB',
        location: 'Auditorium FMIPA UII, Kampus Terpadu',
        room: 'Hall K.H. Mas Mansyur Lt. 3',
        bannerUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
        quotaTotal: 80,
        quotaRemaining: 80,
        status: 'PUBLISHED',
        skpiPoints: 30,
        isFree: true,
        speaker: {
          name: 'Ahmad Faiz, S.T., M.Eng.',
          role: 'Islamic FinTech Architect',
          company: 'BSI Sharia Innovation Center'
        },
        instagramPostStatus: {
          isPosted: true,
          postId: 'ig_post_33910248',
          postedAt: '15 Nov 2026, 12:00 WIB'
        },
        whatsappHelpdesk: '6281234567890'
      },
      {
        id: 'evt-005',
        title: 'Malam Refleksi & Apresiasi Seni Kemahasiswaan (Gala Budaya UII)',
        slug: 'malam-refleksi-apresiasi-seni-uii',
        category: 'KONSER',
        categoryLabel: 'Konser & Pagelaran Seni',
        organizer: 'UKM Kesenian & Budaya UII',
        faculty: 'Direktorat Pembinaan Kemahasiswaan',
        description: 'Malam keakraban, pementasan teater islami, musik akustik, puisi kontemplasi perjuangan kemahasiswaan serta penghargaan Ormawa Berprestasi UII 2026.',
        date: '2026-12-18',
        time: '19:30 - 22:30 WIB',
        location: 'Lapangan Gedung Prof. Dr. Sardjito UII',
        room: 'Open Air Amphitheater UII',
        bannerUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
        quotaTotal: 400,
        quotaRemaining: 400,
        status: 'PUBLISHED',
        skpiPoints: 10,
        isFree: true,
        instagramPostStatus: {
          isPosted: false
        },
        whatsappHelpdesk: '6281234567890'
      },
      {
        id: 'evt-006',
        title: 'Workshop Cyber Security 2026: Hands-on Penetration Testing & Ethical Defense',
        slug: 'workshop-cyber-security-ethical-defense-2026',
        category: 'WORKSHOP',
        categoryLabel: 'Hands-on Workshop',
        organizer: 'UKM Informatika & Multimedia UII',
        faculty: 'Fakultas Teknologi Industri',
        description: 'Pelatihan praktis audit keamanan sistem informasi web kampus, teknik patching vulnerabilitas OWASP Top 10, dan mitigasi serangan DDoS. Menunggu persetujuan izin kegiatan dari DPK UII.',
        date: '2026-12-23',
        time: '09:00 - 15:00 WIB',
        location: 'Gedung K.H. Mas Mansyur FTI UII',
        room: 'Lab Jaringan & Cyber Security Lt. 2',
        bannerUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
        quotaTotal: 40,
        quotaRemaining: 40,
        status: 'PUBLISHED',
        skpiPoints: 20,
        isFree: true,
        proposalFileName: 'Proposal_Workshop_Cyber_Security_FTI_2026.pdf',
        submittedAt: '2026-11-20T14:30:00.000Z',
        instagramPostStatus: { isPosted: false },
        whatsappHelpdesk: '6281298765432'
      },
      {
        id: 'evt-007',
        title: 'Grand Launching Tech Startup & Inkubasi Mahasiswa UII 2027',
        slug: 'grand-launching-tech-startup-inkubasi-2027',
        category: 'SEMINAR',
        categoryLabel: 'Seminar Nasional',
        organizer: 'LEM FTI UII x Simpul Tumbuh',
        faculty: 'Tingkat Universitas',
        description: 'Program akselerasi pendanaan ide bisnis digital mahasiswa, pitching di hadapan venture capital syariah nasional, dan fasilitas mentoring inkubasi 6 bulan.',
        date: '2026-12-28',
        time: '09:00 - 16:00 WIB',
        location: 'Gedung Rektorat GBPH Prabuningrat UII',
        room: 'Ruang Teatrikal Lt. 1',
        bannerUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
        quotaTotal: 150,
        quotaRemaining: 150,
        status: 'PUBLISHED',
        skpiPoints: 25,
        isFree: true,
        proposalFileName: 'Draf_Proposal_Inkubasi_Startup_2027.pdf',
        instagramPostStatus: { isPosted: false },
        whatsappHelpdesk: '6281234567890'
      },
      {
        id: 'evt-008',
        title: 'Porsematik HMIF UII 2026',
        slug: 'porsematik-hmif-uii-2026',
        category: 'COMMITTEE_RECRUITMENT',
        categoryLabel: 'Oprec Kepanitiaan',
        organizer: 'HMIF FTI UII',
        faculty: 'Fakultas Teknologi Industri',
        description: 'Perekrutan panitia mahasiswa untuk rangkaian perhelatan Pekan Olahraga dan Seni Mahasiswa Informatika (Porsematik) FTI UII 2026. Terbuka bagi seluruh mahasiswa aktif UII lintas prodi.',
        date: '2026-12-05',
        time: '08:00 - 17:00 WIB',
        location: 'GOR Ki Bagoes Hadikoesoemo & Hall FTI UII',
        room: 'GOR Utama Kampus Terpadu UII',
        bannerUrl: '/assets/images/campus/uii-kampus-terpadu-hd.jpg',
        quotaTotal: 150,
        quotaRemaining: 150,
        status: 'PUBLISHED',
        skpiPoints: 20,
        isFree: true,
        oprecDivisions: [
          'Divisi Acara & Pertandingan',
          'Divisi Humas & Publikasi (Medsos)',
          'Divisi IT, Web & Presensi Scanner',
          'Divisi Logistik & Perlengkapan',
          'Divisi Konsumsi & Medis',
          'Divisi Wasit & Keamanan'
        ],
        proposalFileName: 'Proposal_Porsematik_HMIF_2026.pdf',
        submittedAt: '2026-11-19T10:00:00.000Z',
        reviewedAt: '2026-11-20T14:00:00.000Z',
        reviewedBy: 'Dr. Ir. Budi Hartono, M.T.',
        dpkReviewNotes: 'Proposal telah ditinjau dan disetujui DPK UII. Memenuhi norma kepatutan kampus islami & bobot SKPI sah.',
        instagramPostStatus: {
          isPosted: true,
          postId: 'ig_post_porsematik2026',
          postedAt: '20 Nov 2026, 14:00 WIB',
          mediaUrl: 'https://instagram.com/p/uii.events/porsematik2026'
        },
        whatsappHelpdesk: '6281234567890'
      }
    ];

    // Seed existing registration & ticket for Muhammad Rian in Seminar AI (FR-REG-02 / US-01 verification ready)
    const initialRegId = 'reg-rian-ai-001';
    const initialTicketId = 'tck-rian-ai-001';
    const hashSignature = '9d8f8a127f8490b435ecbb890c427329d491f88c829e1208d13264eb78d5236b';

    const porsematikTicketCode = 'UII-TIK-2026-8899';
    const porsematikHash = this.generateHashSignature('23525055', 'evt-008', porsematikTicketCode);
    const porsematikQrPayload = JSON.stringify({
      ticketCode: porsematikTicketCode,
      nim: '23525055',
      name: 'Muhammad Raynor Athaillah',
      eventId: 'evt-008',
      hash: porsematikHash,
      timestamp: 1763640000000
    });

    const porsematikTicket: TicketItem = {
      id: 'tck-porsematik-raynor-001',
      registrationId: 'reg-porsematik-raynor-001',
      ticketCode: porsematikTicketCode,
      eventId: 'evt-008',
      eventTitle: 'Porsematik HMIF UII 2026',
      eventCategory: 'COMMITTEE_RECRUITMENT',
      eventDate: '2026-12-05',
      eventTime: '08:00 - 17:00 WIB',
      eventLocation: 'GOR Ki Bagoes Hadikoesoemo & Hall FTI UII',
      eventRoom: 'GOR Utama Kampus Terpadu UII',
      userId: 'usr-raynor-001',
      userName: 'Muhammad Raynor Athaillah',
      userNim: '23525055',
      userStudyProgram: 'Teknik Mesin - Fakultas Teknologi Industri',
      qrPayload: porsematikQrPayload,
      hashSignature: porsematikHash,
      timestampIssued: '20 November 2026, 14:15 WIB',
      isCheckedIn: false
    };

    const nitcTicketCode = 'UII-TIK-2026-7721';
    const nitcHash = this.generateHashSignature('23525055', 'evt-004', nitcTicketCode);
    const nitcQrPayload = JSON.stringify({
      ticketCode: nitcTicketCode,
      nim: '23525055',
      name: 'Muhammad Raynor Athaillah',
      eventId: 'evt-004',
      hash: nitcHash,
      timestamp: 1763640000000
    });

    const nitcTicket: TicketItem = {
      id: 'tck-nitc-raynor-001',
      registrationId: 'reg-nitc-raynor-001',
      ticketCode: nitcTicketCode,
      eventId: 'evt-004',
      eventTitle: 'National Islamic Technology Competition (NITC 2026): Sharia FinTech & GovTech',
      eventCategory: 'LOMBA',
      eventDate: '2026-12-10',
      eventTime: '08:00 - 16:00 WIB',
      eventLocation: 'Auditorium FMIPA UII, Kampus Terpadu',
      eventRoom: 'Hall K.H. Mas Mansyur Lt. 3',
      userId: 'usr-raynor-001',
      userName: 'Muhammad Raynor Athaillah',
      userNim: '23525055',
      userStudyProgram: 'Teknik Mesin - Fakultas Teknologi Industri',
      qrPayload: nitcQrPayload,
      hashSignature: nitcHash,
      timestampIssued: '21 November 2026, 09:30 WIB',
      isCheckedIn: false
    };

    const seedRegistrations: RegistrationItem[] = [
      {
        id: 'reg-porsematik-raynor-001',
        userId: 'usr-raynor-001',
        userNim: '23525055',
        userName: 'Muhammad Raynor Athaillah',
        userEmail: '23525055@students.uii.ac.id',
        userPhone: '081234567890',
        userFaculty: 'Fakultas Teknologi Industri',
        userStudyProgram: 'Teknik Mesin',
        eventId: 'evt-008',
        eventTitle: 'Porsematik HMIF UII 2026',
        eventDate: '2026-12-05',
        eventLocation: 'GOR Utama Kampus Terpadu UII, GOR Ki Bagoes Hadikoesoemo & Hall FTI UII',
        status: 'REGISTERED',
        createdAt: '2026-11-20T14:15:00.000Z'
      },
      {
        id: 'reg-nitc-raynor-001',
        userId: 'usr-raynor-001',
        userNim: '23525055',
        userName: 'Muhammad Raynor Athaillah',
        userEmail: '23525055@students.uii.ac.id',
        userPhone: '081234567890',
        userFaculty: 'Fakultas Teknologi Industri',
        userStudyProgram: 'Teknik Mesin',
        eventId: 'evt-004',
        eventTitle: 'National Islamic Technology Competition (NITC 2026): Sharia FinTech & GovTech',
        eventDate: '2026-12-10',
        eventLocation: 'Hall K.H. Mas Mansyur Lt. 3, Auditorium FMIPA UII, Kampus Terpadu',
        status: 'REGISTERED',
        createdAt: '2026-11-21T09:30:00.000Z'
      }
    ];
    const seedTickets: TicketItem[] = [
      porsematikTicket,
      nitcTicket
    ];
    const attendedRegId = 'reg-rian-attended-099';
    const attendedTicketId = 'tck-rian-attended-099';
    const attendedCertHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const seedCertificates: CertificateItem[] = [
      {
        id: '0491',
        registrationId: 'reg-0491',
        ticketId: 'tck-0491',
        eventId: 'evt-001',
        eventTitle: 'Seminar Nasional AI & Karir Teknologi 2026',
        eventDate: 'Rabu, 25 November 2026',
        organizer: 'LEM FTI UII',
        eventRoom: 'Auditorium KH. Abdurrahman Wahid FTI UII',
        publishedAtFormatted: 'Rabu, 25 November 2026 · 08.14 WIB (saat presensi)',
        userId: 'usr-raynor-001',
        userName: 'Muhammad Raynor Athaillah',
        userNim: '23525055',
        userFaculty: 'Fakultas Teknologi Industri',
        userStudyProgram: 'Teknik Mesin',
        certificateNumber: 'UII/DPK/CERT/2026/0491',
        skpiPoints: 15,
        issueDate: '25 November 2026',
        verificationHash: '7f3a9c2e41b8d05a',
        issuerName: 'Dr. Ir. Budi Hartono, M.T.',
        issuerRole: 'Direktur Pembinaan Kemahasiswaan UII',
        isUnlocked: true
      },
      {
        id: 'cert-001',
        registrationId: attendedRegId,
        ticketId: attendedTicketId,
        eventId: 'evt-004',
        eventTitle: 'National Islamic Technology Competition (NITC 2026): Sharia FinTech & GovTech',
        eventDate: '15 Oktober 2026',
        organizer: 'Dewan Riset Mahasiswa Sains & Teknologi UII',
        eventRoom: 'Hall K.H. Mas Mansyur Lt. 3',
        publishedAtFormatted: '15 Oktober 2026 · 08.15 WIB (saat presensi)',
        userId: 'usr-raynor-001',
        userName: 'Muhammad Raynor Athaillah',
        userNim: '23525055',
        userFaculty: 'Fakultas Teknologi Industri',
        userStudyProgram: 'Teknik Mesin',
        certificateNumber: 'UII/SKPI/2026/FTI-0042',
        skpiPoints: 30,
        issueDate: '15 Oktober 2026',
        verificationHash: attendedCertHash,
        issuerName: 'Dr. Ir. Budi Hartono, M.T.',
        issuerRole: 'Direktur Pembinaan Kemahasiswaan UII',
        isUnlocked: true
      }
    ];

    const seedLogs: NotificationLog[] = [
      {
        id: 'log-001',
        channel: 'WHATSAPP',
        recipientPhone: '6281234567890',
        recipientEmail: '21523001@students.uii.ac.id',
        recipientName: 'Muhammad Rian',
        eventTitle: 'Seminar Nasional AI 2026',
        messageType: 'H-1',
        timestamp: '21 Nov 2026, 09:00 WIB',
        status: 'SENT',
        contentSnippet: 'Halo Muhammad Rian! Mengingatkan besok adalah pelaksanaan Seminar AI 2026 di Auditorium Abd. Kahar Mudzakkir. Tunjukkan E-Tiket Anda...'
      }
    ];

    this.events.set(seedEvents);
    this.registrations.set(seedRegistrations);
    this.tickets.set(seedTickets);
    this.certificates.set(seedCertificates);
    this.notificationLogs.set(seedLogs);

    this.saveToStorage();
  }

  saveToStorage(): void {
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
    this.loadMockDefaults();
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
