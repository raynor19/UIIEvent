import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import { EventService, CheckInResult } from '../../core/services/event.service';
import { AudioService } from '../../core/services/audio.service';
import { AuthService } from '../../core/services/auth.service';

export interface ScanLogItem {
  time: string;
  name: string;
  nim: string;
  status: 'HADIR' | 'DUPLIKAT' | 'TIDAK_SAH';
}

export interface ManualParticipant {
  ticketCode?: string;
  nim: string;
  name: string;
  prodi: string;
  isCheckedIn: boolean;
}

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './scanner.component.html'
})
export class ScannerComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  eventService = inject(EventService);
  audioService = inject(AudioService);
  authService = inject(AuthService);

  // Sound configuration
  soundActive = signal<boolean>(true);

  // Camera state
  isCameraActive = signal<boolean>(false);
  isCameraLoading = signal<boolean>(false);
  cameraError = signal<'DENIED' | 'NOT_FOUND' | null>(null);
  currentFacingMode: 'environment' | 'user' = 'environment';
  mediaStream: MediaStream | null = null;
  animationFrameId: number | null = null;
  isProcessingScan = false;

  // Real-time counter metrics (SCR-PAN-05)
  hadirCount = signal<number>(0);
  totalCount = signal<number>(0);
  unattendedCount = computed(() => this.totalCount() - this.hadirCount());

  // Online / Offline mode
  isOnline = signal<boolean>(true);

  // Scan Result State: 'STANDBY' | 'VALID' | 'DUPLICATE' | 'INVALID' | 'OFFLINE_SAVED'
  scanResultState = signal<'STANDBY' | 'VALID' | 'DUPLICATE' | 'INVALID' | 'OFFLINE_SAVED'>('STANDBY');
  scanResultData = signal<{
    name: string;
    nim: string;
    message?: string;
    timestamp?: string;
  }>({
    name: '',
    nim: ''
  });

  // Recent scan logs
  scanLogs = signal<ScanLogItem[]>([]);

  // Active Event Header info
  eventHeaderTitle = signal<string>('Kegiatan UII');
  eventOrgTitle = signal<string>('Web Scanner Meja Registrasi');
  currentEventId = signal<string>('');

  // Presensi Manual state
  showManualSearch = signal<boolean>(false);
  manualSearchInput = signal<string>('');
  manualParticipants = signal<ManualParticipant[]>([]);

  filteredManualParticipants = computed(() => {
    const q = this.manualSearchInput().trim().toLowerCase();
    if (!q) return this.manualParticipants();
    return this.manualParticipants().filter(
      p => p.name.toLowerCase().includes(q) || p.nim.toLowerCase().includes(q) || p.prodi.toLowerCase().includes(q)
    );
  });

  autoDismissTimeout: any = null;

  async ngOnInit(): Promise<void> {
    // Attempt auto-start camera
    this.startCamera();

    // Check if event ID is provided in route query or param
    let eventId = this.route.snapshot.paramMap.get('eventId') || this.route.snapshot.queryParamMap.get('eventId');
    
    if (!eventId) {
      await this.eventService.loadOrganizerEvents();
      const orgEvents = this.eventService.events().filter(e => e.status === 'PUBLISHED');
      if (orgEvents.length > 0) {
        eventId = orgEvents[0].id;
      } else if (this.eventService.events().length > 0) {
        eventId = this.eventService.events()[0].id;
      }
    }

    if (eventId) {
      this.currentEventId.set(eventId);
      await this.loadEventAttendance(eventId);
    } else {
      // Default to total tickets count
      const allTickets = this.eventService.tickets();
      this.totalCount.set(allTickets.length || 0);
      this.hadirCount.set(allTickets.filter(t => t.isCheckedIn).length || 0);
      this.manualParticipants.set(allTickets.map(t => ({
        ticketCode: t.ticketCode,
        nim: t.userNim,
        name: t.userName,
        prodi: t.userStudyProgram,
        isCheckedIn: t.isCheckedIn
      })));
    }
  }

  async loadEventAttendance(eventId: string): Promise<void> {
    const activeEvent = this.eventService.events().find(e => e.id === eventId);
    if (activeEvent) {
      this.eventHeaderTitle.set(activeEvent.title);
      this.eventOrgTitle.set(`Web Scanner Meja Registrasi · ${activeEvent.organizer || 'Panitia UII'}`);
    }

    const stats = await this.eventService.getEventAttendanceStatsApi(eventId);
    if (stats?.data && Array.isArray(stats.data)) {
      if (stats.data[0]?.event?.title) {
        this.eventHeaderTitle.set(stats.data[0].event.title);
      }
      
      const totalReg = stats.meta?.statistics?.total_registered ?? stats.meta?.total ?? stats.data.length;
      const totalAtt = stats.meta?.statistics?.total_attended ?? stats.data.filter((d: any) => d.is_checked_in).length;
      
      this.totalCount.set(totalReg);
      this.hadirCount.set(totalAtt);

      const mappedManual: ManualParticipant[] = stats.data.map((item: any) => ({
        ticketCode: item.ticket_code,
        nim: item.attendee?.nim || item.user?.nim || '',
        name: item.attendee?.name || item.user?.name || 'Peserta',
        prodi: item.attendee?.study_program || item.attendee?.faculty || 'Informatika',
        isCheckedIn: !!item.is_checked_in
      }));

      this.manualParticipants.set(mappedManual);
    } else {
      const matchingTickets = this.eventService.tickets().filter(t => !eventId || t.eventId === eventId);
      if (matchingTickets.length > 0) {
        this.totalCount.set(matchingTickets.length);
        this.hadirCount.set(matchingTickets.filter(t => t.isCheckedIn).length);
        this.manualParticipants.set(matchingTickets.map(t => ({
          ticketCode: t.ticketCode,
          nim: t.userNim,
          name: t.userName,
          prodi: t.userStudyProgram,
          isCheckedIn: t.isCheckedIn
        })));
      }
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.autoDismissTimeout) {
      clearTimeout(this.autoDismissTimeout);
    }
  }

  // Toggle sound
  toggleSound(): void {
    this.soundActive.update(v => !v);
  }

  // Camera Management
  async startCamera(): Promise<void> {
    this.isCameraLoading.set(true);
    this.cameraError.set(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.isCameraLoading.set(false);
      this.cameraError.set('NOT_FOUND');
      return;
    }

    try {
      this.stopCamera();
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      this.isCameraActive.set(true);
      this.isCameraLoading.set(false);

      setTimeout(() => {
        if (this.videoRef?.nativeElement) {
          this.videoRef.nativeElement.srcObject = this.mediaStream;
          this.videoRef.nativeElement.setAttribute('playsinline', 'true');
          this.videoRef.nativeElement.play().catch(() => {});
          this.requestScanFrame();
        }
      }, 100);
    } catch (err: any) {
      this.isCameraLoading.set(false);
      this.isCameraActive.set(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.cameraError.set('DENIED');
      } else {
        this.cameraError.set('NOT_FOUND');
      }
    }
  }

  stopCamera(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.isCameraActive.set(false);
  }

  flipCamera(): void {
    this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
    this.startCamera();
  }

  private requestScanFrame(): void {
    if (!this.isCameraActive()) return;

    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data && !this.isProcessingScan) {
          this.processDecodedQr(code.data);
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.requestScanFrame());
  }

  // Processing scanned QR code
  async processDecodedQr(payload: string): Promise<void> {
    if (this.isProcessingScan) return;
    this.isProcessingScan = true;

    const operatorName = this.authService.currentUser().name;
    const result = await this.eventService.processScanReal(payload, operatorName);

    const nowStr = new Date().toTimeString().substring(0, 8);

    if (result.status === 'SUCCESS') {
      this.scanResultState.set('VALID');
      this.scanResultData.set({
        name: result.participantName || 'Mahasiswa UII',
        nim: result.nim || '',
        message: result.message || 'Presensi Berhasil: Hadir Terverifikasi!',
        timestamp: nowStr
      });
      this.hadirCount.update(c => c + 1);

      this.addScanLog({
        time: nowStr,
        name: result.participantName || 'Mahasiswa UII',
        nim: result.nim || '',
        status: 'HADIR'
      });

      if (this.soundActive()) {
        this.audioService.playSuccessBeep();
      }
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 }
      });
    } else if (result.status === 'DUPLICATE') {
      this.scanResultState.set('DUPLICATE');
      this.scanResultData.set({
        name: result.participantName || 'Mahasiswa UII',
        nim: result.nim || '',
        message: result.message || 'Peringatan: Tiket sudah pernah dipindai sebelumnya!'
      });

      this.addScanLog({
        time: nowStr,
        name: result.participantName || 'Mahasiswa UII',
        nim: result.nim || '',
        status: 'DUPLIKAT'
      });

      if (this.soundActive()) {
        this.audioService.playErrorAlarm();
      }
    } else {
      this.scanResultState.set('INVALID');
      this.scanResultData.set({
        name: result.participantName || 'QR Tidak Sah',
        nim: result.nim || '',
        message: result.message || 'Tiket Tidak Dikenali / Tidak Sah!'
      });

      this.addScanLog({
        time: nowStr,
        name: result.participantName || 'QR Tidak Sah',
        nim: result.nim || '',
        status: 'TIDAK_SAH'
      });

      if (this.soundActive()) {
        this.audioService.playErrorAlarm();
      }
    }

    // Auto dismiss after 2.5s (back to standby ready for next scan)
    if (this.autoDismissTimeout) clearTimeout(this.autoDismissTimeout);
    this.autoDismissTimeout = setTimeout(() => {
      this.scanResultState.set('STANDBY');
      this.isProcessingScan = false;
    }, 2500);
  }

  addScanLog(item: ScanLogItem): void {
    this.scanLogs.update(logs => [item, ...logs.slice(0, 4)]);
  }

  // Quick prototype simulator actions as seen in SCR-PAN-05
  simulateScanValid(): void {
    this.processDecodedQr('VALID_TICKET_TEST');
  }

  simulateScanDuplicate(): void {
    const nowStr = new Date().toTimeString().substring(0, 8);
    this.scanResultState.set('DUPLICATE');
    this.scanResultData.set({
      name: 'Muhammad Raynor Athaillah',
      nim: '23525055',
      message: 'Tiket sudah pernah digunakan pada pukul 08.15 WIB!'
    });

    this.addScanLog({
      time: nowStr,
      name: 'Muhammad Raynor Athaillah',
      nim: '23525055',
      status: 'DUPLIKAT'
    });

    if (this.soundActive()) {
      this.audioService.playErrorAlarm();
    }

    if (this.autoDismissTimeout) clearTimeout(this.autoDismissTimeout);
    this.autoDismissTimeout = setTimeout(() => {
      this.scanResultState.set('STANDBY');
    }, 2500);
  }

  simulateScanInvalid(): void {
    const nowStr = new Date().toTimeString().substring(0, 8);
    this.scanResultState.set('INVALID');
    this.scanResultData.set({
      name: 'QR tidak dikenal',
      nim: '',
      message: 'Tiket Tidak Dikenali / Tidak Sah!'
    });

    this.addScanLog({
      time: nowStr,
      name: 'QR tidak dikenal',
      nim: '',
      status: 'TIDAK_SAH'
    });

    if (this.soundActive()) {
      this.audioService.playErrorAlarm();
    }

    if (this.autoDismissTimeout) clearTimeout(this.autoDismissTimeout);
    this.autoDismissTimeout = setTimeout(() => {
      this.scanResultState.set('STANDBY');
    }, 2500);
  }

  // Manual Check-in
  toggleManualSearch(): void {
    this.showManualSearch.update(v => !v);
  }

  async markManualHadir(p: ManualParticipant): Promise<void> {
    const operatorName = this.authService.currentUser()?.name || 'Panitia Meja Registrasi';
    const scanRef = p.ticketCode || p.nim;
    const result = await this.eventService.processScanReal(scanRef, operatorName);

    const nowStr = new Date().toTimeString().substring(0, 8);

    if (result.status === 'SUCCESS') {
      p.isCheckedIn = true;
      this.hadirCount.update(c => c + 1);

      this.scanResultState.set('VALID');
      this.scanResultData.set({
        name: result.participantName || p.name,
        nim: result.nim || p.nim,
        message: result.message || 'Presensi Manual Berhasil!',
        timestamp: nowStr
      });

      if (this.currentEventId()) {
        this.loadEventAttendance(this.currentEventId()).catch(() => {});
      }

      this.addScanLog({
        time: nowStr,
        name: result.participantName || p.name,
        nim: result.nim || p.nim,
        status: 'HADIR'
      });

      if (this.soundActive()) {
        this.audioService.playSuccessBeep();
      }
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 }
      });
    } else if (result.status === 'DUPLICATE') {
      p.isCheckedIn = true;
      this.scanResultState.set('DUPLICATE');
      this.scanResultData.set({
        name: result.participantName || p.name,
        nim: result.nim || p.nim,
        message: result.message || 'Peringatan: Peserta sudah tercatat presensi sebelumnya!'
      });

      this.addScanLog({
        time: nowStr,
        name: result.participantName || p.name,
        nim: result.nim || p.nim,
        status: 'DUPLIKAT'
      });

      if (this.soundActive()) {
        this.audioService.playErrorAlarm();
      }
    } else {
      this.scanResultState.set('INVALID');
      this.scanResultData.set({
        name: p.name,
        nim: p.nim,
        message: result.message || 'Gagal memproses presensi manual.'
      });

      this.addScanLog({
        time: nowStr,
        name: p.name,
        nim: p.nim,
        status: 'TIDAK_SAH'
      });

      if (this.soundActive()) {
        this.audioService.playErrorAlarm();
      }
    }

    if (this.autoDismissTimeout) clearTimeout(this.autoDismissTimeout);
    this.autoDismissTimeout = setTimeout(() => {
      this.scanResultState.set('STANDBY');
    }, 2500);
  }

  goBack(): void {
    this.router.navigate(['/dashboard/panitia']);
  }
}