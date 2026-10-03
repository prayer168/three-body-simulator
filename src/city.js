// ================= 城市視角 =================
const WX = {
  uSnow: { value: 0 }, uHeat: { value: 0 }, uNight: { value: 0 }, uWin: { value: 0 }, uBurn: { value: 0 },
  uWinCol: { value: new THREE.Color(1, 0.78, 0.45) }
};
const WINDOWS_GLSL = `
  float side = 1.0 - abs(vWN.y);
  float hx = vWPos.x*abs(vWN.z) + vWPos.z*abs(vWN.x);
  vec2 gg = vec2(hx/1.3, vWPos.y/1.55);
  vec2 cell = floor(gg); vec2 ff = fract(gg);
  float win = step(0.18,ff.x)*step(ff.x,0.82)*step(0.26,ff.y)*step(ff.y,0.8)*step(0.5,side)*step(1.4, vWPos.y);
  float rr = fract(sin(dot(cell, vec2(12.9898,78.233)) + floor(vWPos.x*0.06)*3.1 + floor(vWPos.z*0.06)*7.7)*43758.5453);
  float lit = step(1.0 - uWin, rr);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*0.4 + vec3(0.05,0.07,0.1), win*0.75);
  totalEmissiveRadiance += win*lit*uWinCol*uNight*(0.6+0.7*rr);
`;
function weatherize(mat, opts = {}) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, WX);
    sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      #ifdef USE_INSTANCING
        mat4 _wm = modelMatrix * instanceMatrix;
      #else
        mat4 _wm = modelMatrix;
      #endif
      vWPos = (_wm * vec4(transformed,1.0)).xyz; vWN = normalize(mat3(_wm) * objectNormal);`);
    sh.fragmentShader = 'uniform float uSnow; uniform float uHeat; uniform float uNight; uniform float uWin; uniform float uBurn; uniform vec3 uWinCol; varying vec3 vWPos; varying vec3 vWN;\n' +
      sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float upF = smoothstep(0.35, 0.85, vWN.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9,0.93,0.98), uSnow*upF*${opts.snowK || '1.0'});
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.78,0.52,0.36)+vec3(0.07,0.02,0.0), uHeat*${opts.heatK || '0.7'});
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.07,0.06,0.055), uBurn*${opts.burnK || '0.0'});
        ${opts.windows ? WINDOWS_GLSL : ''}`);
  };
  mat.customProgramCacheKey = () => 'wx' + (opts.windows ? 'w' : '') + (opts.snowK || '') + (opts.heatK || '') + (opts.burnK || '');
  return mat;
}

