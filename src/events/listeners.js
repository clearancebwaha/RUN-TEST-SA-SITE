/* ============================================================
   POCKET APP — Event Listeners
   All user interaction handlers for setup, dashboard, and settings
   ============================================================ */

import { appState, setAppState, saveState, clearState, exportJSON } from '../state/store.js';
import { INITIAL_STATE } from '../config/constants.js';
import { pesoToCentavos, todayISO, uid, formatPeso } from '../utils/format.js';
import { shakeInput, addFocusBorder } from '../utils/dom.js';
import { showView, openModal, closeModal, showEl, hideEl } from '../ui/views.js';
import { showToast } from '../ui/toast.js';
import { pendingSetupBills, showSetupStep, renderSetupBills, renderSetupSummary } from '../ui/setup.js';
import { renderDashboard } from '../ui/dashboard.js';
import { saveEditBill, deleteEditBill } from '../ui/cards.js';
import { openQuickAdd, txSelectedCategory, txSelectedSatiety, txPaidViaUtang,
         setTxCategory, setTxSatiety, setTxPaidViaUtang,
         renderCategoryBtns, renderSatietyBtns, updateNotePlaceholder } from '../ui/modals.js';
import { addTransaction, addMicroIncome, addUtang, toggleBillPaid, withdrawFromVault } from '../engine/transactions.js';
import { computeEngine } from '../engine/budget.js';
import { SFX } from '../feedback/sfx.js';
import { haptic } from '../feedback/haptics.js';
import { launchConfetti } from '../feedback/confetti.js';
import { AuthManager } from '../auth/manager.js';
import { openAuthModal } from '../auth/ui.js';

