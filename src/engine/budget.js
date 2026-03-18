/* ============================================================
   POCKET APP — Budget Engine
   Core math: daily allowance, 50/50 savings split, deficit detection
   ============================================================ */

import { todayISO, localISO, daysBetween } from '../utils/format.js';
import { checkHealthDebt } from './health.js';

/**
 * processEndOfDay(state)
 * Called on boot / after actions. Walks from lastProcessedDate to yesterday,
 * applying the 50/50 savings split on each day's unspent amount.
 * Mutates state.emergencyVault and state.lastProcessedDate, returns leftover.
 */
export function processEndOfDay(state) {
  const today = todayISO();
  if (!state.setupDate || !state.lastProcessedDate) return 0;

  const startDate = state.lastProcessedDate;
  if (startDate >= today) return 0; // already up to date

  const billsTotal = state.tier1Bills.filter(b => !b.isPaid).reduce((s, b) => s + b.amount, 0);
  const availableCash = state.cashOnHand - billsTotal;
  const daysToNext = state.nextIncomeDate ? daysBetween(today, state.nextIncomeDate) : 30;
  const rawDaily = availableCash / Math.max(1, daysToNext);

  let rollover = 0;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(today + 'T00:00:00');

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const ds = localISO(d);
    if (ds === today) break; // don't process today yet
    const daySpent = state.transactions
      .filter(t => t.date === ds && t.tier === 2)
      .reduce((s, t) => s + t.amount, 0);
    const surplus = rawDaily - daySpent;
    if (surplus > 0) {
      // 50/50 SAVINGS SPLIT: half goes to leftover, half locked in vault
      const half = Math.floor(surplus / 2);
      rollover += half;
      state.emergencyVault += (surplus - half); // ceiling goes to vault
    }
  }

  state.lastProcessedDate = today;
  return rollover;
}

/**
 * computeEngine(state) → { dailyAllowance, isDeficit, todayState, unpaidBillsTotal, ... }
 * Core: dailyAllowance = cashOnHand / daysUntilNextIncome
 */
export function computeEngine(state) {
  const today = todayISO();

  /* ── Bills & Utang totals ── */
  const billsTotal = state.tier1Bills.filter(b => !b.isPaid).reduce((s, b) => s + b.amount, 0);
  const utangOwed = state.utangLedger.filter(u => !u.isPaid).reduce((s, u) => s + u.amount, 0);
  const availableCash = state.cashOnHand - billsTotal;

  /* ── Daily allowance from cash-on-hand / days remaining ── */
  const daysToNext = state.nextIncomeDate ? daysBetween(today, state.nextIncomeDate) : 30;
  const dailyAllowance = availableCash / Math.max(1, daysToNext);
  const isDeficit = dailyAllowance <= 0;

  /* ── Process past days (50/50 savings split) ── */
  const rollover = processEndOfDay(state);

  /* ── Today's daily spending ── */
  const todaySpent = state.transactions
    .filter(t => t.date === today && t.tier === 2)
    .reduce((s, t) => s + t.amount, 0);

  const todayState = {
    allowance: Math.max(0, dailyAllowance),
    spent: todaySpent,
    rollover: rollover,
  };

  /* ── Vault: unpaid bills ── */
  const unpaidBills = state.tier1Bills.filter(b => !b.isPaid);
  const unpaidBillsTotal = unpaidBills.reduce((s, b) => s + b.amount, 0);

  let nextBillDays = null;
  const todayMs = new Date(today + 'T00:00:00').getTime();
  for (const bill of unpaidBills) {
    if (!bill.dueDate) continue;
    const du = Math.ceil((new Date(bill.dueDate + 'T00:00:00').getTime() - todayMs) / 86400000);
    if (du >= 0 && (nextBillDays === null || du < nextBillDays)) nextBillDays = du;
  }

  /* ── Health debt check ── */
  const healthWarning = checkHealthDebt(state);

  return {
    dailyAllowance: Math.max(0, dailyAllowance), isDeficit, todayState,
    unpaidBillsTotal, nextBillDays, buffer: rollover,
    emergencyVault: state.emergencyVault, utangOwed, healthWarning,
    daysToNext, availableCash,
  };
}
