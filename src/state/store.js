/* ============================================================
   POCKET APP — State Management (Store)
   Central appState, load/save/clear/export functions
   ============================================================ */

import { STORAGE_KEY, INITIAL_STATE } from '../config/constants.js';
import { todayISO } from '../utils/format.js';
import { scheduleSyncToCloud } from './sync.js';

// The single source of truth — exported so all modules can reference it
export let appState = { ...INITIAL_STATE };

export function setAppState(newState) {
  appState = newState;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_STATE };
    return { ...INITIAL_STATE, ...JSON.parse(raw) };
  } catch { return { ...INITIAL_STATE }; }
}

export function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* silent */ }
  // Pillar 2: silently sync to Supabase if user is authenticated
  scheduleSyncToCloud(state);
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  appState = { ...INITIAL_STATE };
}

export function exportJSON() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pocket-app-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
