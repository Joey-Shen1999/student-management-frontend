import {AuthService} from '../../services/auth.service';
import {Router} from '@angular/router';

export class Dashboard {

  constructor(private auth: AuthService, private router: Router) {}

  get session() {
    return this.auth.getSession();
  }

  goProfile() {
    this.router.navigate(['/student/profile']);
  }

  logout() {
    this.auth.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.auth.clearAuthState();
        this.router.navigate(['/login']);
      },
    });
  }
}
