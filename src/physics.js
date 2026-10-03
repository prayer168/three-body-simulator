// ================= 物理與世界模型 =================
// 單位：天文單位 AU、地球年 yr、太陽質量 M☉。G = 4π²
const G = 4 * Math.PI * Math.PI;
const R_SUN_AU = 0.00465;          // 太陽半徑（AU）
const R_PLANET_AU = 4.26e-5;       // 行星半徑（地球大小）
const G_EARTH = G * 3.0e-6 / (R_PLANET_AU * R_PLANET_AU); // 地表重力（AU/yr²）
const DISK_DEG = 0.04;             // 視直徑小於此值：看起來像「飛星」

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 主序星近似：光度、半徑、表面溫度
function starProps(m) {
  const L = m < 0.43 ? 0.23 * Math.pow(m, 2.3) : Math.pow(m, 4);
  const R = Math.pow(m, 0.8);
  const Teff = 5778 * Math.pow(L / (R * R), 0.25);
  return { m, L, R, Teff, color: kelvinToRGB(Teff) };
}
function kelvinToRGB(k) {
  const t = k / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.52 * Math.log(t - 10) - 305.04;
  const c = v => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(b)];
}

// ---------- N 體積分器（三恆星 + 測試粒子行星） ----------
class Sim {
  constructor(masses) {
    this.stars = masses.map(starProps);
    this.m = masses.slice();
    this.t = 0;
    this.sp = new Float64Array(9); this.sv = new Float64Array(9);
    this.pp = new Float64Array(3); this.pv = new Float64Array(3);
    this.sa = new Float64Array(9); this.pa = new Float64Array(3);
    this.eps2 = 1e-6;
  }
  clone() {
    const s = new Sim(this.m);
    s.t = this.t; s.sp.set(this.sp); s.sv.set(this.sv); s.pp.set(this.pp); s.pv.set(this.pv);
    return s;
  }
  getState() { return { t: this.t, m: this.m.slice(), sp: Array.from(this.sp), sv: Array.from(this.sv), pp: Array.from(this.pp), pv: Array.from(this.pv) }; }
  setState(o) { this.t = o.t; this.sp.set(o.sp); this.sv.set(o.sv); this.pp.set(o.pp); this.pv.set(o.pv); }
  acc() {
    const sp = this.sp, sa = this.sa, m = this.m, e2 = this.eps2;
    sa.fill(0);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const dx = sp[j * 3] - sp[i * 3], dy = sp[j * 3 + 1] - sp[i * 3 + 1], dz = sp[j * 3 + 2] - sp[i * 3 + 2];
      const r2 = dx * dx + dy * dy + dz * dz + e2, inv = 1 / (r2 * Math.sqrt(r2));
      const fi = G * m[j] * inv, fj = G * m[i] * inv;
      sa[i * 3] += dx * fi; sa[i * 3 + 1] += dy * fi; sa[i * 3 + 2] += dz * fi;
      sa[j * 3] -= dx * fj; sa[j * 3 + 1] -= dy * fj; sa[j * 3 + 2] -= dz * fj;
    }
    const pp = this.pp, pa = this.pa; pa.fill(0);
    for (let i = 0; i < 3; i++) {
      const dx = sp[i * 3] - pp[0], dy = sp[i * 3 + 1] - pp[1], dz = sp[i * 3 + 2] - pp[2];
      const r2 = dx * dx + dy * dy + dz * dz + 1e-8, f = G * m[i] / (r2 * Math.sqrt(r2));
      pa[0] += dx * f; pa[1] += dy * f; pa[2] += dz * f;
    }
  }
  // 自適應步長：取所有配對最短的動力學時間
  dtSuggest() {
    const sp = this.sp, pp = this.pp, m = this.m; let best = 0.02;
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const dx = sp[j * 3] - sp[i * 3], dy = sp[j * 3 + 1] - sp[i * 3 + 1], dz = sp[j * 3 + 2] - sp[i * 3 + 2];
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3;
        best = Math.min(best, 0.012 * Math.sqrt(r * r * r / (G * (m[i] + m[j]))));
      }
      const dx = sp[i * 3] - pp[0], dy = sp[i * 3 + 1] - pp[1], dz = sp[i * 3 + 2] - pp[2];
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3;
      best = Math.min(best, 0.012 * Math.sqrt(r * r * r / (G * m[i])));
    }
    return Math.max(best, 2e-6);
  }
  step(dt) {
    const sv = this.sv, sp = this.sp, sa = this.sa, pv = this.pv, pp = this.pp, pa = this.pa, h = dt * 0.5;
    this.acc();
    for (let k = 0; k < 9; k++) { sv[k] += sa[k] * h; sp[k] += sv[k] * dt; }
    for (let k = 0; k < 3; k++) { pv[k] += pa[k] * h; pp[k] += pv[k] * dt; }
    this.acc();
    for (let k = 0; k < 9; k++) sv[k] += sa[k] * h;
    for (let k = 0; k < 3; k++) pv[k] += pa[k] * h;
    this.t += dt;
  }
  stepTo(target, maxSteps = 200000) {
    let n = 0;
    while (this.t < target - 1e-12 && n < maxSteps) { this.step(Math.min(this.dtSuggest(), target - this.t)); n++; }
    if (this.t < target) this.t = target;
    return n;
  }
  com() {
    let M = 0; const c = [0, 0, 0];
    for (let i = 0; i < 3; i++) { M += this.m[i]; for (let k = 0; k < 3; k++) c[k] += this.m[i] * this.sp[i * 3 + k]; }
    return c.map(v => v / M);
  }
}

