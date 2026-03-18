/* ============================================================
   POCKET APP — Modal / Form Renderers
   Quick Add modal: category buttons, satiety buttons, lista toggle
   ============================================================ */

import { appState } from '../state/store.js';
import { SATIETY_TAGS, CAT_ICONS } from '../config/constants.js';
import { openModal, hideEl } from './views.js';

export let txSelectedCategory = '';
export let txSelectedSatiety = 0;
export let txPaidViaUtang = false;

export function setTxCategory(cat) { txSelectedCategory = cat; }
export function setTxSatiety(val) { txSelectedSatiety = val; }
export function setTxPaidViaUtang(val) { txPaidViaUtang = val; }

export function openQuickAdd() {
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-note').value = '';
  txSelectedCategory = appState.tier2Config.categories[0] || 'food';
  txSelectedSatiety = 0;
  txPaidViaUtang = false;
  hideEl('blocked-warning');
  // Reset lista toggle
  const listaCheck = document.getElementById('tx-lista-check');
  if (listaCheck) listaCheck.checked = false;
  const listaToggle = document.getElementById('tx-lista-toggle');
  if (listaToggle) listaToggle.classList.remove('lista-toggle-active');
  renderCategoryBtns();
  renderSatietyBtns();
  updateNotePlaceholder();
  openModal('modal-quickadd');
  setTimeout(() => document.getElementById('tx-amount').focus(), 120);
}

export function updateNotePlaceholder() {
  const noteEl = document.getElementById('tx-note');
  if (!noteEl) return;
  if (txSelectedCategory === 'food') {
    noteEl.placeholder = 'e.g. rice + egg \uD83C\uDF73';
  } else if (txSelectedCategory === 'transport') {
    noteEl.placeholder = 'e.g. Jeepney or LRT \uD83D\uDE8C';
  } else {
    noteEl.placeholder = 'e.g. describe your expense';
  }
}

export function renderCategoryBtns() {
  const container = document.getElementById('category-btns');
  if (!container) return;
  container.innerHTML = appState.tier2Config.categories.map(cat => {
    const active = txSelectedCategory === cat;
    return `<button type="button" class="btn-squishy tx-cat-btn" data-cat="${cat}"
              style="flex:1; padding:12px 8px; font-size:14px; font-weight:700;
                     border-radius:16px; min-height:52px; text-transform:capitalize;
                     background:${active ? '#1cb0f6' : '#f7f4f0'};
                     color:${active ? '#ffffff' : '#7a7a7a'};
                     border:2px solid ${active ? '#1899d6' : '#ede8df'};
                     box-shadow:${active ? '0 4px 0 #1899d6' : 'none'};">
        ${CAT_ICONS[cat] || '📦'} ${cat}
      </button>`;
  }).join('');
}

export function renderSatietyBtns() {
  const section = document.getElementById('nutrition-section');
  const container = document.getElementById('nutrition-btns');
  if (!section || !container) return;
  section.style.display = txSelectedCategory === 'food' ? 'block' : 'none';
  container.innerHTML = SATIETY_TAGS.map(tag => {
    const active = txSelectedSatiety === tag.value;
    return `<button type="button" class="btn-squishy tx-nut-btn" data-nut="${tag.value}"
              style="flex:1; padding:8px 4px; font-size:11px; font-weight:700;
                     border-radius:16px; min-height:52px; line-height:1.4;
                     background:${active ? '#ffc800' : '#f7f4f0'};
                     color:${active ? '#2e2e2e' : '#7a7a7a'};
                     border:2px solid ${active ? '#e0b000' : '#ede8df'};
                     box-shadow:${active ? '0 3px 0 #e0b000' : 'none'};">
        ${tag.emoji}<br>${tag.label}
      </button>`;
  }).join('');
}
