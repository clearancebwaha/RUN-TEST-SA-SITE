/* ============================================================
   POCKET APP — Sync Queue (v2.1 — Delta Sync + Hydration)
   Handles offline-first sync: queues delta state pushes for when
   the user is authenticated and online. Falls back gracefully
   to localStorage-only mode when offline or logged out.

   NEW: hydrateFromCloud() — pulls remote state on login and
   merges it with local data so no data is lost.
   ============================================================ */

import { AuthManager } from '../auth/manager.js';
import { pushDelta, pushFullState, pullFullState } from '../auth/supabase.js';
import { STORAGE_KEY, INITIAL_STATE } from '../config/constants.js';
import { appState, setAppState, saveState as localSave } from '../state/store.js';

// ── Sync Flags ──
let syncPending = false;
let syncTimer = null;
let hydrationInProgress = false;  // block pushes during hydration
const SYNC_DEBOUNCE_MS = 3000;
const SYNC_TS_KEY = 'pocket-last-synced';

/** Read last synced timestamp from localStorage */
function getLastSyncedAt() {
  return localStorage.getItem(SYNC_TS_KEY) || null;
}

/** Write last synced timestamp to localStorage */
function setLastSyncedAt(isoStr) {
  localStorage.setItem(SYNC_TS_KEY, isoStr);
}

/**
 * Called by store.saveState() after every localStorage write.
 * Debounces cloud pushes so rapid saves (e.g. during setup)
 * don't flood the network.
 *
 * Uses Delta Sync — only pushes records created/modified since
 * the last successful sync, saving mobile data.
 *
 * If the user is NOT logged in, this is a silent no-op.
 */
export function scheduleSyncToCloud(state) {
  // Block during hydration to prevent pushing empty/stale state
  if (hydrationInProgress) return;

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

    const lastSyncedAt = getLastSyncedAt();

    try {
      let result;
      if (!lastSyncedAt) {
        // First sync ever — push everything
        result = await pushFullState(user.id, state);
      } else {
        // Delta sync — only push new/updated records
        result = await pushDelta(user.id, state, lastSyncedAt);
      }

      if (result.success) {
        setLastSyncedAt(new Date().toISOString());
        console.log('%c[Sync] Cloud sync complete ✓', 'color:#1cb0f6; font-weight:bold;');
      }
    } catch (err) {
      console.warn('[Sync] Cloud sync failed, will retry on next save:', err.message);
      syncPending = true; // mark for retry
    }
  }, SYNC_DEBOUNCE_MS);
}


/* ═══════════════════════════════════════════════════
   CLOUD-TO-LOCAL HYDRATION
   Called once after successful login (OTP or OAuth).
   Pulls remote state and merges with local state.
   ═══════════════════════════════════════════════════ */

/**
 * Merge two arrays of records by `id`, favoring the one with the
 * more recent uid timestamp (since uid = Date.now base36 + random).
 * If timestamps are identical, the remote version wins.
 */
function mergeById(localArr, remoteArr) {
  const map = new Map();
  // Seed with local items
  for (const item of localArr) {
    map.set(item.id, item);
  }
  // Overlay remote items (remote wins on conflict)
  for (const item of remoteArr) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

/**
 * Hydrate local state from cloud data.
 * Strategy:
 *   - If local has no setup (fresh device), use cloud data entirely
 *   - If both exist, merge arrays by id, and for scalar fields (cash, vault),
 *     use whichever profile has a more recent updated_at
 *   - After merge, write to localStorage and update appState
 */
export async function hydrateFromCloud() {
  const user = AuthManager.getUser();
  if (!user || !user.id) return false;

  hydrationInProgress = true;

  try {
    const remote = await pullFullState(user.id);
    if (!remote) {
      console.log('[Sync] No remote data found — local state is source of truth');
      hydrationInProgress = false;
      return false;
    }

    // Load current local state
    let local;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      local = raw ? { ...INITIAL_STATE, ...JSON.parse(raw) } : { ...INITIAL_STATE };
    } catch {
      local = { ...INITIAL_STATE };
    }

    const hasLocalSetup = local.isSetupComplete;
    const hasRemoteSetup = remote.profile && remote.profile.setupDate;

    let merged;

    if (!hasLocalSetup && hasRemoteSetup) {
      // Fresh device — use cloud data entirely
      merged = {
        ...INITIAL_STATE,
        isSetupComplete: true,
        cashOnHand: remote.profile.cashOnHand,
        emergencyVault: remote.profile.emergencyVault,
        nextIncomeDate: remote.profile.nextIncomeDate,
        setupDate: remote.profile.setupDate,
        transactions: remote.transactions || [],
        tier1Bills: remote.bills || [],
        utangLedger: remote.utang || [],
        microIncomeLedger: remote.income || [],
      };
      console.log('%c[Sync] Hydrated from cloud (fresh device) ✓', 'color:#1cb0f6; font-weight:bold;');
    } else if (hasLocalSetup && hasRemoteSetup) {
      // Both exist — merge arrays, use remote scalars as source of truth
      // (cloud was last pushed by this or another device)
      merged = {
        ...local,
        cashOnHand: remote.profile.cashOnHand,
        emergencyVault: remote.profile.emergencyVault,
        nextIncomeDate: remote.profile.nextIncomeDate || local.nextIncomeDate,
        transactions: mergeById(local.transactions, remote.transactions || []),
        tier1Bills: mergeById(local.tier1Bills, remote.bills || []),
        utangLedger: mergeById(local.utangLedger, remote.utang || []),
        microIncomeLedger: mergeById(local.microIncomeLedger, remote.income || []),
      };
      console.log('%c[Sync] Merged local + cloud state ✓', 'color:#1cb0f6; font-weight:bold;');
    } else {
      // Only local exists — push it up after hydration completes
      merged = local;
      console.log('[Sync] No remote setup — local state will sync up');
    }

    // Write merged state to localStorage and update in-memory appState
    setAppState(merged);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* silent */ }

    // Mark sync timestamp
    setLastSyncedAt(new Date().toISOString());

    hydrationInProgress = false;
    return true;
  } catch (err) {
    console.warn('[Sync] Hydration failed:', err.message);
    hydrationInProgress = false;
    return false;
  }
}
