import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService, getUiiProdiFromNim, UII_FACULTY_DIRECTORY, UiiFacultyDirectory } from '../../core/services/auth.service';

export interface CampusSlide {
  title: string;
  faculty: string;
  imageUrl: string;
  description: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  identifier = '23525055';
  password = 'password123';
  rememberMe = true;
  showPassword = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  selectedRoleTab: 'MAHASISWA' | 'PANITIA' | 'ADMIN' = 'MAHASISWA';

  // Auth Mode: 'LOGIN' or 'REGISTER'
  authMode: 'LOGIN' | 'REGISTER' = 'LOGIN';

  // Register Form State
  regName = '';
  regNim = '';
  regEmail = '';
  regPassword = '';
  regRole: 'MAHASISWA' | 'PANITIA' | 'DPK_ADMIN' = 'MAHASISWA';
  regFaculty = 'Fakultas Teknologi Industri';
  regStudyProgram = 'Informatika';
  regPhone = '';
  isRegisterLoading = false;

  // Campus Landmark Background (Ultra-HD Kampus Terpadu UII Yogyakarta - 2560x1707 px)
  campusBackground = {
    title: 'Kampus Terpadu UII Yogyakarta',
    location: 'Jl. Kaliurang KM 14.5 Sleman & Panorama Gunung Merapi',
    imageUrl: '/assets/images/campus/uii-kampus-terpadu-hd.jpg'
  };

  // Modal popup visibility state
  isLoginModalOpen = true;

  // Google / Gmail OAuth Login State
  showGooglePicker = false;
  isGoogleAuthenticating = false;
  showCustomGmailField = false;
  customGmailInput = '';

  googleAccounts = [
    {
      name: 'Muhammad Raynor Athaillah',
      email: '23525055@students.uii.ac.id',
      role: 'Mahasiswa',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    },
    {
      name: 'Sarah Nabila',
      email: 'sarah.nabila@lem.uii.ac.id',
      role: 'Panitia Ormawa',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
    },
    {
      name: 'Dr. Ir. Budi Hartono, M.T.',
      email: 'budi.hartono@uii.ac.id',
      role: 'Admin DPK UII',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80'
    }
  ];

  isRoleDropdownOpen = false;
  isRegRoleDropdownOpen = false;

  // UII Faculty Directory Reference
  uiiFacultyList = UII_FACULTY_DIRECTORY;
  showDirectoryModal = false;
  selectedDirectoryFaculty: UiiFacultyDirectory = UII_FACULTY_DIRECTORY[0];

  toggleDirectoryModal(): void {
    this.showDirectoryModal = !this.showDirectoryModal;
  }

  selectDirectoryFaculty(fac: UiiFacultyDirectory): void {
    this.selectedDirectoryFaculty = fac;
  }

  pickDepartmentCode(code: string): void {
    // Take year or default 23
    const yearPrefix = (this.regNim.length >= 2) ? this.regNim.substring(0, 2) : '23';
    this.regNim = `${yearPrefix}${code}055`;
    this.showDirectoryModal = false;
  }

  get selectedRoleDisplayName(): string {
    if (this.selectedRoleTab === 'ADMIN') return 'Admin DPK';
    if (this.selectedRoleTab === 'PANITIA') return 'Panitia';
    return 'Mahasiswa';
  }

  get regRoleDisplayName(): string {
    if (this.regRole === 'DPK_ADMIN') return 'Admin DPK';
    if (this.regRole === 'PANITIA') return 'Panitia';
    return 'Mahasiswa';
  }

  toggleRoleDropdown(): void {
    this.isRoleDropdownOpen = !this.isRoleDropdownOpen;
  }

  toggleRegRoleDropdown(): void {
    this.isRegRoleDropdownOpen = !this.isRegRoleDropdownOpen;
  }

  get roleButtonLabel(): string {
    if (this.selectedRoleTab === 'ADMIN') return 'Masuk Sebagai Admin DPK';
    if (this.selectedRoleTab === 'PANITIA') return 'Masuk Sebagai Panitia';
    return 'Masuk Sebagai Mahasiswa';
  }

  get identifierPlaceholder(): string {
    if (this.selectedRoleTab === 'ADMIN') return 'NIP.19740512 / budi.hartono@uii.ac.id';
    if (this.selectedRoleTab === 'PANITIA') return '20523120 / sarah.nabila@lem.uii.ac.id';
    return '23525055 / 23525055@students.uii.ac.id';
  }

