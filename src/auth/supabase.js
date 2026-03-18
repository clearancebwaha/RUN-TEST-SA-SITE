/* ============================================================
   POCKET APP — Supabase Client & Query Helpers
   Connects to the Supabase PostgreSQL backend.
   All cloud operations are OPTIONAL — the app still works
   100% offline via localStorage if the user is not logged in.
   ============================================================ */

import { createClient } from '@supabase/supabase-js';

// ── Supabase Credentials ──
const SUPABASE_URL = 'https://edljvrkmppgmhltecfgk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3HZzqG97LYbr3GzNSTLTKg_QWcVVbpH';

// ── Create the Supabase client (singleton) ──
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

/* ── Utang Ledger ── */
export async function pushUtangLedger(userId, ledger) {
  if (!ledger.length) return;
  const rows = ledger.map(u => ({
    id: u.id,
    user_id: userId,
    amount: u.amount,
    label: u.label,
    date: u.date,
    is_paid: u.isPaid || false,
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

/* ── Full State Sync (push everything at once) ── */
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