// ---------- 預設星系 ----------
function toCOM(sim) {
  let M = 0; const p = [0, 0, 0], v = [0, 0, 0];
  for (let i = 0; i < 3; i++) { M += sim.m[i]; for (let k = 0; k < 3; k++) { p[k] += sim.m[i] * sim.sp[i * 3 + k]; v[k] += sim.m[i] * sim.sv[i * 3 + k]; } }
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { sim.sp[i * 3 + k] -= p[k] / M; sim.sv[i * 3 + k] -= v[k] / M; }
}
function placePlanet(sim, host, rng, rFactor = 1) {
  // 若主星旁有很近的伴星，改成繞雙星（或三星）質心的外側軌道
  const near = [host];
  let Lt = sim.stars[host].L;
  for (let j = 0; j < 3; j++) if (j !== host) {
    const d = Math.hypot(sim.sp[j * 3] - sim.sp[host * 3], sim.sp[j * 3 + 1] - sim.sp[host * 3 + 1], sim.sp[j * 3 + 2] - sim.sp[host * 3 + 2]);
    if (d < Math.sqrt(Lt + sim.stars[j].L) * 0.3) { near.push(j); Lt += sim.stars[j].L; }
  }
  if (near.length > 1) return placeAround(sim, near, rng, rFactor);
  const st = sim.stars[host];
  const r = Math.sqrt(st.L) * rFactor * (0.97 + rng() * 0.06);
  const ang = rng() * Math.PI * 2, tilt = (rng() - 0.5) * 0.12;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const vmag = Math.sqrt(G * sim.m[host] / r);
  sim.pp[0] = sim.sp[host * 3] + r * ux; sim.pp[1] = sim.sp[host * 3 + 1] + r * uy; sim.pp[2] = sim.sp[host * 3 + 2] + r * tilt * ux;
  sim.pv[0] = sim.sv[host * 3] - vmag * uy; sim.pv[1] = sim.sv[host * 3 + 1] + vmag * ux; sim.pv[2] = sim.sv[host * 3 + 2];
}
function placeAround(sim, ids, rng, rFactor = 1) {
  let M = 0, L = 0; const c = [0, 0, 0], cv = [0, 0, 0];
  for (const i of ids) { M += sim.m[i]; L += sim.stars[i].L; for (let k = 0; k < 3; k++) { c[k] += sim.m[i] * sim.sp[i * 3 + k]; cv[k] += sim.m[i] * sim.sv[i * 3 + k]; } }
  for (let k = 0; k < 3; k++) { c[k] /= M; cv[k] /= M; }
  const r = Math.sqrt(L) * rFactor * (0.98 + rng() * 0.04), pa = rng() * 6.28, vp = Math.sqrt(G * M / r);
  sim.pp.set([c[0] + r * Math.cos(pa), c[1] + r * Math.sin(pa), c[2]]);
  sim.pv.set([cv[0] - vp * Math.sin(pa), cv[1] + vp * Math.cos(pa), cv[2]]);
}
// 讓 b 以圓軌道繞 a（或質心 at）運行
function circ(sim, i, cx, cy, cz, cvx, cvy, Mc, r, ang, rng, ecc = 0) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const v = r > 0 ? Math.sqrt(G * (Mc + sim.m[i]) / r) * (1 - ecc) : 0;
  sim.sp[i * 3] = cx + r * ux; sim.sp[i * 3 + 1] = cy + r * uy; sim.sp[i * 3 + 2] = cz + (rng() - 0.5) * r * 0.08;
  sim.sv[i * 3] = cvx - v * uy; sim.sv[i * 3 + 1] = cvy + v * ux; sim.sv[i * 3 + 2] = (rng() - 0.5) * v * 0.04;
}

