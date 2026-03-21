/* ============================================================
   POCKET APP — Auth UI Controller
   Modal steps, OTP input handling, social login, nudge logic
   ============================================================ */

import { AuthManager } from './manager.js';
import { showEl, hideEl, openModal, closeModal } from '../ui/views.js';
import { showToast } from '../ui/toast.js';
import { SFX } from '../feedback/sfx.js';
import { haptic } from '../feedback/haptics.js';
import { launchConfetti } from '../feedback/confetti.js';
import { shakeInput, addFocusBorder } from '../utils/dom.js';
import { appState } from '../state/store.js';
import { exportJSON } from '../state/store.js';
import { hydrateFromCloud } from '../state/sync.js';
import { renderDashboard } from '../ui/dashboard.js';

let authCurrentStep = 1;

export function openAuthModal() {
  authCurrentStep = 1;
  showAuthStep(1);
  document.getElementById('auth-identifier').value = '';
  clearOTPInputs();
  hideEl('otp-error');
  openModal('modal-auth');
  setTimeout(() => document.getElementById('auth-identifier')?.focus(), 200);
}

function showAuthStep(step) {
  authCurrentStep = step;
  [1, 2, 3].forEach(s => {
    const el = document.getElementById(`auth-step-${s}`);
    if (el) el.style.display = s === step ? 'block' : 'none';
  });
  document.querySelectorAll('.auth-step-dot').forEach((dot, i) => {
    const s = i + 1;
    dot.classList.toggle('active', s === step);
    dot.classList.toggle('done', s < step);
  });
}

function clearOTPInputs() {
  document.querySelectorAll('.auth-otp-digit').forEach(inp => {
    inp.value = '';
    inp.classList.remove('filled', 'error');
  });
}

function getOTPCode() {
  return Array.from(document.querySelectorAll('.auth-otp-digit')).map(i => i.value).join('');
}

function startOTPCountdown() {
  let secs = 60;
  const timerEl = document.getElementById('otp-timer');
  const countEl = document.getElementById('otp-countdown');
  const resendEl = document.getElementById('otp-resend');
  if (timerEl) timerEl.style.display = 'block';
  if (resendEl) resendEl.style.display = 'none';
  if (countEl) countEl.textContent = secs;

  if (AuthManager._otpTimer) clearInterval(AuthManager._otpTimer);

  AuthManager._otpTimer = setInterval(() => {
    secs--;
    if (countEl) countEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(AuthManager._otpTimer);
      AuthManager._otpTimer = null;
      if (timerEl) timerEl.style.display = 'none';
      if (resendEl) resendEl.style.display = 'inline-block';
    }
  }, 1000);
}

