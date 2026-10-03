// ================= 共用工具 =================
const AUS = 10; // 場景單位 / AU
const LOGDEPTH_V = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const LOGDEPTH_F = '#include <logdepthbuf_pars_fragment>\n';

function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(x, y, z, oct = 5) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }

function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

// 軌道攝影機：拖曳旋轉、滾輪/雙指縮放（對數距離）
class OrbitCam {
  constructor(el) {
    this.theta = 0.6; this.phi = 1.05; this.logD = Math.log(200); this.tlogD = this.logD;
    this.tTheta = this.theta; this.tPhi = this.phi;
    this.minD = 0.001; this.maxD = 5000; this.phiMin = 0.05; this.phiMax = Math.PI - 0.05;
    this.onZoomPastMin = null; this.onZoomPastMax = null; this.enabled = true; this.autoSpin = 0;
    const pts = new Map(); let pinch0 = 0, lastTap = 0;
    el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) pinch0 = this.pinchDist(pts); this.autoSpin = 0; });
    el.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !this.enabled) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1];
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { this.tTheta -= dx * 0.006; this.tPhi = Math.max(this.phiMin, Math.min(this.phiMax, this.tPhi - dy * 0.005)); }
      else if (pts.size === 2) { const d = this.pinchDist(pts); if (pinch0 > 0) this.zoomBy(Math.log(pinch0 / d) * 1.4); pinch0 = d; }
    });
    const up = e => { pts.delete(e.pointerId); pinch0 = pts.size === 2 ? this.pinchDist(pts) : 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); if (this.enabled) this.zoomBy(Math.sign(e.deltaY) * Math.min(0.35, Math.abs(e.deltaY) * 0.0016)); }, { passive: false });
  }
  pinchDist(pts) { const a = [...pts.values()]; return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) + 1; }
  zoomBy(k) {
    const n = this.tlogD + k;
    if (n < Math.log(this.minD)) { this.tlogD = Math.log(this.minD); if (k < 0 && this.logD < Math.log(this.minD) + 0.08 && this.onZoomPastMin) this.onZoomPastMin(); return; }
    if (n > Math.log(this.maxD)) { this.tlogD = Math.log(this.maxD); if (k > 0 && this.logD > Math.log(this.maxD) - 0.08 && this.onZoomPastMax) this.onZoomPastMax(); return; }
    this.tlogD = n;
  }
  setDist(d, instant) { this.tlogD = Math.log(Math.max(this.minD, Math.min(this.maxD, d))); if (instant) this.logD = this.tlogD; }
  get dist() { return Math.exp(this.logD); }
  update(dt, cam, target) {
    const k = 1 - Math.exp(-dt * 7);
    this.tTheta += this.autoSpin * dt;
    this.theta += (this.tTheta - this.theta) * k; this.phi += (this.tPhi - this.phi) * k; this.logD += (this.tlogD - this.logD) * k;
    const d = this.dist, sp = Math.sin(this.phi);
    cam.position.set(target.x + d * sp * Math.sin(this.theta), target.y + d * Math.cos(this.phi), target.z + d * sp * Math.cos(this.theta));
    cam.lookAt(target);
  }
}

// ================= 太空視角 =================
const PLANET_R = 4.26e-5 * AUS;   // 行星真實半徑（場景單位）
const MOON_ORBIT = PLANET_R * 34; // 巨月距離（誇張化，較月地距離近）
const MOON_R = PLANET_R * 0.42;