const PITCH = 14, ROAD = 2.6, NB = 8, RC = (NB + 0.5) * PITCH;
const REACH = [0.16, 0.26, 0.36, 0.46, 0.6, 0.72, 0.84, 0.95, 1.02];
const OCC = [0.32, 0.48, 0.58, 0.66, 0.78, 0.85, 0.9, 0.93, 0.95];
const HMAX = [1.1, 1.5, 2.1, 2.7, 5, 9, 16, 27, 34];
const FOOT = [0.45, 0.62, 0.7, 0.76, 0.86, 0.9, 0.92, 0.92, 0.92];
const TOWER_PAL = [[0.74, 0.76, 0.8], [0.6, 0.65, 0.72], [0.8, 0.75, 0.66], [0.5, 0.58, 0.68], [0.86, 0.86, 0.88], [0.66, 0.6, 0.56], [0.55, 0.68, 0.72]];
const PEND = { x: -2 * PITCH, z: 1 * PITCH };
const PAD = { x: 6 * PITCH, z: -6 * PITCH };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class CityView {
  constructor(quality) {
    this.q = quality;
    const sc = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 5000);
    sc.fog = new THREE.Fog(0x9fb8d8, 300, 1700);
    this.time = 0; this.target = new THREE.Vector3(0, 0, 0); this.targetGoal = new THREE.Vector3();
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0x3a3226, 0.5); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.sun.castShadow = quality > 1;
    this.sun.shadow.mapSize.set(2048, 2048); const sca = this.sun.shadow.camera; sca.left = -230; sca.right = 230; sca.top = 230; sca.bottom = -230; sca.near = 10; sca.far = 1600;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.4;
    sc.add(this.sun, this.sun.target);
    this.fill = [new THREE.DirectionalLight(0xffffff, 0), new THREE.DirectionalLight(0xffffff, 0)]; this.fill.forEach(l => sc.add(l));
    this.buildSky(); this.buildTerrain(1); this.buildMeshes(); this.buildMonuments();
    this.layoutSeed = -1; this.stateKey = '';
  }

  // ---------- 天空 ----------
  buildSky() {
    const U = this.skyU = {
      uSunDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(), new THREE.Vector3()] },
      uSunCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uSunVis: { value: [1, 0, 0] }, uSunSize: { value: [0.02, 0.01, 0.01] },
      uDay: { value: 1 }, uHeat: { value: 0 }, uSnow: { value: 0 }
    };
    const m = new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: LOGDEPTH_V + `varying vec3 vD; void main(){ vD=position; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader: LOGDEPTH_F + `uniform vec3 uSunDir[3]; uniform vec3 uSunCol[3]; uniform float uSunVis[3]; uniform float uSunSize[3]; uniform float uDay; uniform float uHeat; uniform float uSnow; varying vec3 vD;
        void main(){
        #include <logdepthbuf_fragment>
          vec3 d=normalize(vD); float h=d.y;
          vec3 nz=vec3(.008,.012,.035), nh=vec3(.03,.04,.075);
          vec3 dz=vec3(.16,.36,.74), dh=vec3(.62,.74,.88);
          vec3 col=mix(mix(nh,nz,clamp(h*2.2,0.,1.)), mix(dh,dz,pow(clamp(h,0.,1.),.55)), uDay);
          for(int i=0;i<3;i++){
            float c=dot(d,uSunDir[i]); float v=uSunVis[i]*smoothstep(-.08,.02,uSunDir[i].y);
            float glow=pow(max(c,0.),18.)*.22+pow(max(c,0.),260.)*.55;
            float r=uSunSize[i]; float disk=smoothstep(cos(r*1.35),cos(r),c);
            col+=uSunCol[i]*v*glow*(.35+uDay);
            col+=mix(uSunCol[i],vec3(1.),.5)*disk*min(v*1.6+.5,2.2)*step(.001,uSunVis[i]);
            col+=vec3(1.,.42,.16)*pow(max(c,0.),3.)*exp(-abs(h)*7.)*v*.55*(1.-uDay*.5);
          }
          col=mix(col,vec3(.85,.42,.18)*(.4+uDay*.6),uHeat*.55);
          col=mix(col,col*vec3(.92,.97,1.08),uSnow*.4);
          col=mix(col,vec3(.05,.055,.06)*(.3+uDay),clamp(-h*5.,0.,1.));
          gl_FragColor=vec4(col,1.); }`
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2400, 48, 24), m); this.sky.renderOrder = -10; this.scene.add(this.sky);
    // 夜空星點
    const n = 2500, p = new Float32Array(n * 3), rng = mulberry32(5);
    for (let i = 0; i < n; i++) { const u = rng() * 0.98 + 0.02, a = rng() * 6.2832, s = Math.sqrt(1 - u * u); p[i * 3] = s * Math.cos(a) * 2200; p[i * 3 + 1] = u * 2200; p[i * 3 + 2] = s * Math.sin(a) * 2200; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.nightStars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, color: 0xdde3f5, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.nightStars);
    // 巨月
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const gr = x.createRadialGradient(110, 100, 10, 128, 128, 120); gr.addColorStop(0, '#f2f0ea'); gr.addColorStop(0.75, '#bdbab2'); gr.addColorStop(1, '#8d8a84');
    x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
    const r2 = mulberry32(9); x.globalAlpha = 0.18; for (let i = 0; i < 40; i++) { x.fillStyle = r2() < 0.5 ? '#6e6b66' : '#ffffff'; x.beginPath(); const a = r2() * 6.28, d = r2() * 100; x.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 4 + r2() * 18, 0, 7); x.fill(); }
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false, transparent: true, depthWrite: false }));
    this.moon.scale.setScalar(150); this.scene.add(this.moon);
  }

  // ---------- 地形 ----------
  heightAt(x, z) {
    const o = this.tSeed, r = Math.hypot(x, z);
    const n = fbm3(x * 0.005 + o, 0.3, z * 0.005, 5);
    let h = smooth(140, 420, r) * (0.25 + n) * 95;
    h += smooth(95, 220, r) * (fbm3(x * 0.02, 1.7 + o, z * 0.02, 3) - 0.45) * 14;
    const dd = (x * this.seaDir[0] + z * this.seaDir[1]) / (r + 1e-6);
    h -= smooth(0.45, 0.85, dd) * smooth(150, 300, r) * 60;
    h += (fbm3(x * 0.05, 3.3, z * 0.05 + o, 2) - 0.5) * 0.5 * smooth(40, 120, r);
    return h;
  }
  buildTerrain(seed) {
    this.tSeed = (seed % 97) * 1.37; const a = (seed % 360) * 0.0174;
    this.seaDir = [Math.cos(a), Math.sin(a)];
    const S = 2000, N = this.q > 1 ? 220 : 150;
    const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.heightAt(x, z); pos.setY(i, h);
      const nv = fbm3(x * 0.018, 9, z * 0.018, 4), nv2 = fbm3(x * 0.09, 2, z * 0.09, 2);
      let c = [0.15 + nv * 0.14 + nv2 * 0.05, 0.27 + nv * 0.12 + nv2 * 0.05, 0.11 + nv * 0.05];
      if (h > 22) { const k = smooth(22, 45, h); c = c.map((v, j) => v * (1 - k) + [0.42, 0.41, 0.38][j] * k); }
      if (h > 62) { const k = smooth(62, 85, h); c = c.map(v => v * (1 - k) + 0.9 * k); }
      if (h < 0.6 && Math.hypot(x, z) > 140) { const k = smooth(0.6, -1.5, h); c = c.map((v, j) => v * (1 - k) + [0.72, 0.66, 0.48][j] * k); }
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    if (this.terrain) { this.scene.remove(this.terrain); this.terrain.geometry.dispose(); }
    this.terrain = new THREE.Mesh(g, weatherize(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { burnK: '0.5' }));
    this.terrain.receiveShadow = true; this.scene.add(this.terrain);
    if (!this.water) {
      this.waterMat = new THREE.MeshStandardMaterial({ color: 0x1b4a6e, roughness: 0.18, metalness: 0.2, transparent: true, opacity: 0.88 });
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(S, S), this.waterMat); this.water.rotation.x = -Math.PI / 2; this.water.position.y = -1.2;
      this.scene.add(this.water);
    }
  }

  // ---------- 實例化網格 ----------
  buildMeshes() {
    const lots = 2400;
    const std = (c, o = {}) => { const { wx, ...rest } = o; return weatherize(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, rest)), wx || {}); };
    const im = (geo, mat, n, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; this.scene.add(m); return m; };
    const hutGeo = new THREE.CylinderGeometry(0.5, 0.55, 1, 7); hutGeo.translate(0, 0.5, 0);
    const hutRoofGeo = new THREE.ConeGeometry(0.72, 0.9, 7); hutRoofGeo.translate(0, 0.45, 0);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
    const roofGeo = new THREE.ConeGeometry(0.72, 0.55, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, 0.275, 0);
    const chimGeo = new THREE.CylinderGeometry(0.35, 0.5, 1, 8); chimGeo.translate(0, 0.5, 0);
    this.m = {
      hut: im(hutGeo, std(0xffffff), lots), hutRoof: im(hutRoofGeo, std(0xffffff, { wx: { snowK: '1.0' } }), lots),
      house: im(boxGeo, std(0xffffff), lots), roof: im(roofGeo, std(0xffffff), lots),
      tower: im(boxGeo, std(0xffffff, { roughness: 0.5, metalness: 0.15, wx: { windows: true, burnK: '0.9' } }), lots),
      factory: im(boxGeo, std(0xffffff), 300), chimney: im(chimGeo, std(0x6b5146), 300),
      road: im(boxGeo, std(0xffffff, { roughness: 1 }), 700, false),
      farm: im(boxGeo, std(0xffffff, { roughness: 1 }), 1400, false),
      tree: im(new THREE.ConeGeometry(1, 3.2, 6).translate(0, 1.6, 0), std(0xffffff, { wx: { burnK: '1.0' } }), this.q > 1 ? 2600 : 1400),
      wall: im(boxGeo, std(0xb8a888), 120),
      person: im(new THREE.BoxGeometry(0.42, 1.1, 0.42).translate(0, 0.55, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), 420, false),
      car: im(new THREE.BoxGeometry(1.0, 0.75, 2.0).translate(0, 0.38, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.3 }), 420, false),
      smoke: im(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.32, depthWrite: false }), 220, false)
    };
    this.m.road.receiveShadow = true;
    const lampG = new THREE.BufferGeometry(); lampG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(900 * 3), 3));
    this.lamps = new THREE.Points(lampG, new THREE.PointsMaterial({ size: 5, color: 0xffcc66, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]) }));
    this.lamps.frustumCulled = false; this.scene.add(this.lamps);
    this.dummy = new THREE.Object3D(); this.col = new THREE.Color();
  }

  // ---------- 紀念建築：巨擺、中央地標、發射場 ----------
  buildMonuments() {
    const stone = weatherize(new THREE.MeshStandardMaterial({ color: 0x9a8f7e, roughness: 0.9 }), { burnK: '0.7' });
    const bronze = new THREE.MeshStandardMaterial({ color: 0x3b3a3f, roughness: 0.3, metalness: 0.8 });
    const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
    // 巨擺
    const P = this.pend = new THREE.Group(); P.position.set(PEND.x, 0, PEND.z);
    mk(new THREE.BoxGeometry(30, 0.8, 12), stone, 0, 0.4, 0, P);
    mk(new THREE.BoxGeometry(2.6, 48, 2.6), stone, -11, 24, 0, P); mk(new THREE.BoxGeometry(2.6, 48, 2.6), stone, 11, 24, 0, P);
    mk(new THREE.BoxGeometry(26, 2.6, 3.2), stone, 0, 48, 0, P);
    this.pivot = new THREE.Group(); this.pivot.position.set(0, 46.5, 0); P.add(this.pivot);
    mk(new THREE.CylinderGeometry(0.15, 0.15, 38, 6), bronze, 0, -19, 0, this.pivot);
    this.ball = mk(new THREE.SphereGeometry(3.4, 32, 20), bronze, 0, -39.5, 0, this.pivot);
    this.scene.add(P);
    // 中央地標
    const C = this.center = new THREE.Group(); this.scene.add(C);
    mk(new THREE.BoxGeometry(PITCH - ROAD, 0.4, PITCH - ROAD), stone, 0, 0.2, 0, C);
    this.pyramid = new THREE.Group(); C.add(this.pyramid);
    [10, 8, 6, 4].forEach((s, i) => mk(new THREE.BoxGeometry(s, 2, s), stone, 0, 1 + i * 2, 0, this.pyramid));
    mk(new THREE.BoxGeometry(2.4, 3, 2.4), stone, 0, 9.5, 0, this.pyramid);
    this.clock = new THREE.Group(); C.add(this.clock);
    mk(new THREE.BoxGeometry(4.2, 26, 4.2), new THREE.MeshStandardMaterial({ color: 0x8c5a43, roughness: 0.9 }), 0, 13, 0, this.clock);
    mk(new THREE.ConeGeometry(3.4, 6, 4).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0x2d3a3a, roughness: 0.6 }), 0, 29, 0, this.clock);
    this.clockFace = new THREE.MeshStandardMaterial({ color: 0xf4ead0, emissive: 0xffcc44, emissiveIntensity: 0 });
    [0, 1, 2, 3].forEach(k => { const f = mk(new THREE.CircleGeometry(1.4, 24), this.clockFace, Math.sin(k * Math.PI / 2) * 2.12, 22, Math.cos(k * Math.PI / 2) * 2.12, this.clock); f.rotation.y = k * Math.PI / 2; });
    this.tvTower = new THREE.Group(); C.add(this.tvTower);
    const conc = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.6 });
    mk(new THREE.CylinderGeometry(1.1, 2.2, 74, 16), conc, 0, 37, 0, this.tvTower);
    mk(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd04040, roughness: 0.4, metalness: 0.3 }), 0, 56, 0, this.tvTower);
    mk(new THREE.CylinderGeometry(0.2, 0.4, 22, 6), conc, 0, 85, 0, this.tvTower);
    this.supertall = new THREE.Group(); C.add(this.supertall);
    const glass = weatherize(new THREE.MeshStandardMaterial({ color: 0x8a9bb2, roughness: 0.35, metalness: 0.1 }), { windows: true, burnK: '0.9' });
    [[9.5, 70, 0], [7.5, 48, 70], [5.5, 34, 118], [3.6, 16, 152]].forEach(([s, h, y]) => mk(new THREE.BoxGeometry(s, h, s), glass, 0, y + h / 2, 0, this.supertall));
    mk(new THREE.CylinderGeometry(0.15, 0.6, 26, 6), conc, 0, 181, 0, this.supertall);
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,90,90,1)'], [0.3, 'rgba(255,60,60,0.5)'], [1, 'rgba(255,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beacon.position.set(0, 194, 0); this.beacon.scale.setScalar(8); this.supertall.add(this.beacon);
    // 發射場
    const L = this.launch = new THREE.Group(); L.position.set(PAD.x, 0, PAD.z); this.scene.add(L);
    mk(new THREE.CylinderGeometry(14, 15, 1.2, 32), conc, 0, 0.6, 0, L);
    mk(new THREE.BoxGeometry(3, 46, 3), new THREE.MeshStandardMaterial({ color: 0xc23b2b, roughness: 0.7 }), -7, 23, 0, L);
    const R = this.rocket = new THREE.Group(); L.add(R);
    const white = new THREE.MeshStandardMaterial({ color: 0xeef1f5, roughness: 0.35, metalness: 0.2 });
    mk(new THREE.CylinderGeometry(2.4, 2.4, 34, 24), white, 0, 18, 0, R);
    mk(new THREE.ConeGeometry(2.4, 7, 24), white, 0, 38.5, 0, R);
    mk(new THREE.CylinderGeometry(2.45, 2.45, 2.4, 24), new THREE.MeshStandardMaterial({ color: 0xffcc44, roughness: 0.3, metalness: 0.6 }), 0, 30, 0, R);
    [0, 1, 2, 3].forEach(k => { const f = mk(new THREE.BoxGeometry(0.4, 6, 3.6), white, Math.sin(k * 1.5708) * 2.8, 4, Math.cos(k * 1.5708) * 2.8, R); f.rotation.y = k * 1.5708; });
    this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,200,90,0.9)'], [0.6, 'rgba(255,110,40,0.35)'], [1, 'rgba(255,60,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flame.position.set(0, -4, 0); this.flame.scale.set(9, 20, 1); this.flame.visible = false; R.add(this.flame);
    this.launchT = -1;
  }

  // ---------- 城市佈局（每個文明一份） ----------
  setLayout(seed) {
    if (seed === this.layoutSeed) return; this.layoutSeed = seed;
    const rng = mulberry32(seed), lots = [], ang0 = rng() * 6.28;
    const skip = (bx, bz) => (bx === 0 && bz === 0) || (bx === -2 && bz === 1) || (bx === -1 && bz === 1) || (Math.abs(bx - 6) <= 1 && Math.abs(bz + 6) <= 1);
    const B = PITCH - ROAD;
    for (let bx = -NB; bx <= NB; bx++) for (let bz = -NB; bz <= NB; bz++) {
      if (skip(bx, bz)) continue;
      const k = rng() < 0.35 ? 2 : 3, s = B / k;
      for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
        const x = bx * PITCH - B / 2 + s * (i + 0.5), z = bz * PITCH - B / 2 + s * (j + 0.5);
        const ang = Math.atan2(z, x);
        const wob = 0.82 + 0.36 * vnoise3(Math.cos(ang + ang0) * 1.8 + 5, Math.sin(ang + ang0) * 1.8, seed % 13);
        lots.push({ x, z, s: s - 0.7, d: Math.hypot(x, z) / RC / wob, r1: rng(), r2: rng(), r3: rng(), r4: rng(), r5: rng() });
      }
    }
    this.lots = lots;
    // 道路段
    const roads = [];
    for (let i = -NB; i <= NB + 1; i++) for (let j = -NB; j <= NB; j++) {
      const c = (i - 0.5) * PITCH, m = j * PITCH;
      roads.push({ x: c, z: m, ax: 1, d: Math.hypot(c, m) / RC }); roads.push({ x: m, z: c, ax: 0, d: Math.hypot(c, m) / RC });
    }
    this.roads = roads;
    // 農田
    const farms = [];
    for (let x = -330; x <= 330; x += 9.5) for (let z = -330; z <= 330; z += 9.5) {
      const r = Math.hypot(x, z); if (r < 50 || r > 330) continue;
      if (Math.abs(this.heightAt(x, z)) > 2.2) continue;
      farms.push({ x: x + (rng() - 0.5) * 1.2, z: z + (rng() - 0.5) * 1.2, d: r / RC, r1: rng(), r2: rng() });
    }
    this.farms = farms;
    // 樹
    const trees = [], nT = this.m.tree.instanceMatrix.count;
    let tries = 0;
    while (trees.length < nT && tries++ < nT * 6) {
      const r = 30 + Math.pow(rng(), 0.7) * 520, a = rng() * 6.2832, x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.heightAt(x, z);
      if (h < 0.2 || h > 48) continue;
      if (fbm3(x * 0.012, 4.4, z * 0.012, 3) < 0.42 && r > 120) continue;
      trees.push({ x, z, y: h, d: r / RC, s: 0.8 + rng() * 1.1, r1: rng() });
    }
    this.trees = trees;
    this.stateKey = '';
    this.agentsInit(rng);
  }

  agentsInit(rng) {
    const mk = (n, speed) => Array.from({ length: n }, () => ({ ax: rng() < 0.5 ? 0 : 1, line: Math.floor(rng() * (2 * NB + 2)) - NB, pos: (rng() - 0.5) * 2 * RC, dir: rng() < 0.5 ? -1 : 1, sp: speed * (0.6 + rng() * 0.8), c: rng() }));
    this.people = mk(this.m.person.instanceMatrix.count, 1.6);
    this.cars = mk(this.m.car.instanceMatrix.count, 9);
    this.smokes = Array.from({ length: this.m.smoke.instanceMatrix.count }, (_, i) => ({ e: i, t: rng() * 6 }));
  }

  // ---------- 依文明狀態更新建築 ----------
  refresh(st) {
    // st: {age, frac, alive, dehyd, ruins, burned}
    const age = st.age, reach = REACH[age] + (REACH[Math.min(8, age + 1)] - REACH[age]) * (age < 8 ? st.frac : 0);
    const key = [age, Math.round(reach * 60), st.alive, st.ruins, st.burned, this.layoutSeed].join('|');
    if (key === this.stateKey) return; this.stateKey = key;
    this.reach = reach; this.age = age; this.ruinsMode = st.ruins;
    const D = this.dummy, C = this.col, M = this.m, ruin = st.ruins;
    const cnt = { hut: 0, hutRoof: 0, house: 0, roof: 0, tower: 0, factory: 0, chimney: 0 };
    const put = (name, x, y, z, sx, sy, sz, color, ry = 0, tilt = 0) => {
      D.position.set(x, y, z); D.rotation.set(tilt, ry, tilt * 0.6); D.scale.set(sx, sy, sz); D.updateMatrix();
      const m = M[name], i = cnt[name]++; m.setMatrixAt(i, D.matrix); m.setColorAt(i, color);
    };
    const wallCol = [[0.62, 0.5, 0.36], [0.78, 0.7, 0.55], [0.85, 0.8, 0.7], [0.8, 0.76, 0.7], [0.62, 0.38, 0.3], [0.72, 0.72, 0.7], [0.78, 0.78, 0.78], [0.55, 0.63, 0.72], [0.7, 0.76, 0.84]];
    const roofCol = [[0.55, 0.45, 0.25], [0.62, 0.5, 0.26], [0.62, 0.3, 0.2], [0.55, 0.26, 0.2], [0.3, 0.3, 0.33], [0.28, 0.3, 0.34], [0.35, 0.36, 0.38], [0.3, 0.32, 0.36], [0.3, 0.32, 0.36]];
    this.emitters = [];
    for (const L of this.lots) {
      const visible = L.d < reach && L.r1 < OCC[age];
      if (!visible) continue;
      const k = 1 - L.d / reach;
      let h = 1 + (HMAX[age] - 1) * Math.pow(k, 2.1) * (0.25 + 0.75 * L.r2 * L.r2);
      if (age >= 6 && L.r3 < 0.05 && k > 0.3) h *= 1.9;
      const fp = L.s * FOOT[age] * (0.85 + L.r4 * 0.15);
      const wc = wallCol[age], j = (L.r5 - 0.5) * 0.12;
      const tilt = ruin ? (L.r3 - 0.5) * 0.25 : 0, hm = ruin ? 0.25 + L.r4 * 0.25 : 1;
      if (ruin) C.setRGB(0.24 + j, 0.23 + j, 0.22 + j);
      else if (age >= 5) { const tp = TOWER_PAL[Math.floor(L.r5 * TOWER_PAL.length)]; C.setRGB(tp[0] + j * 0.5, tp[1] + j * 0.5, tp[2] + j * 0.5); }
      else C.setRGB(wc[0] + j, wc[1] + j, wc[2] + j);
      if (age === 0) {
        const hs = 1.4 + L.r2 * 0.6, r = fp * 0.5;
        put('hut', L.x, 0, L.z, r * 1.6, hs * hm, r * 1.6, C, L.r3 * 6);
        if (!ruin) { C.setRGB(roofCol[0][0], roofCol[0][1], roofCol[0][2]); put('hutRoof', L.x, hs, L.z, r * 1.7, 1.4, r * 1.7, C, L.r3 * 6); }
      } else if (age >= 4 && age <= 6 && L.r4 < 0.045 && L.d > reach * 0.5) {
        // 工廠＋煙囪
        put('factory', L.x, 0, L.z, fp, 3.4 * hm, fp * 0.8, ruin ? C : C.setRGB(0.48, 0.36, 0.3));
        if (!ruin) { put('chimney', L.x + fp * 0.3, 3.4, L.z, 1.4, 9 + L.r2 * 5, 1.4, C.setRGB(0.42, 0.3, 0.26)); this.emitters.push([L.x + fp * 0.3, 3.4 + 9 + L.r2 * 5, L.z]); }
      } else if (h < 4.2) {
        const fl = Math.max(1.6, h * 2.2), w = fp * (0.75 + L.r2 * 0.25);
        put('house', L.x, 0, L.z, w, fl * hm, fp * 0.8, C, (L.r3 > 0.5 ? 0 : Math.PI / 2));
        if (!ruin) { const rc = roofCol[age]; C.setRGB(rc[0] + j, rc[1] + j * 0.5, rc[2]); put('roof', L.x, fl, L.z, w * 1.12, Math.min(2.4, w * 0.55), fp * 0.92, C, (L.r3 > 0.5 ? 0 : Math.PI / 2)); }
      } else {
        const fl = h * 1.9 + 2;
        put('tower', L.x, 0, L.z, fp, fl * hm, fp * (0.75 + L.r3 * 0.25), C, 0, tilt);
      }
    }
    for (const n in cnt) { const m = M[n]; m.count = cnt[n]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // 道路
    let rc = 0; const rcol = age < 4 ? [0.46, 0.38, 0.28] : age < 5 ? [0.35, 0.33, 0.3] : [0.16, 0.17, 0.19];
    const lampPos = this.lamps.geometry.attributes.position.array; let lp = 0;
    for (const R of this.roads) {
      if (R.d > reach + 0.05 || (age === 0 && R.d > reach * 0.6)) continue;
      D.position.set(R.x, 0.04, R.z); D.rotation.set(0, 0, 0);
      if (R.ax) D.scale.set(ROAD, 0.1, PITCH); else D.scale.set(PITCH, 0.1, ROAD);
      D.updateMatrix(); M.road.setMatrixAt(rc, D.matrix); C.setRGB(rcol[0], rcol[1], rcol[2]); if (ruin) C.multiplyScalar(0.7); M.road.setColorAt(rc++, C);
      if (age >= 4 && lp < 900 && R.ax) { lampPos[lp * 3] = R.x + 1.6; lampPos[lp * 3 + 1] = 3.2; lampPos[lp * 3 + 2] = R.z; lp++; }
    }
    M.road.count = rc; M.road.instanceMatrix.needsUpdate = true; if (M.road.instanceColor) M.road.instanceColor.needsUpdate = true;
    this.lamps.geometry.setDrawRange(0, ruin ? 0 : lp); this.lamps.geometry.attributes.position.needsUpdate = true;
    // 農田
    let fc = 0; const crops = [[0.78, 0.68, 0.3], [0.45, 0.6, 0.25], [0.6, 0.48, 0.28], [0.36, 0.52, 0.22], [0.82, 0.74, 0.42]];
    if (age >= 1 && age <= 6 && !ruin) for (const F of this.farms) {
      if (F.d < reach + 0.03 || F.d > reach + 0.35 + age * 0.05 || F.r2 > 0.85) continue;
      D.position.set(F.x, this.heightAt(F.x, F.z) + 0.08, F.z); D.rotation.set(0, 0, 0); D.scale.set(8.2, 0.12, 8.2); D.updateMatrix();
      M.farm.setMatrixAt(fc, D.matrix); const cc = crops[Math.floor(F.r1 * crops.length)]; C.setRGB(cc[0], cc[1], cc[2]); M.farm.setColorAt(fc++, C);
      if (fc >= 1400) break;
    }
    M.farm.count = fc; M.farm.instanceMatrix.needsUpdate = true; if (M.farm.instanceColor) M.farm.instanceColor.needsUpdate = true;
    // 樹
    let tc = 0;
    for (const T of this.trees) {
      if (T.d < reach + 0.04 && !(age <= 1 && T.r1 < 0.25)) continue;
      D.position.set(T.x, T.y, T.z); D.rotation.set(0, T.r1 * 6, 0); D.scale.set(T.s, T.s * (0.9 + T.r1 * 0.5), T.s); D.updateMatrix();
      M.tree.setMatrixAt(tc, D.matrix); C.setRGB(0.12 + T.r1 * 0.1, 0.3 + T.r1 * 0.14, 0.14); M.tree.setColorAt(tc++, C);
    }
    M.tree.count = tc; M.tree.instanceMatrix.needsUpdate = true; if (M.tree.instanceColor) M.tree.instanceColor.needsUpdate = true;
    // 城牆
    let wc2 = 0;
    if (age >= 2 && age <= 4) {
      const Rw = reach * RC * 0.95 + 6, n = 96;
      for (let i = 0; i < n; i++) {
        if (i % 24 === 0) continue;
        const a = i / n * 6.2832, x = Math.cos(a) * Rw, z = Math.sin(a) * Rw;
        D.position.set(x, 0, z); D.rotation.set(0, -a, 0); D.scale.set(1.6, ruin ? 1.6 : 5, Rw * 6.2832 / n + 0.3); D.updateMatrix(); M.wall.setMatrixAt(wc2++, D.matrix);
      }
    }
    M.wall.count = wc2; M.wall.instanceMatrix.needsUpdate = true;
    // 地標
    this.pend.visible = age >= 1;
    this.pyramid.visible = age >= 1 && age <= 3; this.clock.visible = age >= 4 && age <= 5;
    this.tvTower.visible = age === 6; this.supertall.visible = age >= 7; this.launch.visible = age >= 8;
    [this.pyramid, this.clock, this.tvTower, this.supertall].forEach(g => { g.scale.y = ruin ? 0.35 : 1; g.rotation.z = ruin ? 0.08 : 0; });
    this.pivot.rotation.z = 0;
  }

  launchRocket() { if (this.launch.visible) { this.launchT = 0; this.flame.visible = true; } }

  // env: {suns:[{dir:Vector3, col:[r,g,b], vis, size}], T, day, lights, alive, dehyd}
  update(dt, cam, env) {
    this.time += dt;
    const M = this.m, D = this.dummy;
    // 天空與光照
    const U = this.skyU; let day = 0, best = -1, bi = 0;
    env.suns.forEach((s, i) => {
      U.uSunDir.value[i].copy(s.dir); U.uSunCol.value[i].setRGB(s.col[0], s.col[1], s.col[2]);
      U.uSunVis.value[i] = s.vis; U.uSunSize.value[i] = s.size;
      const e = smooth(-0.1, 0.25, s.dir.y) * s.vis; day += e;
      if (e > best) { best = e; bi = i; }
    });
    day = Math.min(1, day * 1.15);
    this.day = day;
    const snow = Math.max(0, Math.min(1, (-4 - env.T) / 28)), heat = Math.max(0, Math.min(1, (env.T - 42) / 70));
    U.uDay.value = day; U.uHeat.value = heat; U.uSnow.value = snow;
    WX.uSnow.value = snow; WX.uHeat.value = heat; WX.uNight.value = Math.max(0, 1 - day * 1.6);
    WX.uWin.value = env.alive && !env.dehyd ? [0.05, 0.08, 0.1, 0.14, 0.25, 0.4, 0.45, 0.5, 0.52][this.age] : 0;
    WX.uWinCol.value.setRGB(1, this.age >= 6 ? 0.88 : 0.72, this.age >= 6 ? 0.66 : 0.4);
    WX.uBurn.value = this.ruinsMode && env.burned ? 1 : 0;
    const sb = env.suns[bi];
    this.sun.position.copy(sb.dir).multiplyScalar(700); this.sun.target.position.set(0, 0, 0);
    this.sun.color.setRGB(sb.col[0], sb.col[1], sb.col[2]);
    this.sun.intensity = Math.min(1.8, sb.vis * 1.15) * smooth(-0.05, 0.12, sb.dir.y);
    let fi = 0;
    env.suns.forEach((s, i) => { if (i === bi) return; const l = this.fill[fi++]; l.position.copy(s.dir).multiplyScalar(700); l.color.setRGB(s.col[0], s.col[1], s.col[2]); l.intensity = Math.min(1.8, s.vis * 1.2) * smooth(-0.05, 0.12, s.dir.y); });
    this.hemi.intensity = 0.1 + day * 0.4; this.hemi.color.setRGB(0.55 + day * 0.2, 0.65 + day * 0.15, 0.85 + day * 0.1);
    this.hemi.color.lerp(new THREE.Color(1, 0.55, 0.3), heat * 0.5);
    const fogC = new THREE.Color(0.03, 0.04, 0.08).lerp(new THREE.Color(0.62, 0.72, 0.85), day).lerp(new THREE.Color(0.75, 0.42, 0.22), heat * 0.6);
    this.scene.fog.color.copy(fogC); this.scene.fog.near = 260 - heat * 180; this.scene.fog.far = 1900 - heat * 1100 - snow * 300;
    this.nightStars.material.opacity = Math.pow(1 - day, 2.5) * (1 - heat * 0.7);
    // 巨月
    const ma = this.time * 0.01 + 1.2; const md = new THREE.Vector3(Math.cos(ma) * 0.8, 0.32 + 0.15 * Math.sin(ma * 0.7), Math.sin(ma) * 0.8).normalize();
    this.moon.position.copy(md).multiplyScalar(2000); this.moon.material.opacity = 0.35 + (1 - day) * 0.65;
    // 水面
    this.water.position.y = -1.2 - heat * 9;
    this.waterMat.color.setRGB(0.1, 0.29, 0.43).lerp(new THREE.Color(0.84, 0.9, 0.95), snow).lerp(new THREE.Color(0.35, 0.25, 0.18), heat * 0.8);
    this.waterMat.roughness = 0.18 + snow * 0.6;
    // 城市燈光
    this.lamps.material.opacity = (env.alive && !env.dehyd && this.age >= 4) ? WX.uNight.value : 0;
    this.clockFace.emissiveIntensity = WX.uNight.value * (env.alive ? 0.9 : 0);
    this.beacon.material.opacity = (Math.sin(this.time * 3) > 0 ? 1 : 0.15) * (env.alive ? 1 : 0);
    // 巨擺（真實單擺週期 T = 2π√(L/g)）
    if (this.pend.visible) {
      const Tp = 2 * Math.PI * Math.sqrt(40 / 9.8);
      this.pivot.rotation.z = this.ruinsMode ? 0 : 0.55 * Math.sin(this.time * 2 * Math.PI / Tp);
    }
    // 行人與車輛
    const active = env.alive && !env.dehyd && !this.ruinsMode;
    const ext = this.reach * RC * 0.95;
    this.moveAgents(this.people, M.person, dt, active ? Math.floor(this.people.length * Math.min(1, 0.25 + this.age * 0.12)) : 0, ext, 0.35, [[0.85, 0.3, 0.3], [0.3, 0.5, 0.85], [0.9, 0.8, 0.3], [0.9, 0.9, 0.9], [0.4, 0.7, 0.4]]);
    this.moveAgents(this.cars, M.car, dt, active && this.age >= 5 ? Math.floor(this.cars.length * Math.min(1, 0.35 + (this.age - 5) * 0.25)) : 0, ext, 0.7, [[0.8, 0.15, 0.15], [0.15, 0.3, 0.75], [0.9, 0.9, 0.92], [0.12, 0.12, 0.14], [0.95, 0.75, 0.2], [0.4, 0.42, 0.45]]);
    // 煙
    let si = 0;
    if (active && this.emitters && this.emitters.length) {
      for (const p of this.smokes) {
        p.t += dt; if (p.t > 6) { p.t = 0; p.e = Math.floor(Math.random() * this.emitters.length); }
        const e = this.emitters[p.e % this.emitters.length], k = p.t;
        D.position.set(e[0] + k * 1.6, e[1] + k * 2.6, e[2] + k * 0.6); D.rotation.set(k, k * 0.7, 0); D.scale.setScalar(0.7 + k * 0.75); D.updateMatrix();
        M.smoke.setMatrixAt(si++, D.matrix);
      }
    }
    M.smoke.count = si; M.smoke.instanceMatrix.needsUpdate = true;
    // 火箭發射
    if (this.launchT >= 0) {
      this.launchT += dt; const t = this.launchT;
      this.rocket.position.y = Math.max(0, t - 1.5) ** 2 * 5;
      this.flame.scale.set(9 + Math.random() * 2, 20 + Math.random() * 6, 1);
      if (t > 14) { this.launchT = -1; this.flame.visible = false; this.rocket.position.y = 0; }
    }
    // 攝影機
    this.target.lerp(this.targetGoal, 1 - Math.exp(-dt * 3));
    if (this.skyMode) {
      // 站在城市邊緣的山坡上仰望：拖曳可環顧
      const R = Math.max(90, (this.reach || 0.3) * RC + 70), a0 = this.skyAz0 || 0;
      const px = -Math.sin(a0) * R, pz = -Math.cos(a0) * R, py = Math.max(0, this.heightAt(px, pz)) + 7;
      cam.theta += (cam.tTheta - cam.theta) * (1 - Math.exp(-dt * 7)); cam.phi += (cam.tPhi - cam.phi) * (1 - Math.exp(-dt * 7));
      const pitch = (1.6 - cam.phi) / 1.48 * 1.15 + 0.06, yaw = cam.theta;
      this.camera.position.set(px, py, pz);
      this.camera.lookAt(px + Math.sin(yaw) * Math.cos(pitch), py + Math.sin(pitch), pz + Math.cos(yaw) * Math.cos(pitch));
    } else cam.update(dt, this.camera, this.target);
    this.camera.near = 0.5; this.camera.far = 5000; this.camera.updateProjectionMatrix();
    this.sky.position.copy(this.camera.position); this.nightStars.position.copy(this.camera.position); this.moon.position.add(this.camera.position);
  }

  moveAgents(list, mesh, dt, n, ext, lane, palette) {
    const D = this.dummy, C = this.col; let c = 0;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      a.pos += a.dir * a.sp * dt;
      if (Math.abs(a.pos) > ext) { a.dir = -Math.sign(a.pos); a.pos = Math.sign(a.pos) * ext; }
      const lineC = (a.line - 0.5) * PITCH;
      if (Math.abs(lineC) > ext) { a.line = Math.round((Math.random() - 0.5) * 2 * ext / PITCH); }
      // 路口轉彎
      const g = a.pos / PITCH + 0.5, near = Math.round(g);
      if (Math.abs(g - near) < 0.02 && Math.random() < 0.02) { const nl = near; a.pos = (a.line - 0.5) * PITCH; a.line = nl; a.ax = 1 - a.ax; a.pos += a.dir * 0.4; }
      const off = (a.ax ? 1 : -1) * a.dir * lane;
      let x, z, ry;
      if (a.ax === 0) { x = a.pos; z = (a.line - 0.5) * PITCH + off; ry = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { z = a.pos; x = (a.line - 0.5) * PITCH + off; ry = a.dir > 0 ? 0 : Math.PI; }
      D.position.set(x, 0.1, z); D.rotation.set(0, ry, 0); D.scale.setScalar(1); D.updateMatrix();
      mesh.setMatrixAt(c, D.matrix);
      const p = palette[Math.floor(a.c * palette.length)]; C.setRGB(p[0], p[1], p[2]); mesh.setColorAt(c, C); c++;
    }
    mesh.count = c; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
