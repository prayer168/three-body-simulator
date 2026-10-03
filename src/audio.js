// ================= 太空環境音（Web Audio 即時合成） =================
class Sound {
  constructor() { this.ctx = null; this.on = false; this.era = 'stable'; }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(c.destination);
    // 回聲空間
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2);
    const wet = c.createGain(); wet.gain.value = 0.55; this.verb.connect(wet); wet.connect(this.master);
    this.dry = c.createGain(); this.dry.gain.value = 0.8; this.dry.connect(this.master);
    // 低頻嗡鳴
    this.drone = c.createGain(); this.drone.gain.value = 0.16; this.drone.connect(this.dry);
    [55, 55.4, 82.4].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5; o.connect(g); g.connect(this.drone); o.start();
    });
    // 和弦墊音
    this.padF = c.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 700; this.padF.Q.value = 0.7;
    this.padG = c.createGain(); this.padG.gain.value = 0.07; this.padF.connect(this.padG); this.padG.connect(this.dry); this.padG.connect(this.verb);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(this.padF.frequency); lfo.start();
    this.voices = [];
    for (let i = 0; i < 5; i++) {
      const g = c.createGain(); g.gain.value = 0.2; g.connect(this.padF);
      const pair = [0, 1].map(k => { const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = k ? 7 : -7; o.connect(g); o.start(); return o; });
      this.voices.push({ g, pair });
    }
    // 風聲（棕噪音）
    const nb = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), d = nb.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const ns = c.createBufferSource(); ns.buffer = nb; ns.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 420; this.windF.Q.value = 0.6;
    this.windG = c.createGain(); this.windG.gain.value = 0.0;
    ns.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.dry); ns.start();
    const wl = c.createOscillator(); wl.frequency.value = 0.11; const wlg = c.createGain(); wlg.gain.value = 260; wl.connect(wlg); wlg.connect(this.windF.frequency); wl.start();
    this.setEra(this.era, true);
  }
  impulse(sec) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return b;
  }
  setOn(v) {
    this.on = v; if (v) this.init(); if (!this.ctx) return;
    if (v && this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.4);
  }
  hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  setEra(era, force) {
    if (era === this.era && !force) return; this.era = era; if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // 恆紀元：A 大調九和弦；亂紀元：不協和的增四度與小二度
    const chord = era === 'stable' ? [45, 52, 59, 61, 64] : [45, 51, 58, 63, 64];
    this.voices.forEach((v, i) => v.pair.forEach(o => o.frequency.setTargetAtTime(this.hz(chord[i]), t, 1.6)));
    this.padF.frequency.setTargetAtTime(era === 'stable' ? 650 : 1250, t, 2);
    this.windG.gain.setTargetAtTime(era === 'stable' ? 0.0 : 0.22, t, 2);
    this.drone.gain.setTargetAtTime(era === 'stable' ? 0.14 : 0.24, t, 2);
  }
  setCold(k) { if (this.ctx && this.era === 'stable') this.windG.gain.setTargetAtTime(0.25 * k, this.ctx.currentTime, 2); }
  bell(midi, when = 0, vol = 0.18, len = 3.2) {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime + when, f = this.hz(midi);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 2.41;
    mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + len);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(this.dry); g.connect(this.verb);
    car.start(t); mod.start(t); car.stop(t + len + 0.1); mod.stop(t + len + 0.1);
  }
  boom() {
    if (!this.ctx || !this.on) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(24, t + 2.5);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    o.connect(g); g.connect(this.dry); g.connect(this.verb); o.start(t); o.stop(t + 3.1);
  }
  alarm() { [81, 76, 81, 76].forEach((m, i) => this.bell(m, i * 0.22, 0.09, 1.2)); }
  event(e) {
    if (!this.on) return;
    switch (e.key) {
      case 'age': [69, 73, 76, 81].forEach((m, i) => this.bell(m, i * 0.16, 0.12)); break;
      case 'civStart': [64, 69, 71].forEach((m, i) => this.bell(m, i * 0.3, 0.1)); break;
      case 'civWin': [69, 73, 76, 81, 85, 88].forEach((m, i) => this.bell(m, i * 0.14, 0.13, 4)); break;
      case 'civEnd': case 'lost': this.boom(); this.bell(45, 0.4, 0.15, 5); break;
      case 'sanri': case 'lianzhu': this.alarm(); break;
      case 'eraChaos': this.bell(58, 0, 0.12, 4); this.bell(64, 0.05, 0.1, 4); break;
      case 'eraStable': this.bell(76, 0, 0.1); this.bell(81, 0.2, 0.08); break;
      case 'dehyd': this.bell(52, 0, 0.1, 2.5); break;
      case 'rehyd': this.bell(76, 0, 0.1, 2.5); break;
      default: this.bell(88, 0, 0.05, 1.5);
    }
  }
}
