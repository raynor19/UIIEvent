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

  // Active event being scanned (defaults to NITC evt-004 or query param)
  currentEventId = signal<string>('evt-004');
  currentEvent = computed(() => {
    const id = this.currentEventId();
    const list = this.eventService.events();
    const found = list.find(e => e.id === id);
    return found || list[0] || null;
  });

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
  unattendedCount = computed(() => Math.max(0, this.totalCount() - this.hadirCount()));

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

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const id = params['eventId'] || this.route.snapshot.paramMap.get('id');
      if (id) {
        this.currentEventId.set(id);
      }
      this.syncEventMetrics();
    });

    // Attempt auto-start camera
    this.startCamera();
  }

  syncEventMetrics(): void {
    const evId = this.currentEventId();
    const tickets = this.eventService.tickets().filter(t => t.eventId === evId);
    const regs = this.eventService.registrations().filter(r => r.eventId === evId && r.status !== 'CANCELLED');

    this.totalCount.set(Math.max(tickets.length, regs.length));
    const attended = tickets.filter(t => t.isCheckedIn).length || regs.filter(r => r.status === 'ATTENDED').length;
    this.hadirCount.set(attended);

    if (regs.length > 0) {
      const mapped: ManualParticipant[] = regs.map(r => {
        const t = tickets.find(tick => tick.registrationId === r.id);
        return {
          nim: r.userNim,
          name: r.userName,
          prodi: r.userStudyProgram || 'Teknik Mesin',
          isCheckedIn: r.status === 'ATTENDED' || !!t?.isCheckedIn
        };
      });
      this.manualParticipants.set(mapped);
      if (mapped.length > 0) {
        this.manualSearchInput.set(mapped[0].name.toLowerCase());
      }
    } else {
      this.manualParticipants.set([
        { nim: '23525055', name: 'Muhammad Raynor Athaillah', prodi: 'Teknik Mesin', isCheckedIn: false }
      ]);
      this.manualSearchInput.set('raynor');
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
      const ctx = canvas.getContext('2d');

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
  processDecodedQr(payload: string): void {
    if (this.isProcessingScan) return;
    this.isProcessingScan = true;

    const operatorName = this.authService.currentUser().name;
    const result = this.eventService.processScan(payload, operatorName);

    const nowStr = new Date().toTimeString().substring(0, 8);

    if (result.status === 'SUCCESS') {
      this.scanResultState.set('VALID');
      this.scanResultData.set({
        name: result.participantName || 'Muhammad Raynor Athaillah',
        nim: result.nim || '23525055',
        timestamp: nowStr
      });
      this.hadirCount.update(c => c + 1);

      this.addScanLog({
        time: nowStr,
        name: result.participantName || 'Muhammad Raynor Athaillah',
        nim: result.nim || '23525055',
        status: 'HADIR'
      });

      this.syncEventMetrics();

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
        name: result.participantName || 'Muhammad Raynor Athaillah',
        nim: result.nim || '23525055',
        message: 'Tiket sudah pernah digunakan pada pukul 08.15 WIB!'
      });

      this.addScanLog({
        time: nowStr,
        name: result.participantName || 'Muhammad Raynor Athaillah',
        nim: result.nim || '23525055',
        status: 'DUPLIKAT'
      });

      if (this.soundActive()) {
        this.audioService.playErrorAlarm();
      }
    } else {
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
    const evId = this.currentEventId();
    const t = this.eventService.tickets().find(tick => tick.eventId === evId);
    if (t) {
      this.processDecodedQr(t.qrPayload || t.ticketCode);
    } else {
      this.processDecodedQr(JSON.stringify({
        ticketCode: `UII-TIK-2026-5522`,
        nim: '23525055',
        name: 'Muhammad Raynor Athaillah',
        eventId: evId,
        hash: 'valid_test_hash'
      }));
    }
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

  markManualHadir(p: ManualParticipant): void {
    p.isCheckedIn = true;
    this.hadirCount.update(c => c + 1);

    // Also update ticket & registration in eventService if matching
    const matchTicket = this.eventService.tickets().find(t => t.userNim === p.nim && t.eventId === this.currentEventId());
    if (matchTicket && !matchTicket.isCheckedIn) {
      const nowFormatted = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      matchTicket.isCheckedIn = true;
      matchTicket.checkedInAt = nowFormatted;
      matchTicket.checkedInBy = this.authService.currentUser().name;
      this.eventService.registrations.update(regs => 
        regs.map(r => r.id === matchTicket.registrationId ? { ...r, status: 'ATTENDED', attendedAt: new Date().toISOString() } : r)
      );
      this.eventService.tickets.update(ticks => 
        ticks.map(t => t.id === matchTicket.id ? { ...matchTicket } : t)
      );
      this.eventService.saveToStorage();
    }

    const nowStr = new Date().toTimeString().substring(0, 8);
    this.scanResultState.set('VALID');
    this.scanResultData.set({
      name: p.name,
      nim: p.nim
    });

    this.addScanLog({
      time: nowStr,
      name: p.name,
      nim: p.nim,
      status: 'HADIR'
    });

    if (this.soundActive()) {
      this.audioService.playSuccessBeep();
    }

    if (this.autoDismissTimeout) clearTimeout(this.autoDismissTimeout);
    this.autoDismissTimeout = setTimeout(() => {
      this.scanResultState.set('STANDBY');
    }, 2500);
  }

  goBack(): void {
    const evId = this.currentEventId();
    if (evId) {
      this.router.navigate(['/dashboard/panitia'], { queryParams: { eventId: evId } });
    } else {
      this.router.navigate(['/dashboard/panitia']);
    }
  }
}