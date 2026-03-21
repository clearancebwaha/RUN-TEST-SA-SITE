/* ============================================================
   POCKET APP — Supabase Client & Query Helpers
   Connects to the Supabase PostgreSQL backend.
   All cloud operations are OPTIONAL — the app still works
   100% offline via localStorage if the user is not logged in.

   v2.1 — Delta Sync + Hydration + Hulugan Protocol
   ============================================================ */

import { createClient } from '@supabase/supabase-js';

// ── Supabase Credentials ──
const SUPABASE_URL = 'https://edljvrkmppgmhltecfgk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3HZzqG97LYbr3GzNSTLTKg_QWcVVbpH';

// ── Create the Supabase client (singleton) ──
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/* ═══════════════════════════════════════════════════
   PUSH HELPERS (Local → Cloud)
   ═══════════════════════════════════════════════════ */

/* ── Profile ── */
export async function upsertProfile(userId, data) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...data, updated_at: new Date().toISOString() });
  if (error) console.warn('[Supabase] upsertProfile error:', error.message);
}

/* ── Transactions ── */
export async function pushTransactions(userId, transactions) {
  if (!transactions.length) return;
  const rows = transactions.map(tx => ({
    id: tx.id,
    user_id: userId,
    date: tx.date,
    amount: tx.amount,
    tier: tx.tier || 2,
    category: tx.category || null,
    note: tx.note || null,
    satiety_score: tx.satietyScore || null,
    paid_via_utang: tx.paidViaUtang || false,
    linked_utang_id: tx.linkedUtangId || null,
    is_vault_withdraw: tx.isVaultWithdraw || false,
    vault_amount: tx.vaultAmount || null,
    vault_reason: tx.vaultReason || null,
  }));
  const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[Supabase] pushTransactions error:', error.message);
}

/* ── Bills ── */
export async function pushBills(userId, bills) {
  if (!bills.length) return;
  const rows = bills.map(b => ({
    id: b.id,
    user_id: userId,
    label: b.label,
    amount: b.amount,
    due_date: b.dueDate,
    is_paid: b.isPaid || false,
  }));
  const { error } = await supabase.from('bills').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[Supabase] pushBills error:', error.message);
}

/* ── Utang Ledger (Hulugan — partial payments) ── */
export async function pushUtangLedger(userId, ledger) {
  if (!ledger.length) return;
  const rows = ledger.map(u => ({
    id: u.id,
    user_id: userId,
    amount: u.amount,
    label: u.label,
    date: u.date,
    amount_paid: u.amountPaid || 0,
  }));
  const { error } = await supabase.from('utang_ledger').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[Supabase] pushUtangLedger error:', error.message);
}

/* ── Income Ledger ── */
export async function pushIncomeLedger(userId, ledger) {
  if (!ledger.length) return;
  const rows = ledger.map(i => ({
    id: i.id,
    user_id: userId,
    amount: i.amount,
    label: i.label,
    date: i.date,
  }));
  const { error } = await supabase.from('income_ledger').upsert(rows, { onConflict: 'id' });
  if (error) console.warn('[Supabase] pushIncomeLedger error:', error.message);
}


/* ═══════════════════════════════════════════════════
   FULL STATE PUSH (first-time sync / force sync)
   ═══════════════════════════════════════════════════ */

export async function pushFullState(userId, appState) {
  try {
    await Promise.all([
      upsertProfile(userId, {
        cash_on_hand: appState.cashOnHand,
        emergency_vault: appState.emergencyVault,
        next_income_date: appState.nextIncomeDate,
        setup_date: appState.setupDate,
      }),
      pushTransactions(userId, appState.transactions),
      pushBills(userId, appState.tier1Bills),
      pushUtangLedger(userId, appState.utangLedger),
      pushIncomeLedger(userId, appState.microIncomeLedger),
    ]);
    console.log('%c[Supabase] Full state synced ✓', 'color:#58cc02; font-weight:bold;');
    return { success: true };
  } catch (err) {
    console.warn('[Supabase] Full state sync failed:', err.message);
    return { success: false, error: err.message };
  }
}


/* ═══════════════════════════════════════════════════
   DELTA PUSH (incremental — saves mobile data)
   Only pushes records created/modified after lastSyncedAt.
   ═══════════════════════════════════════════════════ */

/**
 * Filter an array to items with an `id` generated after `sinceMs`.
 * Our uid() is Date.now().toString(36) + random, so we can
 * compare the timestamp prefix to determine "newness".
 * Falls back to pushing everything if sinceMs is 0 (first sync).
 */
function isNewerThan(item, sinceMs) {
  if (!sinceMs) return true; // first sync — push everything
  // uid format: Date.now().toString(36) + 5 random chars
  const tsPrefix = item.id ? item.id.slice(0, -5) : '';
  try {
    const itemMs = parseInt(tsPrefix, 36);
    return itemMs > sinceMs;
  } catch {
    return true; // safety: push if we can't parse
  }
}

