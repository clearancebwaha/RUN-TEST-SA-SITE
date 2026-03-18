/* ============================================================
   POCKET APP — Haptic Feedback
   Vibration patterns — gracefully degrades on unsupported devices
   ============================================================ */

export function haptic(intensity = 'light') {
  if (!navigator.vibrate) return;
  try {
    switch (intensity) {
      case 'light': navigator.vibrate(10); break;
      case 'medium': navigator.vibrate(25); break;
      case 'heavy': navigator.vibrate([15, 30, 15]); break;
      case 'error': navigator.vibrate([40, 20, 40]); break;
    }
  } catch { }
}
