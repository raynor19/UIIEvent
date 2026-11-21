import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard-redirect',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
      <div class="flex items-center gap-3">
        <span class="w-5 h-5 border-2 border-uii-blue border-t-transparent rounded-full animate-spin"></span>
        <span>Mengarahkan ke Dashboard Role Anda...</span>
      </div>
    </div>
  `
})
export class DashboardRedirectComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    const role = this.authService.currentUser().role;
    if (role === 'PANITIA') {
      this.router.navigate(['/dashboard/panitia']);
    } else if (role === 'DPK_ADMIN') {
      this.router.navigate(['/dashboard/admin']);
    } else {
      this.router.navigate(['/dashboard/mahasiswa']);
    }
  }
}
