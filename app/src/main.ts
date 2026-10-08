import { t } from './i18n/index.js';

document.title = t.appTitle;

const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `
  <h1></h1>
  <p class="muted" data-placeholder></p>
  <p data-status></p>
`;
root.querySelector('h1')!.textContent = t.appTitle;
root.querySelector('[data-placeholder]')!.textContent = t.mapPlaceholder;

const status = root.querySelector<HTMLElement>('[data-status]')!;
status.textContent = t.serverChecking;

async function checkServer(): Promise<void> {
  try {
    const response = await fetch('/api/health');
    const body = await response.json();
    if (!response.ok || body.status !== 'ok') throw new Error(`HTTP ${response.status}`);
    status.textContent = t.serverOk;
    status.className = 'status-ok';
  } catch {
    status.textContent = t.serverError;
    status.className = 'status-error';
  }
}

void checkServer();
