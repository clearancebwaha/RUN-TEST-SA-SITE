/* ============================================================
   POCKET APP — View & Modal Helpers
   Show/hide views, open/close modals, element visibility
   ============================================================ */

const VIEWS = ['view-loading', 'view-welcome', 'view-setup', 'view-dashboard'];

export function showView(id, displayType) {
  VIEWS.forEach(v => { const el = document.getElementById(v); if (el) el.style.display = 'none'; });
  const target = document.getElementById(id);
  if (!target) return;
  target.style.display = displayType || (id === 'view-loading' || id === 'view-welcome' ? 'flex' : 'block');
}

export function openModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
export function closeModal(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
export function showEl(id, type = 'block') { const el = document.getElementById(id); if (el) el.style.display = type; }
export function hideEl(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