const PRESETS = {
  chaos: {
    name: '三體世界', tag: '混沌',
    desc: '三顆質量相近的恆星彼此糾纏，行星時而穩定繞行、時而被甩亂。恆紀元與亂紀元交替出現。',
    build(rng) {
      const m = [1.05 + rng() * 0.08, 0.86 + rng() * 0.1, 0.68 + rng() * 0.1];
      const sim = new Sim(m);
      const rB = 7 + rng() * 2.5;
      circ(sim, 0, 0, 0, 0, 0, 0, 0, 0, 0, rng);
      circ(sim, 1, 0, 0, 0, 0, 0, m[0], rB, rng() * 6.28, rng, 0.12 + rng() * 0.1);
      const cx = (m[1] * sim.sp[3]) / (m[0] + m[1]), cy = (m[1] * sim.sp[4]) / (m[0] + m[1]);
      const cvx = (m[1] * sim.sv[3]) / (m[0] + m[1]), cvy = (m[1] * sim.sv[4]) / (m[0] + m[1]);
      circ(sim, 2, cx, cy, 0, cvx, cvy, m[0] + m[1], rB * (2.1 + rng() * 0.6), rng() * 6.28, rng, 0.2 + rng() * 0.15);
      toCOM(sim); placePlanet(sim, 0, rng);
      return sim;
    }
  },
  hier: {
    name: '階層三星', tag: '穩定',
    desc: '一對緊密雙星加上遠方第三顆恆星。行星繞著雙星外側運行，恆紀元可以維持很久。',
    build(rng) {
      const m = [0.92, 0.7, 0.5];
      const sim = new Sim(m);
      const a = 0.14, M = m[0] + m[1], ang = rng() * 6.28;
      const v = Math.sqrt(G * M / a);
      const r0 = a * m[1] / M, r1 = a * m[0] / M;
      sim.sp.set([r0 * Math.cos(ang), r0 * Math.sin(ang), 0, -r1 * Math.cos(ang), -r1 * Math.sin(ang), 0], 0);
      const v0 = v * m[1] / M, v1 = v * m[0] / M;
      sim.sv.set([-v0 * Math.sin(ang), v0 * Math.cos(ang), 0, v1 * Math.sin(ang), -v1 * Math.cos(ang), 0], 0);
      circ(sim, 2, 0, 0, 0, 0, 0, M, 42, rng() * 6.28, rng, 0.05);
      toCOM(sim); placeAround(sim, [0, 1], rng);
      return sim;
    }
  },
  solar: {
    name: '太陽系對照', tag: '對照組',
    desc: '只有一顆明亮主星，另外兩顆暗淡紅矮星遠在數百 AU 外。這就是地球的處境：一顆太陽，穩定的四季。',
    build(rng) {
      const m = [1.0, 0.3, 0.2];
      const sim = new Sim(m);
      circ(sim, 1, 0, 0, 0, 0, 0, 1, 320, rng() * 6.28, rng);
      circ(sim, 2, 0, 0, 0, 0, 0, 1.3, 680, rng() * 6.28, rng);
      toCOM(sim); placePlanet(sim, 0, rng);
      return sim;
    }
  },
  eight: {
    name: '八字形編舞', tag: '特解',
    desc: '三顆等質量恆星沿同一條「8」字軌道互相追逐，是三體問題少數的週期解（Chenciner–Montgomery, 2000）。行星在外圍繞行。',
    build(rng) {
      const m = [1.3, 1.3, 1.3], L = 0.5;
      const sim = new Sim(m);
      const vs = Math.sqrt(G * m[0] / L);
      const x1 = [0.97000436, -0.24308753], v3 = [-0.93240737, -0.86473146];
      sim.sp.set([x1[0] * L, x1[1] * L, 0, -x1[0] * L, -x1[1] * L, 0, 0, 0, 0]);
      sim.sv.set([-v3[0] / 2 * vs, -v3[1] / 2 * vs, 0, -v3[0] / 2 * vs, -v3[1] / 2 * vs, 0, v3[0] * vs, v3[1] * vs, 0]);
      placeAround(sim, [0, 1, 2], rng, 1.02);
      return sim;
    }
  },
  random: {
    name: '隨機新星系', tag: '隨機',
    desc: '隨機產生三顆恆星的質量、距離與速度。每一個種子碼都是一個新宇宙。',
    build(rng) {
      const m = [0.6 + rng() * 0.8, 0.5 + rng() * 0.7, 0.4 + rng() * 0.7];
      const sim = new Sim(m);
      const rB = 4 + rng() * 10;
      circ(sim, 0, 0, 0, 0, 0, 0, 0, 0, 0, rng);
      circ(sim, 1, 0, 0, 0, 0, 0, m[0], rB, rng() * 6.28, rng, rng() * 0.4);
      circ(sim, 2, 0, 0, 0, 0, 0, m[0] + m[1], rB * (1.6 + rng() * 2.5), rng() * 6.28, rng, rng() * 0.45);
      toCOM(sim);
      let host = 0; for (let i = 1; i < 3; i++) if (sim.stars[i].L > sim.stars[host].L) host = i;
      placePlanet(sim, host, rng);
      return sim;
    }
  }
};

