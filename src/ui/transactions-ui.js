/* ============================================================
   POCKET APP — Transactions UI
   Renders recent transaction list with undo support
   ============================================================ */

import { appState } from '../state/store.js';
import { formatPeso, formatDate, esc } from '../utils/format.js';
import { CAT_ICONS, SATIETY_TAGS } from '../config/constants.js';
import { undoTransaction } from '../engine/transactions.js';
import { showToast } from './toast.js';
import { SFX } from '../feedback/sfx.js';
import { haptic } from '../feedback/haptics.js';
import { renderDashboard } from './dashboard.js';

export function renderTransactions() {
  const el = document.getElementById('transactions-container');
  if (!el) return;
  const txList = [...appState.transactions].reverse(); // newest first
  if (txList.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="rounded-2xl p-4 animate-fade-in"
         style="background:#fff; border:2px solid #ede8df; box-shadow:0 4px 20px rgba(0,0,0,0.06);">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">📜</span>
          <span class="font-display" style="font-size:14px; color:#2e2e2e;">Recent Transactions</span>
        </div>
        <span style="font-size:10px; font-weight:700; border-radius:9999px; padding:3px 10px;
               background:rgba(28,176,246,0.1); color:#1cb0f6; border:1px solid #1cb0f622;">
          ${txList.length} total
        </span>
      </div>
      <div class="transactions-scroll" style="display:flex; flex-direction:column; gap:6px;">
        ${txList.map(tx => {
          const isReconcile = tx.tier === 3 && tx.category === 'reconciliation';
          const icon = isReconcile ? '🔧' : tx.isVaultWithdraw ? '🚨' : (CAT_ICONS[tx.category] || '📦');
          const sign = isReconcile ? '±' : tx.isVaultWithdraw ? '+' : '-';
          const color = isReconcile ? '#8a6d00' : tx.isVaultWithdraw ? '#58cc02' : '#ff4b4b';
          const label = tx.note ? esc(tx.note) : (tx.category || 'expense');
          const listaTag = tx.paidViaUtang ? '<span style="font-size:9px; font-weight:700; padding:2px 6px; border-radius:6px; background:#ffc80022; color:#8a6d00; margin-left:4px;">lista</span>' : '';
          const nutTag = tx.satietyScore ? `<span style="font-size:9px; font-weight:700; padding:2px 6px; border-radius:6px; background:#ffc80022; color:#8a6d00; margin-left:4px;">${SATIETY_TAGS.find(s => s.value === tx.satietyScore)?.emoji || ''}</span>` : '';
          const canUndo = !tx.isVaultWithdraw && !isReconcile;
          return `<div class="tx-item">
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
              <span style="font-size:18px; flex-shrink:0;">${icon}</span>
              <div style="min-width:0;">
                <div style="font-size:12px; font-weight:700; color:#2e2e2e; white-space:nowrap;
                     overflow:hidden; text-overflow:ellipsis; max-width:160px;">${label}${listaTag}${nutTag}</div>
                <div style="font-size:10px; font-weight:600; color:#7a7a7a;">${formatDate(tx.date)}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
              <span class="font-nums" style="font-size:13px; color:${color};">${sign}${tx.isVaultWithdraw ? formatPeso(tx.vaultAmount) : formatPeso(tx.amount)}</span>
              ${canUndo ? `<button class="tx-undo-btn" data-undo-tx="${tx.id}" title="Undo">↩</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Two-tap undo confirmation handler
  el.addEventListener('click', function handler(e) {
    const btn = e.target.closest('[data-undo-tx]');
    if (!btn) return;
    const txId = btn.dataset.undoTx;

    if (btn.classList.contains('confirming')) {
      undoTransaction(txId);
      SFX.play('pop');
      haptic('light');
      showToast('↩ Transaction undone — cash refunded!');
      renderDashboard();
      el.removeEventListener('click', handler);
    } else {
      btn.classList.add('confirming');
      btn.innerHTML = 'Sure?';
      SFX.play('pop');
      haptic('light');
      setTimeout(() => {
        if (btn && btn.classList.contains('confirming')) {
          btn.classList.remove('confirming');
          btn.innerHTML = '↩';
        }
      }, 3000);
    }
  });
}