async function handleSendOTP() {
  const identifier = document.getElementById('auth-identifier')?.value.trim();
  if (!identifier) {
    shakeInput('auth-identifier');
    return;
  }

  const btn = document.getElementById('auth-send-otp');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="auth-spinner"></span> Sending...';
  btn.disabled = true;

  try {
    await AuthManager.initCaptcha();
    const result = await AuthManager.sendOTP(identifier);

    if (result.success) {
      SFX.play('coin');
      haptic('medium');
      document.getElementById('auth-sent-to').textContent = identifier;
      showAuthStep(2);
      startOTPCountdown();
      clearOTPInputs();
      setTimeout(() => document.querySelector('.auth-otp-digit')?.focus(), 200);
    }
  } catch (err) {
    showToast('❌ Failed to send code. Please try again.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleVerifyOTP() {
  const code = getOTPCode();
  if (code.length < 6) {
    document.querySelectorAll('.auth-otp-digit').forEach(inp => {
      if (!inp.value) inp.classList.add('error');
    });
    SFX.play('error');
    haptic('error');
    return;
  }

  const btn = document.getElementById('auth-verify-otp');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="auth-spinner"></span> Verifying...';
  btn.disabled = true;

  try {
    const result = await AuthManager.verifyOTP(code);

    if (result.success) {
      SFX.play('chaching');
      haptic('heavy');
      launchConfetti();
      hideEl('otp-error');

      // Cloud-to-Local Hydration: pull remote state before showing success
      await hydrateFromCloud();

      document.getElementById('auth-display-name').textContent = result.user.name;
      document.getElementById('auth-display-id').textContent = result.user.identifier;

      showAuthStep(3);
      hideEl('auth-nudge-banner');

      if (AuthManager._otpTimer) { clearInterval(AuthManager._otpTimer); AuthManager._otpTimer = null; }
    } else {
      showEl('otp-error');
      document.querySelectorAll('.auth-otp-digit').forEach(inp => inp.classList.add('error'));
      SFX.play('error');
      haptic('error');
      setTimeout(() => {
        document.querySelectorAll('.auth-otp-digit').forEach(inp => inp.classList.remove('error'));
        hideEl('otp-error');
      }, 2500);
    }
  } catch {
    showToast('❌ Verification failed. Try again.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleSocialAuth(provider) {
  const btn = document.querySelector(`[data-provider="${provider}"]`);
  if (!btn) return;

  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="auth-spinner"></span> Redirecting...';
  btn.disabled = true;

  try {
    // OAuth will redirect the browser to the provider's login page.
    // When the user returns, the session is set automatically by Supabase.
    const result = await AuthManager.socialLogin(provider);

    if (!result.success) {
      showToast(`❌ ${result.message || 'Connection failed.'}`);
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
    // If success, the page is already redirecting — no UI update needed
  } catch {
    showToast('❌ Connection failed. Please try again.');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

/* ── Progressive Disclosure Logic ── */
export function checkAuthNudge() {
  if (AuthManager.isLoggedIn()) return;
  if (localStorage.getItem('pocket-nudge-dismissed')) return;
  if (!appState.setupDate) return;

  const setupMs = new Date(appState.setupDate + 'T00:00:00').getTime();
  const now = Date.now();
  const daysSinceSetup = (now - setupMs) / 86400000;

  if (daysSinceSetup >= 3) {
    showEl('auth-nudge-banner');
  }
}

function dismissNudge() {
  hideEl('auth-nudge-banner');
  localStorage.setItem('pocket-nudge-dismissed', 'true');
}

/* ── Auth Event Listeners ── */
export function authEventListeners() {
  document.getElementById('auth-close')?.addEventListener('click', () => {
    closeModal('modal-auth');
    if (AuthManager._otpTimer) { clearInterval(AuthManager._otpTimer); AuthManager._otpTimer = null; }
  });
  document.getElementById('modal-auth')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-auth')) {
      closeModal('modal-auth');
      if (AuthManager._otpTimer) { clearInterval(AuthManager._otpTimer); AuthManager._otpTimer = null; }
    }
  });

  // Cloud Sync button in Settings
  document.getElementById('cloud-sync-btn')?.addEventListener('click', () => {
    closeModal('modal-settings');
    if (AuthManager.isLoggedIn()) {
      showToast('☁️ Already synced! Your data is backed up.');
    } else {
      AuthManager._pendingAction = 'sync';
      openAuthModal();
    }
  });

  // Nudge banner
  document.getElementById('nudge-dismiss')?.addEventListener('click', dismissNudge);
  document.getElementById('nudge-signin-btn')?.addEventListener('click', () => {
    hideEl('auth-nudge-banner');
    openAuthModal();
  });

  // Social OAuth
  document.querySelectorAll('.auth-social-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      if (provider) handleSocialAuth(provider);
    });
  });

  // OTP send
  document.getElementById('auth-send-otp')?.addEventListener('click', handleSendOTP);
  document.getElementById('auth-identifier')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSendOTP();
  });

  // OTP digit inputs — auto-advance, paste support, backspace
  document.querySelectorAll('.auth-otp-digit').forEach((inp, idx, all) => {
    inp.addEventListener('input', e => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val.slice(0, 1);

      if (val) {
        e.target.classList.add('filled');
        e.target.classList.remove('error');
        SFX.play('pop');
        if (idx < all.length - 1) all[idx + 1].focus();
        if (getOTPCode().length === 6) {
          setTimeout(() => handleVerifyOTP(), 200);
        }
      } else {
        e.target.classList.remove('filled');
      }
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        all[idx - 1].focus();
        all[idx - 1].value = '';
        all[idx - 1].classList.remove('filled');
      }
    });

    inp.addEventListener('paste', e => {
      e.preventDefault();
      const paste = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6);
      paste.split('').forEach((d, i) => {
        if (all[i]) {
          all[i].value = d;
          all[i].classList.add('filled');
        }
      });
      if (paste.length === 6) {
        all[5].focus();
        setTimeout(() => handleVerifyOTP(), 300);
      } else if (paste.length > 0) {
        (all[paste.length] || all[paste.length - 1]).focus();
      }
    });
  });

  // OTP verify & resend
  document.getElementById('auth-verify-otp')?.addEventListener('click', handleVerifyOTP);
  document.getElementById('otp-resend')?.addEventListener('click', () => {
    const identifier = document.getElementById('auth-sent-to')?.textContent;
    if (identifier) {
      AuthManager.sendOTP(identifier).then(() => {
        startOTPCountdown();
        clearOTPInputs();
        showToast('🔑 New code sent!');
        document.querySelector('.auth-otp-digit')?.focus();
      });
    }
  });

  // Back to step 1
  document.getElementById('auth-back-to-step1')?.addEventListener('click', () => {
    showAuthStep(1);
    if (AuthManager._otpTimer) { clearInterval(AuthManager._otpTimer); AuthManager._otpTimer = null; }
  });

  // Done — close auth and run pending action
  document.getElementById('auth-done')?.addEventListener('click', () => {
    closeModal('modal-auth');

    if (AuthManager._pendingAction === 'export') {
      exportJSON();
      showToast('📤 Data exported successfully!');
    } else if (AuthManager._pendingAction === 'sync') {
      showToast('☁️ Cloud sync activated! Your data is safe.');
    }
    AuthManager._pendingAction = null;

    // Re-render dashboard with potentially hydrated data
    renderDashboard();
  });

  addFocusBorder('auth-identifier');
}