// ---------- 文明時代 ----------
const AGES = [
  { n: '原始時代', y: 0, d: '部落在河谷聚居，用火取暖，觀察太陽卻無法預測它。' },
  { n: '農耕時代', y: 8, d: '開墾農田、建起巨擺，試圖用規律對抗無常的太陽。' },
  { n: '青銅時代', y: 20, d: '城牆與祭壇出現，曆法學者開始記錄三顆太陽的軌跡。' },
  { n: '鐵器時代', y: 34, d: '王朝興起，人力計算陣列嘗試推算恆紀元何時到來。' },
  { n: '蒸汽時代', y: 52, d: '工廠煙囪林立，蒸汽機讓脫水與浸泡變得更有效率。' },
  { n: '電氣時代', y: 70, d: '電燈照亮夜晚，電報把天象警報傳遍全球。' },
  { n: '原子時代', y: 92, d: '原子能點亮城市，科學家用電子計算機模擬三體運動。' },
  { n: '資訊時代', y: 115, d: '全球網路建成，證明三體問題沒有通用解，決定改為飛向群星。' },
  { n: '太空時代', y: 140, d: '發射場日夜不停，星際艦隊正在軌道上組裝。' }
];
const CIV_END = 170;

const EVENT_DEFS = {
  sanri: { n: '三日凌空', c: 'red', msg: '三日凌空：三顆太陽同時以日面出現在天空，地表急速升溫。' },
  shuangri: { n: '雙日凌空', c: 'yellow', msg: '雙日凌空：兩顆太陽同時出現在天空。' },
  lianzhu: { n: '三日連珠', c: 'red', msg: '三日連珠：三顆太陽排成一直線，潮汐力疊加。' },
  feixingStill: { n: '飛星不動', c: 'blue', msg: '飛星不動：遠方的飛星在天空中幾乎靜止，它正朝行星直線接近或遠離。' },
  twoFly: { n: '兩顆飛星', c: 'blue', msg: '兩顆飛星：天空只剩一顆太陽，另外兩顆遠成亮星，可能迎來較長恆紀元。' },
  threeFly: { n: '三顆飛星', c: 'red', msg: '三顆飛星：三顆太陽都遠成亮點，嚴寒將至。' },
  night: { n: '長夜', c: 'blue', msg: '長夜：行星遠離所有太陽，天空一片黑暗。' }
};

// ---------- 世界：氣候、紀元、事件、文明 ----------
class World {
  constructor(presetKey, seed) {
    this.presetKey = presetKey; this.seed = seed;
    this.rng = mulberry32(seed * 9301 + 49297);
    this.sim = PRESETS[presetKey].build(mulberry32(seed));
    this.T = 15; this.era = 'stable'; this.eraSince = 0; this.eraTimer = 0;
    this.flags = {}; this.flagCool = {};
    this.events = []; this.history = [];
    this.civCounter = 0; this.civ = null; this.lastCivEnd = -100; this.recoverTimer = 0;
    this.lostTimer = 0; this.cold = 0;
    this.skyTrail = [[], [], []]; this.skyT = 0;
    this.info = null;
    this.compute();
    this.T = this.info.Teq;
    this.newCiv();
  }
  log(t, key, text, color) { this.events.push({ t, key, text, color }); this.onEvent && this.onEvent(this.events[this.events.length - 1]); }