export async function pushDelta(userId, appState, lastSyncedAt) {
  const sinceMs = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;

  // Always push profile (small payload)
  const profilePromise = upsertProfile(userId, {
    cash_on_hand: appState.cashOnHand,
    emergency_vault: appState.emergencyVault,
    next_income_date: appState.nextIncomeDate,
    setup_date: appState.setupDate,
  });

  // Filter arrays for new/updated items
  const newTx = appState.transactions.filter(t => isNewerThan(t, sinceMs));
  const newBills = appState.tier1Bills.filter(b => isNewerThan(b, sinceMs));
  const newUtang = appState.utangLedger.filter(u => isNewerThan(u, sinceMs));
  const newIncome = appState.microIncomeLedger.filter(i => isNewerThan(i, sinceMs));

  // For utang, always push all active (partially paid) entries
  // since amountPaid can change even on old utang items
  const activeUtang = appState.utangLedger.filter(u => (u.amountPaid || 0) < u.amount);
  const utangToSync = [...new Map([...newUtang, ...activeUtang].map(u => [u.id, u])).values()];

  try {
    await Promise.all([
      profilePromise,
      pushTransactions(userId, newTx),
      pushBills(userId, newBills),
      pushUtangLedger(userId, utangToSync),
      pushIncomeLedger(userId, newIncome),
    ]);

    const totalPushed = newTx.length + newBills.length + utangToSync.length + newIncome.length;
    if (totalPushed > 0) {
      console.log(`%c[Supabase] Delta sync: ${totalPushed} records pushed ✓`, 'color:#58cc02; font-weight:bold;');
    } else {
      console.log('%c[Supabase] Delta sync: profile only (no new records) ✓', 'color:#58cc02;');
    }
    return { success: true };
  } catch (err) {
    console.warn('[Supabase] Delta sync failed:', err.message);
    return { success: false, error: err.message };
  }
}


/* ═══════════════════════════════════════════════════
   PULL HELPERS (Cloud → Local)
   Used for Cloud-to-Local Hydration on login.
   ═══════════════════════════════════════════════════ */

export async function pullProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) { console.warn('[Supabase] pullProfile error:', error.message); return null; }
  if (!data) return null;
  return {
    cashOnHand: data.cash_on_hand || 0,
    emergencyVault: data.emergency_vault || 0,
    nextIncomeDate: data.next_income_date || null,
    setupDate: data.setup_date || null,
  };
}

export async function pullTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) { console.warn('[Supabase] pullTransactions error:', error.message); return []; }
  return (data || []).map(row => ({
    id: row.id,
    date: row.date,
    amount: row.amount,
    tier: row.tier,
    category: row.category,
    note: row.note,
    satietyScore: row.satiety_score,
    paidViaUtang: row.paid_via_utang,
    linkedUtangId: row.linked_utang_id,
    isVaultWithdraw: row.is_vault_withdraw,
    vaultAmount: row.vault_amount,
    vaultReason: row.vault_reason,
  }));
}

export async function pullBills(userId) {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true });
  if (error) { console.warn('[Supabase] pullBills error:', error.message); return []; }
  return (data || []).map(row => ({
    id: row.id,
    label: row.label,
    amount: row.amount,
    dueDate: row.due_date,
    isPaid: row.is_paid,
  }));
}

export async function pullUtangLedger(userId) {
  const { data, error } = await supabase
    .from('utang_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) { console.warn('[Supabase] pullUtangLedger error:', error.message); return []; }
  return (data || []).map(row => ({
    id: row.id,
    amount: row.amount,
    label: row.label,
    date: row.date,
    amountPaid: row.amount_paid || 0,
  }));
}

export async function pullIncomeLedger(userId) {
  const { data, error } = await supabase
    .from('income_ledger')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) { console.warn('[Supabase] pullIncomeLedger error:', error.message); return []; }
  return (data || []).map(row => ({
    id: row.id,
    amount: row.amount,
    label: row.label,
    date: row.date,
  }));
}

/* ── Pull everything at once (for hydration) ── */
export async function pullFullState(userId) {
  try {
    const [profile, transactions, bills, utang, income] = await Promise.all([
      pullProfile(userId),
      pullTransactions(userId),
      pullBills(userId),
      pullUtangLedger(userId),
      pullIncomeLedger(userId),
    ]);
    console.log('%c[Supabase] Full state pulled ✓', 'color:#1cb0f6; font-weight:bold;');
    return { profile, transactions, bills, utang, income };
  } catch (err) {
    console.warn('[Supabase] Full state pull failed:', err.message);
    return null;
  }
}