  get identifierLabel(): string {
    if (this.selectedRoleTab === 'ADMIN') return 'NIP / Email Resmi Admin DPK';
    if (this.selectedRoleTab === 'PANITIA') return 'Email Ormawa / Akun Panitia UII';
    return 'NIM / Alamat Email Mahasiswa UII';
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {}

  openLoginModal(): void {
    this.isLoginModalOpen = true;
  }

  closeLoginModal(): void {
    this.isLoginModalOpen = false;
  }

  selectRole(role: 'MAHASISWA' | 'PANITIA' | 'ADMIN'): void {
    this.selectedRoleTab = role;
    this.isRoleDropdownOpen = false;
    if (role === 'MAHASISWA') {
      this.identifier = '23525055';
      this.password = 'password123';
    } else if (role === 'PANITIA') {
      this.identifier = '20523120';
      this.password = 'password123';
    } else {
      this.identifier = 'NIP.19740512';
      this.password = 'password123';
    }
  }

  onLoginSubmit(): void {
    if (!this.identifier.trim()) {
      this.errorMessage = 'Silakan isi NIM atau Email resmi UII Anda.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    // Emulate JWT token handshake (RFC 7519)
    setTimeout(() => {
      const res = this.authService.login(this.identifier, this.password);
      this.isLoading = false;

      if (res.success) {
        this.successMessage = res.message;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (res.user?.role === 'DPK_ADMIN' || this.selectedRoleTab === 'ADMIN') {
            this.router.navigate(['/dashboard/admin']);
          } else if (res.user?.role === 'PANITIA' || this.selectedRoleTab === 'PANITIA') {
            this.router.navigate(['/dashboard/panitia']);
          } else {
            this.router.navigate(['/catalog']);
          }
        }, 500);
      } else {
        this.errorMessage = res.message;
      }
      this.cdr.detectChanges();
    }, 200);
  }

  openGoogleLogin(): void {
    this.showGooglePicker = true;
    this.showCustomGmailField = false;
    this.customGmailInput = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeGoogleLogin(): void {
    this.showGooglePicker = false;
    this.showCustomGmailField = false;
    this.customGmailInput = '';
  }

  selectGoogleAccount(email: string, displayName?: string): void {
    this.isGoogleAuthenticating = true;
    setTimeout(() => {
      const res = this.authService.loginWithGoogle(email, displayName);
      this.isGoogleAuthenticating = false;
      this.showGooglePicker = false;
      if (res.success) {
        this.successMessage = res.message;
        setTimeout(() => {
          if (res.user?.role === 'DPK_ADMIN' || this.selectedRoleTab === 'ADMIN') {
            this.router.navigate(['/dashboard/admin']);
          } else if (res.user?.role === 'PANITIA' || this.selectedRoleTab === 'PANITIA') {
            this.router.navigate(['/dashboard/panitia']);
          } else {
            this.router.navigate(['/catalog']);
          }
        }, 500);
      } else {
        this.errorMessage = res.message;
      }
    }, 400);
  }

  submitCustomGmail(): void {
    if (!this.customGmailInput.trim()) return;
    const email = this.customGmailInput.trim();
    if (!email.includes('@')) {
      this.errorMessage = 'Format alamat email tidak valid.';
      return;
    }
    this.selectGoogleAccount(email);
  }

  // ==========================================
  // REGISTER FLOW METHODS
  // ==========================================
  toggleAuthMode(mode: 'LOGIN' | 'REGISTER'): void {
    this.authMode = mode;
    this.errorMessage = '';
    this.successMessage = '';
  }

  selectRegRole(role: 'MAHASISWA' | 'PANITIA' | 'DPK_ADMIN'): void {
    this.regRole = role;
    this.isRegRoleDropdownOpen = false;
  }

  get detectedProdiInfo(): { studyProgram: string; faculty: string } {
    return getUiiProdiFromNim(this.regNim);
  }

  onRegisterSubmit(): void {
    if (!this.regName.trim()) {
      this.errorMessage = 'Silakan masukkan nama lengkap Anda.';
      return;
    }
    if (!this.regNim.trim()) {
      this.errorMessage = 'Silakan masukkan NIM atau NIP Anda.';
      return;
    }
    if (!this.regEmail.trim() || !this.regEmail.includes('@')) {
      this.errorMessage = 'Silakan masukkan alamat email yang valid.';
      return;
    }
    if (!this.regPassword || this.regPassword.length < 6) {
      this.errorMessage = 'Kata sandi minimal 6 karakter.';
      return;
    }

    this.isRegisterLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.detectChanges();

    setTimeout(() => {
      const prodiInfo = getUiiProdiFromNim(this.regNim);
      const res = this.authService.register({
        name: this.regName,
        nim: this.regNim,
        email: this.regEmail,
        role: this.regRole,
        faculty: this.regRole === 'MAHASISWA' ? prodiInfo.faculty : this.regFaculty,
        studyProgram: this.regRole === 'MAHASISWA' ? prodiInfo.studyProgram : this.regStudyProgram,
        phone: this.regPhone || '081234567890'
      });
      this.isRegisterLoading = false;

      if (res.success) {
        // Alur resmi: Setelah registrasi berhasil, arahkan kembali ke tab LOGIN untuk memasukkan akun yang telah didaftarkan
        this.authMode = 'LOGIN';
        this.identifier = this.regNim.trim() || this.regEmail.trim();
        this.password = '';
        if (this.regRole === 'DPK_ADMIN') {
          this.selectedRoleTab = 'ADMIN';
        } else if (this.regRole === 'PANITIA') {
          this.selectedRoleTab = 'PANITIA';
        } else {
          this.selectedRoleTab = 'MAHASISWA';
        }
        this.successMessage = `Akun berhasil didaftarkan! Silakan masukkan kata sandi akun ${res.user?.name} (${this.identifier}) untuk masuk.`;
        
        // Reset form input registrasi
        this.regName = '';
        this.regNim = '';
        this.regEmail = '';
        this.regPassword = '';
        this.regPhone = '';
      } else {
        this.errorMessage = res.message;
      }
      this.cdr.detectChanges();
    }, 150);
  }
}