  compute() {
    const s = this.sim, pp = s.pp, info = { stars: [], S: 0, tide: 0 };
    let host = 0, best = -1;
    for (let i = 0; i < 3; i++) {
      const dx = s.sp[i * 3] - pp[0], dy = s.sp[i * 3 + 1] - pp[1], dz = s.sp[i * 3 + 2] - pp[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const st = s.stars[i], flux = st.L / (d * d);
      const ang = 2 * Math.atan(st.R * R_SUN_AU / d) * 180 / Math.PI;
      const a = G * s.m[i] / (d * d);
      // 視角速度
      const rvx = s.sv[i * 3] - s.pv[0], rvy = s.sv[i * 3 + 1] - s.pv[1], rvz = s.sv[i * 3 + 2] - s.pv[2];
      const ux = dx / d, uy = dy / d, uz = dz / d, vr = rvx * ux + rvy * uy + rvz * uz;
      const vt = Math.sqrt(Math.max(0, rvx * rvx + rvy * rvy + rvz * rvz - vr * vr));
      info.stars.push({ d, flux, ang, a, u: [ux, uy, uz], omega: vt / d, disk: ang >= DISK_DEG });
      info.S += flux; info.tide += 2 * G * s.m[i] * R_PLANET_AU / (d * d * d);
      if (a > best) { best = a; host = i; }
    }
    info.tide /= G_EARTH;
    info.host = host;
    // 相對主星的軌道要素
    const h3 = host * 3, M = s.m[host];
    const rx = pp[0] - s.sp[h3], ry = pp[1] - s.sp[h3 + 1], rz = pp[2] - s.sp[h3 + 2];
    const vx = s.pv[0] - s.sv[h3], vy = s.pv[1] - s.sv[h3 + 1], vz = s.pv[2] - s.sv[h3 + 2];
    const r = Math.sqrt(rx * rx + ry * ry + rz * rz), v2 = vx * vx + vy * vy + vz * vz;
    const mu = G * M, E = v2 / 2 - mu / r;
    const hx = ry * vz - rz * vy, hy = rz * vx - rx * vz, hz = rx * vy - ry * vx, h2 = hx * hx + hy * hy + hz * hz;
    info.bound = E < 0; info.a = E < 0 ? -mu / (2 * E) : Infinity;
    info.e = Math.sqrt(Math.max(0, 1 + 2 * E * h2 / (mu * mu)));
    info.period = info.bound ? Math.pow(info.a, 1.5) / Math.sqrt(M) : Infinity;
    // 擾動：其他恆星的潮汐加速度 / 主星引力
    let px = 0, py = 0, pz = 0, minSep = Infinity;
    for (let j = 0; j < 3; j++) if (j !== host) {
      const j3 = j * 3;
      const dx1 = s.sp[j3] - pp[0], dy1 = s.sp[j3 + 1] - pp[1], dz1 = s.sp[j3 + 2] - pp[2];
      const dx2 = s.sp[j3] - s.sp[h3], dy2 = s.sp[j3 + 1] - s.sp[h3 + 1], dz2 = s.sp[j3 + 2] - s.sp[h3 + 2];
      const d1 = Math.hypot(dx1, dy1, dz1), d2 = Math.hypot(dx2, dy2, dz2);
      minSep = Math.min(minSep, d2);
      const f1 = G * s.m[j] / (d1 * d1 * d1), f2 = G * s.m[j] / (d2 * d2 * d2);
      px += dx1 * f1 - dx2 * f2; py += dy1 * f1 - dy2 * f2; pz += dz1 * f1 - dz2 * f2;
    }
    info.pert = Math.hypot(px, py, pz) / (mu / (r * r));
    // 多星主系統：與主星距離很近的伴星，視為同一個中心（環雙星／環三星軌道）
    info.circumbinary = false;
    const grp = [host];
    for (let j = 0; j < 3; j++) if (j !== host) {
      const d = Math.hypot(s.sp[j * 3] - s.sp[h3], s.sp[j * 3 + 1] - s.sp[h3 + 1], s.sp[j * 3 + 2] - s.sp[h3 + 2]);
      if (d < r * 0.6) grp.push(j);
    }
    if (grp.length > 1) {
      info.circumbinary = true; info.group = grp;
      let Mb = 0; const c = [0, 0, 0], cv = [0, 0, 0];
      for (const i of grp) { Mb += s.m[i]; for (let k = 0; k < 3; k++) { c[k] += s.m[i] * s.sp[i * 3 + k]; cv[k] += s.m[i] * s.sv[i * 3 + k]; } }
      for (let k = 0; k < 3; k++) { c[k] /= Mb; cv[k] /= Mb; }
      const ex = pp[0] - c[0], ey = pp[1] - c[1], ez = pp[2] - c[2], wx = s.pv[0] - cv[0], wy = s.pv[1] - cv[1], wz = s.pv[2] - cv[2];
      const r2 = Math.hypot(ex, ey, ez), E2 = (wx * wx + wy * wy + wz * wz) / 2 - G * Mb / r2;
      const hh = (ey * wz - ez * wy) ** 2 + (ez * wx - ex * wz) ** 2 + (ex * wy - ey * wx) ** 2;
      info.bound = E2 < 0; info.a = E2 < 0 ? -G * Mb / (2 * E2) : Infinity;
      info.e = Math.sqrt(Math.max(0, 1 + 2 * E2 * hh / (G * Mb) ** 2));
      info.period = info.bound ? Math.pow(info.a, 1.5) / Math.sqrt(Mb) : Infinity;
      // 擾動只計群組外的恆星
      let qx = 0, qy = 0, qz = 0;
      for (let j = 0; j < 3; j++) if (!grp.includes(j)) {
        const j3 = j * 3;
        const dx1 = s.sp[j3] - pp[0], dy1 = s.sp[j3 + 1] - pp[1], dz1 = s.sp[j3 + 2] - pp[2];
        const dx2 = s.sp[j3] - c[0], dy2 = s.sp[j3 + 1] - c[1], dz2 = s.sp[j3 + 2] - c[2];
        const d1 = Math.hypot(dx1, dy1, dz1), d2 = Math.hypot(dx2, dy2, dz2);
        const f1 = G * s.m[j] / d1 ** 3, f2 = G * s.m[j] / d2 ** 3;
        qx += dx1 * f1 - dx2 * f2; qy += dy1 * f1 - dy2 * f2; qz += dz1 * f1 - dz2 * f2;
      }
      info.pert = Math.max(0.004, Math.hypot(qx, qy, qz) / (G * Mb / (r2 * r2)));
    }
    info.Teq = Math.max(-250, 288 * Math.pow(info.S + 1e-9, 0.25) - 273.15);
    const com = s.com();
    info.distCOM = Math.hypot(pp[0] - com[0], pp[1] - com[1], pp[2] - com[2]);
    info.minStarDist = Math.min(...info.stars.map(x => x.d));
    info.r = r;
    // 天象
    const st = info.stars;
    const disks = st.filter(x => x.disk).length, fly = 3 - disks;
    let collinear = true;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const a = st[i].u, b = st[j].u;
      const cx = a[1] * b[2] - a[2] * b[1], cy = a[2] * b[0] - a[0] * b[2], cz = a[0] * b[1] - a[1] * b[0];
      if (Math.hypot(cx, cy, cz) > 0.035) collinear = false;
    }
    info.disks = disks; info.fly = fly; info.collinear = collinear;
    info.flags = {
      sanri: st.filter(x => x.ang >= 0.12).length === 3,
      shuangri: st.filter(x => x.ang >= 0.12).length === 2,
      lianzhu: collinear && st.every(x => x.ang > 0.03),
      feixingStill: st.some(x => !x.disk && x.omega < 0.02 && x.flux > 1e-4),
      twoFly: fly === 2 && info.S > 0.05,
      threeFly: fly === 3 && info.S > 0.05,
      night: info.S <= 0.05
    };
    this.info = info;
    return info;
  }

