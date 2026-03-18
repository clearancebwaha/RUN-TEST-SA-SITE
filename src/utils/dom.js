/* ============================================================
   POCKET APP — DOM Utility Helpers
   Input shake animation, focus border effects
   ============================================================ */

export function shakeInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('animate-shake');
  void el.offsetWidth;
  el.classList.add('animate-shake');
  el.style.borderColor = '#ff4b4b';
  setTimeout(() => {
    el.classList.remove('animate-shake');
    el.style.borderColor = '#ede8df';
  }, 650);
}

export function addFocusBorder(id, fc = '#1cb0f6', bc = '#ede8df') {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('focus', () => el.style.borderColor = fc);
  el.addEventListener('blur', () => el.style.borderColor = bc);
}
