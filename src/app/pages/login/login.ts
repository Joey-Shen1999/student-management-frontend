import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
})
export class Login {
  username: string = '';
  password: string = '';
  error: string = '';

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error = '';
    this.auth.login({ username: this.username, password: this.password }).subscribe({
      next: (resp) => {
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.error = 'Login failed';
      },
    });
  }
}