export function setupEventListeners() {

  /* ── Welcome → Setup ── */
  document.getElementById('btn-get-started').addEventListener('click', () => {
    pendingSetupBills.length = 0;
    showView('view-setup');
    showSetupStep(1);
    renderSetupBills();
  });

  /* ── Setup Step 1: funds + next date → step 2 ── */
  document.getElementById('step1-next').addEventListener('click', () => {
    const val = pesoToCentavos(document.getElementById('income-input').value);
    if (val <= 0) { shakeInput('income-input'); return; }
    const nextDate = document.getElementById('next-income-date').value;
    if (!nextDate) { shakeInput('next-income-date'); return; }
    showSetupStep(2);
    renderSetupBills();
  });
  document.getElementById('income-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('step1-next').click();
  });

  /* ── Setup Step 2: back/next/bills ── */
  document.getElementById('step2-back').addEventListener('click', () => showSetupStep(1));

  document.getElementById('add-bill-btn').addEventListener('click', () => {
    showEl('add-bill-form');
    document.getElementById('bill-label').focus();
    if (!document.getElementById('bill-due').value) document.getElementById('bill-due').value = todayISO();
  });

  document.getElementById('bill-cancel').addEventListener('click', () => { hideEl('add-bill-form'); clearBillForm(); });
  document.getElementById('bill-save').addEventListener('click', savePendingBill);
  document.getElementById('bill-due').addEventListener('keydown', e => { if (e.key === 'Enter') savePendingBill(); });

  document.getElementById('bills-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-bill]');
    if (!btn) return;
    pendingSetupBills.splice(parseInt(btn.dataset.removeBill, 10), 1);
    renderSetupBills();
  });

  document.getElementById('step2-next').addEventListener('click', () => {
    hideEl('add-bill-form');
    showSetupStep(3);
    renderSetupSummary();
  });

  document.getElementById('step3-back').addEventListener('click', () => showSetupStep(2));

  /* ── Finish setup ── */
  document.getElementById('finish-setup').addEventListener('click', () => {
    const funds = pesoToCentavos(document.getElementById('income-input').value);
    const nextDate = document.getElementById('next-income-date').value || null;
    setAppState({
      ...INITIAL_STATE,
      isSetupComplete: true,
      cashOnHand: funds,
      nextIncomeDate: nextDate,
      microIncomeLedger: [{ id: uid(), amount: funds, label: 'Initial funds', date: todayISO() }],
      tier1Bills: pendingSetupBills.map(b => ({ ...b })),
      tier2Config: { categories: ['food', 'transport'] },
      setupDate: todayISO(),
      lastProcessedDate: todayISO(),
    });
    saveState(appState);
    pendingSetupBills.length = 0;
    showView('view-dashboard');
    renderDashboard();
  });

  /* ── FAB + Quick Add ── */
  document.getElementById('fab-add').addEventListener('click', openQuickAdd);
  document.getElementById('modal-close').addEventListener('click', () => closeModal('modal-quickadd'));
  document.getElementById('modal-quickadd').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-quickadd')) closeModal('modal-quickadd');
  });

  /* ── Category & Satiety buttons ── */
  document.getElementById('category-btns').addEventListener('click', e => {
    const btn = e.target.closest('.tx-cat-btn');
    if (!btn) return;
    setTxCategory(btn.dataset.cat);
    setTxSatiety(0);
    renderCategoryBtns();
    renderSatietyBtns();
    updateNotePlaceholder();
  });

  document.getElementById('nutrition-btns').addEventListener('click', e => {
    const btn = e.target.closest('.tx-nut-btn');
    if (!btn) return;
    const val = parseInt(btn.dataset.nut, 10);
    setTxSatiety(txSelectedSatiety === val ? 0 : val);
    renderSatietyBtns();
  });

  /* ── Submit expense ── */
  document.getElementById('tx-submit').addEventListener('click', submitExpense);
  document.getElementById('tx-amount').addEventListener('keydown', e => { if (e.key === 'Enter') submitExpense(); });

  /* ── Vault bill toggle ── */
  document.getElementById('vault-status-container').addEventListener('click', e => {
    const btn = e.target.closest('.vault-bill-btn');
    if (!btn) return;
    const bill = appState.tier1Bills.find(b => b.id === btn.dataset.billId);
    const wasPaid = bill ? bill.isPaid : false;
    const result = toggleBillPaid(btn.dataset.billId);
    if (result.blocked) {
      SFX.play('error');
      haptic('error');
      showToast(`⚠️ Not enough cash! You're ₱${(result.shortfall / 100).toFixed(0)} short.`);
      document.getElementById('utang-amount').value = (result.shortfall / 100).toFixed(2);
      document.getElementById('utang-label').value = `Bridge for: ${bill.label}`;
      openModal('modal-crisis');
      return;
    }
    if (!wasPaid) {
      SFX.play('chaching');
      haptic('heavy');
      launchConfetti();
    } else {
      haptic('light');
    }
    renderDashboard();
  });

  /* ── Utang / Lista toggle in Quick Add ── */
  const listaLabel = document.querySelector('#utang-lista-section label');
  if (listaLabel) {
    listaLabel.addEventListener('click', (e) => {
      e.preventDefault();
      const check = document.getElementById('tx-lista-check');
      const toggle = document.getElementById('tx-lista-toggle');
      if (!check || !toggle) return;
      check.checked = !check.checked;
      setTxPaidViaUtang(check.checked);
      toggle.classList.toggle('lista-toggle-active', check.checked);
    });
  }

  /* ── Settings ── */
  document.getElementById('settings-btn').addEventListener('click', () => openModal('modal-settings'));
  document.getElementById('settings-close').addEventListener('click', () => closeModal('modal-settings'));
  document.getElementById('modal-settings').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-settings')) closeModal('modal-settings');
  });
  document.getElementById('export-btn').addEventListener('click', () => {
    if (!AuthManager.isLoggedIn()) {
      AuthManager._pendingAction = 'export';
      closeModal('modal-settings');
      openAuthModal();
    } else {
      exportJSON();
      closeModal('modal-settings');
    }
  });
  document.getElementById('reset-app-btn').addEventListener('click', () => {
    if (!confirm('⚠️  This will permanently delete ALL your data. Are you sure?')) return;
    clearState(); closeModal('modal-settings'); showView('view-welcome');
  });

  /* ── Add Funds modal ── */
  document.getElementById('add-funds-btn').addEventListener('click', () => {
    const tip = document.getElementById('add-cash-tooltip');
    if (tip) tip.style.display = 'none';
    appState.hasSeenCashTip = true;
    saveState(appState);
    openModal('modal-addfunds');
  });
  document.getElementById('addfunds-close').addEventListener('click', () => closeModal('modal-addfunds'));
  document.getElementById('modal-addfunds').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-addfunds')) closeModal('modal-addfunds');
  });
  document.getElementById('addfunds-submit').addEventListener('click', submitAddFunds);

  /* ── Crisis / Utang modal ── */
  document.getElementById('crisis-close').addEventListener('click', () => closeModal('modal-crisis'));
  document.getElementById('modal-crisis').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-crisis')) closeModal('modal-crisis');
  });
  document.getElementById('utang-submit').addEventListener('click', submitUtang);

  /* ── Break Glass modal ── */
  document.getElementById('breakglass-close').addEventListener('click', () => closeModal('modal-breakglass'));
  document.getElementById('modal-breakglass').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-breakglass')) closeModal('modal-breakglass');
  });
  document.getElementById('breakglass-submit').addEventListener('click', submitBreakGlass);

  /* ── Edit Bill modal ── */
  document.getElementById('editbill-close').addEventListener('click', () => closeModal('modal-editbill'));
  document.getElementById('modal-editbill').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-editbill')) closeModal('modal-editbill');
  });
  document.getElementById('editbill-save').addEventListener('click', () => { saveEditBill(); renderDashboard(); });
  document.getElementById('editbill-delete').addEventListener('click', () => {
    if (!confirm('Delete this bill? This cannot be undone.')) return;
    deleteEditBill();
    renderDashboard();
  });

  /* ── Focus borders ── */
  ['income-input', 'next-income-date', 'bill-label', 'bill-amount', 'bill-due',
   'tx-amount', 'tx-note', 'funds-amount', 'funds-label', 'utang-amount', 'utang-label',
   'breakglass-amount', 'breakglass-reason', 'editbill-label', 'editbill-amount', 'editbill-due'
  ].forEach(id => addFocusBorder(id));
}

