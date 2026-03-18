/* ============================================================
   POCKET APP — Dashboard Renderers
   Budget ring, cash status, and main renderDashboard orchestrator
   ============================================================ */

import { appState, saveState } from '../state/store.js';
import { formatPeso, formatDate } from '../utils/format.js';
import { computeEngine } from '../engine/budget.js';
import { renderBufferFund, renderEmergencyVault, renderUtangStatus, renderVaultStatus, renderHealthWarning } from './cards.js';
import { renderTransactions } from './transactions-ui.js';
import { openModal } from './views.js';

export function renderDashboard() {
  const engine = computeEngine(appState);
  renderDeficitAlert(engine);
  renderBudgetRing(engine.todayState);
  renderBufferFund(engine.buffer);
  renderEmergencyVault(engine.emergencyVault);
  renderUtangStatus();
  renderVaultStatus(appState.tier1Bills, engine.unpaidBillsTotal, engine.nextBillDays);
  renderHealthWarning(engine.healthWarning);
  renderCashStatus(engine);
  renderTransactions();

  // Show Add Cash tooltip on first use
  if (!appState.hasSeenCashTip) {
    const tip = document.getElementById('add-cash-tooltip');
    if (tip) {
      tip.style.display = 'block';
      setTimeout(() => {
        tip.style.display = 'none';
        appState.hasSeenCashTip = true;
        saveState(appState);
      }, 8000);
    }
  }
}

/* ── Over Budget Alert + Bridge trigger ── */
function renderDeficitAlert(engine) {
  const el = document.getElementById('deficit-alert');
  if (!el) return;
  if (!engine.isDeficit) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const deficitAmt = Math.abs(engine.availableCash);
  el.innerHTML = `
    <div class="rounded-2xl p-4 relative overflow-hidden animate-shake"
         style="background:linear-gradient(135deg,#fff8e0,#fff0e0);
                border:2px solid #ffc800; box-shadow:0 6px 20px rgba(255,200,0,0.2);">
      <div style="position:absolute; top:-24px; right:-24px; width:80px; height:80px;
                  border-radius:50%; background:#ffc800; opacity:0.1;"></div>
      <div style="position:relative; display:flex; align-items:center; gap:12px;">
        <div class="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
             style="background:rgba(255,200,0,0.15);">🛡️</div>
        <div style="flex:1;">
          <div class="font-display" style="font-size:14px; color:#8a6d00;">Need a Bridge?</div>
          <div style="font-size:10px; font-weight:700; color:#8a6d00; opacity:0.7; margin-top:1px;">Borrow now, auto-pay later</div>
          <div style="font-size:11px; font-weight:700; color:#7a7a7a; margin-top:2px;">
          You're ${deficitAmt > 0 ? `₱${(deficitAmt / 100).toFixed(0)} short for bills.` : `out of daily budget.`} Activate the bridge to keep moving forward.
        </div>
        </div>
        <button id="trigger-crisis-btn" class="btn-squishy px-4 py-2 rounded-xl text-xs font-bold text-white"
                style="background:linear-gradient(135deg,#ffc800,#e0a000); box-shadow:0 3px 0 #c89000; white-space:nowrap;">
          Bridge It 🌉
        </button>
      </div>
    </div>`;
  const crisisBtn = document.getElementById('trigger-crisis-btn');
  if (crisisBtn) {
    crisisBtn.onclick = () => {
      document.getElementById('utang-amount').value = (deficitAmt / 100).toFixed(2);
      openModal('modal-crisis');
    };
  }
}

/* ── Cash Status Bar ── */
function renderCashStatus(engine) {
  const el = document.getElementById('cash-status-container');
  if (!el) return;
  const nextLabel = appState.nextIncomeDate ? formatDate(appState.nextIncomeDate) : '—';
  el.innerHTML = `
    <div class="rounded-2xl p-4 animate-fade-in"
         style="background:linear-gradient(135deg,#e8f6ff,#d4efff); border:2px solid #1cb0f622;">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:22px;">💰</span>
          <div>
            <div style="font-size:11px; font-weight:700; color:#1899d6;">CASH ON HAND</div>
            <div class="font-nums" style="font-size:20px; color:#1cb0f6;">${formatPeso(appState.cashOnHand)}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px; font-weight:700; color:#7a7a7a;">NEXT INCOME</div>
          <div style="font-size:13px; font-weight:700; color:#2e2e2e;">${nextLabel}</div>
          <div style="font-size:10px; font-weight:600; color:#7a7a7a;">${engine.daysToNext} day${engine.daysToNext !== 1 ? 's' : ''} left</div>
        </div>
      </div>
    </div>`;
}

