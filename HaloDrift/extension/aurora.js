/* Halo Drift — WebGL 极光背景渲染器
 * 一个全屏片元着色器：屏幕边缘的流体光晕 + 环绕的细光带 + 胶片颗粒。
 */
(() => {
  'use strict';

  const PALETTES = {
    aurora:   { name: '极光',   colors: ['#1fe08f', '#1c9dff', '#8b5cf6', '#ff4fa3', '#ffc145'] },
    nebula:   { name: '星云',   colors: ['#ff5ea8', '#a35bff', '#3f6dff', '#22d3ee', '#d58cff'] },
    sunset:   { name: '落日',   colors: ['#ff7a3d', '#ff3d7f', '#c2189b', '#6f2dbd', '#ffb53b'] },
    ocean:    { name: '深海',   colors: ['#00e5c3', '#00a3ff', '#3655ff', '#7c3aed', '#3ccfff'] },
    sakura:   { name: '樱粉',   colors: ['#ff8fb1', '#ffc4d6', '#c08bff', '#7f9dff', '#ffd2a8'] },
    borealis: { name: '北境',   colors: ['#3dffa2', '#00c9a7', '#1f7aff', '#6ef3ff', '#b6ff52'] },
  };

  const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uMouseAmt;
uniform float uMouseVel;
uniform vec3  uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform vec3  uBase;
uniform float uIntensity;
uniform float uGrain;
uniform float uCssH;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float fbm2(vec2 p){ return 0.65 * noise(p) + 0.35 * noise(p * 2.1 + 7.3); }
vec3 pal(float x){
  x = fract(x) * 5.0; float f = fract(x); f = f*f*(3.0-2.0*f);
  if (x < 1.0) return mix(uC0, uC1, f);
  if (x < 2.0) return mix(uC1, uC2, f);
  if (x < 3.0) return mix(uC2, uC3, f);
  if (x < 4.0) return mix(uC3, uC4, f);
  return mix(uC4, uC0, f);
}

void main(){
  float asp = uRes.x / uRes.y;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // ---- 鼠标互动 ----
  vec2 muv  = (uMouse - 0.5) * vec2(asp, 1.0);      // 鼠标位置（与 uv 同单位）
  vec2 dmv  = uv - muv;
  float d2  = dot(dmv, dmv);
  float infl = exp(-d2 * 3.0) * uMouseAmt;          // 影响范围：约 0.4 屏高
  // 引力透镜：把远处的光带"吸"向鼠标；移动越快，绕鼠标的旋涡越明显
  float pinch = infl * 0.6;
  float swirl = infl * (0.25 + uMouseVel * 1.1);
  float cs = cos(swirl), sn = sin(swirl);
  vec2 rel = mat2(cs, -sn, sn, cs) * dmv * (1.0 + pinch);
  vec2 uvw = muv + rel;
  uvw -= muv * 0.16 * uMouseAmt;                     // 整体视差
  vec2 q  = uvw / vec2(0.5 * asp, 0.5);              // 屏幕四边位于 |q|=1

  float r   = length(q);
  float th  = atan(q.y, q.x);
  float ang = th / 6.2831853 + 0.5;

  // 流体扰动
  float n  = fbm(q * 1.3 + vec2(t * 0.045, -t * 0.035));
  float n2 = fbm(q * 2.2 + vec2(-t * 0.03, t * 0.05) + n * 1.5);
  float rw = r + (n - 0.47) * 0.42 + (n2 - 0.47) * 0.18;
  float edge = smoothstep(0.66, 1.45, rw);

  vec3 ca = pal(ang + t * 0.008 + (n2 - 0.5) * 0.35);
  vec3 cb = pal(ang + 0.18 + t * 0.008 - (n - 0.5) * 0.4);
  vec3 glow = mix(ca, cb, smoothstep(0.3, 0.7, n2));

  vec3 col = mix(uBase * 1.4, uBase * 0.8, smoothstep(0.0, 1.25, r));
  col += glow * (edge * edge) * 1.2 * uIntensity;
  col += glow * pow(edge, 5.0) * 0.55 * uIntensity;

  // 环绕光带（屏幕中央没有光带，跳过以节省计算）
  float px = 1.5 / uCssH;
  if (r > 0.42) for (int k = 0; k < 5; k++){
    float fk = float(k);
    float w  = fbm2(q * (0.75 + 0.12 * fk) + vec2(fk * 3.7, t * 0.03 + fk));
    float rr = r + (w - 0.5) * 0.6;
    float target = 0.86 + fk * 0.075 + 0.035 * sin(th * 2.0 + t * 0.13 + fk * 1.3);
    float d = abs(rr - target);
    float wid  = px * (1.0 + fk * 0.4);
    float core = exp(-(d * d) / (wid * wid));
    float halo = exp(-d * 26.0) * 0.16 + exp(-d * 90.0) * 0.26 + exp(-(d * d) / 0.0016) * 0.12;
    float seg  = 0.5 + 0.5 * sin(th * (1.0 + mod(fk, 2.0)) + t * (0.11 + 0.04 * fk) + fk * 2.1);
    seg = seg * seg * seg;
    vec3 rc = pal(ang + fk * 0.09 + t * 0.008 + 0.05);
    col += rc * (core * 0.9 + halo) * seg * uIntensity * (0.55 + 0.45 * edge) * (1.0 + infl * 0.9);
  }

  // 跟随鼠标的光斑，移动时更亮
  vec3 mc = mix(pal(ang + t * 0.02 + 0.25), vec3(1.0), 0.12);
  col += mc * exp(-d2 * 14.0) * (0.10 + 0.18 * uMouseVel) * uMouseAmt * uIntensity;
  col += glow * exp(-d2 * 5.0) * 0.06 * uMouseAmt * uIntensity;

  col = 1.0 - exp(-col * 1.25);                       // 柔和色调映射
  float g = hash(gl_FragCoord.xy + fract(t * 7.0) * vec2(91.7, 37.3)) - 0.5;
  col += g * uGrain * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  };

  class Aurora {
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.speed = opts.speed ?? 1;
      this.intensity = opts.intensity ?? 1;
      this.grain = opts.grain ?? 1;
      this.mouseAmt = this._amt(opts.mouse ?? 1);
      this.vel = 0;
      this.scale = opts.scale ?? 1;
      this.fpsCap = opts.fpsCap ?? 0;        // 0 = 跟随屏幕刷新率
      this.maxDpr = opts.maxDpr ?? 1.5;
      this.dyn = 1;                           // 自适应分辨率系数（0.5–1）
      this.adaptive = !opts.still;
      this.perf = { ema: 16.7, best: 1000, slow: 0, fast: 0, warm: 0, cool: 0 };
      this.time = opts.time ?? 30 + Math.random() * 120;
      this.base = hexToRgb(opts.base || '#101117');
      this.mouse = [0.5, 0.5];
      this.mouseTarget = [0.5, 0.5];
      this.cur = PALETTES.aurora.colors.map(hexToRgb);
      this.target = this.cur.map((c) => c.slice());
      this.running = false;
      this.last = 0;
      this.lastDraw = 0;

      const gl = canvas.getContext('webgl', {
        antialias: false, alpha: false, depth: false, stencil: false,
        premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserve,
        powerPreference: 'low-power',
      });
      if (!gl) throw new Error('WebGL unavailable');
      this.gl = gl;

      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.u = {};
      ['uRes', 'uTime', 'uMouse', 'uMouseAmt', 'uMouseVel', 'uC0', 'uC1', 'uC2', 'uC3', 'uC4', 'uBase', 'uIntensity', 'uGrain', 'uCssH']
        .forEach((n) => { this.u[n] = gl.getUniformLocation(prog, n); });

      this._tick = this._tick.bind(this);
      if (!opts.still) {
        this._onResize = () => this.resize();
        window.addEventListener('resize', this._onResize);
        window.addEventListener('pointermove', (e) => {
          this.mouseTarget = [e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight];
        }, { passive: true });
        this.resize();
      }
    }

    _amt(v) { return typeof v === 'number' ? v : (v ? 1 : 0); }

    resize(w, h) {
      const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
      const k = dpr * this.scale * this.dyn;
      const cw = w ?? Math.max(2, Math.round(window.innerWidth * k));
      const ch = h ?? Math.max(2, Math.round(window.innerHeight * k));
      this.cssH = h ? h : window.innerHeight;
      if (this.canvas.width !== cw || this.canvas.height !== ch) {
        this.canvas.width = cw;
        this.canvas.height = ch;
      }
      this.gl.viewport(0, 0, cw, ch);
      this.dirty = true;
    }

    setPalette(colors, instant = false) {
      this.target = colors.map(hexToRgb);
      if (instant) this.cur = this.target.map((c) => c.slice());
      this.dirty = true;
    }

    setOptions(o) {
      if (o.speed !== undefined) this.speed = o.speed;
      if (o.intensity !== undefined) this.intensity = o.intensity;
      if (o.grain !== undefined) this.grain = o.grain;
      if (o.mouse !== undefined) this.mouseAmt = this._amt(o.mouse);
      if (o.fpsCap !== undefined) this.fpsCap = o.fpsCap;
      if (o.maxDpr !== undefined && o.maxDpr !== this.maxDpr) { this.maxDpr = o.maxDpr; this.dyn = 1; this.resize(); }
      if (o.scale !== undefined && o.scale !== this.scale) { this.scale = o.scale; this.dyn = 1; this.resize(); }
      this.dirty = true;
    }

    draw() {
      const gl = this.gl, u = this.u;
      gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(u.uTime, this.time);
      gl.uniform2f(u.uMouse, this.mouse[0], this.mouse[1]);
      gl.uniform1f(u.uMouseAmt, this.mouseAmt);
      gl.uniform1f(u.uMouseVel, this.vel);
      this.cur.forEach((c, i) => gl.uniform3f(u['uC' + i], c[0], c[1], c[2]));
      gl.uniform3f(u.uBase, this.base[0], this.base[1], this.base[2]);
      gl.uniform1f(u.uIntensity, this.intensity);
      gl.uniform1f(u.uGrain, this.grain);
      gl.uniform1f(u.uCssH, this.cssH || this.canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._tick);
    }

    stop() { this.running = false; }

    _tick(now) {
      if (!this.running) return;
      requestAnimationFrame(this._tick);
      const dt = Math.min((now - this.last) / 1000, 0.1);
      this.last = now;

      let moving = this.speed > 0;
      // 调色板平滑过渡
      const k = 1 - Math.exp(-dt * 3);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        const d = this.target[i][j] - this.cur[i][j];
        if (Math.abs(d) > 0.001) { this.cur[i][j] += d * k; moving = true; }
      }
      // 鼠标缓动 + 速度估计
      const km = 1 - Math.exp(-dt * 3.5);
      let step = 0;
      for (let j = 0; j < 2; j++) {
        const d = this.mouseTarget[j] - this.mouse[j];
        if (Math.abs(d) > 0.0005 && this.mouseAmt) { this.mouse[j] += d * km; step += (d * km) ** 2; moving = true; }
      }
      const vTarget = dt > 0 ? Math.min(1, (Math.sqrt(step) / dt) * 0.9) : 0;
      this.vel += (vTarget - this.vel) * (1 - Math.exp(-dt * (vTarget > this.vel ? 6 : 1.6)));
      if (this.vel > 0.002) moving = true; else this.vel = 0;
      this.time += dt * this.speed * (1 + this.vel * 1.4 * Math.min(this.mouseAmt, 1.5));

      if (!moving && !this.dirty) return;
      if (this.fpsCap && now - this.lastDraw < 1000 / this.fpsCap - 2) return;
      const interval = now - this.lastDraw;
      this.lastDraw = now;
      this.dirty = false;
      this.draw();
      if (this.adaptive && interval < 250) this._adapt(interval);
    }

    // 自适应分辨率：帧间隔明显长于屏幕刷新间隔时降低渲染分辨率，流畅后再慢慢升回
    _adapt(ms) {
      const p = this.perf;
      if (p.warm < 45) { p.warm++; return; }       // 跳过启动时编译着色器的几帧
      p.ema += (ms - p.ema) * 0.12;
      p.best = Math.min(p.best * 1.0015, ms);
      if (p.cool > 0) { p.cool--; return; }
      const target = Math.max(p.best, this.fpsCap ? 1000 / this.fpsCap : 0);
      if (p.ema > target * 1.35) { p.slow++; p.fast = 0; } else if (p.ema < target * 1.1) { p.fast++; p.slow = 0; } else { p.slow = 0; p.fast = 0; }
      if (p.slow > 24 && this.dyn > 0.5) {
        this.dyn = Math.max(0.5, this.dyn * 0.82);
        p.slow = 0; p.cool = 40; this.resize();
      } else if (p.fast > 360 && this.dyn < 1) {
        this.dyn = Math.min(1, this.dyn + 0.08);
        p.fast = 0; p.cool = 90; this.resize();
      }
    }
  }

  window.Aurora = Aurora;
  window.AURORA_PALETTES = PALETTES;
})();
