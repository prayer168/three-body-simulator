// ================= 主程式：狀態、迴圈、介面 =================
(function () {
  const $ = id => document.getElementById(id);
  const isMobile = () => innerWidth <= 860;
  const QUALITY = (Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4) ? 1 : 2;

  const CONCEPTS = {
    era: { k: '紀元', t: '恆紀元與亂紀元', p: '行星穩定繞著一顆太陽轉時，距離幾乎不變，日照和溫度也就穩定，這是恆紀元。當另一顆恆星靠近，它的引力把行星的軌道拉歪，距離忽遠忽近，溫度大起大落，這是亂紀元。左上角的「擾動」就是其他恆星的拉力占主星引力的比例。', q: '地球為什麼沒有亂紀元？太陽系少了什麼？' },
    stable: { k: '恆紀元', t: '穩定的圓軌道', p: '行星被一顆太陽「抓住」，沿著接近圓形的軌道運行，離心率接近 0。這時一年長度固定、季節規律，文明可以安心發展。', q: '如果軌道變得很扁（離心率變大），一年中的溫度會怎樣變化？' },
    chaos: { k: '亂紀元', t: '引力擾動', p: '另一顆恆星經過時，它對行星和主星的拉力不一樣大，這個差就是「擾動」。擾動超過幾個百分比，軌道就開始變形，行星甚至會被另一顆恆星搶走。', q: '找找看：亂紀元開始前，太陽乙或太陽丙離行星多遠？' },
    flux: { k: '日照', t: '距離平方反比', p: '日照強度和距離的平方成反比：距離變 2 倍，日照只剩 1/4。溫度大約跟日照的四次方根成正比，所以日照少一半，溫度只降大約 16%（以絕對溫度計算）。黃色三角形是平衡溫度，白線是目前溫度。', q: '白線為什麼總是慢一步才追上黃色三角形？（提示：海洋需要時間加熱）' },
    thermal: { k: '熱慣性', t: '溫度會慢慢追上去', p: '海洋和大地吸熱、散熱都需要時間，所以太陽忽然變近時，溫度不會瞬間飆高。模擬中目前溫度會以指數方式追趕平衡溫度，這就是為什麼短暫的雙日凌空不一定致命。', q: '沙灘和海水，哪個在中午比較燙？為什麼？' },
    hz: { k: '宜居帶', t: '液態水的距離', p: '每顆太陽周圍都有一圈綠色環帶，行星在這個範圍裡，表面溫度剛好能讓水保持液態。越亮的恆星，宜居帶離得越遠。', q: '三顆太陽的宜居帶重疊時，行星會更適合居住嗎？' },
    fly: { k: '飛星', t: '太遠的太陽變成星星', p: '恆星離得很遠時，它在天空中看起來只是一個亮點，原著稱為「飛星」。視直徑大於 0.04° 我們就當作看得到日面的「太陽」，否則就是飛星。兩顆飛星表示行星只剩一顆太陽照耀，常是恆紀元的徵兆。', q: '地球上看得到其他恆星的日面嗎？為什麼？' },
    sanri: { k: '天象', t: '三日凌空', p: '三顆太陽同時以日面出現在天空。日照疊加，溫度急速上升；如果溫度超過 140°C，地表文明會被焚毀。', q: '三顆太陽一起照，日照是一顆的幾倍？溫度也會變成三倍嗎？' },
    lianzhu: { k: '天象', t: '三日連珠', p: '三顆太陽和行星排成一直線，它們的潮汐力（對行星近側、遠側拉力的差）會疊加。三顆都靠得夠近時，會引發巨大的地震與海嘯。', q: '地球上的大潮發生在太陽、月亮、地球排成一線時，這和三日連珠有什麼相似？' },
    night: { k: '天象', t: '長夜', p: '行星離所有太陽都很遠，總日照不到地球的 5%，天空一片漆黑，溫度可能降到零下一百多度。', q: '如果沒有陽光，生物還能靠什麼能量活下去？' },
    dehyd: { k: '原著設定', t: '脫水與浸泡', p: '在《三體》小說裡，三體人遇到亂紀元會把身體脫水成乾纖維保存起來，等恆紀元到來再泡水復活。模擬中溫度超出 -35～65°C 時文明就會脫水，發展暫停。', q: '地球上有沒有生物也會「脫水休眠」？（提示：水熊蟲）' },
    sky: { k: '觀測', t: '全天圖怎麼看', p: '這張圖把整個天空攤平：橫軸是方向（經度），縱軸是高低（緯度）。恆紀元時，主太陽沿著一條規律的路徑繞圈；亂紀元時，三顆太陽的路徑互相交纏、毫無規律。', q: '在全天圖上，飛星的路徑和太陽有什麼不同？' },
    chron: { k: '編年史', t: '一次又一次的輪迴', p: '每個文明從原始時代開始，走過農耕、蒸汽、電氣直到太空時代。發展到第 170 文明年，就能建造星艦飛出三體星系。大多數文明會先毀於烈日、嚴寒或潮汐。', q: '哪一種毀滅原因最常見？和這個星系的哪個特性有關？' },
    chaosTheory: { k: '混沌', t: '差之毫釐，失之千里', p: '三體問題沒有通用的公式解，只能一步一步計算。更麻煩的是它是混沌系統：起始位置差十億分之一，誤差也會指數放大，幾十年後就完全不同。這就是三體人無法預測太陽的原因。', q: '天氣預報為什麼只能準確預報一週左右？' },
    pendulum: { k: '原著場景', t: '巨擺', p: '小說的遊戲裡，伏羲時代的人建造巨擺，想催眠反覆無常的太陽神。真實的單擺週期只和擺長有關：T = 2π√(L/g)。這座擺長約 40 公尺，擺一個來回約 12.7 秒，和擺錘多重無關。', q: '如果把擺長變成 4 倍，週期會變成幾倍？' },
    eight: { k: '特解', t: '八字形編舞', p: '2000 年數學家找到三顆等質量恆星沿同一條「8」字軌道追逐的週期解。它很漂亮，但也很脆弱，只要一點點擾動就會瓦解。', q: '為什麼現實宇宙中很難找到這種八字形三星？' }
  };

  // ---------- 狀態 ----------
  const S = {
    world: null, presetKey: 'chaos', seed: 1, playing: true, speed: 1.5, view: 'space',
    teach: false, twin: null, twinDelta: 1e-6, twinStart: 0, div: [], divSplit: null,
    snaps: [], snapEvery: 0.25, skyTr: [[], [], []], clock: 0.6, sunLocal: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    perfMs: 0, costPerYr: 0.002, limited: false, uiT: 0, conceptT: 0, mtab: 'cEra', toastN: 0, lastEventSeen: 0
  };
  const sound = new Sound();

  // ---------- 3D ----------
  const canvas = $('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY > 1 ? 2 : 1.5));
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const space = new SpaceView();
  const city = new CityView(QUALITY);
  const spaceCam = new OrbitCam(canvas), cityCam = new OrbitCam(canvas);
  cityCam.enabled = false;
  cityCam.minD = 16; cityCam.maxD = 700; cityCam.phiMin = 0.12; cityCam.phiMax = 1.53;
  cityCam.theta = cityCam.tTheta = 0.7; cityCam.phi = cityCam.tPhi = 1.08; cityCam.setDist(300, true);

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    space.camera.aspect = city.camera.aspect = w / h;
    space.camera.updateProjectionMatrix(); city.camera.updateProjectionMatrix();
    sizeCanvases();
  }

  // ---------- 世界生成 ----------
  function newWorld(presetKey, seed) {
    S.presetKey = presetKey; S.seed = seed;
    const w = S.world = new World(presetKey, seed);
    w.onEvent = onEvent; w.onStep = () => space.sampleTrails(w, S.twin);
    S.snaps = [{ t: 0, s: w.snapshot() }]; S.twin = null; S.div = []; S.divSplit = null; updateTwinBtn();
    space.clearTrails(); S.skyTr = [[], [], []]; space.genPlanetBase(seed * 31 + 7); space.climKey = ''; space.lightKey = '';
    city.buildTerrain(seed); city.layoutSeed = -1;
    $('toasts').innerHTML = '';
    // 取景：看見整個星系
    const s = w.sim; let far = 0; const c = s.com();
    for (let i = 0; i < 3; i++) far = Math.max(far, Math.hypot(s.sp[i * 3] - c[0], s.sp[i * 3 + 1] - c[1]));
    far = Math.max(far, w.info.distCOM);
    space.focus = 'com'; space.focusPrev = null; space.focusBlend = 1;
    const asp = innerWidth / innerHeight < 1 ? 1.9 : 1;
    spaceCam.minD = 0.5; spaceCam.setDist((Math.min(far, 60) * AUS * 2.3 + 30) * asp, true);
    spaceCam.setDist((Math.min(far, 60) * AUS * 1.9 + 20) * asp);
    spaceCam.tPhi = 0.95; spaceCam.phi = 1.25;
    if (S.view === 'city') exitCity(true);
    renderFocusBar(); renderChron(); S.lastEventSeen = 0;
    toast(`${PRESETS[presetKey].name}（種子 ${seed}）：${PRESETS[presetKey].desc}`, 'blue', 9000);
  }

  // ---------- 事件 ----------
  function onEvent(e) {
    sound.event(e);
    if (e.key === 'eraStable' || e.key === 'eraChaos') sound.setEra(e.key === 'eraStable' ? 'stable' : 'chaos');
    if (e.key === 'civWin' && S.view === 'city') city.launchRocket();
    const important = ['eraStable', 'eraChaos', 'sanri', 'lianzhu', 'civStart', 'civEnd', 'civWin', 'age', 'dehyd', 'rehyd', 'reset', 'lost', 'night', 'threeFly'];
    if (important.includes(e.key)) toast(`第 ${e.t.toFixed(1)} 年｜${e.text}`, e.color);
    if (e.key === 'civEnd' || e.key === 'civWin') renderChron();
  }
  function toast(text, color = 'blue', ms = 6500) {
    const box = $('toasts'), d = document.createElement('div');
    d.className = 'toast ' + color; d.textContent = text; box.appendChild(d);
    while (box.children.length > (isMobile() ? 2 : 3)) box.removeChild(box.firstChild);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 520); }, ms);
  }

  // ---------- 時間控制 ----------
  const speedFromSlider = v => 0.05 * Math.pow(400, v / 100);
  const sliderFromSpeed = s => Math.log(s / 0.05) / Math.log(400) * 100;
  function setSpeed(s) { S.speed = Math.max(0.05, Math.min(20, s)); $('speed').value = sliderFromSpeed(S.speed); updateSpeedLabel(); }
  function fmtSpeed(s) { return s < 1 ? (s * 365).toFixed(0) + ' 天/秒' : s.toFixed(s < 10 ? 1 : 0) + ' 年/秒'; }
  function updateSpeedLabel() {
    const eff = effSpeed();
    $('speedV').textContent = fmtSpeed(eff) + (eff < S.speed - 1e-6 ? '*' : '');
    $('yrS').textContent = (S.playing ? '每秒 ' + fmtSpeed(eff).replace('/秒', '') : '已暫停') + (S.view === 'city' && S.speed > 1.5 ? ' · 城市限速' : S.limited ? ' · 運算限速' : '');
  }
  const effSpeed = () => S.view === 'city' ? Math.min(S.speed, 1.5) : S.speed;
  function setPlaying(p) { S.playing = p; $('play').textContent = p ? '❚❚' : '▶'; $('play').setAttribute('aria-label', p ? '暫停' : '播放'); updateSpeedLabel(); }

  function seekTo(t) {
    let i = S.snaps.length - 1; while (i > 0 && S.snaps[i].t > t) i--;
    const sn = S.snaps[i]; S.world.restore(sn.s); S.snaps.length = i + 1;
    space.clearTrails(); S.skyTr = [[], [], []];
    if (S.twin) { S.twin = null; updateTwinBtn(); $('divCap').textContent = '回到過去後，雙胞胎實驗已停止。'; }
    sound.setEra(S.world.era);
    toast(`回到第 ${sn.t.toFixed(1)} 年，從這一刻重新推演。電腦每一步的微小差異，可能讓未來走向不同結局。`, 'yellow', 7000);
    renderChron();
  }

  // ---------- 視角切換 ----------
  function fade(fn) { const f = $('fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 360); }
  function enterCity() {
    if (S.view === 'city') return;
    fade(() => {
      S.view = 'city'; document.body.classList.add('city'); spaceCam.enabled = false; cityCam.enabled = true; city.skyMode = false;
      renderer.shadowMap.enabled = QUALITY > 1;
      syncCity(true);
      const dd = Math.max(110, city.reach * RC * 2.4);
      cityCam.theta = cityCam.tTheta = 0.7 + Math.random() * 0.5; cityCam.phi = 0.6; cityCam.tPhi = 1.22; cityCam.setDist(Math.min(690, dd * 2.2), true); cityCam.setDist(dd);
      city.targetGoal.set(0, 0, 0); city.target.set(0, 0, 0); S.cityMode = 'c-top'; renderFocusBar(); updateSpeedLabel();
    });
  }
  function exitCity(instant) {
    const go = () => {
      S.view = 'space'; document.body.classList.remove('city'); spaceCam.enabled = true; cityCam.enabled = false;
      space.setFocus('planet'); space.focusBlend = 1; space.focusPrev = null;
      spaceCam.minD = PLANET_R * 1.3; spaceCam.setDist(PLANET_R * 1.6, true); spaceCam.setDist(PLANET_R * 9);
      renderer.shadowMap.enabled = false; renderFocusBar(); updateSpeedLabel();
    };
    instant ? go() : fade(go);
  }
  function focusSpace(key) {
    if (S.view === 'city') exitCity();
    space.setFocus(key);
    const s = S.world.sim;
    if (key === 'planet') {
      spaceCam.minD = PLANET_R * 1.3; spaceCam.setDist(PLANET_R * 16);
      const h = S.world.info.host * 3, dx = s.sp[h] - s.pp[0], dy = s.sp[h + 1] - s.pp[1];
      spaceCam.tTheta = Math.atan2(dx, -dy) + 1.1; spaceCam.tPhi = 1.25;
    }
    else if (key === 'com') { spaceCam.minD = 0.5; let far = 0; const c = s.com(); for (let i = 0; i < 3; i++) far = Math.max(far, Math.hypot(s.sp[i * 3] - c[0], s.sp[i * 3 + 1] - c[1])); spaceCam.setDist((Math.min(far, 60) * AUS * 1.9 + 20) * (innerWidth / innerHeight < 1 ? 1.9 : 1)); }
    else { const i = +key.slice(4); const r = s.stars[i].R * 0.00465 * AUS; spaceCam.minD = r * 1.6; spaceCam.setDist(Math.sqrt(s.stars[i].L) * AUS * 3.2); }
    renderFocusBar();
  }
  function goCityFromSpace() {
    if (S.view === 'city') return;
    if (space.focus !== 'planet') { space.setFocus('planet'); spaceCam.minD = PLANET_R * 1.3; }
    spaceCam.setDist(PLANET_R * 1.35); S.pendingCity = 1.4;
  }
  spaceCam.onZoomPastMin = () => { if (space.focus === 'planet' && S.view === 'space') enterCity(); };
  cityCam.onZoomPastMax = () => { if (S.view === 'city') exitCity(); };

  function renderFocusBar() {
    const bar = $('viewbar'), s = S.world.sim;
    const items = S.view === 'space'
      ? [['com', '星系'], ['star0', '太陽甲', s.stars[0].color], ['star1', '太陽乙', s.stars[1].color], ['star2', '太陽丙', s.stars[2].color], ['planet', '行星'], ['hz', '宜居帶'], ['city', '近看城市 →']]
      : [['c-top', '俯瞰城市'], ['c-pend', '巨擺'], ['c-sky', '仰望天空'], ['c-ring', '環繞'], ['space', '← 返回太空']];
    bar.innerHTML = items.map(([k, n, c]) => {
      const on = (S.view === 'space' && (k === space.focus || (k === 'hz' && space.showHZ))) || (S.view === 'city' && k === S.cityMode);
      return `<button class="chip${on ? ' on' : ''}${k === 'city' || k === 'space' ? ' go' : ''}" data-k="${k}">${c ? `<i style="background:rgb(${c.map(v => Math.round(v * 255)).join(',')})"></i>` : ''}${n}</button>`;
    }).join('');
  }
  $('viewbar').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return; const k = b.dataset.k;
    if (k === 'hz') { space.showHZ = !space.showHZ; renderFocusBar(); return; }
    if (k === 'city') { goCityFromSpace(); return; }
    if (k === 'space') { exitCity(); return; }
    if (k.startsWith('c-')) { cityMode(k); return; }
    focusSpace(k);
  });
  function cityMode(k) {
    S.cityMode = k; cityCam.autoSpin = 0; city.skyMode = k === 'c-sky';
    if (k === 'c-top') { city.targetGoal.set(0, 0, 0); cityCam.tPhi = 1.2; cityCam.setDist(Math.max(110, city.reach * RC * 2.4)); }
    if (k === 'c-pend') { city.targetGoal.set(PEND.x, 26, PEND.z); cityCam.tPhi = 1.32; cityCam.setDist(95); cityCam.tTheta = 0.15; showConcept('pendulum'); }
    if (k === 'c-sky') {
      // 面向主太陽的方位，從城市另一側的山坡看過去
      const sd = S.sunLocal[S.world.info.host]; const az = Math.atan2(sd.x, sd.z);
      const el = Math.max(0.15, Math.min(1.1, Math.asin(Math.max(-1, Math.min(1, sd.y))) * 0.8));
      city.skyAz0 = az; cityCam.tTheta = cityCam.theta = az; cityCam.tPhi = Math.max(0.12, 1.6 - (el - 0.06) / 1.15 * 1.48); cityCam.phi = 1.45;
    }
    if (k === 'c-ring') { city.targetGoal.set(0, 10, 0); cityCam.tPhi = 1.12; cityCam.setDist(230); cityCam.autoSpin = 0.12; }
    renderFocusBar();
  }

  // ---------- 城市環境 ----------
  const LAT = 0.42;
  function localSuns(dt, raw) {
    const info = S.world.info, h = info.host, uh = info.stars[h].u;
    const lam = Math.atan2(uh[1], uh[0]) + S.clock; // 觀測者所在經度（慣性座標）
    const cl = Math.cos(LAT), sl = Math.sin(LAT), cL = Math.cos(lam), sL = Math.sin(lam);
    const up = [cl * cL, cl * sL, sl], east = [-sL, cL, 0], north = [-sl * cL, -sl * sL, cl];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const u = info.stars[i].u;
      const v = new THREE.Vector3(u[0] * east[0] + u[1] * east[1] + u[2] * east[2], u[0] * up[0] + u[1] * up[1] + u[2] * up[2], -(u[0] * north[0] + u[1] * north[1] + u[2] * north[2]));
      if (!raw) { if (i === h || dt == null) S.sunLocal[i].copy(v); else S.sunLocal[i].lerp(v, 1 - Math.exp(-dt / 0.3)).normalize(); }
      const st = info.stars[i], sp = S.world.sim.stars[i];
      out.push({ dir: raw ? v : S.sunLocal[i].clone(), col: sp.color, vis: Math.min(2.2, Math.pow(st.flux, 0.45)), size: st.disk ? Math.min(0.12, st.ang * Math.PI / 360 * 2.6) : 0.003 });
    }
    return out;
  }
  function civState() {
    const w = S.world, c = w.civ;
    if (c) {
      const next = AGES[c.age + 1], frac = next ? (c.years - AGES[c.age].y) / (next.y - AGES[c.age].y) : (c.years - AGES[8].y) / (CIV_END - AGES[8].y);
      return { age: c.age, frac: Math.max(0, Math.min(1, frac)), alive: true, dehyd: c.dehyd, ruins: false, seed: c.seed, id: c.id };
    }
    const r = w.ruins || { age: 0, seed: 1, burned: false };
    return { age: r.age, frac: 0, alive: false, dehyd: false, ruins: true, burned: r.burned, seed: r.seed, id: -1 };
  }
  function syncCity(force) {
    const st = civState();
    city.setLayout(st.seed);
    city.refresh(st);
  }

  // ---------- 主迴圈 ----------
  let last = performance.now(), frames = 0, fpsAcc = 0, fpsLow = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = S.world;
    if (S.playing) {
      let simDt = effSpeed() * dt;
      const budget = 22; // 毫秒
      const maxDt = budget / 1000 / Math.max(1e-6, S.costPerYr);
      S.limited = simDt > maxDt; if (S.limited) simDt = maxDt;
      const t0 = performance.now();
      w.advance(simDt, S.twin);
      const el = (performance.now() - t0) / 1000;
      if (simDt > 0.002) S.costPerYr = S.costPerYr * 0.9 + (el / simDt) * 0.1;
      S.clock += dt * 2 * Math.PI / 45;
      if (w.sim.t - S.snaps[S.snaps.length - 1].t >= S.snapEvery) { S.snaps.push({ t: w.sim.t, s: w.snapshot() }); if (S.snaps.length > 6000) S.snaps.splice(1, 1); }
      if (S.twin) trackTwin();
      S.skyAcc = (S.skyAcc || 0) + dt;
      if (S.skyAcc > 0.06) { S.skyAcc = 0; const ls = localSuns(null, true); ls.forEach((x, i) => { const tr = S.skyTr[i]; tr.push([Math.atan2(x.dir.x, -x.dir.z), Math.asin(Math.max(-1, Math.min(1, x.dir.y)))]); if (tr.length > 320) tr.shift(); }); }
    }
    if (S.pendingCity) { S.pendingCity -= dt; if (S.pendingCity <= 0 || spaceCam.dist < PLANET_R * 1.5) { S.pendingCity = 0; enterCity(); } }
    const civ = civState();
    if (S.view === 'space') {
      space.paintPlanet(w.T); space.paintLights(civ.age, civ.seed, civ.alive && !civ.dehyd);
      const info = w.info, uh = info.stars[info.host].u;
      space.spin = -(Math.atan2(uh[1], uh[0]) + S.clock) + Math.PI;
      space.update(dt, w, spaceCam, S.twin, { lights: civ.alive && !civ.dehyd ? 1 : 0 });
      spaceCam.update(dt, space.camera, new THREE.Vector3(0, 0, 0));
      renderer.render(space.scene, space.camera);
      updateLabels();
    } else {
      syncCity();
      city.update(dt, cityCam, { suns: localSuns(dt), T: w.T, alive: civ.alive, dehyd: civ.dehyd, burned: civ.burned });
      renderer.render(city.scene, city.camera);
      lblEls.forEach(l => l.style.display = 'none');
    }
    S.uiT += dt; if (S.uiT > 0.12) { S.uiT = 0; renderPanels(); }
    S.conceptT += dt; if (S.teach && S.conceptT > 1.5) { S.conceptT = 0; autoConcept(); }
    // 自動降低畫質
    frames++; fpsAcc += dt;
    if (fpsAcc > 2) { const fps = frames / fpsAcc; frames = 0; fpsAcc = 0; if (fps < 32) fpsLow++; else fpsLow = 0; if (fpsLow >= 2 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); fpsLow = 0; } }
  }

  // ---------- 雙胞胎（混沌實驗） ----------
  function startTwin() {
    const tw = S.world.sim.clone(); tw.sp[3] += S.twinDelta; S.twin = tw; S.twinStart = S.world.sim.t; S.div = []; S.divSplit = null;
    space.twinTrails.forEach(t => { t.head = 0; t.count = 0; t.last = null; });
    updateTwinBtn(); toast('雙胞胎宇宙已建立：太陽乙的位置只差 ' + S.twinDelta.toExponential(0) + ' AU。', 'yellow');
  }
  function trackTwin() {
    const a = S.world.sim, b = S.twin; let d = 0;
    for (let i = 0; i < 9; i += 3) d = Math.max(d, Math.hypot(a.sp[i] - b.sp[i], a.sp[i + 1] - b.sp[i + 1], a.sp[i + 2] - b.sp[i + 2]));
    const t = a.t - S.twinStart;
    if (!S.div.length || t - S.div[S.div.length - 1][0] > 0.05) S.div.push([t, Math.log10(Math.max(d, 1e-14))]);
    if (!S.divSplit && d > 1) { S.divSplit = t; toast(`兩個宇宙在 ${t.toFixed(1)} 年後分道揚鑣：恆星位置差距超過 1 AU。`, 'red', 8000); }
  }
  function updateTwinBtn() { $('twinBtn').textContent = S.twin ? '停止實驗' : '開始雙胞胎實驗'; }
  $('twinBtn').onclick = () => { if (S.twin) { S.twin = null; updateTwinBtn(); } else startTwin(); };
  $('deltaSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.twinDelta = +b.dataset.d; [...$('deltaSeg').children].forEach(x => x.classList.toggle('on', x === b)); });

  // ---------- 標籤 ----------
  const lblEls = [];
  function updateLabels() {
    const box = $('labels'), w = S.world, s = w.sim, info = w.info;
    if (!lblEls.length) for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'lbl' + (i === 3 ? ' pl' : ''); box.appendChild(d); lblEls.push(d); }
    const W = innerWidth, H = innerHeight, v = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      const el = lblEls[i];
      if (i < 3) { v.copy(space.starObjs[i].pos); el.innerHTML = `<b>${w.starName(i)}</b><span>${info.stars[i].d.toFixed(info.stars[i].d < 10 ? 2 : 1)} AU</span>`; }
      else { v.copy(space.planetPos); el.innerHTML = `<b>三體行星</b><span>${Math.round(w.T)}°C</span>`; }
      v.project(space.camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && !(i === 3 && spaceCam.dist < PLANET_R * 6);
      el.style.display = vis ? 'block' : 'none';
      if (vis) el.style.transform = `translate(${((v.x + 1) / 2 * W + 12).toFixed(1)}px, ${((1 - v.y) / 2 * H - 8).toFixed(1)}px)`;
    }
  }

  // ---------- 面板 ----------
  const EV_ORDER = ['sanri', 'shuangri', 'lianzhu', 'feixingStill', 'twoFly', 'threeFly', 'night'];
  $('evGrid').innerHTML = EV_ORDER.map(k => `<div class="ev ${EVENT_DEFS[k].c}" id="ev-${k}"><i></i>${EVENT_DEFS[k].n}</div>`).join('');
  $('segs').innerHTML = AGES.map(() => '<i><b></b></i>').join('');
  function renderPanels() {
    const w = S.world, info = w.info, s = w.sim, c = w.civ;
    // 紀元
    const st = w.era === 'stable';
    $('eraName').textContent = st ? '恆紀元' : '亂紀元'; $('eraName').classList.toggle('chaos', !st);
    $('eraDur').textContent = `已持續 ${(s.t - w.eraSince).toFixed(1)} 年`;
    const hostTxt = info.circumbinary ? '繞' + info.group.map(i => w.starName(i).slice(2)).join('') + '多星系統' : '繞' + w.starName(info.host);
    $('orbitLine').textContent = info.bound
      ? `${hostTxt}運行 · 半長軸 ${info.a.toFixed(2)} AU · 離心率 ${info.e.toFixed(2)} · 擾動 ${(info.pert * 100).toFixed(1)}%`
      : `未被任何太陽穩定捕獲 · 擾動 ${(info.pert * 100).toFixed(1)}%`;
    EV_ORDER.forEach(k => $('ev-' + k).classList.toggle('on', !!info.flags[k]));
    // 行星
    const T = w.T, x = v => ((Math.max(-200, Math.min(400, v)) + 200) / 600 * 100) + '%';
    $('tVal').textContent = Math.round(T);
    $('tVal').style.color = T < -35 ? 'var(--blue)' : T > 65 ? 'var(--red)' : T < -10 || T > 40 ? 'var(--yellow)' : 'var(--green)';
    const tag = $('habTag');
    const [tt, tc] = T < -120 ? ['極寒', 'b'] : T < -35 ? ['嚴寒', 'b'] : T > 140 ? ['烈焰', 'r'] : T > 65 ? ['酷熱', 'r'] : (T < -10 || T > 40) ? ['勉強可居', 'y'] : ['宜居', 'g'];
    tag.textContent = tt; tag.className = 'pill ' + tc;
    $('tMk').style.left = x(T); $('tEq').style.left = x(info.Teq);
    $('tHab').style.left = x(-10); $('tHab').style.width = (50 / 600 * 100) + '%';
    $('rS').textContent = info.S.toFixed(info.S < 0.1 ? 3 : 2) + '× 地球';
    $('rTeq').textContent = Math.round(info.Teq) + ' °C';
    $('rYear').textContent = isFinite(info.period) ? info.period.toFixed(2) + ' 地球年' : '無週期';
    $('rTide').textContent = info.tide.toExponential(1) + ' 倍';
    // 太陽
    const maxF = Math.max(...info.stars.map(x => x.flux));
    $('sunList').innerHTML = info.stars.map((x, i) => {
      const col = s.stars[i].color.map(v => Math.round(v * 255)).join(',');
      const isHost = i === info.host || (info.circumbinary && info.group.includes(i));
      const pct = Math.max(2, (Math.log10(x.flux) + 5) / (Math.log10(Math.max(maxF, 1)) + 5) * 100);
      return `<div class="sun"><span class="dot" style="background:rgb(${col});box-shadow:0 0 ${x.disk ? 10 : 3}px rgb(${col})"></span>
        <span class="nm">${w.starName(i)}${isHost ? '<em>· 宿主</em>' : ''}</span>
        <span class="tag ${x.disk ? '' : 'fly'}">${x.disk ? '日面 ' + x.ang.toFixed(2) + '°' : '飛星'}</span>
        <span class="meta">${x.d.toFixed(x.d < 10 ? 2 : 1)} AU<span class="bar"><b style="width:${pct.toFixed(0)}%;background:rgb(${col})"></b></span>${x.flux >= 0.01 ? x.flux.toFixed(2) : x.flux.toExponential(1)}×</span></div>`;
    }).join('');
    // 文明
    if (c) {
      $('civNo').textContent = c.id;
      const p = $('civState'); p.textContent = c.dehyd ? '脫水中' : '活動中'; p.className = 'pill ' + (c.dehyd ? 'b' : 'g');
      $('civAge').textContent = AGES[c.age].n;
      $('civDesc').textContent = c.dehyd ? '全體脫水，儲存在乾燥倉庫中，等待恆紀元到來時浸泡復活。' : AGES[c.age].d;
      const nx = AGES[c.age + 1];
      $('rNext').textContent = nx ? `${nx.n}（${nx.y} 文明年）` : `星際遠航（${CIV_END} 文明年）`;
      $('rCivY').textContent = c.years.toFixed(1) + ' 年';
      const rate = c.dehyd ? 0 : (T > -10 && T < 40 ? 1 : T > -30 && T < 58 ? 0.4 : 0) * (w.era === 'chaos' ? 0.5 : 1);
      $('rRate').textContent = '×' + rate.toFixed(rate === 1 || rate === 0 ? 0 : 1);
      $('rDehyd').textContent = c.dehydCount;
    } else {
      const last = w.history[w.history.length - 1];
      $('civNo').textContent = last ? last.id : '—';
      const p = $('civState'); p.textContent = last && last.kind === 'win' ? '已遠航' : '已毀滅'; p.className = 'pill ' + (last && last.kind === 'win' ? 'g' : 'r');
      $('civAge').textContent = last ? '曾達' + AGES[last.age].n : '—';
      $('civDesc').textContent = last ? (last.kind === 'win' ? '艦隊已離開。母星等待下一個恆紀元，新的生命會再度萌芽。' : `${last.reason}。等待恆紀元穩定後，新的文明會重新萌芽。`) : '';
      $('rNext').textContent = '等待恆紀元'; $('rCivY').textContent = '—'; $('rRate').textContent = '—'; $('rDehyd').textContent = last ? last.dehyd : '—';
    }
    $('rHist').textContent = w.history.length;
    const segs = $('segs').children, cs = civState();
    for (let i = 0; i < 9; i++) { const f = !c ? 0 : i < cs.age ? 1 : i === cs.age ? Math.max(0.04, cs.frac) : 0; segs[i].firstChild.style.transform = `scaleX(${f})`; segs[i].firstChild.style.background = c && c.dehyd ? 'var(--blue)' : 'var(--yellow)'; }
    $('goCity').classList.toggle('on', S.view === 'city');
    // 年份
    $('yrV').textContent = `第 ${s.t.toFixed(1)} 年`;
    updateSpeedLabel();
    drawTimeline(); drawSky(); drawPlanetThumb(); drawDiv();
    if (S.view === 'city') $('cityHud').textContent = `當地時間 ${hourStr()} · 建築 ${city.m.tower.count + city.m.house.count + city.m.hut.count + city.m.factory.count} · 樹 ${city.m.tree.count} · 車 ${city.m.car.count} · 行人 ${city.m.person.count}`;
    sound.setCold(Math.max(0, Math.min(1, (-10 - T) / 80)));
    if (w.events.length !== S.lastEventSeen) { S.lastEventSeen = w.events.length; }
  }
  function hourStr() { let h = ((S.clock / (2 * Math.PI)) * 24 + 12) % 24; if (h < 0) h += 24; const m = Math.floor((h % 1) * 60); return String(Math.floor(h)).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }

  function renderChron() {
    const w = S.world, list = $('chronList'), H = w.history.slice().reverse();
    const rows = [];
    if (w.civ) rows.push(`<li><span class="no">${w.civ.id}</span><span class="a">${AGES[w.civ.age].n}</span><span class="y">進行中</span><span class="why">第 ${w.civ.startT.toFixed(0)} 年誕生${w.civ.dehydCount ? '，脫水 ' + w.civ.dehydCount + ' 次' : ''}</span></li>`);
    H.forEach(h => rows.push(`<li><span class="no">${h.id}</span><span class="a">${AGES[h.age].n}</span><span class="y">${h.years.toFixed(1)} 年</span><span class="why ${h.kind === 'win' ? 'green' : 'red'}">${h.kind === 'win' ? '飛出三體星系' : h.reason}</span></li>`));
    list.innerHTML = rows.join('') || '<li class="empty">尚無紀錄</li>';
    const all = w.history.concat(w.civ ? [{ age: w.civ.age, years: w.civ.years }] : []);
    $('stTotal').textContent = w.civCounter;
    $('stBest').textContent = all.length ? AGES[Math.max(...all.map(h => h.age))].n.replace('時代', '') : '—';
    $('stLong').textContent = all.length ? Math.max(...all.map(h => h.years)).toFixed(0) : 0;
  }

  // ---------- 小圖 ----------
  function prep(cv) { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio); if (r.width < 2) return null; const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; } const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w: r.width, h: r.height }; }
  function sizeCanvases() { ['skyMap', 'planetThumb', 'divChart', 'tlCanvas'].forEach(id => { const c = $(id); c.width = 0; }); }
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function drawSky() {
    const P = prep($('skyMap')); if (!P) return; const { g, w: W, h: H } = P, w = S.world;
    g.fillStyle = '#0c0f1a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(106,184,255,.10)'; g.lineWidth = 1;
    for (let k = 1; k < 12; k++) { g.beginPath(); g.moveTo(k * W / 12, 0); g.lineTo(k * W / 12, H); g.stroke(); }
    for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(0, k * H / 6); g.lineTo(W, k * H / 6); g.stroke(); }
    g.fillStyle = 'rgba(30,36,52,.55)'; g.fillRect(0, H / 2, W, H / 2);
    g.strokeStyle = 'rgba(255,204,68,.35)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#5b6380'; g.font = '9.5px "Noto Sans TC",sans-serif'; ['北', '東', '南', '西'].forEach((d, k) => g.fillText(d, (k + 0.5) / 4 * W + (k === 0 ? -W / 8 + 4 : -4), H - 4));
    const X = l => (l + Math.PI) / (2 * Math.PI) * W, Y = b => (0.5 - b / Math.PI) * H;
    for (let i = 0; i < 3; i++) {
      const tr = S.skyTr[i], c = w.sim.stars[i].color.map(v => Math.round(v * 255)).join(',');
      g.lineWidth = 1.4;
      for (let k = 1; k < tr.length; k++) {
        if (Math.abs(tr[k][0] - tr[k - 1][0]) > Math.PI) continue;
        g.strokeStyle = `rgba(${c},${(k / tr.length * 0.8).toFixed(2)})`;
        g.beginPath(); g.moveTo(X(tr[k - 1][0]), Y(tr[k - 1][1])); g.lineTo(X(tr[k][0]), Y(tr[k][1])); g.stroke();
      }
      const st = w.info.stars[i], cur = tr[tr.length - 1] || [0, 0], x = X(cur[0]), y = Y(cur[1]);
      if (st.disk) {
        const r = Math.max(3, Math.min(10, st.ang * 9));
        const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.6); gr.addColorStop(0, `rgba(${c},.55)`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.6, 0, 7); g.fill();
        g.fillStyle = `rgb(${c})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      } else { g.strokeStyle = `rgb(${c})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke(); }
      g.fillStyle = '#dde3f5'; g.font = '10px "Noto Sans TC",sans-serif'; g.fillText(w.starName(i).slice(2) + (st.disk ? '' : '・飛星'), x + 8, y - 6);
    }
  }
  function drawPlanetThumb() {
    const P = prep($('planetThumb')); if (!P) return; const { g, w: W, h: H } = P, w = S.world, info = w.info;
    g.fillStyle = '#05070d'; g.fillRect(0, 0, W, H);
    const cx = W * 0.42, cy = H * 0.52, R = Math.min(W, H) * 0.36, T = w.T;
    const sn = Math.max(0, Math.min(1, (-T - 5) / 70)), ht = Math.max(0, Math.min(1, (T - 40) / 110));
    const base = [40 + ht * 120 + sn * 180, 90 - ht * 20 + sn * 140, 130 - ht * 80 + sn * 110].map(v => Math.round(Math.min(240, v)));
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.fillStyle = `rgb(${base})`; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const r = mulberry32(S.seed);
    for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(${[70 + ht * 90 + sn * 160, 110 + sn * 120, 60 + sn * 170].map(Math.round)},.85)`; g.beginPath(); g.ellipse(cx + (r() - 0.5) * R * 1.6, cy + (r() - 0.5) * R * 1.4, R * (0.15 + r() * 0.3), R * (0.1 + r() * 0.2), r() * 3, 0, 7); g.fill(); }
    // 晝夜：依各太陽方向疊光
    let lx = 0, ly = 0, tot = 0;
    info.stars.forEach(s => { const k = Math.min(1.5, Math.pow(s.flux, 0.4)); lx += s.u[0] * k; ly += s.u[1] * k; tot += k; });
    const ang = Math.atan2(-ly, lx), lit = Math.min(1, tot);
    const gr = g.createLinearGradient(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, cx - Math.cos(ang) * R, cy - Math.sin(ang) * R);
    gr.addColorStop(0, `rgba(0,0,0,${0.05 + (1 - lit) * 0.5})`); gr.addColorStop(0.48, `rgba(0,0,0,${0.15 + (1 - lit) * 0.5})`); gr.addColorStop(0.62, 'rgba(0,0,4,.88)'); gr.addColorStop(1, 'rgba(0,0,6,.95)');
    g.fillStyle = gr; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const cs = civState();
    if (cs.alive && !cs.dehyd) {
      const n = [6, 14, 24, 40, 70, 120, 170, 220, 260][cs.age], r2 = mulberry32(cs.seed);
      for (let k = 0; k < n; k++) {
        const a = r2() * 6.28, d = Math.sqrt(r2()) * R * 0.95, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
        const side = (x - cx) * Math.cos(ang) + (y - cy) * Math.sin(ang);
        if (side < R * 0.1) { g.fillStyle = cs.age >= 5 ? 'rgba(255,220,150,.9)' : 'rgba(255,170,80,.8)'; g.fillRect(x, y, 1.4, 1.4); }
      }
    }
    g.restore();
    const ag = g.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.12); ag.addColorStop(0, 'rgba(106,184,255,.35)'); ag.addColorStop(1, 'rgba(106,184,255,0)');
    g.fillStyle = ag; g.beginPath(); g.arc(cx, cy, R * 1.12, 0, 7); g.fill();
    // 巨月
    const ma = S.world.sim.t * 2.0, mx = cx + Math.cos(ma) * R * 1.7, my = cy + Math.sin(ma) * R * 0.35;
    if (mx < W - 4) { g.fillStyle = '#9d9a94'; g.beginPath(); g.arc(mx, my, R * 0.22, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,6,.7)'; g.beginPath(); g.arc(mx - Math.cos(ang) * R * 0.08, my - Math.sin(ang) * R * 0.08, R * 0.2, 0, 7); g.fill(); }
    g.fillStyle = '#8a93b0'; g.font = '10px "Noto Sans TC",sans-serif'; g.fillText('巨月', Math.min(mx, W - 26) + 4, my - R * 0.28);
    $('planetCap').textContent = T > 140 ? '地表正在燃燒，海洋大量蒸發。' : T > 65 ? '酷熱：海平面下降，陸地乾裂。' : T < -60 ? '整顆行星冰封，海洋結成冰原。' : T < -10 ? '嚴寒：冰帽向赤道擴張。' : cs.alive && !cs.dehyd ? '海洋與陸地分明，夜面亮著城市燈火。' : '海洋與陸地分明，夜面一片黑暗。';
  }
  function drawDiv() {
    const P = prep($('divChart')); if (!P) return; const { g, w: W, h: H } = P;
    g.fillStyle = '#0c0f1a'; g.fillRect(0, 0, W, H);
    const pad = 28, tMax = Math.max(20, S.div.length ? S.div[S.div.length - 1][0] * 1.1 : 20);
    const X = t => pad + t / tMax * (W - pad - 8), Y = v => 8 + (2 - v) / 14 * (H - 26);
    g.font = '9.5px "IBM Plex Mono",monospace'; g.fillStyle = '#5b6380'; g.strokeStyle = 'rgba(106,184,255,.08)';
    [-12, -9, -6, -3, 0].forEach(v => { g.beginPath(); g.moveTo(pad, Y(v)); g.lineTo(W - 8, Y(v)); g.stroke(); g.fillText('1e' + v, 2, Y(v) + 3); });
    g.strokeStyle = 'rgba(255,93,108,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(pad, Y(0)); g.lineTo(W - 8, Y(0)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ff9aa4'; g.fillText('1 AU', W - 40, Y(0) - 4);
    g.fillStyle = '#5b6380'; g.fillText('0', pad, H - 4); g.fillText(tMax.toFixed(0) + ' 年', W - 44, H - 4);
    if (S.div.length > 1) {
      g.strokeStyle = '#ff7ad9'; g.lineWidth = 1.6; g.beginPath();
      S.div.forEach(([t, v], i) => { const x = X(t), y = Y(Math.max(-14, Math.min(2, v))); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
      const lastV = S.div[S.div.length - 1];
      $('divCap').textContent = S.divSplit ? `分道揚鑣於第 ${S.divSplit.toFixed(1)} 年。之後兩個宇宙的恆星位置已毫無關聯。` : `經過 ${lastV[0].toFixed(1)} 年，差距約 ${Math.pow(10, lastV[1]).toExponential(1)} AU。誤差每隔一段時間就放大十倍。`;
    }
  }
  // 時間軸
  function tlRange() { return Math.max(30, S.world.sim.t * 1.04); }
  function drawTimeline() {
    const P = prep($('tlCanvas')); if (!P) return; const { g, w: W, h: H } = P, w = S.world, tMax = tlRange();
    const X = t => t / tMax * W;
    g.clearRect(0, 0, W, H);
    // 紀元帶
    let era = 'stable', t0 = 0;
    const band = (a, b, e) => { g.fillStyle = e === 'stable' ? 'rgba(61,255,160,.22)' : 'rgba(255,93,108,.3)'; g.fillRect(X(a), H * 0.38, Math.max(1, X(b) - X(a)), 6); };
    for (const e of w.events) { if (e.key === 'eraStable' || e.key === 'eraChaos') { band(t0, e.t, era); era = e.key === 'eraStable' ? 'stable' : 'chaos'; t0 = e.t; } }
    band(t0, w.sim.t, era);
    // 文明帶
    let c0 = null;
    for (const e of w.events) { if (e.key === 'civStart') c0 = e.t; if ((e.key === 'civEnd' || e.key === 'civWin') && c0 !== null) { g.fillStyle = 'rgba(255,204,68,.35)'; g.fillRect(X(c0), H * 0.38 + 9, X(e.t) - X(c0), 3); c0 = null; } }
    if (c0 !== null) { g.fillStyle = 'rgba(255,204,68,.35)'; g.fillRect(X(c0), H * 0.38 + 9, X(w.sim.t) - X(c0), 3); }
    // 事件標記
    const colors = { red: '#ff5d6c', green: '#3dffa0', yellow: '#ffcc44', blue: '#6ab8ff' };
    S.tlMarks = [];
    for (const e of w.events) {
      const big = e.key === 'civEnd' || e.key === 'civWin' || e.key === 'reset';
      const mid = e.key === 'sanri' || e.key === 'lianzhu' || e.key === 'age';
      if (!big && !mid) continue;
      const x = X(e.t); g.fillStyle = colors[e.color] || '#dde3f5';
      if (big) g.fillRect(x - 1, 2, 2, H * 0.38 - 2); else { g.beginPath(); g.arc(x, H * 0.24, 2.2, 0, 7); g.fill(); }
      S.tlMarks.push({ x, e });
    }
    // 刻度
    g.fillStyle = '#5b6380'; g.font = '9.5px "IBM Plex Mono",monospace';
    const step = [5, 10, 20, 50, 100, 200, 500].find(s => tMax / s < 9) || 1000;
    for (let t = 0; t <= tMax; t += step) { g.fillRect(X(t), H - 13, 1, 4); g.fillText(t, X(t) + 2, H - 2); }
    // 目前位置
    g.fillStyle = '#ffffff'; g.fillRect(X(w.sim.t) - 1, 0, 2, H - 12);
  }
  const tlc = $('tlCanvas');
  tlc.addEventListener('click', e => { const r = tlc.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * tlRange(); if (t < S.world.sim.t - 0.1) seekTo(t); });
  tlc.addEventListener('mousemove', e => {
    const r = tlc.getBoundingClientRect(), x = e.clientX - r.left, tip = $('tlTip');
    const m = (S.tlMarks || []).reduce((b, k) => Math.abs(k.x - x) < Math.abs((b ? b.x : 1e9) - x) ? k : b, null);
    const t = x / r.width * tlRange();
    if (m && Math.abs(m.x - x) < 6) tip.innerHTML = `<b>第 ${m.e.t.toFixed(1)} 年</b><br>${m.e.text}`;
    else tip.innerHTML = t < S.world.sim.t ? `點擊回到第 ${t.toFixed(1)} 年` : '未來尚未發生';
    tip.style.display = 'block'; tip.style.left = (e.clientX - $('tl').getBoundingClientRect().left) + 'px';
  });
  tlc.addEventListener('mouseleave', () => $('tlTip').style.display = 'none');
  $('prevEv').onclick = () => {
    const t = S.world.sim.t, ev = S.world.events.filter(e => ['eraChaos', 'eraStable', 'civEnd', 'civWin', 'sanri', 'lianzhu', 'age'].includes(e.key) && e.t < t - 1.5);
    if (ev.length) seekTo(Math.max(0, ev[ev.length - 1].t - 1)); else toast('之前沒有重大事件。', 'blue', 3000);
  };

  // ---------- 教學概念 ----------
  function showConcept(key) {
    const c = CONCEPTS[key]; if (!c) return;
    $('cpT').textContent = c.t; $('cpP').textContent = c.p; $('cpQ').textContent = c.q ? '想一想：' + c.q : '';
    document.querySelector('#concept .k').textContent = '課堂概念 · ' + c.k; S.conceptKey = key;
  }
  function autoConcept() {
    const w = S.world, f = w.info.flags; let k;
    if (S.view === 'city' && S.cityMode === 'c-pend') k = 'pendulum';
    else if (f.lianzhu) k = 'lianzhu'; else if (f.sanri) k = 'sanri'; else if (f.night) k = 'night';
    else if (w.civ && w.civ.dehyd) k = 'dehyd';
    else if (S.twin) k = 'chaosTheory';
    else if (w.era === 'chaos') k = Math.abs(w.T - w.info.Teq) > 25 ? 'thermal' : 'chaos';
    else if (S.presetKey === 'eight') k = 'eight';
    else if (f.twoFly) k = 'fly';
    else k = ['stable', 'flux', 'hz'][Math.floor(w.sim.t / 12) % 3];
    if (k !== S.conceptKey) showConcept(k);
  }
  function openModal(html) { $('mBody').innerHTML = html; $('modal').hidden = false; $('mClose').focus(); }
  $('mClose').onclick = () => $('modal').hidden = true;
  $('modal').addEventListener('click', e => { if (e.target === $('modal')) $('modal').hidden = true; });
  document.addEventListener('click', e => {
    const b = e.target.closest('.i'); if (!b) return;
    const map = { era: ['era', 'chaos'], flux: ['flux', 'thermal', 'hz'], fly: ['fly', 'sanri', 'lianzhu', 'night'], dehyd: ['dehyd', 'chron'], sky: ['sky'], chron: ['chron'], chaos: ['chaosTheory'] };
    openModal((map[b.dataset.c] || []).map(k => { const c = CONCEPTS[k]; return `<div class="k">${c.k}</div><h2>${c.t}</h2><p>${c.p}</p>${c.q ? `<p class="q">課堂提問：${c.q}</p>` : ''}`; }).join('<hr style="border:0;border-top:1px solid var(--line-soft);margin:18px 0">'));
  });
  function helpHTML() {
    return `<div class="k">BLACK BEAR OBSERVATORY</div><h2>怎麼操作</h2>
    <table><tr><td>旋轉視角</td><td>拖曳畫面（手機單指）</td></tr><tr><td>縮放</td><td>滾輪（手機雙指）</td></tr>
    <tr><td>進入城市</td><td>選「行星」後一直放大，或按「近看城市」</td></tr><tr><td>回到過去</td><td>點時間軸上任何過去的時刻</td></tr></table>
    <p style="margin-top:14px">鍵盤快捷鍵：<kbd>空白</kbd> 播放／暫停、<kbd>[</kbd> <kbd>]</kbd> 調整速度、<kbd>1</kbd>–<kbd>5</kbd> 切換觀察目標、<kbd>C</kbd> 城市、<kbd>V</kbd> 太空、<kbd>H</kbd> 宜居帶、<kbd>T</kbd> 教學模式、<kbd>M</kbd> 聲音。</p>
    <h2 style="margin-top:18px;font-size:18px">模擬了什麼</h2>
    <ul><li>三顆恆星與行星用真實的牛頓萬有引力逐步計算（自適應步長的蛙跳積分）。</li>
    <li>恆星亮度依質量估算（L ≈ M⁴），日照依距離平方反比，溫度用輻射平衡加上海洋熱慣性。</li>
    <li>恆紀元的判定：行星被一顆（或一組靠很近的）太陽穩定捕獲、軌道接近圓形、其他恆星的擾動小於 6%。</li>
    <li>文明、脫水、巨擺、三日凌空等設定改編自劉慈欣《三體》，數值為教學用的簡化。</li></ul>
    <p class="q">教學模式會依照畫面上正在發生的事，自動顯示對應的概念與課堂提問。</p>`;
  }

  // ---------- 控制項 ----------
  $('preset').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.name}・${p.tag}</option>`).join('');
  $('preset').onchange = e => newWorld(e.target.value, S.presetKey === 'random' ? S.seed : 1 + Math.floor(Math.random() * 9999));
  $('play').onclick = () => setPlaying(!S.playing);
  $('speed').oninput = e => setSpeed(speedFromSlider(+e.target.value));
  $('restart').onclick = () => newWorld(S.presetKey, S.seed);
  $('newsys').onclick = () => { const k = S.presetKey === 'solar' || S.presetKey === 'eight' ? 'random' : S.presetKey; $('preset').value = k; newWorld(k, 1 + Math.floor(Math.random() * 99999)); };
  $('teach').onclick = () => { S.teach = !S.teach; document.body.classList.toggle('teach', S.teach); $('teach').classList.toggle('on', S.teach); $('teach').setAttribute('aria-pressed', S.teach); if (S.teach) { S.conceptKey = null; autoConcept(); } };
  $('snd').onclick = () => { const on = !sound.on; sound.setOn(on); sound.setEra(S.world.era, true); $('snd').classList.toggle('on', on); $('snd').setAttribute('aria-pressed', on); };
  $('help').onclick = () => openModal(helpHTML());
  $('goCity').onclick = () => goCityFromSpace();
  $('goSpace').onclick = () => { if (S.view === 'city') exitCity(); else focusSpace('com'); };
  document.querySelectorAll('.rtabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.rtabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('#pR .card').forEach(c => c.classList.toggle('show', c.id === b.dataset.r));
    if (b.dataset.r === 'cChron') renderChron();
  });
  // 手機分頁
  const MT = [['cEra', '紀元'], ['cPlanet', '行星'], ['cSuns', '太陽'], ['cCiv', '文明'], ['cObs', '觀測'], ['cChron', '編年史'], ['cChaos', '混沌']];
  $('mtabs').innerHTML = MT.map(([id, n]) => `<button data-m="${id}">${n}</button>`).join('');
  function setMTab(id, toggle) {
    if (toggle && id === S.mtab && !document.body.classList.contains('sheet-closed')) { document.body.classList.add('sheet-closed'); [...$('mtabs').children].forEach(b => b.classList.remove('on')); return; }
    document.body.classList.remove('sheet-closed'); S.mtab = id;
    [...$('mtabs').children].forEach(b => b.classList.toggle('on', b.dataset.m === id));
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('mon', c.id === id));
    $('pL').classList.toggle('mshow', !!$('pL').querySelector('#' + id)); $('pR').classList.toggle('mshow', !!$('pR').querySelector('#' + id));
    if (id === 'cChron') renderChron();
    sizeCanvases();
  }
  $('mtabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMTab(b.dataset.m, true); });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (!$('start').hidden && e.key !== 'Enter') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setPlaying(!S.playing); }
    else if (k === '[') setSpeed(S.speed / 1.5); else if (k === ']') setSpeed(S.speed * 1.5);
    else if (k === 'c') goCityFromSpace(); else if (k === 'v') { if (S.view === 'city') exitCity(); }
    else if (k === 'h') { space.showHZ = !space.showHZ; renderFocusBar(); }
    else if (k === 't') $('teach').click(); else if (k === 'm') $('snd').click();
    else if (k === 'escape') $('modal').hidden = true;
    else if (k === 'enter' && !$('start').hidden) $('startBtn').click();
    else if ('12345'.includes(k) && k.length === 1) focusSpace(['com', 'star0', 'star1', 'star2', 'planet'][+k - 1]);
  });
  addEventListener('resize', resize);

  // ---------- 啟動 ----------
  $('preset').value = 'chaos';
  setSpeed(1.5);
  newWorld('chaos', 1);
  // 開場選擇模式：背景先慢慢轉，選好再開始
  setPlaying(false); spaceCam.autoSpin = 0.05; $('toasts').innerHTML = '';
  let pick = 'chaos', aud = 'show';
  $('startModes').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button class="mode${k === pick ? ' on' : ''}" data-k="${k}"><span class="tg">${p.tag}</span><b>${p.name}</b><p>${p.desc}</p></button>`).join('');
  $('startModes').addEventListener('click', e => { const b = e.target.closest('.mode'); if (!b) return; pick = b.dataset.k; [...$('startModes').children].forEach(x => x.classList.toggle('on', x === b)); });
  $('startAud').addEventListener('click', e => { const b = e.target.closest('.mode'); if (!b) return; aud = b.dataset.a; [...$('startAud').children].forEach(x => x.classList.toggle('on', x === b)); });
  $('startBtn').onclick = () => {
    $('start').hidden = true; spaceCam.autoSpin = 0;
    $('preset').value = pick; newWorld(pick, pick === 'chaos' ? 1 : 1 + Math.floor(Math.random() * 99999));
    if ((aud === 'teach') !== S.teach) $('teach').click();
    if ($('startSnd').checked && !sound.on) $('snd').click();
    setPlaying(true);
  };
  setMTab('cEra');
  if (isMobile()) document.body.classList.add('sheet-closed');
  resize();
  requestAnimationFrame(loop);
  window.__tb = { S, space, city, spaceCam, cityCam, enterCity, exitCity, focusSpace, seekTo, renderer, cityMode };
})();