/* ── Budget Ring (SVG approach) ── */
function renderBudgetRing({ allowance, spent, rollover }) {
  const total = allowance + rollover;
  const remaining = total - spent;
  const pct = total > 0 ? Math.min(spent / total, 1) : (spent > 0 ? 1 : 0);
  const isOver = remaining < 0;
  const isWarn = !isOver && pct > 0.8;
  const r = 74, C = 2 * Math.PI * r;
  const dashOffset = C * (1 - pct);
  const color = isOver ? '#ff4b4b' : isWarn ? '#ffc800' : '#58cc02';
  const gradId = isOver ? 'gradRed' : isWarn ? 'gradYellow' : 'gradGreen';
  const badgeBg = isOver ? '#fff0f0' : isWarn ? '#fff8e0' : '#e8ffe8';
  const badge = isOver ? '😰 over budget' : isWarn ? '⚠️ almost gone' : '✨ left today';

  const container = document.getElementById('budget-ring-container');
  if (!container) return;
  container.innerHTML = `
    <div style="position:relative; filter:drop-shadow(0 8px 24px ${color}44);">
      <svg width="210" height="210" viewBox="0 0 210 210" aria-hidden="true">
        <defs>
          <linearGradient id="gradGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#78e820"/><stop offset="100%" stop-color="#46a302"/>
          </linearGradient>
          <linearGradient id="gradYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffd940"/><stop offset="100%" stop-color="#e0a000"/>
          </linearGradient>
          <linearGradient id="gradRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ff7070"/><stop offset="100%" stop-color="#cc1c1c"/>
          </linearGradient>
        </defs>
        <circle cx="105" cy="105" r="${r}" fill="none" stroke="#ede8df" stroke-width="16" stroke-linecap="round"/>
        ${pct > 0 ? `
          <circle cx="105" cy="105" r="${r}" fill="none" stroke="${color}"
                  stroke-width="16" stroke-linecap="round" stroke-dasharray="${C.toFixed(4)}"
                  stroke-dashoffset="${dashOffset.toFixed(4)}" transform="rotate(-90 105 105)" opacity="0.15"/>
          <circle class="ring-progress" cx="105" cy="105" r="${r}" fill="none" stroke="url(#${gradId})"
                  stroke-width="16" stroke-linecap="round" stroke-dasharray="${C.toFixed(4)}"
                  stroke-dashoffset="${dashOffset.toFixed(4)}" transform="rotate(-90 105 105)"/>
          <text x="105" y="21" text-anchor="middle" font-size="11" font-weight="800"
                font-family="Nunito" fill="${color}" opacity="0.85">${Math.round(pct * 100)}% used</text>
        ` : ''}
      </svg>
      <div style="position:absolute; inset:0; display:flex; flex-direction:column;
                  align-items:center; justify-content:center; gap:4px; pointer-events:none;">
        <span class="font-nums" style="font-size:2.1rem; line-height:1;
              color:${isOver ? '#ff4b4b' : '#2e2e2e'};">${formatPeso(Math.abs(remaining))}</span>
        <span class="font-display" style="font-size:13px; margin-top:4px; padding:3px 14px;
                     border-radius:9999px; color:${color}; background:${badgeBg};">${badge}</span>
      </div>
    </div>
    <div style="display:flex; gap:10px; margin-top:10px; width:100%; max-width:310px;">
      ${statPill('Spent', formatPeso(spent), '#ff4b4b', '#fff0f0')}
      ${statPill('Budget', formatPeso(total), '#1cb0f6', '#e8f6ff')}
      ${rollover > 0 ? statPill('Leftover', '+' + formatPeso(rollover), '#58cc02', '#e8ffe8') : ''}
    </div>`;

  const ring = container.querySelector('.ring-progress');
  if (ring) { ring.classList.remove('ring-animated'); void ring.offsetWidth; ring.classList.add('ring-animated'); }
}

function statPill(label, value, color, bg) {
  return `<div style="flex:1; border-radius:16px; padding:10px 12px; text-align:center;
                background:${bg}; border:1.5px solid ${color}22;">
      <div class="font-nums" style="font-size:14px; line-height:1.3; color:${color};">${value}</div>
      <div style="font-size:10px; font-weight:700; margin-top:2px; color:#7a7a7a;">${label}</div>
    </div>`;
}