  newCiv() {
    this.civCounter++;
    this.civ = { id: this.civCounter, startT: this.sim.t, years: 0, age: 0, dehyd: false, dehydCount: 0, badT: 0, goodT: 0, frozen: 0, seed: Math.floor(this.rng() * 1e9) };
    this.log(this.sim.t, 'civStart', `第 ${this.civ.id} 號文明誕生於河谷之中。`, 'green');
  }
  endCiv(reason, kind) {
    const c = this.civ; if (!c) return;
    this.history.push({ id: c.id, startT: c.startT, endT: this.sim.t, years: c.years, age: c.age, reason, kind, dehyd: c.dehydCount });
    this.log(this.sim.t, kind === 'win' ? 'civWin' : 'civEnd', kind === 'win'
      ? `第 ${c.id} 號文明的星際艦隊啟航，飛出三體星系。`
      : `第 ${c.id} 號文明毀滅：${reason}。文明發展到${AGES[c.age].n}，存續 ${c.years.toFixed(1)} 文明年。`, kind === 'win' ? 'green' : 'red');
    this.ruins = { age: c.age, kind, seed: c.seed, burned: kind === 'heat' };
    this.civ = null; this.lastCivEnd = this.sim.t; this.recoverTimer = 0;
  }

  update(dt) {
    const info = this.compute(), t = this.sim.t;
    // 溫度：熱慣性追趕平衡溫度（海洋的熱容量）
    const tau = info.Teq < this.T ? 0.16 : 0.1;
    this.T += (info.Teq - this.T) * (1 - Math.exp(-dt / tau));
    // 紀元判定（有遲滯，避免來回閃爍）
    const stableNow = info.bound && info.e < 0.35 && info.pert < 0.06 && info.Teq > -45 && info.Teq < 75;
    const want = stableNow ? 'stable' : 'chaos';
    if (want !== this.era) {
      this.eraTimer += dt;
      if (this.eraTimer > (want === 'stable' ? 0.35 : 0.12)) {
        this.era = want; this.eraSince = t; this.eraTimer = 0;
        this.log(t, want === 'stable' ? 'eraStable' : 'eraChaos', want === 'stable'
          ? '恆紀元開始：行星被' + this.hostName() + '穩定捕獲，日出日落恢復規律。'
          : '亂紀元開始：太陽的運行失去規律。', want === 'stable' ? 'green' : 'red');
      }
    } else this.eraTimer = 0;
    // 天象事件
    for (const k in info.flags) {
      const on = info.flags[k];
      const cool = (k === "feixingStill" || k === "shuangri" || k === "lianzhu") ? 3 : 0.8;
      if (on && !this.flags[k] && (this.flagCool[k] === undefined || t - this.flagCool[k] > cool)) {
        const def = EVENT_DEFS[k];
        this.log(t, k, def.msg, def.c);
        this.flagCool[k] = t;
      }
      this.flags[k] = on;
    }
    // 天空軌跡取樣
    this.skyT += dt;
    if (this.skyT > 0.02) {
      this.skyT = 0;
      for (let i = 0; i < 3; i++) {
        const u = info.stars[i].u, tr = this.skyTrail[i];
        tr.push([Math.atan2(u[1], u[0]), Math.asin(Math.max(-1, Math.min(1, u[2])))]);
        if (tr.length > 260) tr.shift();
      }
    }
    // 行星失落：被甩出或撞進恆星
    if (info.minStarDist < 0.035) { this.catastrophe('行星墜入' + this.starName(info.stars.findIndex(x => x.d === info.minStarDist)), 'engulf'); return; }
    if (!info.bound && info.distCOM > 140) { this.lostTimer += dt; } else this.lostTimer = 0;
    if (this.lostTimer > 3) { this.catastrophe('行星被拋入星際深空', 'eject'); return; }
    this.updateCiv(dt, info);
  }
  catastrophe(reason, kind) {
    if (this.civ) this.endCiv(reason, kind);
    else this.log(this.sim.t, 'lost', reason + '。', 'red');
    // 略過地質時間：行星重新被一顆恆星捕獲
    let host = Math.floor(this.rng() * 3);
    if (this.rng() < 0.6) { let b = 0; for (let i = 0; i < 3; i++) if (this.sim.stars[i].L > b) { b = this.sim.stars[i].L; host = i; } }
    placePlanet(this.sim, host, this.rng);
    this.T = 15; this.lostTimer = 0; this.lastCivEnd = this.sim.t - 4;
    this.log(this.sim.t, 'reset', `略過漫長的地質時間：行星重新被${this.starName(host)}捕獲。`, 'blue');
  }
  starName(i) { return ['太陽甲', '太陽乙', '太陽丙'][i] || '恆星'; }
  hostName() { return this.starName(this.info.host); }

