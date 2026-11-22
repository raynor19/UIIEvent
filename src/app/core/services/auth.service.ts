import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { UserProfile } from '../models/user.model';

export interface UiiDepartmentInfo {
  code: string;
  name: string;
  degree: string;
}

export interface UiiFacultyDirectory {
  facultyName: string;
  facultyShort: string;
  departments: UiiDepartmentInfo[];
}

export const UII_FACULTY_DIRECTORY: UiiFacultyDirectory[] = [
  {
    facultyName: 'Fakultas Teknologi Industri',
    facultyShort: 'FTI',
    departments: [
      { code: '525', name: 'Teknik Mesin', degree: 'S1' },
      { code: '523', name: 'Informatika', degree: 'S1' },
      { code: '522', name: 'Teknik Industri', degree: 'S1' },
      { code: '521', name: 'Teknik Kimia', degree: 'S1' },
      { code: '524', name: 'Teknik Elektro', degree: 'S1' },
      { code: '526', name: 'Rekayasa Tekstil', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Teknik Sipil dan Perencanaan',
    facultyShort: 'FTSP',
    departments: [
      { code: '511', name: 'Teknik Sipil', degree: 'S1' },
      { code: '512', name: 'Arsitektur', degree: 'S1' },
      { code: '513', name: 'Teknik Lingkungan', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Matematika dan Ilmu Pengetahuan Alam',
    facultyShort: 'FMIPA',
    departments: [
      { code: '611', name: 'Statistika', degree: 'S1' },
      { code: '612', name: 'Kimia', degree: 'S1' },
      { code: '613', name: 'Farmasi', degree: 'S1' },
      { code: '614', name: 'Pendidikan Kimia', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Bisnis dan Ekonomika',
    facultyShort: 'FBE',
    departments: [
      { code: '311', name: 'Manajemen', degree: 'S1' },
      { code: '312', name: 'Akuntansi', degree: 'S1' },
      { code: '313', name: 'Ilmu Ekonomi', degree: 'S1' },
      { code: '314', name: 'Bisnis Digital', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Hukum',
    facultyShort: 'FH',
    departments: [
      { code: '411', name: 'Ilmu Hukum', degree: 'S1' },
      { code: '412', name: 'Hukum Bisnis', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Ilmu Agama Islam',
    facultyShort: 'FIAI',
    departments: [
      { code: '421', name: 'Hukum Keluarga (Ahwal Syakhshiyah)', degree: 'S1' },
      { code: '422', name: 'Ekonomi Islam', degree: 'S1' },
      { code: '423', name: 'Pendidikan Agama Islam', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Psikologi dan Ilmu Sosial Budaya',
    facultyShort: 'FPSB',
    departments: [
      { code: '711', name: 'Psikologi', degree: 'S1' },
      { code: '712', name: 'Ilmu Komunikasi', degree: 'S1' },
      { code: '713', name: 'Hubungan Internasional', degree: 'S1' },
      { code: '714', name: 'Pendidikan Bahasa Inggris', degree: 'S1' }
    ]
  },
  {
    facultyName: 'Fakultas Kedokteran',
    facultyShort: 'FK',
    departments: [
      { code: '710', name: 'Kedokteran', degree: 'S1' },
      { code: '111', name: 'Pendidikan Dokter', degree: 'S1' }
    ]
  }
];

export function getUiiProdiFromNim(nim: string): { studyProgram: string; faculty: string; angkatan: string; code: string } {
  const clean = (nim || '').trim().replace(/\D/g, '');
  const angkatan = clean.length >= 2 ? `20${clean.substring(0, 2)}` : '2023';

  if (clean.length >= 5) {
    const code = clean.substring(2, 5);
    for (const fac of UII_FACULTY_DIRECTORY) {
      const dept = fac.departments.find(d => d.code === code);
      if (dept) {
        return {
          studyProgram: dept.name,
          faculty: fac.facultyName,
          angkatan,
          code
        };
      }
    }
  }

  return { studyProgram: 'Teknik Mesin', faculty: 'Fakultas Teknologi Industri', angkatan, code: '525' };
}

export const MOCK_USERS: UserProfile[] = [
  {
    id: 'usr-raynor-001',
    nim: '23525055',
    name: 'Muhammad Raynor Athaillah',
    email: '23525055@students.uii.ac.id',
    phone: '081234567890',
    faculty: 'Fakultas Teknologi Industri',
    studyProgram: 'Teknik Mesin',
    role: 'MAHASISWA',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: 'usr-jay-001',
    nim: '23524001',
    name: 'Jay',
    email: '23524001@students.uii.ac.id',
    phone: '081234567891',
    faculty: 'Fakultas Teknologi Industri',
    studyProgram: 'Teknik Elektro',
    role: 'MAHASISWA',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: 'usr-sarah-002',
    nim: '20523120',
    name: 'Panitia UII',
    email: 'panitia@uii.ac.id',
    phone: '081298765432',
    faculty: 'Fakultas Teknologi Industri',
    studyProgram: 'Informatika',
    role: 'PANITIA',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
  },
  {
    id: 'usr-budi-admin',
    nim: 'NIP.19740512',
    name: 'Dr. Ir. Budi Hartono, M.T.',
    email: 'budi.hartono@uii.ac.id',
    phone: '081122334455',
    faculty: 'Direktorat Pembinaan Kemahasiswaan',
    studyProgram: 'Direktur DPK UII',
    role: 'DPK_ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80'
  }
];

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly USER_STORAGE_KEY = 'uii_active_user_id';
  private readonly TOKEN_STORAGE_KEY = 'uii_jwt_token_session';

  // State signals
  currentUser = signal<UserProfile>(MOCK_USERS[0]);
  isLoggedIn = signal<boolean>(true);
  jwtToken = signal<string | null>(null);

  isMahasiswa = computed(() => this.currentUser().role === 'MAHASISWA');
  isPanitia = computed(() => this.currentUser().role === 'PANITIA' || this.currentUser().role === 'DPK_ADMIN');

  constructor(private router: Router) {
    this.loadSavedSession();
  }

  private loadSavedSession(): void {
    if (typeof localStorage !== 'undefined') {
      const savedToken = localStorage.getItem(this.TOKEN_STORAGE_KEY);
      let savedId = localStorage.getItem(this.USER_STORAGE_KEY);

      // Restore custom registered users if any
      const savedRegistered = localStorage.getItem('uii_registered_users_list');
      if (savedRegistered) {
        try {
          const registeredList: UserProfile[] = JSON.parse(savedRegistered);
          registeredList.forEach(ru => {
            if (ru.role === 'MAHASISWA' && ru.nim) {
              const info = getUiiProdiFromNim(ru.nim);
              ru.studyProgram = info.studyProgram;
              ru.faculty = info.faculty;
            }
            const existingIdx = MOCK_USERS.findIndex(u => u.id === ru.id || u.nim === ru.nim);
            if (existingIdx >= 0) {
              MOCK_USERS[existingIdx] = { ...MOCK_USERS[existingIdx], ...ru };
            } else {
              MOCK_USERS.push(ru);
            }
          });
        } catch (e) {
          console.error('Failed to parse registered users', e);
        }
      }

      // Check stored profile JSON first for highest fidelity
      const savedProfileJson = localStorage.getItem('uii_active_user_profile');
      if (savedProfileJson) {
        try {
          const profile: UserProfile = JSON.parse(savedProfileJson);
          if (profile && profile.name) {
            const existingIdx = MOCK_USERS.findIndex(u => u.id === profile.id || u.nim === profile.nim);
            if (existingIdx >= 0) {
              MOCK_USERS[existingIdx] = profile;
            } else {
              MOCK_USERS.push(profile);
            }
            this.currentUser.set(profile);
            this.isLoggedIn.set(true);
            if (savedToken) this.jwtToken.set(savedToken);
            return;
          }
        } catch (e) {
          console.error('Failed to parse saved user profile', e);
        }
      }

      if (savedToken && savedId) {
        const cleanSavedId = savedId.replace(/^usr-/, '');
        const found = MOCK_USERS.find(u => 
          u.id === savedId || 
          u.nim === savedId || 
          u.nim === cleanSavedId ||
          (cleanSavedId === '23524001' && (u.id === 'usr-jay-001' || u.nim === '23524001'))
        );
        if (found) {
          if (found.role === 'MAHASISWA' && found.nim) {
            const info = getUiiProdiFromNim(found.nim);
            found.studyProgram = info.studyProgram;
            found.faculty = info.faculty;
          }
          this.currentUser.set(found);
          this.isLoggedIn.set(true);
          this.jwtToken.set(savedToken);
          localStorage.setItem('uii_active_user_profile', JSON.stringify(found));
          return;
        }
      }
    }
    // Default active session for instant interactive testing: Jay
    this.currentUser.set(MOCK_USERS[1] || MOCK_USERS[0]);
    this.isLoggedIn.set(true);
    this.jwtToken.set('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c3ItamF5LTAwMSIsInJvbGUiOiJNQUhBU0lTV0EifQ');
  }

  /**
   * SSO Authentication with UII Directory credentials
   */
  login(identifier: string, password?: string): { success: boolean; message: string; user?: UserProfile } {
    const cleanId = identifier.trim().toLowerCase();

    let user = MOCK_USERS.find(
      u => u.nim.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
    );

    // If not found in memory, check if previously registered in localStorage
    if (!user && typeof localStorage !== 'undefined') {
      const savedRegistered = localStorage.getItem('uii_registered_users_list');
      if (savedRegistered) {
        try {
          const list: UserProfile[] = JSON.parse(savedRegistered);
          user = list.find(u => u.nim.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId);
          if (user && !MOCK_USERS.some(u => u.id === user!.id || u.nim === user!.nim)) {
            MOCK_USERS.push(user);
          }
        } catch (e) {
          console.error('Failed to parse registered users list', e);
        }
      }
    }

    // Dynamic UII Campus Directory SSO Resolution:
    // Seamlessly authenticate students entering any valid UII NIM or campus email across devices
    if (!user) {
      const cleanDigits = cleanId.replace(/\D/g, '');
      const isNimFormat = cleanDigits.length >= 6 && cleanDigits.length <= 10;
      const isUiiEmail = cleanId.includes('@students.uii.ac.id') || cleanId.includes('@uii.ac.id');
      const isEmail = cleanId.includes('@');

      if (isNimFormat || isUiiEmail || cleanId === '23524001') {
        const nim = isNimFormat ? cleanDigits : (cleanId.split('@')[0]);
        const prodiInfo = getUiiProdiFromNim(nim);

        let detectedName = 'Mahasiswa UII';
        if (cleanId === '23524001' || (password && password.toLowerCase().includes('jay'))) {
          detectedName = 'Jay';
        } else if (password && password.length >= 3 && !password.toLowerCase().startsWith('password')) {
          const alphaMatch = password.match(/^[a-zA-Z]+/);
          if (alphaMatch && alphaMatch[0].length >= 3) {
            detectedName = alphaMatch[0].charAt(0).toUpperCase() + alphaMatch[0].slice(1).toLowerCase();
          }
        } else if (isEmail) {
          const namePart = cleanId.split('@')[0].replace(/[._]/g, ' ');
          detectedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        }

        user = {
          id: `usr-${nim}`,
          nim: nim,
          name: detectedName,
          email: isEmail ? cleanId : `${nim}@students.uii.ac.id`,
          phone: '081234567891',
          faculty: prodiInfo.faculty,
          studyProgram: prodiInfo.studyProgram,
          role: 'MAHASISWA',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
        };

        MOCK_USERS.push(user);

        if (typeof localStorage !== 'undefined') {
          try {
            const existingSaved = localStorage.getItem('uii_registered_users_list');
            const list: UserProfile[] = existingSaved ? JSON.parse(existingSaved) : [];
            if (!list.some(u => u.nim === user!.nim || u.email === user!.email)) {
              list.push(user);
              localStorage.setItem('uii_registered_users_list', JSON.stringify(list));
            }
          } catch (e) {
            console.error('Failed to sync directory user', e);
          }
        }
      }
    }

    if (!user) {
      return {
        success: false,
        message: 'Kredensial tidak valid: NIM atau Email tidak terdaftar dalam direktori kampus UII.'
      };
    }

    if (user.role === 'MAHASISWA' && user.nim) {
      const info = getUiiProdiFromNim(user.nim);
      user.studyProgram = info.studyProgram;
      user.faculty = info.faculty;
    }

    // Generate mock RFC 7519 JWT session token
    const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: user.nim, name: user.name, role: user.role, exp: Date.now() + 7200000 }))}.sig`;

    this.currentUser.set(user);
    this.isLoggedIn.set(true);
    this.jwtToken.set(mockJwt);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.USER_STORAGE_KEY, user.id);
      localStorage.setItem(this.TOKEN_STORAGE_KEY, mockJwt);
      localStorage.setItem('uii_active_user_profile', JSON.stringify(user));
    }

    return {
      success: true,
      message: `Selamat datang, ${user.name}! Sesi SSO berhasil diverifikasi.`,
      user: user
    };
  }

  /**
   * Google / Gmail OAuth SSO Login
   */
  loginWithGoogle(email: string, displayName?: string): { success: boolean; message: string; user?: UserProfile } {
    const cleanEmail = email.trim().toLowerCase();
    let user = MOCK_USERS.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Create user profile for new Gmail user
      const namePart = displayName || cleanEmail.split('@')[0].replace(/[._]/g, ' ');
      user = {
        id: `usr-gmail-${Date.now()}`,
        nim: '23525055',
        name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
        email: cleanEmail,
        phone: '081234567800',
        faculty: 'Fakultas Teknologi Industri',
        studyProgram: 'Teknik Mesin',
        role: 'MAHASISWA',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
      };
      MOCK_USERS.push(user);
    }

    if (user.role === 'MAHASISWA' && user.nim) {
      const info = getUiiProdiFromNim(user.nim);
      user.studyProgram = info.studyProgram;
      user.faculty = info.faculty;
    }

    const mockJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: user.nim, email: user.email, name: user.name, role: user.role, auth_provider: 'google', exp: Date.now() + 7200000 }))}.sig`;

    this.currentUser.set(user);
    this.isLoggedIn.set(true);
    this.jwtToken.set(mockJwt);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.USER_STORAGE_KEY, user.id);
      localStorage.setItem(this.TOKEN_STORAGE_KEY, mockJwt);
      localStorage.setItem('uii_active_user_profile', JSON.stringify(user));
    }

    return {
      success: true,
      message: `Login dengan akun Gmail (${user.email}) berhasil!`,
      user: user
    };
  }

  /**
   * Register new user account
   */
  register(userData: {
    nim: string;
    name: string;
    email: string;
    role: 'MAHASISWA' | 'PANITIA' | 'DPK_ADMIN';
    faculty?: string;
    studyProgram?: string;
    phone?: string;
  }): { success: boolean; message: string; user?: UserProfile } {
    const cleanNim = userData.nim.trim();
    const cleanEmail = userData.email.trim().toLowerCase();

    // Check duplicate
    const existing = MOCK_USERS.find(
      u => u.nim.toLowerCase() === cleanNim.toLowerCase() || u.email.toLowerCase() === cleanEmail
    );
    if (existing) {
      return {
        success: false,
        message: 'NIM atau Alamat Email tersebut sudah terdaftar di sistem SSO UII.'
      };
    }

    const prodiInfo = getUiiProdiFromNim(cleanNim);
    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      nim: cleanNim,
      name: userData.name.trim(),
      email: cleanEmail,
      phone: userData.phone || '081234567890',
      faculty: userData.role === 'MAHASISWA' ? prodiInfo.faculty : (userData.faculty || 'Fakultas Teknologi Industri'),
      studyProgram: userData.role === 'MAHASISWA' ? prodiInfo.studyProgram : (userData.studyProgram || 'Teknik Mesin'),
      role: userData.role,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
    };

    MOCK_USERS.unshift(newUser);

    if (typeof localStorage !== 'undefined') {
      const existingSaved = localStorage.getItem('uii_registered_users_list');
      const list = existingSaved ? JSON.parse(existingSaved) : [];
      list.push(newUser);
      localStorage.setItem('uii_registered_users_list', JSON.stringify(list));
    }

    return {
      success: true,
      message: `Pendaftaran berhasil! Akun ${newUser.name} telah aktif di sistem SSO UII. Silakan masuk dengan akun Anda.`,
      user: newUser
    };
  }

  logout(): void {
    this.isLoggedIn.set(false);
    this.jwtToken.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.TOKEN_STORAGE_KEY);
      localStorage.removeItem(this.USER_STORAGE_KEY);
      localStorage.removeItem('uii_active_user_profile');
    }
    this.router.navigate(['/login']);
  }

  switchUser(userId: string): void {
    const targetId = (userId === 'usr-rian-001' || userId === '21523001') ? 'usr-raynor-001' : userId;
    const user = MOCK_USERS.find(u => u.id === targetId || u.nim === targetId);
    if (user) {
      if (user.role === 'MAHASISWA' && user.nim) {
        const info = getUiiProdiFromNim(user.nim);
        user.studyProgram = info.studyProgram;
        user.faculty = info.faculty;
      }
      this.currentUser.set(user);
      this.isLoggedIn.set(true);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.USER_STORAGE_KEY, user.id);
      }
    }
  }

  getAllUsers(): UserProfile[] {
    return MOCK_USERS;
  }
}
