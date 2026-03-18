/* ============================================================
   POCKET APP — Dashboard Cards
   Buffer Fund, Emergency Vault, Utang Status, Bills Vault, Health Warning
   ============================================================ */

import { appState, saveState } from '../state/store.js';
import { formatPeso, formatDate, esc, todayISO, uid, pesoToCentavos } from '../utils/format.js';
import { shakeInput } from '../utils/dom.js';
import { openModal, closeModal } from './views.js';
import { showToast } from './toast.js';
import { SFX } from '../feedback/sfx.js';
import { haptic } from '../feedback/haptics.js';

/* ── Savings Fund (leftover portion only) ── */
export function renderBufferFund(buffer) {
  const el = document.getElementById('buffer-fund-container');
  if (!el) return;
  if (buffer <= 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="card-green-glow rounded-2xl p-4 relative overflow-hidden animate-fade-in">
      <div class="shimmer-bg" style="position:absolute; inset:0; pointer-events:none; border-radius:16px;"></div>
      <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="animate-float" style="width:44px; height:44px; border-radius:16px; display:flex;
                 align-items:center; justify-content:center; font-size:24px;
                 background:rgba(88,204,2,0.15);">🐷</div>
          <div>
            <div class="font-display" style="font-size:15px; color:#2e2e2e;">Savings Fund</div>
            <div style="font-size:11px; font-weight:700; color:#58cc02;">50% of yesterday's leftover ✓</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="font-nums" style="font-size:20px; color:#58cc02;">${formatPeso(buffer)}</div>
          <div style="font-size:10px; font-weight:700; color:#58cc02; opacity:0.7;">spendable</div>
        </div>
      </div>
    </div>`;
}

/* ── Emergency Vault (auto-saved — locked savings) ── */
export function renderEmergencyVault(vault) {
  const el = document.getElementById('emergency-vault-container');
  if (!el) return;
  if (vault <= 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="rounded-2xl p-4 relative overflow-hidden animate-fade-in"
         style="background:linear-gradient(145deg,#1a1040,#2d1b69,#3d2580);
                border:1px solid rgba(255,215,0,0.2); box-shadow:0 8px 32px rgba(45,27,105,0.4);">
      <div class="shimmer-bg" style="position:absolute; inset:0; pointer-events:none; border-radius:16px; opacity:0.3;"></div>
      <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; border-radius:16px; display:flex;
                 align-items:center; justify-content:center; font-size:24px;
                 background:rgba(255,215,0,0.15);">🏦</div>
          <div>
            <div class="font-display" style="font-size:15px; color:#ffd700;">Emergency Vault</div>
            <div style="font-size:11px; font-weight:700; color:rgba(255,215,0,0.7);">Auto-Saved • Locked & protected 🔒</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="font-nums" style="font-size:20px; color:#ffd700;">${formatPeso(vault)}</div>
          <div style="font-size:10px; font-weight:700; color:rgba(255,215,0,0.6);">secured</div>
        </div>
      </div>
      <button id="vault-withdraw-btn" class="btn-squishy" style="width:100%; margin-top:12px; padding:10px 16px;
              border-radius:12px; font-size:12px; font-weight:700; background:rgba(255,215,0,0.12);
              border:1.5px solid rgba(255,215,0,0.3); color:#ffd700; cursor:pointer;">
        🚨 Break Glass — Withdraw
      </button>
    </div>`;
  const wBtn = document.getElementById('vault-withdraw-btn');
  if (wBtn) {
    wBtn.onclick = () => {
      document.getElementById('breakglass-amount').value = '';
      document.getElementById('breakglass-reason').value = '';
      openModal('modal-breakglass');
    };
  }
}

/* ── Utang Status ── */
export function renderUtangStatus() {
  const el = document.getElementById('utang-status-container');
  if (!el) return;
  const active = appState.utangLedger.filter(u => !u.isPaid);
  const paid = appState.utangLedger.filter(u => u.isPaid);
  if (active.length === 0 && paid.length === 0) { el.innerHTML = ''; return; }
  const totalOwed = active.reduce((s, u) => s + u.amount, 0);
  el.innerHTML = `
    <div class="rounded-2xl p-4 animate-fade-in"
         style="background:linear-gradient(135deg,#fff8f0,#fff0e0); border:2px solid #ffc80022;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:20px;">📝</span>
          <span class="font-display" style="font-size:15px; color:#2e2e2e;">Advances / Loans</span>
        </div>
        <span style="font-size:11px; font-weight:700; border-radius:9999px; padding:4px 12px;
               background:${active.length > 0 ? 'rgba(255,75,75,0.1)' : 'rgba(88,204,2,0.15)'};
               color:${active.length > 0 ? '#ff4b4b' : '#58cc02'}; border:1px solid ${active.length > 0 ? '#ff4b4b22' : '#58cc0222'};">
          ${active.length > 0 ? `${active.length} active` : '✓ All cleared!'}
        </span>
      </div>
      ${active.length > 0 ? `
        <div class="font-nums" style="font-size:20px; color:#ff4b4b; margin-bottom:4px;">${formatPeso(totalOwed)}</div>
        <div style="font-size:11px; font-weight:600; color:#7a7a7a;">Auto-deducts from your next income 🔄</div>
      ` : `<div style="font-size:12px; font-weight:600; color:#58cc02;">You cleared ${paid.length} loan${paid.length !== 1 ? 's' : ''}! 🎉</div>`}
    </div>`;
}

/* ── Health Debt Warning ── */
export function renderHealthWarning(warning) {
  const el = document.getElementById('health-warning-container');
  if (!el) return;
  if (!warning) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="rounded-2xl p-4 animate-fade-in"
         style="background:linear-gradient(135deg,#fff5f0,#ffe8e0); border:2px solid #ff8c4222;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:44px; height:44px; border-radius:16px; display:flex;
               align-items:center; justify-content:center; font-size:24px;
               background:rgba(255,140,66,0.12);">💪</div>
        <div>
          <div class="font-display" style="font-size:14px; color:#cc5500;">Nutrition Investment Alert</div>
          <div style="font-size:11px; font-weight:700; color:#7a7a7a; margin-top:2px;">
            Your last ${warning.meals} meals averaged <b>${warning.avgScore}/5</b> nutrition at
            <b>${formatPeso(warning.avgCost)}</b> each. Your body is your most expensive asset —
            cheap fuel now = costly repairs later. 🩺
          </div>
        </div>
      </div>
    </div>`;
}

/* ── Vault Status (Bills) ── */
export let editingBillId = null;

export function renderVaultStatus(bills, unpaidTotal, nextBillDays) {
  const el = document.getElementById('vault-status-container');
  if (!el) return;
  const paidCount = bills.filter(b => b.isPaid).length;
  const allPaid = bills.length > 0 && paidCount === bills.length;
  const badgeBg = allPaid ? 'rgba(88,204,2,0.2)' : 'rgba(255,255,255,0.1)';
  const badgeColor = allPaid ? '#58cc02' : '#7a7a7a';
  const badgeBdr = allPaid ? 'rgba(88,204,2,0.35)' : 'rgba(255,255,255,0.08)';
  const amtColor = unpaidTotal > 0 ? '#ff6b6b' : '#58cc02';
  el.innerHTML = `
    <div class="card-vault rounded-2xl p-5 animate-fade-in">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:20px;">${allPaid ? '🔓' : '🔒'}</span>
          <span class="font-display" style="font-size:15px; color:white;">Bills Vault</span>
        </div>
        <span style="font-size:11px; font-weight:700; border-radius:9999px; padding:4px 12px;
               background:${badgeBg}; color:${badgeColor}; border:1px solid ${badgeBdr};">
          ${paidCount}/${bills.length} paid
        </span>
      </div>
      <div class="font-nums" style="font-size:30px; color:${amtColor};">${formatPeso(unpaidTotal)}</div>
      <div style="font-size:12px; font-weight:600; margin-top:2px; margin-bottom:16px; color:#7a7a7a;">
        ${nextBillDays !== null ? `⏰ Next due in ${nextBillDays} day${nextBillDays !== 1 ? 's' : ''}` : '🎉 No upcoming bills'}
      </div>
      ${bills.length > 0 ? `<div style="display:flex; flex-direction:column; gap:8px;">
        ${bills.map(bill => {
    const pBg = bill.isPaid ? 'rgba(88,204,2,0.12)' : 'rgba(255,255,255,0.06)';
    const pBdr = bill.isPaid ? 'rgba(88,204,2,0.4)' : 'rgba(255,255,255,0.1)';
    const pClr = bill.isPaid ? '#58cc02' : '#e0e0e0';
    const dBg = bill.isPaid ? 'rgba(88,204,2,0.2)' : 'rgba(255,255,255,0.08)';
    const sk = bill.isPaid ? 'text-decoration:line-through; opacity:0.65;' : '';
    return `<button class="btn-squishy vault-bill-btn" data-bill-id="${bill.id}"
                  style="width:100%; display:flex; align-items:center; justify-content:space-between;
                         padding:12px 16px; min-height:52px; border-radius:12px; font-weight:600;
                         font-size:13px; text-align:left; cursor:pointer; background:${pBg};
                         border:1.5px solid ${pBdr}; color:${pClr};">
            <span style="display:flex; align-items:center; gap:10px;">
              <span style="width:24px; height:24px; border-radius:50%; display:flex;
                           align-items:center; justify-content:center; font-size:13px;
                           background:${dBg};">${bill.isPaid ? '✓' : '○'}</span>
              <span style="${sk}">${esc(bill.label)}</span>
            </span>
            <span style="display:flex; align-items:center; gap:8px;">
              <span class="font-nums" style="font-size:13px;">${formatPeso(bill.amount)}</span>
              <span style="font-size:10px; font-weight:700; border-radius:8px; padding:3px 8px;
                           background:rgba(255,255,255,0.08); color:#7a7a7a;">${formatDate(bill.dueDate)}</span>
              <span class="bill-edit-icon" data-edit-bill="${bill.id}"
                    style="font-size:10px; opacity:0.5; cursor:pointer; padding:2px;">✏️</span>
            </span>
          </button>`;
  }).join('')}
      </div>` : ''}
      <div class="bill-action-row">
        <button class="btn-squishy bill-add-btn" id="vault-add-bill-btn">
          + Add New Bill
        </button>
      </div>
    </div>`;

  // Wire edit bill icons
  el.querySelectorAll('.bill-edit-icon').forEach(icon => {
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const bill = appState.tier1Bills.find(b => b.id === icon.dataset.editBill);
      if (!bill) return;
      openEditBillModal(bill);
    });
  });

  // Wire add new bill button
  const addBtn = document.getElementById('vault-add-bill-btn');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditBillModal(null);
    });
  }
}

/* ── Edit Bill Modal Logic ── */
export function openEditBillModal(bill) {
  editingBillId = bill ? bill.id : null;
  const title = document.getElementById('editbill-title');
  const labelInput = document.getElementById('editbill-label');
  const amountInput = document.getElementById('editbill-amount');
  const dueInput = document.getElementById('editbill-due');
  const deleteBtn = document.getElementById('editbill-delete');

  if (bill) {
    title.textContent = 'Edit Bill';
    labelInput.value = bill.label;
    amountInput.value = (bill.amount / 100).toFixed(2);
    dueInput.value = bill.dueDate;
    deleteBtn.style.display = 'block';
  } else {
    title.textContent = 'Add New Bill';
    labelInput.value = '';
    amountInput.value = '';
    dueInput.value = todayISO();
    deleteBtn.style.display = 'none';
  }
  openModal('modal-editbill');
  setTimeout(() => labelInput.focus(), 120);
}

export function saveEditBill() {
  const label = document.getElementById('editbill-label').value.trim();
  const amount = pesoToCentavos(document.getElementById('editbill-amount').value);
  const due = document.getElementById('editbill-due').value || todayISO();
  if (!label) { shakeInput('editbill-label'); return; }
  if (amount <= 0) { shakeInput('editbill-amount'); return; }

  if (editingBillId) {
    const bill = appState.tier1Bills.find(b => b.id === editingBillId);
    if (bill) {
      bill.label = label;
      bill.amount = amount;
      bill.dueDate = due;
    }
    showToast('📋 Bill updated!');
  } else {
    appState.tier1Bills.push({ id: uid(), label, amount, dueDate: due, isPaid: false });
    showToast('✅ New bill added!');
  }
  saveState(appState);
  SFX.play('pop');
  haptic('light');
  closeModal('modal-editbill');
  // Dashboard will be re-rendered by event handler
}

export function deleteEditBill() {
  if (!editingBillId) return;
  const bill = appState.tier1Bills.find(b => b.id === editingBillId);
  if (!bill) return;
  if (bill.isPaid) {
    appState.cashOnHand += bill.amount;
  }
  appState.tier1Bills = appState.tier1Bills.filter(b => b.id !== editingBillId);
  saveState(appState);
  SFX.play('pop');
  haptic('medium');
  closeModal('modal-editbill');
  showToast('🗑️ Bill deleted');
}