  updateCiv(dt, info) {
    const T = this.T, t = this.sim.t;
    if (!this.civ) {
      const ok = this.era === 'stable' && T > -10 && T < 40;
      this.recoverTimer = ok ? this.recoverTimer + dt : Math.max(0, this.recoverTimer - dt * 0.5);
      if (this.recoverTimer > 2.5 && t - this.lastCivEnd > 5) { this.newCiv(); this.ruins = null; }
      else if (this.era === 'chaos' && t - this.lastCivEnd > 70) this.catastrophe('亂紀元持續了數十年', 'skip');
      return;
    }
    const c = this.civ;
    // 毀滅條件
    if (T > 140) { this.endCiv(this.flags.sanri ? '三日凌空，大地被烈日焚毀' : '烈日焚毀了地表', 'heat'); return; }
    if (this.flags.lianzhu && info.tide > 1e-7 && info.disks === 3) { this.endCiv('三日連珠，潮汐力疊加引發巨型地震與海嘯', 'tide'); return; }
    if (c.dehyd) { c.dehydTime = (c.dehydTime || 0) + dt; if (c.dehydTime > 90) { this.endCiv('亂紀元持續太久，脫水者無法復原', 'cold'); return; } }
    if (c.dehyd && T < -60) { c.frozen += dt; if (c.frozen > 40) { this.endCiv('長夜過久，脫水者全數凍毀', 'cold'); return; } } else c.frozen = 0;
    if (!c.dehyd && T < -120) { this.endCiv('嚴寒驟降，來不及脫水', 'cold'); return; }
    // 脫水與浸泡
    const harsh = T < -35 || T > 65;
    if (!c.dehyd) {
      c.badT = harsh ? c.badT + dt : 0;
      if (c.badT > 0.06) { c.dehyd = true; c.dehydCount++; c.goodT = 0; this.log(t, 'dehyd', `第 ${c.id} 號文明全體脫水，等待恆紀元。`, 'yellow'); }
    } else {
      const good = T > -15 && T < 45 && this.era === 'stable';
      c.goodT = good ? c.goodT + dt : 0;
      if (c.goodT > 0.25) { c.dehyd = false; c.badT = 0; c.dehydTime = 0; this.log(t, 'rehyd', `浸泡復活：第 ${c.id} 號文明重新甦醒。`, 'green'); }
    }
    // 發展
    if (!c.dehyd) {
      let rate = 0;
      if (T > -10 && T < 40) rate = 1; else if (T > -30 && T < 58) rate = 0.4;
      if (this.era === 'chaos') rate *= 0.5;
      c.years += dt * rate;
      let a = 0; for (let i = 0; i < AGES.length; i++) if (c.years >= AGES[i].y) a = i;
      if (a > c.age) { c.age = a; this.log(t, 'age', `第 ${c.id} 號文明進入${AGES[a].n}。${AGES[a].d}`, 'yellow'); }
      if (c.years >= CIV_END) this.endCiv('飛出三體星系', 'win');
    }
  }

