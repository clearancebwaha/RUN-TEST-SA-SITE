/* ============================================================
   POCKET APP — Toast Notification
   Bottom-floating notification banner
   ============================================================ */

export function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed; bottom:90px; left:50%; transform:translateX(-50%); z-index:999; ' +
      'background:linear-gradient(135deg,#2e2e2e,#1a1a2e); color:white; padding:12px 20px; border-radius:16px; ' +
      'font-size:13px; font-weight:700; box-shadow:0 8px 32px rgba(0,0,0,0.3); max-width:340px; text-align:center; ' +
      'opacity:0; transition:opacity 0.3s ease;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}