class SpaceView {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 1e-6, 3e6);
    this.focus = 'com'; this.focusPrev = null; this.focusBlend = 1;
    this.focusPhys = [0, 0, 0];
    this.spin = 0; this.time = 0;
    this.showHZ = true;
    this.buildBackground();
    this.buildStars();
    this.buildPlanet();
    this.buildTrails();
    this.buildGrid();
  }
  map(px, py, pz, out) { const f = this.focusPhys; out.set((px - f[0]) * AUS, (pz - f[2]) * AUS, -(py - f[1]) * AUS); return out; }

  buildBackground() {
    const n = 7000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const rng = mulberry32(77);
    for (let i = 0; i < n; i++) {
      let x, y, z;
      if (i < 3000) { // 銀河帶
        const a = rng() * Math.PI * 2, b = (rng() + rng() + rng() - 1.5) * 0.22;
        x = Math.cos(a) * Math.cos(b); z = Math.sin(a) * Math.cos(b); y = Math.sin(b);
        const t = 0.45; const y2 = y * Math.cos(t) - x * Math.sin(t), x2 = y * Math.sin(t) + x * Math.cos(t); x = x2; y = y2;
      } else { const u = rng() * 2 - 1, a = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u); x = s * Math.cos(a); y = u; z = s * Math.sin(a); }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const tint = rng(), br = 0.35 + Math.pow(rng(), 3) * 0.9;
      col[i * 3] = br * (tint < 0.2 ? 1 : 0.8 + tint * 0.2); col[i * 3 + 1] = br * 0.88; col[i * 3 + 2] = br * (tint > 0.75 ? 1.15 : 0.92);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false });
    this.bg = new THREE.Points(g, m); this.bg.renderOrder = -10; this.bg.frustumCulled = false;
    this.scene.add(this.bg);
  }

  buildStars() {
    this.starObjs = [];
    const glowT = glowTexture([[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.75)'], [0.32, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
    const haloT = glowTexture([[0, 'rgba(255,255,255,0.45)'], [0.25, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
    const geo = new THREE.SphereGeometry(1, 48, 24);
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uSeed: { value: i * 13.1 } },
        vertexShader: LOGDEPTH_V + `varying vec3 vN; varying vec3 vP; varying vec3 vV;
          void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv;
          #include <logdepthbuf_vertex>
          }`,
        fragmentShader: LOGDEPTH_F + `uniform vec3 uCol; uniform float uT; uniform float uSeed; varying vec3 vN; varying vec3 vP; varying vec3 vV;
          float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
          float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
          void main(){
#include <logdepthbuf_fragment>

            vec3 p=vP*6.+uSeed; float g=n(p+uT*.3)*.6+n(p*2.3-uT*.5)*.3+n(p*5.1+uT)*.1;
            float limb=pow(max(dot(vN,vV),0.),.45);
            vec3 c=mix(uCol*.55,mix(uCol,vec3(1.),.55),g)*(.35+.85*limb);
            gl_FragColor=vec4(c,1.); }`
      });
      const mesh = new THREE.Mesh(geo, mat);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.renderOrder = 2; halo.renderOrder = 1;
      this.scene.add(mesh, glow, halo);
      const hz = new THREE.Mesh(new THREE.RingGeometry(Math.sqrt(0.53 / 1.1), 1, 160, 1), new THREE.MeshBasicMaterial({ color: 0x3dffa0, transparent: true, opacity: 0.045, side: THREE.DoubleSide, depthWrite: false }));
      hz.rotation.x = -Math.PI / 2; this.scene.add(hz);
      const hzEdge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos(k / 160 * 6.2832), Math.sin(k / 160 * 6.2832), 0))), new THREE.LineBasicMaterial({ color: 0x3dffa0, transparent: true, opacity: 0.22, depthWrite: false }));
      hzEdge.rotation.x = -Math.PI / 2; this.scene.add(hzEdge);
      this.starObjs.push({ mesh, glow, halo, hz, hzEdge, pos: new THREE.Vector3() });
    }
  }

  // 行星：程序生成地表、夜間城市燈光、雲層、大氣
  buildPlanet() {
    this.texW = 512; this.texH = 256;
    this.dayCanvas = document.createElement('canvas'); this.dayCanvas.width = this.texW; this.dayCanvas.height = this.texH;
    this.nightCanvas = document.createElement('canvas'); this.nightCanvas.width = this.texW; this.nightCanvas.height = this.texH;
    this.cloudCanvas = document.createElement('canvas'); this.cloudCanvas.width = this.texW; this.cloudCanvas.height = this.texH;
    this.dayTex = new THREE.CanvasTexture(this.dayCanvas); this.nightTex = new THREE.CanvasTexture(this.nightCanvas); this.cloudTex = new THREE.CanvasTexture(this.cloudCanvas);
    [this.dayTex, this.nightTex, this.cloudTex].forEach(t => { t.colorSpace = undefined; t.anisotropy = 4; });
    const sunU = () => ({ value: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(), new THREE.Vector3()] });
    const common = {
      uSunDir: sunU(), uSunCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] }, uSunI: { value: [1, 0, 0] }
    };
    this.planetUniforms = Object.assign({ uDay: { value: this.dayTex }, uNight: { value: this.nightTex }, uLights: { value: 1 } }, common);
    const pv = LOGDEPTH_V + `varying vec3 vN; varying vec2 vUv; varying vec3 vW;
      void main(){ vN=normalize(mat3(modelMatrix)*normal); vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w;
      #include <logdepthbuf_vertex>
      }`;
    const lightFn = `uniform vec3 uSunDir[3]; uniform vec3 uSunCol[3]; uniform float uSunI[3];
      vec3 lightAt(vec3 n, out float L){ vec3 s=vec3(0.); L=0.; for(int i=0;i<3;i++){ float d=max(dot(n,uSunDir[i]),0.); float w=smoothstep(-.08,.25,dot(n,uSunDir[i]));
        s+=uSunCol[i]*uSunI[i]*(d*.9+w*.1); L+=uSunI[i]*w; } return s; }`;
    const pmat = new THREE.ShaderMaterial({
      uniforms: this.planetUniforms, vertexShader: pv,
      fragmentShader: LOGDEPTH_F + lightFn + `uniform sampler2D uDay; uniform sampler2D uNight; uniform float uLights; varying vec3 vN; varying vec2 vUv; varying vec3 vW;
        void main(){
#include <logdepthbuf_fragment>

          vec3 n=normalize(vN); float L; vec3 li=lightAt(n,L);
          vec3 base=texture2D(uDay,vUv).rgb;
          vec3 col=base*(li+vec3(.012,.016,.03));
          vec3 night=texture2D(uNight,vUv).rgb*uLights*smoothstep(.35,.0,L);
          vec3 v=normalize(cameraPosition-vW); float fr=pow(1.-max(dot(n,v),0.),3.);
          col+=night*1.6+vec3(.3,.55,1.)*fr*min(L,1.2)*.6;
          gl_FragColor=vec4(col,1.); }`
    });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), pmat);
    this.planetTilt = new THREE.Group(); this.planetTilt.rotation.z = 0.26; this.planetTilt.add(this.planet);
    this.cloudUniforms = Object.assign({ uC: { value: this.cloudTex } }, common);
    const cmat = new THREE.ShaderMaterial({
      uniforms: this.cloudUniforms, vertexShader: pv, transparent: true, depthWrite: false,
      fragmentShader: LOGDEPTH_F + lightFn + `uniform sampler2D uC; varying vec3 vN; varying vec2 vUv; varying vec3 vW;
        void main(){
#include <logdepthbuf_fragment>

          float a=texture2D(uC,vUv).r; float L; vec3 li=lightAt(normalize(vN),L);
          gl_FragColor=vec4(li*.95+vec3(.01),a*.85); }`
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 64, 48), cmat);
    this.planetTilt.add(this.clouds);
    this.atmUniforms = Object.assign({}, common);
    const amat = new THREE.ShaderMaterial({
      uniforms: this.atmUniforms, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: pv,
      fragmentShader: LOGDEPTH_F + lightFn + `varying vec3 vN; varying vec2 vUv; varying vec3 vW;
        void main(){
#include <logdepthbuf_fragment>

          vec3 n=normalize(vN); vec3 v=normalize(cameraPosition-vW); float rim=pow(max(1.0-abs(dot(n,v))*1.0,0.),2.2);
          float L; vec3 li=lightAt(-n,L); li=max(li,lightAt(n,L)*.0);
          gl_FragColor=vec4(vec3(.35,.62,1.)*rim*clamp(L+.04,0.,1.4)*.9,1.); }`
    });
    this.atm = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), amat);
    this.planetTilt.add(this.atm);
    this.scene.add(this.planetTilt);
    // 巨月
    this.moonUniforms = Object.assign({}, common);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.ShaderMaterial({
      uniforms: this.moonUniforms, vertexShader: pv,
      fragmentShader: LOGDEPTH_F + lightFn + `varying vec3 vN; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        void main(){
#include <logdepthbuf_fragment>

          float L; vec3 li=lightAt(normalize(vN),L);
          vec2 g=vUv*vec2(18.,9.); vec2 c=floor(g); float cr=step(.82,h(c))*smoothstep(.5,.2,length(fract(g)-.5));
          float m=.62-.18*cr+.08*h(floor(vUv*80.));
          gl_FragColor=vec4(vec3(m)*li+vec3(.008),1.); }`
    }));
    this.scene.add(this.moon);
    this.planetPos = new THREE.Vector3();
  }

  // 依世界種子產生地表，依氣候重新上色
  genPlanetBase(seed) {
    const W = this.texW, H = this.texH, hgt = new Float32Array(W * H), cl = new Float32Array(W * H);
    const o = seed % 1000;
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - y / H) * Math.PI, cy = Math.cos(lat), sy = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const lon = x / W * Math.PI * 2, px = cy * Math.cos(lon), pz = cy * Math.sin(lon);
        const v = fbm3(px * 1.6 + o, sy * 1.6, pz * 1.6, 6);
        hgt[y * W + x] = v + 0.12 * fbm3(px * 5 + o, sy * 5, pz * 5, 3);
        cl[y * W + x] = fbm3(px * 2.4 + 50 + o, sy * 4.2, pz * 2.4, 5);
      }
    }
    this.hgt = hgt; this.climKey = '';
    const g = this.cloudCanvas.getContext('2d'), im = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) { const a = Math.max(0, Math.min(1, (cl[i] - 0.5) * 3.2)); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = a * 255; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); this.cloudTex.needsUpdate = true;
  }
  paintPlanet(T) {
    const snow = Math.max(0, Math.min(1, (-T - 5) / 70)), heat = Math.max(0, Math.min(1, (T - 40) / 110));
    const key = Math.round(snow * 10) + ':' + Math.round(heat * 10);
    if (key === this.climKey) return; this.climKey = key;
    const W = this.texW, H = this.texH, g = this.dayCanvas.getContext('2d'), im = g.createImageData(W, H), d = im.data;
    const sea = 0.5 - heat * 0.12; // 高溫時海洋蒸發
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(0.5 - y / H) * 2;
      const ice = Math.min(1, Math.max(0, (lat - (0.82 - snow * 0.8 + heat * 0.3)) * 8));
      for (let x = 0; x < W; x++) {
        const i = y * W + x, h = this.hgt[i]; let r, gg, b;
        if (h < sea) { const k = (sea - h) * 3; r = 16 - k * 10; gg = 52 - k * 20; b = 96 - k * 30; if (heat > 0.3) { r += 60 * heat; gg += 30 * heat; b -= 30 * heat; } }
        else {
          const k = (h - sea) * 4;
          r = 62 + k * 70; gg = 98 + k * 25 - lat * 30; b = 48 + k * 30;
          if (lat < 0.3 && h < sea + 0.06) { r += 30; gg += 15; }
          r = r * (1 - heat) + (120 + k * 60) * heat; gg = gg * (1 - heat) + (62 + k * 20) * heat; b = b * (1 - heat) + (38) * heat;
        }
        const s = Math.max(ice, snow * (h > sea ? 0.85 : 0.6));
        r = r * (1 - s) + 228 * s; gg = gg * (1 - s) + 236 * s; b = b * (1 - s) + 245 * s;
        d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0); this.dayTex.needsUpdate = true;
  }
  paintLights(age, seed, alive) {
    const key = age + ':' + seed + ':' + alive; if (key === this.lightKey) return; this.lightKey = key;
    const W = this.texW, H = this.texH, g = this.nightCanvas.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (!alive || !this.hgt) { this.nightTex.needsUpdate = true; return; }
    const rng = mulberry32(seed), n = [20, 50, 90, 160, 380, 900, 1500, 2300, 2800][age];
    const centers = []; for (let k = 0; k < 6 + age * 2; k++) centers.push([rng() * W, H * (0.2 + rng() * 0.6)]);
    for (let k = 0; k < n; k++) {
      const c = centers[Math.floor(rng() * centers.length)], sp = 6 + age * 7;
      const x = Math.floor((c[0] + (rng() - 0.5) * sp * 2 + W) % W), y = Math.floor(Math.max(1, Math.min(H - 2, c[1] + (rng() - 0.5) * sp)));
      if (this.hgt[y * W + x] < 0.5) continue;
      const b = 0.35 + rng() * 0.65, warm = age < 5;
      g.fillStyle = warm ? `rgba(255,${150 + rng() * 60},70,${b})` : `rgba(255,${210 + rng() * 40},${150 + rng() * 60},${b})`;
      g.fillRect(x, y, rng() < 0.15 ? 2 : 1, 1);
    }
    if (age >= 6) { g.globalAlpha = 0.25; g.strokeStyle = '#ffd890'; for (let k = 0; k < age * 3; k++) { const a = centers[k % centers.length], b = centers[(k * 7 + 3) % centers.length]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } g.globalAlpha = 1; }
    this.nightTex.needsUpdate = true;
  }

  buildTrails() {
    this.trails = [];
    const mk = (n, color, op) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false; this.scene.add(line);
      return { line, n, buf: new Float64Array(n * 3), head: 0, count: 0, last: null, color: new THREE.Color(color) };
    };
    for (let i = 0; i < 3; i++) this.trails.push(mk(1400, 0xffffff, 0.85));
    this.trails.push(mk(1800, 0x6ab8ff, 0.9));
    this.twinTrails = [0, 1, 2].map(() => mk(1400, 0xff7ad9, 0.75));
  }
  clearTrails() { [...this.trails, ...this.twinTrails].forEach(t => { t.head = 0; t.count = 0; t.last = null; }); }
  pushTrail(t, x, y, z, minStep) {
    if (t.last && Math.hypot(x - t.last[0], y - t.last[1], z - t.last[2]) < minStep) {
      // 更新最新點，讓線條跟上目前位置
      const k = ((t.head - 1 + t.n) % t.n) * 3; t.buf[k] = x; t.buf[k + 1] = y; t.buf[k + 2] = z; return;
    }
    const k = t.head * 3; t.buf[k] = x; t.buf[k + 1] = y; t.buf[k + 2] = z;
    t.head = (t.head + 1) % t.n; t.count = Math.min(t.n, t.count + 1);
    t.last = [x, y, z];
    // 下一點先佔位，作為「目前位置」
    const k2 = t.head * 3; t.buf[k2] = x; t.buf[k2 + 1] = y; t.buf[k2 + 2] = z; t.head = (t.head + 1) % t.n; t.count = Math.min(t.n, t.count + 1);
  }
  writeTrail(t, visible) {
    t.line.visible = visible && t.count > 1; if (!t.line.visible) return;
    const p = t.line.geometry.attributes.position.array, c = t.line.geometry.attributes.color.array, f = this.focusPhys;
    const start = (t.head - t.count + t.n) % t.n;
    for (let i = 0; i < t.count; i++) {
      const k = ((start + i) % t.n) * 3, a = Math.pow(i / t.count, 1.6);
      p[i * 3] = (t.buf[k] - f[0]) * AUS; p[i * 3 + 1] = (t.buf[k + 2] - f[2]) * AUS; p[i * 3 + 2] = -(t.buf[k + 1] - f[1]) * AUS;
      c[i * 3] = t.color.r * a; c[i * 3 + 1] = t.color.g * a; c[i * 3 + 2] = t.color.b * a;
    }
    t.line.geometry.setDrawRange(0, t.count);
    t.line.geometry.attributes.position.needsUpdate = true; t.line.geometry.attributes.color.needsUpdate = true;
  }

  buildGrid() {
    const pts = [];
    [1, 2, 5, 10, 20, 50, 100].forEach(r => { for (let k = 0; k < 128; k++) { const a = k / 128 * 6.2832, b = (k + 1) / 128 * 6.2832; pts.push(r * Math.cos(a) * AUS, 0, r * Math.sin(a) * AUS, r * Math.cos(b) * AUS, 0, r * Math.sin(b) * AUS); } });
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832; pts.push(AUS * Math.cos(a), 0, AUS * Math.sin(a), 100 * AUS * Math.cos(a), 0, 100 * AUS * Math.sin(a)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0.07, depthWrite: false }));
    this.scene.add(this.grid);
  }

  physPos(world, key, out) {
    const s = world.sim;
    if (key === 'planet') { out[0] = s.pp[0]; out[1] = s.pp[1]; out[2] = s.pp[2]; }
    else if (key === 'com') { const c = s.com(); out[0] = c[0]; out[1] = c[1]; out[2] = c[2]; }
    else { const i = +key.slice(4); out[0] = s.sp[i * 3]; out[1] = s.sp[i * 3 + 1]; out[2] = s.sp[i * 3 + 2]; }
    return out;
  }
  setFocus(key) { if (key === this.focus) return; this.focusPrev = this.focus; this.focus = key; this.focusBlend = 0; }

  sampleTrails(world, twin) {
    const s = world.sim;
    for (let i = 0; i < 3; i++) this.pushTrail(this.trails[i], s.sp[i * 3], s.sp[i * 3 + 1], s.sp[i * 3 + 2], 0.04);
    this.pushTrail(this.trails[3], s.pp[0], s.pp[1], s.pp[2], 0.025);
    if (twin) for (let i = 0; i < 3; i++) this.pushTrail(this.twinTrails[i], twin.sp[i * 3], twin.sp[i * 3 + 1], twin.sp[i * 3 + 2], 0.04);
  }

  update(dt, world, cam, twin, civInfo) {
    this.time += dt;
    const s = world.sim, info = world.info;
    // 浮動原點：以焦點為中心
    const a = this.physPos(world, this.focus, [0, 0, 0]);
    if (this.focusBlend < 1 && this.focusPrev) {
      this.focusBlend = Math.min(1, this.focusBlend + dt / 1.1);
      const b = this.physPos(world, this.focusPrev, [0, 0, 0]), e = this.focusBlend * this.focusBlend * (3 - 2 * this.focusBlend);
      for (let k = 0; k < 3; k++) this.focusPhys[k] = b[k] + (a[k] - b[k]) * e;
    } else for (let k = 0; k < 3; k++) this.focusPhys[k] = a[k];

    const camD = cam.dist;
    // 恆星
    for (let i = 0; i < 3; i++) {
      const o = this.starObjs[i], st = s.stars[i];
      this.map(s.sp[i * 3], s.sp[i * 3 + 1], s.sp[i * 3 + 2], o.pos);
      const camTo = o.pos.distanceTo(this.camera.position);
      const trueR = st.R * 0.00465 * AUS, visR = Math.max(trueR, camTo * 0.007 * Math.pow(st.L, 0.15));
      o.mesh.position.copy(o.pos); o.mesh.scale.setScalar(visR);
      o.mesh.material.uniforms.uCol.value.setRGB(st.color[0], st.color[1], st.color[2]);
      o.mesh.material.uniforms.uT.value = this.time;
      o.glow.position.copy(o.pos); o.glow.scale.setScalar(visR * 9);
      o.glow.material.color.setRGB(st.color[0], st.color[1], st.color[2]);
      o.halo.position.copy(o.pos); o.halo.scale.setScalar(Math.max(visR * 26, camTo * 0.07) * Math.pow(st.L, 0.2));
      o.halo.material.color.setRGB(st.color[0] * 0.8, st.color[1] * 0.8, st.color[2] * 0.8);
      const inner = Math.sqrt(st.L / 1.1) * AUS, outer = Math.sqrt(st.L / 0.53) * AUS;
      o.hz.position.copy(o.pos); o.hzEdge.position.copy(o.pos);
      o.hz.scale.setScalar(outer); o.hzEdge.scale.setScalar(outer);
      o.hz.visible = o.hzEdge.visible = this.showHZ && camD > 0.4;
    }
    // 行星
    this.map(s.pp[0], s.pp[1], s.pp[2], this.planetPos);
    const pTo = this.planetPos.distanceTo(this.camera.position);
    const pVis = Math.max(PLANET_R, pTo * 0.006);
    this.planetTilt.position.copy(this.planetPos); this.planetTilt.scale.setScalar(pVis);
    this.planet.rotation.y = this.spin; this.clouds.rotation.y = this.spin * 1.04 + this.time * 0.004;
    // 太陽方向（世界座標）
    const sd = this.planetUniforms.uSunDir.value, sc = this.planetUniforms.uSunCol.value, si = this.planetUniforms.uSunI.value;
    for (let i = 0; i < 3; i++) {
      sd[i].copy(this.starObjs[i].pos).sub(this.planetPos).normalize();
      const st = s.stars[i]; sc[i].setRGB(st.color[0], st.color[1], st.color[2]);
      si[i] = Math.min(1.5, Math.pow(info.stars[i].flux, 0.4));
    }
    this.planetUniforms.uLights.value = civInfo.lights;
    // 巨月
    const mAng = this.time * 0.05 + s.t * 2.0;
    const mDist = MOON_ORBIT * (pVis / PLANET_R);
    this.moon.position.set(this.planetPos.x + Math.cos(mAng) * mDist, this.planetPos.y + Math.sin(mAng) * mDist * 0.12, this.planetPos.z + Math.sin(mAng) * mDist);
    this.moon.scale.setScalar(MOON_R * pVis / PLANET_R);
    this.moon.visible = pVis < PLANET_R * 30;
    // 軌跡
    for (let i = 0; i < 3; i++) { this.trails[i].color.setRGB(s.stars[i].color[0], s.stars[i].color[1], s.stars[i].color[2]); this.writeTrail(this.trails[i], true); }
    this.writeTrail(this.trails[3], true);
    this.twinTrails.forEach(t => this.writeTrail(t, !!twin));
    // 網格以質心為中心
    const com = s.com(); this.map(com[0], com[1], com[2], this.grid.position);
    this.grid.material.opacity = 0.07;
    // 背景星空跟隨攝影機
    this.bg.position.copy(this.camera.position); this.bg.scale.setScalar(Math.min(1e6, Math.max(camD * 400, 1000)));
    this.camera.near = Math.max(1e-7, camD * 0.002); this.camera.far = Math.max(1e5, camD * 1e5); this.camera.updateProjectionMatrix();
  }
}