/* ── Helper Functions ── */

function savePendingBill() {
  const label = document.getElementById('bill-label').value.trim();
  const amount = pesoToCentavos(document.getElementById('bill-amount').value);
  const due = document.getElementById('bill-due').value || todayISO();
  if (!label) { shakeInput('bill-label'); return; }
  if (amount <= 0) { shakeInput('bill-amount'); return; }
  pendingSetupBills.push({ id: uid(), label, amount, dueDate: due, isPaid: false });
  hideEl('add-bill-form');
  clearBillForm();
  renderSetupBills();
}

function clearBillForm() {
  document.getElementById('bill-label').value = '';
  document.getElementById('bill-amount').value = '';
  document.getElementById('bill-due').value = '';
}

function submitExpense() {
  const amount = pesoToCentavos(document.getElementById('tx-amount').value);
  if (amount <= 0) { shakeInput('tx-amount'); return; }
  const note = document.getElementById('tx-note').value.trim();
  const isLista = txPaidViaUtang;

  const tx = {
    date: todayISO(), amount, tier: 2, category: txSelectedCategory,
    ...(txSelectedSatiety ? { satietyScore: txSelectedSatiety } : {}),
    ...(note ? { note } : {}),
    ...(isLista ? { paidViaUtang: true } : {}),
  };

  if (isLista) {
    const utangEntry = {
      id: uid(), amount, label: note || `Lista: ${txSelectedCategory}`, date: todayISO(), isPaid: false,
    };
    appState.utangLedger.push(utangEntry);
    tx.linkedUtangId = utangEntry.id;
    addTransaction(tx, true);
    SFX.play('bridge');
    haptic('medium');
    closeModal('modal-quickadd');
    showToast(`📝 Logged as lista/utang — no cash deducted`);
    renderDashboard();
    return;
  }

  const result = addTransaction(tx);
  if (result.blocked) {
    SFX.play('error');
    haptic('error');
    const warn = document.getElementById('blocked-warning');
    warn.style.display = 'block';
    warn.classList.remove('animate-shake'); void warn.offsetWidth; warn.classList.add('animate-shake');
    setTimeout(() => { warn.style.display = 'none'; }, 3000);
  } else {
    SFX.play('pop');
    haptic('light');
    closeModal('modal-quickadd');
    const fab = document.getElementById('fab-add');
    fab.classList.add('animate-pop'); setTimeout(() => fab.classList.remove('animate-pop'), 400);
    const eng = computeEngine(appState);
    if (eng.todayState.spent <= eng.todayState.allowance * 0.5) {
      launchConfetti();
    }
    renderDashboard();
  }
}

function submitAddFunds() {
  const amount = pesoToCentavos(document.getElementById('funds-amount').value);
  if (amount <= 0) { shakeInput('funds-amount'); return; }
  const label = document.getElementById('funds-label').value.trim() || 'Funds added';
  const nextDate = document.getElementById('next-income-date-update').value;
  if (nextDate) appState.nextIncomeDate = nextDate;

  const result = addMicroIncome(amount, label);
  SFX.play('coin');
  haptic('medium');
  closeModal('modal-addfunds');
  document.getElementById('funds-amount').value = '';
  document.getElementById('funds-label').value = '';

  if (result.deducted > 0) {
    showToast(`💰 +${formatPeso(result.credited)} added • ${formatPeso(result.deducted)} auto-paid utang ✓`);
    launchConfetti();
  } else {
    showToast(`💰 +${formatPeso(result.credited)} added to your funds!`);
  }
  renderDashboard();
}

function submitUtang() {
  const amount = pesoToCentavos(document.getElementById('utang-amount').value);
  if (amount <= 0) { shakeInput('utang-amount'); return; }
  const label = document.getElementById('utang-label').value.trim() || 'Bridge loan';
  addUtang(amount, label);
  SFX.play('bridge');
  haptic('medium');
  closeModal('modal-crisis');
  document.getElementById('utang-amount').value = '';
  document.getElementById('utang-label').value = '';
  showToast(`🛡️ Bridge activated! ₱${(amount / 100).toFixed(0)} borrowed. Auto-pays when you add cash.`);
  renderDashboard();
}

function submitBreakGlass() {
  const amount = pesoToCentavos(document.getElementById('breakglass-amount').value);
  const reason = document.getElementById('breakglass-reason').value.trim();
  if (amount <= 0) { shakeInput('breakglass-amount'); return; }
  if (!reason) { shakeInput('breakglass-reason'); return; }
  if (amount > appState.emergencyVault) {
    showToast(`⚠️ Maximum available: ${formatPeso(appState.emergencyVault)}`);
    shakeInput('breakglass-amount');
    return;
  }
  withdrawFromVault(amount, reason);
  SFX.play('coin');
  haptic('heavy');
  closeModal('modal-breakglass');
  showToast(`🚨 ${formatPeso(amount)} withdrawn from Emergency Vault`);
  renderDashboard();
}
