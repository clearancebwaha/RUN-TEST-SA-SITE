/* ============================================================
   POCKET APP — Transaction, Bill & Income Helpers
   CRUD operations for transactions, utang, income, vault
   ============================================================ */

import { appState, saveState } from '../state/store.js';
import { todayISO, uid, formatPeso } from '../utils/format.js';
import { computeEngine } from './budget.js';

export function addTransaction(tx, skipCashDeduct = false) {
  if (!skipCashDeduct) {
    const engine = computeEngine(appState);
    const pool = engine.todayState.allowance + engine.buffer;
    const projected = engine.todayState.spent + tx.amount;
    if (projected > pool) return { blocked: true };
  }

  const txEntry = { ...tx, id: uid() };
  appState.transactions.push(txEntry);

  // Track nutrition
  if (tx.category === 'food' && tx.satietyScore) {
    appState.nutritionLog.push({ date: tx.date, score: tx.satietyScore, cost: tx.amount });
  }

  // Deduct from cash on hand (unless paid via utang/lista)
  if (!skipCashDeduct) {
    appState.cashOnHand = Math.max(0, appState.cashOnHand - tx.amount);
  }

  saveState(appState);
  return { blocked: false, txId: txEntry.id };
}

export function addMicroIncome(amount, label) {
  const entry = { id: uid(), amount, label: label || 'Funds added', date: todayISO() };
  appState.microIncomeLedger.push(entry);

  // Auto-deduct utang FIFO before crediting cash (Hulugan — partial payments)
  let remaining = amount;
  for (const u of appState.utangLedger) {
    const owed = u.amount - (u.amountPaid || 0);
    if (owed <= 0 || remaining <= 0) continue;
    if (remaining >= owed) {
      remaining -= owed;
      u.amountPaid = u.amount; // fully settled
    } else {
      u.amountPaid = (u.amountPaid || 0) + remaining;
      remaining = 0;
    }
  }

  appState.cashOnHand += remaining;
  saveState(appState);
  return { deducted: amount - remaining, credited: remaining };
}

export function addUtang(amount, label) {
  appState.utangLedger.push({
    id: uid(), amount, label: label || 'Micro-loan', date: todayISO(), amountPaid: 0,
  });
  // Utang gives you cash now (borrowed money)
  appState.cashOnHand += amount;
  saveState(appState);
}

export function toggleBillPaid(id) {
  const bill = appState.tier1Bills.find(b => b.id === id);
  if (!bill) return { blocked: false };

  // If marking as paid, check if enough cash
  if (!bill.isPaid) {
    if (appState.cashOnHand < bill.amount) {
      const shortfall = bill.amount - appState.cashOnHand;
      return { blocked: true, shortfall };
    }
    bill.isPaid = true;
    appState.cashOnHand -= bill.amount;
  } else {
    // Unmarking: refund
    bill.isPaid = false;
    appState.cashOnHand += bill.amount;
  }
  saveState(appState);
  return { blocked: false };
}

/* ── Emergency Vault Withdrawal ── */
export function withdrawFromVault(amount, reason) {
  if (amount <= 0 || amount > appState.emergencyVault) return false;
  appState.emergencyVault -= amount;
  appState.cashOnHand += amount;
  // Log as a special transaction for history
  appState.transactions.push({
    id: uid(), date: todayISO(), amount: 0, tier: 0,
    category: 'vault-withdraw', note: `🚨 Emergency: ${reason} (+${formatPeso(amount)})`,
    isVaultWithdraw: true, vaultAmount: amount,
  });
  saveState(appState);
  return true;
}

/* ── Undo Transaction ── */
export function undoTransaction(txId) {
  const idx = appState.transactions.findIndex(t => t.id === txId);
  if (idx === -1) return;
  const tx = appState.transactions[idx];

  // Refund cash (only for normal expenses, not vault withdrawals or lista)
  if (!tx.isVaultWithdraw && !tx.paidViaUtang && tx.tier === 2) {
    appState.cashOnHand += tx.amount;
  }

  // If it was paid via utang/lista, also remove the utang entry
  if (tx.paidViaUtang && tx.linkedUtangId) {
    const uIdx = appState.utangLedger.findIndex(u => u.id === tx.linkedUtangId);
    if (uIdx !== -1) appState.utangLedger.splice(uIdx, 1);
  }

  // Remove matching nutrition log entry
  if (tx.category === 'food' && tx.satietyScore) {
    const nIdx = appState.nutritionLog.findIndex(
      n => n.date === tx.date && n.score === tx.satietyScore && n.cost === tx.amount
    );
    if (nIdx !== -1) appState.nutritionLog.splice(nIdx, 1);
  }

  appState.transactions.splice(idx, 1);
  saveState(appState);
}

/* ── Wallet Reconciliation (Anti-Drift) ── */
export function reconcileBalance(actualCashCentavos) {
  const systemCash = appState.cashOnHand;
  const delta = actualCashCentavos - systemCash;
  if (delta === 0) return { adjusted: false };

  // Log a special tier:3 correction transaction
  const isPositive = delta > 0;
  appState.transactions.push({
    id: uid(),
    date: todayISO(),
    amount: Math.abs(delta),
    tier: 3,
    category: 'reconciliation',
    note: isPositive
      ? `🔧 Found +${formatPeso(Math.abs(delta))} untracked cash`
      : `🔧 Cash was ${formatPeso(Math.abs(delta))} less than expected`,
  });

  // Adjust cash to match physical reality
  appState.cashOnHand = actualCashCentavos;
  saveState(appState);

  return { adjusted: true, delta, isPositive };
}
