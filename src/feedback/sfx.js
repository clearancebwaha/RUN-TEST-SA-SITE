/* ============================================================
   POCKET APP — Sound Effects (Web Audio API)
   Synthesized SFX — no external audio files needed
   ============================================================ */

export const SFX = {
  ctx: null,
  _init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { }
  },
  play(name) {
    this._init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      switch (name) {
        case 'pop': {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(600, t);
          o.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
          o.frequency.exponentialRampToValueAtTime(800, t + 0.15);
          g.gain.setValueAtTime(0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          o.connect(g).connect(this.ctx.destination);
          o.start(t); o.stop(t + 0.2);
          break;
        }
        case 'chaching': {
          [0, 0.08, 0.16].forEach((d, i) => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime([1200, 1600, 2000][i], t + d);
            g.gain.setValueAtTime(0.12, t + d);
            g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.15);
            o.connect(g).connect(this.ctx.destination);
            o.start(t + d); o.stop(t + d + 0.15);
          });
          break;
        }
        case 'error': {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(150, t);
          o.frequency.linearRampToValueAtTime(80, t + 0.25);
          g.gain.setValueAtTime(0.08, t);
          g.gain.linearRampToValueAtTime(0, t + 0.3);
          o.connect(g).connect(this.ctx.destination);
          o.start(t); o.stop(t + 0.3);
          break;
        }
        case 'coin': {
          [0, 0.06].forEach((d, i) => {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime([1400, 1800][i], t + d);
            g.gain.setValueAtTime(0.1, t + d);
            g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.12);
            o.connect(g).connect(this.ctx.destination);
            o.start(t + d); o.stop(t + d + 0.12);
          });
          break;
        }
        case 'bridge': {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(300, t);
          o.frequency.linearRampToValueAtTime(500, t + 0.3);
          g.gain.setValueAtTime(0.1, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          o.connect(g).connect(this.ctx.destination);
          o.start(t); o.stop(t + 0.35);
          break;
        }
      }
    } catch { }
  }
};
