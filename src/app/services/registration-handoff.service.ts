import { Injectable } from '@angular/core';

export interface RegistrationHandoff { username: string; password: string; expiresAt: number; }

/** One-use registration handoff. Never persisted or included in router state/URLs. */
@Injectable({ providedIn: 'root' })
export class RegistrationHandoffService {
  private value: RegistrationHandoff | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  start(username: string, password: string): void {
    this.clear();
    this.value = { username, password, expiresAt: Date.now() + 60000 };
    this.timer = setTimeout(() => { if (this.value) this.value.password = ''; }, 60000);
  }

  peek(): RegistrationHandoff | null {
    if (this.value && Date.now() >= this.value.expiresAt) this.value.password = '';
    return this.value;
  }

  take(): RegistrationHandoff | null {
    const value = this.peek();
    const result = value ? { ...value } : null;
    this.clear();
    return result;
  }

  clear(): void { clearTimeout(this.timer); this.value = null; }
}
