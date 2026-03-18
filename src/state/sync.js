/* ============================================================
   POCKET APP — Sync Queue
   Handles offline-first sync: queues state pushes for when
   the user is authenticated and online. Falls back gracefully
   to localStorage-only mode when offline or logged out.
   ============================================================ */

import { AuthManager } from '../auth/manager.js';
import { pushFullState } from '../auth/supabase.js';

// ── Sync Flags ──
let syncPending = false;
let syncTimer = null;
const SYNC_DEBOUNCE_MS = 3000; // wait 3 seconds after last save before syncing

/**
 * Called by store.saveState() after every localStorage write.
 * Debounces cloud pushes so rapid saves (e.g. during setup)
 * don't flood the network.
 *
 * If the user is NOT logged in, this is a silent no-op.
 */
export function scheduleSyncToCloud(appState) {
  // Only sync if user is authenticated
  if (!AuthManager.isLoggedIn()) return;

  const user = AuthManager.getUser();
  if (!user || !user.id) return;

  syncPending = true;

  // Debounce: clear any previous timer, set a new one
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    if (!syncPending) return;
    syncPending = false;

    try {
      const result = await pushFullState(user.id, appState);
      if (result.success) {
        console.log('%c[Sync] Cloud sync complete ✓', 'color:#1cb0f6; font-weight:bold;');
      }
    } catch (err) {
      console.warn('[Sync] Cloud sync failed, will retry on next save:', err.message);
      syncPending = true; // mark for retry
    }
  }, SYNC_DEBOUNCE_MS);
}
