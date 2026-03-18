/* ============================================================
   POCKET APP — Formatting Utilities
   Pure helper functions for formatting currency, dates, IDs
   ============================================================ */

export function formatPeso(centavos) {
  return '₱' + (centavos / 100).toFixed(2);
}

export function pesoToCentavos(str) {
  const n = parseFloat(String(str).replace(/[^0-9.]/g, ''));
  if (!n || n <= 0 || isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function todayISO() {
  return localISO(new Date());
}

export function localISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function formatDate(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function daysBetween(iso1, iso2) {
  const d1 = new Date(iso1 + 'T00:00:00').getTime();
  const d2 = new Date(iso2 + 'T00:00:00').getTime();
  return Math.max(1, Math.ceil((d2 - d1) / 86400000));
}
