/* ============================================================
   POCKET APP — AuthManager (Real Supabase Auth)
   Replaces the mock auth with real OTP + OAuth via Supabase.
   Keeps the same API surface so sync.js and ui.js work unchanged.
   ============================================================ */

import { supabase } from './supabase.js';

// ── Cached session (kept in sync via onAuthStateChange) ──
// This allows isLoggedIn() and getUser() to stay synchronous,
// which sync.js and event listeners depend on.
let _session = null;
let _user = null;

// Listen for auth state changes (login, logout, token refresh)
supabase.auth.onAuthStateChange((_event, session) => {
  _session = session;
  _user = session?.user || null;
});

// On module load, hydrate from any existing session (e.g. page reload)
supabase.auth.getSession().then(({ data }) => {
  _session = data.session;
  _user = data.session?.user || null;
});

export const AuthManager = {
  _pendingAction: null,   // 'export' | 'sync' | null
  _otpTimer: null,
  _otpEmail: null,        // email used for current OTP flow

  /* ── Synchronous state checks (used by sync.js) ── */

  isLoggedIn() {
    return !!_session;
  },

  getUser() {
    if (!_user) return null;
    return {
      id: _user.id,
      name: _user.user_metadata?.full_name || 'Pocket User',
      identifier: _user.email || _user.phone || '',
      provider: _user.app_metadata?.provider || 'email',
      avatarEmoji: '👤',
    };
  },

  /* ── Real Supabase Auth Methods ── */

  async sendOTP(identifier) {
    this._otpEmail = identifier;
    const { error } = await supabase.auth.signInWithOtp({ email: identifier });
    if (error) return { success: false, message: error.message };
    return { success: true, message: `Code sent to ${identifier}` };
  },

  async verifyOTP(code) {
    const { data, error } = await supabase.auth.verifyOtp({
      email: this._otpEmail,
      token: code,
      type: 'email',
    });
    if (error) return { success: false, message: error.message };
    // Session is automatically set by onAuthStateChange listener above
    return {
      success: true,
      token: data.session?.access_token,
      user: this.getUser(),
    };
  },

  async socialLogin(provider) {
    // OAuth redirects the browser to the provider's login page.
    // When the user returns, onAuthStateChange fires automatically.
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) return { success: false, message: error.message };
    // The page will redirect, so this code only runs if there's an error
    return { success: true, user: this.getUser() };
  },

  async logout() {
    await supabase.auth.signOut();
    _session = null;
    _user = null;
  },

  initCaptcha() {
    // Supabase has built-in bot protection — no separate captcha needed
    return Promise.resolve({ token: 'supabase_managed' });
  },

  /* ── Nudge compatibility (used by ui.js checkAuthNudge) ── */

  _loadAuth() {
    return {
      isLoggedIn: this.isLoggedIn(),
      nudgeDismissed: !!localStorage.getItem('pocket-nudge-dismissed'),
    };
  },

  _saveAuth() {
    // Supabase manages its own session. Nudge state is stored separately.
  },
};
