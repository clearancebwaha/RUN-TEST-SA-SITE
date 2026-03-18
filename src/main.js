/* ============================================================
   POCKET APP — main.js (Entry Point)
   Boots the app, loads state, wires event listeners
   ============================================================ */

import './styles/index.css';
import { loadState, setAppState } from './state/store.js';
import { appState } from './state/store.js';
import { showView } from './ui/views.js';
import { renderDashboard } from './ui/dashboard.js';
import { setupEventListeners } from './events/listeners.js';
import { authEventListeners, checkAuthNudge } from './auth/ui.js';
import { SFX } from './feedback/sfx.js';
import { haptic } from './feedback/haptics.js';

document.addEventListener('DOMContentLoaded', () => {
  setAppState(loadState());

  setupEventListeners();
  authEventListeners();

  // Prime the AudioContext on first user interaction (browser autoplay policy)
  const primeAudio = () => {
    SFX._init();
    if (SFX.ctx && SFX.ctx.state === 'suspended') SFX.ctx.resume();
    document.removeEventListener('pointerdown', primeAudio);
  };
  document.addEventListener('pointerdown', primeAudio, { once: true });

  // Add haptic tap to all squishy buttons (global listener)
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.btn-squishy')) {
      haptic('light');
    }
  }, { passive: true });

  setTimeout(() => {
    if (!appState.isSetupComplete) {
      showView('view-welcome');
    } else {
      showView('view-dashboard');
      renderDashboard();
      checkAuthNudge();
    }
  }, 450);
});
