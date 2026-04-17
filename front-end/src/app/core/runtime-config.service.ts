import { Injectable } from '@angular/core';

interface AppModeResponse {
  production?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RuntimeConfigService {
  private production = false;

  async load(): Promise<void> {
    try {
      const response = await fetch('/assets/app-mode.json', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const data = await response.json() as AppModeResponse;
      this.production = Boolean(data.production);
    } catch {
      this.production = false;
    }
  }

  isProduction(): boolean {
    return this.production;
  }

  getApiBaseUrl(): string {
    return this.production
      ? 'https://api.mukundhaassociates.com'
      : 'http://localhost:5000';
  }
}