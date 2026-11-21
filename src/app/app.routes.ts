import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { CatalogComponent } from './features/catalog/catalog.component';
import { RegistrationComponent } from './features/registration/registration.component';
import { TicketsComponent } from './features/tickets/tickets.component';
import { CertificatesComponent } from './features/certificates/certificates.component';
import { ScannerComponent } from './features/scanner/scanner.component';
import { VerifyComponent } from './features/verify/verify.component';

import { DashboardRedirectComponent } from './features/dashboards/dashboard-redirect.component';
import { MahasiswaDashboardComponent } from './features/dashboards/mahasiswa/mahasiswa-dashboard.component';
import { PanitiaDashboardComponent } from './features/dashboards/panitia/panitia-dashboard.component';
import { AdminDashboardComponent } from './features/dashboards/admin/admin-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'catalog', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, title: 'Masuk SSO UII | UII Event Platform' },
  { path: 'catalog', component: CatalogComponent, title: 'Katalog Acara | UII Event Platform' },
  { path: 'register/:id', component: RegistrationComponent, title: 'Form Pendaftaran | UII Event Platform' },
  { path: 'tickets', component: TicketsComponent, title: 'E-Tiket Saya | UII Event Platform' },
  { path: 'my-tickets', redirectTo: 'tickets', pathMatch: 'full' },
  { path: 'my-tickets/:ticket_code', component: TicketsComponent, title: 'E-Tiket Kegiatan | UII Event' },
  { path: 'my-events', redirectTo: 'dashboard/mahasiswa', pathMatch: 'full' },
  { path: 'certificates', component: CertificatesComponent, title: 'Brankas Sertifikat SKPI | UII Event Platform' },
  { path: 'my-certificates', redirectTo: 'certificates', pathMatch: 'full' },
  { path: 'my-certificates/:id', component: CertificatesComponent, title: 'Brankas E-Sertifikat | UII Event' },
  { path: 'scanner', component: ScannerComponent, title: 'Meja Registrasi Scanner | UII Event Platform' },
  { path: 'verify/:hash', component: VerifyComponent, title: 'Verifikasi Keaslian SKPI | UII Event Platform' },

  // Role-Specific Dashboards
  { path: 'dashboard', component: DashboardRedirectComponent, title: 'Dashboard | UII Event Platform' },
  { path: 'dashboard/mahasiswa', component: MahasiswaDashboardComponent, title: 'Event Saya & Riwayat | UII Event' },
  { path: 'dashboard/panitia', component: PanitiaDashboardComponent, title: 'Dashboard Panitia · UII Event' },
  { path: 'dashboard/admin', component: AdminDashboardComponent, title: 'Kurasi & Approval Acara · UII Event' },
  { path: 'admin/curation', component: AdminDashboardComponent, title: 'Kurasi & Approval Acara · UII Event' },
  { path: 'admin/notifications', component: AdminDashboardComponent, title: 'Monitoring Log Notifikasi · UII Event' },
  { path: 'admin', redirectTo: 'admin/curation', pathMatch: 'full' },

  // Organizer routes from Figma handoff (SCR-PAN-01, SCR-PAN-02, SCR-PAN-03, SCR-PAN-04)
  { path: 'organizer/events', component: PanitiaDashboardComponent, title: 'Dashboard Panitia · UII Event' },
  { path: 'organizer/events/new', component: PanitiaDashboardComponent, title: 'Buat Acara Baru · UII Event' },
  { path: 'organizer/events/:id/participants', component: PanitiaDashboardComponent, title: 'Rekap Peserta & Presensi · UII Event' },
  { path: 'organizer/events/:id/applicants', component: PanitiaDashboardComponent, title: 'Seleksi Oprec Panitia · UII Event' },
  { path: 'organizer/events/:id/scanner', component: ScannerComponent, title: 'Web Scanner · UII Event' },

  { path: '**', redirectTo: 'catalog' }
];
