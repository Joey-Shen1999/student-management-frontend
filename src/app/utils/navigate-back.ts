import { Router } from '@angular/router';

export function navigateBack(router: Router, fallbackCommands: readonly unknown[]): void {
  const historyRef = (globalThis as { history?: History }).history;

  if (historyRef && historyRef.length > 1 && typeof historyRef.back === 'function') {
    historyRef.back();
    return;
  }

  router.navigate([...fallbackCommands]);
}
