/* ============================================================
   POCKET APP — Setup Renderers
   3-step wizard: Initial Funds → Bills → Summary
   ============================================================ */

import { pesoToCentavos, formatPeso, formatDate, daysBetween, todayISO, esc } from '../utils/format.js';

export let pendingSetupBills = [];
export let currentSetupStep = 1;

export function showSetupStep(step) {
  currentSetupStep = step;
  [1, 2, 3].forEach(s => {
    const el = document.getElementById(`setup-step-${s}`);
    if (el) el.style.display = s === step ? 'block' : 'none';
  });
  document.querySelectorAll('.setup-step-dot').forEach((dot, i) => {
    const s = i + 1;
    dot.classList.toggle('active', s === step);
    dot.classList.toggle('done', s < step);
  });
}

export function renderSetupBills() {
  const list = document.getElementById('bills-list');
  if (!list) return;
  if (pendingSetupBills.length === 0) {
    list.innerHTML = `<p class="text-center text-sm py-3" style="color:#7a7a7a">No bills added yet — tap below to add one</p>`;
    return;
  }
  list.innerHTML = pendingSetupBills.map((b, i) => `
    <div class="flex items-center justify-between rounded-xl px-4 py-3 animate-fade-in"
         style="background:#f7f4f0; border:2px solid #ede8df;">
      <div>
        <div class="text-sm font-bold" style="color:#2e2e2e">${esc(b.label)}</div>
        <div style="font-size:11px; font-weight:600; color:#7a7a7a">${formatDate(b.dueDate)}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="font-nums text-sm" style="color:#ff4b4b;">${formatPeso(b.amount)}</span>
        <button class="btn-squishy w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style="background:#fff0f0; color:#ff4b4b;"
                data-remove-bill="${i}" aria-label="Remove bill">✕</button>
      </div>
    </div>`).join('');
}

export function renderSetupSummary() {
  const funds = pesoToCentavos(document.getElementById('income-input').value);
  const nextDate = document.getElementById('next-income-date').value || '';
  const billsTotal = pendingSetupBills.reduce((s, b) => s + b.amount, 0);
  const daysToNext = nextDate ? daysBetween(todayISO(), nextDate) : 30;
  const available = funds - billsTotal;
  const daily = available / Math.max(1, daysToNext);
  const isDeficit = daily <= 0;

  const el = document.getElementById('setup-summary');
  if (!el) return;

  el.innerHTML = `
    <div class="space-y-3">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="text-sm font-bold" style="color:#7a7a7a;">Initial Funds</span>
        <span class="font-nums text-sm" style="color:#1cb0f6;">${formatPeso(funds)}</span>
      </div>
      ${pendingSetupBills.length > 0 ? `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="text-sm font-bold" style="color:#7a7a7a;">Total Bills</span>
        <span class="font-nums text-sm" style="color:#ff4b4b;">−${formatPeso(billsTotal)}</span>
      </div>` : ''}
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="text-sm font-bold" style="color:#7a7a7a;">Days Until Next Income</span>
        <span class="font-nums text-sm" style="color:#7a7a7a;">${daysToNext} days</span>
      </div>
      <div style="height:1px; background:#ede8df;"></div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="font-bold" style="font-size:13px; color:#7a7a7a;">Daily Budget</span>
        <span class="font-nums" style="font-size:22px; font-weight:900; color:${isDeficit ? '#ff4b4b' : '#58cc02'};">
          ${isDeficit ? '😟 Over Budget!' : formatPeso(Math.max(0, daily))}
        </span>
      </div>
      <div class="text-xs font-semibold text-center" style="color:#7a7a7a;">
        ${pendingSetupBills.length} bill${pendingSetupBills.length !== 1 ? 's' : ''} tracked •
        ${isDeficit ? 'Consider an Advance to bridge the gap 🛡️' : `${formatPeso(Math.max(0, daily))}/day for ${daysToNext} days`}
      </div>
    </div>`;
}

export function resetPendingBills() {
  pendingSetupBills = [];
}