  advance(simDt, twin) {
    let remain = simDt; const chunk = 0.004;
    while (remain > 1e-9) {
      const h = Math.min(chunk, remain);
      this.sim.stepTo(this.sim.t + h);
      if (twin) twin.stepTo(this.sim.t);
      this.update(h);
      if (this.onStep) this.onStep();
      remain -= h;
    }
  }
  snapshot() {
    return JSON.stringify({ sim: this.sim.getState(), T: this.T, era: this.era, eraSince: this.eraSince, flags: this.flags, flagCool: this.flagCool, civ: this.civ, civCounter: this.civCounter, history: this.history, lastCivEnd: this.lastCivEnd, recoverTimer: this.recoverTimer, ruins: this.ruins || null, nEvents: this.events.length });
  }
  restore(str) {
    const o = JSON.parse(str);
    this.sim.setState(o.sim); this.T = o.T; this.era = o.era; this.eraSince = o.eraSince; this.flags = o.flags; this.flagCool = o.flagCool;
    this.civ = o.civ; this.civCounter = o.civCounter; this.history = o.history; this.lastCivEnd = o.lastCivEnd; this.recoverTimer = o.recoverTimer; this.ruins = o.ruins;
    this.events.length = o.nEvents; this.skyTrail = [[], [], []]; this.eraTimer = 0; this.lostTimer = 0;
    this.compute();
  }
}

if (typeof module !== 'undefined') module.exports = { Sim, World, PRESETS, AGES, CIV_END, EVENT_DEFS, G, mulberry32, starProps };
