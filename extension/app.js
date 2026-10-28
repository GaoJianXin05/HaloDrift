/* Halo Drift — 新标签页逻辑 */
(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const PALETTES = window.AURORA_PALETTES;
  const IS_EXT = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);
  const SYNC = IS_EXT && chrome.storage && chrome.storage.sync;
  const KEY = 'haloDrift.v1';
  const I18N = window.HD_I18N;
  const t = I18N.t;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ENGINES = {
    google:  { name: 'Google',      brand: 'Google',  glyph: 'globe',   url: 'https://www.google.com/search?q=%s',                home: 'https://www.google.com' },
    bing:    { name: 'Bing',        brand: 'Bing',    glyph: 'compass', url: 'https://www.bing.com/search?q=%s',                  home: 'https://www.bing.com' },
    scholar: { name: 'Google 学术', brand: 'Scholar', glyph: 'quote',   url: 'https://scholar.google.com/scholar?q=%s',          home: 'https://scholar.google.com' },
    arxiv:   { name: 'arXiv',       brand: 'arXiv',   glyph: 'papers',  url: 'https://arxiv.org/search/?query=%s&searchtype=all', home: 'https://arxiv.org' },
  };

  const DEFAULT_TILES = [
    { name: 'Gemini',     url: 'https://gemini.google.com/' },
    { name: 'OpenReview', url: 'https://openreview.net/' },
    { name: 'Overleaf',   url: 'https://www.overleaf.com/project' },
    { name: 'Claude',     url: 'https://claude.ai/' },
    { name: I18N.defaultLang() === 'zh' ? '哔哩哔哩' : 'Bilibili', url: 'https://www.bilibili.com/' },
    { name: 'arXiv',      url: 'https://arxiv.org/' },
    { name: 'GitHub',     url: 'https://github.com/' },
    { name: 'Scholar',    url: 'https://scholar.google.com/' },
    { name: 'GPT',        url: 'https://chatgpt.com/' },
  ];

  const DEFAULTS = {
    palette: 'aurora', speed: 1, intensity: 1, quality: 'high', mouse: 1, grain: true, iconStyle: 'logo', schema: 4,
    showBrand: true, showTiles: true,
    engine: 'google', openMode: 'tab', lang: I18N.defaultLang(),
    tiles: DEFAULT_TILES,
  };
  if (reduceMotion) DEFAULTS.speed = 0;

  const QUALITY = {
    high:     { scale: 1,    fpsCap: 0,  maxDpr: 1.5 },
    balanced: { scale: 0.8,  fpsCap: 0,  maxDpr: 1 },
    eco:      { scale: 0.55, fpsCap: 30, maxDpr: 1 },
  };

  /* ---------- 存储：localStorage 保证首帧无闪烁，chrome.storage.sync 跨设备同步 ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  // 旧版本设置升级（只处理已保存过的设置）
  let migrated = false;
  const migrate = (o) => {
    if (!o || !Object.keys(o).length) return {};
    if (typeof o.mouse === 'boolean') o.mouse = o.mouse ? 1 : 0;
    if (o.engine && !ENGINES[o.engine]) o.engine = 'google';
    if ((o.schema || 0) < 4) {
      o.iconStyle = 'logo';
      o.openMode = 'tab';
      delete o.newTabResults;
      if (Array.isArray(o.tiles)) {
        o.tiles = o.tiles.map((t) => (/notebooklm\.google\.com/.test(t.url) ? { name: 'OpenReview', url: 'https://openreview.net/' } : t));
      }
      o.schema = 4;
      migrated = true;
    }
    return o;
  };
  let S = Object.assign(clone(DEFAULTS), migrate(readLocal()));
  if (migrated) setTimeout(() => save(), 0);
  let saveTimer;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 预览环境可能禁用 */ }
      if (SYNC) chrome.storage.sync.set({ [KEY]: S });
    }, 200);
  };

  /* ---------- 背景 ---------- */
  let aurora = null;
  try {
    aurora = new window.Aurora($('#bg'), {
      speed: S.speed, intensity: S.intensity, grain: S.grain ? 1 : 0, mouse: S.mouse,
      ...QUALITY[S.quality],
    });
  } catch (e) {
    console.warn('[Halo Drift] WebGL unavailable, using static gradient background', e);
  }

  const applyPalette = (instant) => {
    const pal = PALETTES[S.palette] || PALETTES.aurora;
    pal.colors.forEach((c, i) => document.documentElement.style.setProperty('--c' + i, c));
    if (aurora) aurora.setPalette(pal.colors, instant);
    document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b.dataset.id === S.palette));
  };

  const applyMotion = () => {
    if (!aurora) return;
    aurora.setOptions({
      speed: S.speed, intensity: S.intensity, grain: S.grain ? 1 : 0, mouse: S.mouse,
      ...QUALITY[S.quality],
    });
  };

  /* ---------- 标志 ---------- */
  const brandEl = $('#brand');
  let brandText = '';
  const renderBrand = () => {
    const e = ENGINES[S.engine] || ENGINES.google;
    if (e.brand === brandText) return;
    const first = !brandText;
    brandText = e.brand;
    brandEl.setAttribute('aria-label', e.brand);
    brandEl.querySelectorAll('span').forEach((n) => { n.textContent = e.brand; });
    if (!first) {
      brandEl.classList.remove('swap');
      void brandEl.offsetWidth;
      brandEl.classList.add('swap');
    }
  };
  const applyContent = () => {
    $('#hero').style.display = S.showBrand ? '' : 'none';
    $('#tiles').classList.toggle('hidden', !S.showTiles);
  };

  /* ---------- 网站图标 ----------
   * 来源依次为：自定义图标 → Google 网站图标服务（64px）→ Chrome 本地图标缓存 → 首字母。
   * 拿到图标后在本地处理：去掉底板、统一尺寸，生成单色字形（默认样式）和原色版本，缓存为 data URL。 */
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const hostname = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
  const letterIcon = (name, i) => {
    const span = document.createElement('span');
    span.className = 'letter';
    span.textContent = (name || '?').trim().charAt(0).toUpperCase();
    span.style.setProperty('--g1', `var(--c${i % 5})`);
    span.style.setProperty('--g2', `var(--c${(i + 2) % 5})`);
    return span;
  };

  const ICON_KEY = 'haloDrift.icons.v1';
  const DAY = 864e5;
  let iconStore = {};
  try { iconStore = JSON.parse(localStorage.getItem(ICON_KEY) || '{}'); } catch { iconStore = {}; }
  let iconSaveTimer;
  const saveIcons = () => {
    clearTimeout(iconSaveTimer);
    iconSaveTimer = setTimeout(() => { try { localStorage.setItem(ICON_KEY, JSON.stringify(iconStore)); } catch { /* noop */ } }, 300);
  };

  const loadImg = (src, cors) => new Promise((res) => {
    const im = new Image();
    if (cors) im.crossOrigin = 'anonymous';
    im.referrerPolicy = 'no-referrer';
    im.onload = () => res(im.naturalWidth ? im : null);
    im.onerror = () => res(null);
    im.src = src;
  });
  // 通过 fetch 取图（扩展有该站点权限时不受跨域限制），转成同源 blob 才能读取像素
  const fetchImg = async (src) => {
    let r;
    try { r = await fetch(src, { credentials: 'omit', referrerPolicy: 'no-referrer' }); } catch { return { err: true }; }
    if (!r.ok) return { im: null };
    try {
      const u = URL.createObjectURL(await r.blob());
      const im = await loadImg(u);
      setTimeout(() => URL.revokeObjectURL(u), 5000);
      return { im };
    } catch { return { im: null }; }
  };

  const N = 64;
  const canvas2d = () => {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    return [c, x];
  };
  // 处理图标：返回 { orig, glyph, dark, hash }；跨域且无法读取像素时返回 null
  const processIcon = (im) => {
    try {
      const [c, x] = canvas2d();
      const w = im.naturalWidth, h = im.naturalHeight, k = N / Math.max(w, h);
      x.drawImage(im, (N - w * k) / 2, (N - h * k) / 2, w * k, h * k);
      const src = x.getImageData(0, 0, N, N).data;
      const orig = c.toDataURL('image/png');

      let hash = 0, lum = 0, aSum = 0;
      for (let p = 0; p < src.length; p += 4) {
        const a = src[p + 3] / 255;
        hash = (hash * 31 + src[p] + src[p + 1] * 3 + src[p + 2] * 7 + src[p + 3] * 11) >>> 0;
        lum += ((0.2126 * src[p] + 0.7152 * src[p + 1] + 0.0722 * src[p + 2]) / 255) * a;
        aSum += a;
      }
      const cover = aSum / (N * N);
      const dark = aSum > 0 && lum / aSum < 0.2 && cover < 0.72;

      // 检测底板：在内缩约 10% 的一圈上取样，大部分不透明且颜色一致，就视为底板
      const inset = 6, ring = [];
      for (let i = inset; i < N - inset; i++) ring.push([i, inset], [i, N - 1 - inset], [inset, i], [N - 1 - inset, i]);
      const solid = [];
      for (const [px, py] of ring) {
        const o = (py * N + px) * 4;
        if (src[o + 3] > 200) solid.push([src[o], src[o + 1], src[o + 2]]);
      }
      let plate = null;
      if (solid.length > ring.length * 0.6) {
        const m = [0, 1, 2].map((j) => solid.reduce((acc, v) => acc + v[j], 0) / solid.length);
        const near = solid.filter((v) => Math.hypot(v[0] - m[0], v[1] - m[1], v[2] - m[2]) < 38).length;
        if (near > solid.length * 0.85) plate = m;
      }
      // 备用判断（底板四周留了透明边时）：找出占比最大的颜色，
      // 若它构成一块实心区域（方形或圆形），而且里面还有明显不同颜色的图形，就把它当底板
      if (!plate) {
        const buckets = new Map();
        let opaque = 0;
        for (let p = 0; p < src.length; p += 4) {
          if (src[p + 3] < 200) continue;
          opaque++;
          const key = ((src[p] >> 4) << 8) | ((src[p + 1] >> 4) << 4) | (src[p + 2] >> 4);
          const b = buckets.get(key) || [0, 0, 0, 0];
          b[0]++; b[1] += src[p]; b[2] += src[p + 1]; b[3] += src[p + 2];
          buckets.set(key, b);
        }
        let best = null;
        for (const b of buckets.values()) if (!best || b[0] > best[0]) best = b;
        if (best && best[0] > opaque * 0.4) {
          const m = [best[1] / best[0], best[2] / best[0], best[3] / best[0]];
          let bx0 = N, by0 = N, bx1 = -1, by1 = -1, contrast = 0;
          for (let p = 0, i = 0; p < src.length; p += 4, i++) {
            if (src[p + 3] < 200) continue;
            const dist = Math.hypot(src[p] - m[0], src[p + 1] - m[1], src[p + 2] - m[2]);
            if (dist < 40) {
              const px = i % N, py = (i / N) | 0;
              if (px < bx0) bx0 = px; if (px > bx1) bx1 = px;
              if (py < by0) by0 = py; if (py > by1) by1 = py;
            } else if (dist > 60) contrast++;
          }
          const area = (bx1 - bx0 + 1) * (by1 - by0 + 1);
          let filled = 0;
          for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) if (src[(py * N + px) * 4 + 3] > 200) filled++;
          if (area > N * N * 0.25 && filled / area > 0.7 && contrast > opaque * 0.03) plate = m;
        }
      }

      let glyph = null;
      if (plate || cover < 0.85) {
        const [gc, gx] = canvas2d();
        const out = gx.createImageData(N, N);
        let x0 = N, y0 = N, x1 = -1, y1 = -1;
        for (let p = 0, i = 0; p < src.length; p += 4, i++) {
          let g = src[p + 3] / 255;
          if (plate) g *= Math.min(1, Math.max(0, (Math.hypot(src[p] - plate[0], src[p + 1] - plate[1], src[p + 2] - plate[2]) - 22) / 60));
          out.data[p] = out.data[p + 1] = out.data[p + 2] = 255;
          out.data[p + 3] = Math.round(g * 255);
          if (g > 0.1) {
            const px = i % N, py = (i / N) | 0;
            if (px < x0) x0 = px; if (px > x1) x1 = px;
            if (py < y0) y0 = py; if (py > y1) y1 = py;
          }
        }
        if (x1 >= x0 && (x1 - x0) * (y1 - y0) > 16) {
          gx.putImageData(out, 0, 0);
          // 裁掉空白并统一大小：字形最长边占画布 82%
          const [fc, fx] = canvas2d();
          const bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = (N * 0.82) / Math.max(bw, bh);
          fx.drawImage(gc, x0, y0, bw, bh, (N - bw * s) / 2, (N - bh * s) / 2, bw * s, bh * s);
          glyph = fc.toDataURL('image/png');
        }
      }
      // 底座染色用的主色：按不透明度和饱和度加权
      let tr = 0, tg = 0, tb = 0, tw = 0;
      for (let p = 0; p < src.length; p += 4) {
        const mx = Math.max(src[p], src[p + 1], src[p + 2]), mn = Math.min(src[p], src[p + 1], src[p + 2]);
        const w = (src[p + 3] / 255) * ((mx - mn) / Math.max(mx, 1) + 0.1);
        tr += src[p] * w; tg += src[p + 1] * w; tb += src[p + 2] * w; tw += w;
      }
      const tint = tw > 0 ? '#' + [tr, tg, tb].map((v) => Math.round(v / tw).toString(16).padStart(2, '0')).join('') : null;
      return { orig, glyph, dark, hash, tint };
    } catch { return null; }
  };

  const googleFav = (host) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host.replace(/^www\./, ''))}&sz=64`;
  const chromeFav = (url, size) => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`);
  const defaultHashes = {};
  const chromeDefaultHash = (size) => defaultHashes[size] || (defaultHashes[size] = loadImg(chromeFav('https://none.aurora-flow.invalid/', size))
    .then((im) => (im && processIcon(im)?.hash) ?? -1));

  const fromRemote = async (src, minSize) => {
    const f = await fetchImg(src);
    if (f.im && f.im.naturalWidth >= minSize) return processIcon(f.im);
    if (!f.err) return null;
    // 没有该站点权限（如自定义图标）：退回普通图片加载
    const cors = await loadImg(src, true);
    if (cors && cors.naturalWidth >= minSize) { const p = processIcon(cors); if (p) return p; }
    const plain = cors ? null : await loadImg(src, false);
    return plain && plain.naturalWidth >= minSize ? { raw: src } : null;
  };

  const pending = new Map();
  const resolveIcon = (url, custom) => {
    const key = custom || hostname(url);
    if (pending.has(key)) return pending.get(key);
    const job = (async () => {
      let out = null;
      let rawFallback = null;
      const take = (r) => { if (r && r.raw) { rawFallback = rawFallback || r; return null; } return r; };
      if (custom) out = take(await fromRemote(custom, 1));
      if (!out && hostname(url)) out = take(await fromRemote(googleFav(hostname(url)), 32));
      if (!out && IS_EXT) {
        // Chrome 缓存里没有该尺寸时会返回默认地球图标，所以每个尺寸都和默认图标的指纹比对
        for (const size of [64, 32]) {
          const im = await loadImg(chromeFav(url, size));
          const p = im && processIcon(im);
          if (p && p.hash !== await chromeDefaultHash(size)) { out = p; break; }
        }
      }
      if (!out) out = rawFallback; // 读不到像素时，最后才退回未处理的原图
      const entry = { t: Date.now() };
      if (out) ['orig', 'glyph', 'dark', 'raw', 'tint'].forEach((f) => { if (out[f]) entry[f] = out[f]; });
      iconStore[key] = entry;
      saveIcons();
      pending.delete(key);
      return entry;
    })();
    pending.set(key, job);
    return job;
  };

  const GLY = window.AURORA_GLYPHS;
  const builtinGlyph = (id) => {
    const g = document.createElement('span');
    g.className = 'glyph';
    g.style.setProperty('--m', GLY.url(id));
    return g;
  };
  // 自带线条图标：tile.icon 为 "glyph:<id>"，或未设置图标且网址是常用网站
  const glyphIdFor = (url, custom) => {
    if (custom && custom.startsWith('glyph:')) return GLY.list[custom.slice(6)] ? custom.slice(6) : null;
    if (custom) return null;
    return S.iconStyle === 'mono' ? GLY.forHost(hostname(url)) : null;
  };
  const builtinLogo = (id) => {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.className = 'logo';
    img.src = GLY.logoSrc(id);
    return img;
  };
  const setTint = (target, tint) => {
    if (!target) return;
    target.classList.toggle('tinted', !!tint);
    if (tint) target.style.setProperty('--tint', tint); else target.style.removeProperty('--tint');
  };
  const iconFor = (url, name, i, custom, forceGlyph, tintTarget) => {
    const box = document.createElement('span');
    box.className = 'ico';
    setTint(tintTarget, null);
    // 1) 指定的彩色图标，或彩色模式下常用网站自带的彩色图标
    const lid = custom && custom.startsWith('logo:') ? custom.slice(5)
      : (!custom && !forceGlyph && S.iconStyle === 'logo' ? GLY.logoForHost(hostname(url)) : null);
    if (lid && GLY.logos[lid]) {
      box.classList.add('has-logo');
      box.append(builtinLogo(lid));
      setTint(tintTarget, GLY.logos[lid].tint);
      return box;
    }
    // 2) 线条图标
    const gid = forceGlyph || glyphIdFor(url, custom);
    if (gid) { box.append(builtinGlyph(gid)); return box; }
    const paint = (r) => {
      if (S.iconStyle === 'mono' && r && r.glyph) {
        const g = document.createElement('span');
        g.className = 'glyph';
        g.style.setProperty('--m', `url("${r.glyph}")`);
        box.replaceChildren(g);
      } else if (r && (r.orig || r.raw)) {
        const img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        if (r.dark) img.className = 'inv';
        else if (r.raw) img.className = 'halo';
        if (r.tint) setTint(tintTarget, r.tint);
        img.onerror = () => box.replaceChildren(letterIcon(name, i));
        img.src = r.orig || r.raw;
        box.replaceChildren(img);
      } else {
        box.replaceChildren(letterIcon(name, i));
      }
    };
    const key = custom || hostname(url);
    const hit = iconStore[key];
    const fresh = hit && Date.now() - hit.t < (hit.orig ? 30 * DAY : hit.raw ? DAY / 24 : DAY / 4);
    if (hit) paint(hit);
    if (!fresh) resolveIcon(url, custom).then((r) => { if (!hit || r.orig !== hit.orig || r.glyph !== hit.glyph) paint(r); });
    return box;
  };

  /* ---------- 搜索 ---------- */
  const input = $('#q');
  const menu = $('#engineMenu');
  const engineBtn = $('#engineBtn');
  const engineKeys = Object.keys(ENGINES);
  let menuIndex = -1;

  const engName = (k) => t('engine.' + k);
  const renderEngine = () => {
    const e = ENGINES[S.engine] || ENGINES.google;
    const box = $('#engineIcon');
    box.replaceChildren(iconFor(e.home, engName(S.engine), engineKeys.indexOf(S.engine), null, e.glyph));
    renderBrand();
    input.placeholder = t('search.ph', { e: engName(S.engine) });
    engineBtn.setAttribute('aria-label', t('engine.aria', { e: engName(S.engine) }));
    menu.querySelectorAll('li').forEach((li) => li.classList.toggle('current', li.dataset.id === S.engine));
  };

  const buildMenu = () => {
    menu.replaceChildren();
    engineKeys.forEach((k, i) => {
      const li = document.createElement('li');
      li.dataset.id = k;
      li.setAttribute('role', 'option');
      const ic = document.createElement('span');
      ic.className = 'menu-icon';
      ic.append(iconFor(ENGINES[k].home, engName(k), i, null, ENGINES[k].glyph));
      const label = document.createElement('span');
      label.textContent = engName(k);
      li.append(ic, label);
      li.insertAdjacentHTML('beforeend', '<svg class="check" viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      li.addEventListener('click', () => { setEngine(k); closeMenu(); input.focus(); });
      menu.append(li);
    });
    const sel = $('#engineSel');
    sel.replaceChildren(...engineKeys.map((k) => new Option(engName(k), k)));
  };

  const setEngine = (k) => { S.engine = k; $('#engineSel').value = k; renderEngine(); save(); };
  const openMenu = () => {
    menu.classList.add('open');
    engineBtn.setAttribute('aria-expanded', 'true');
    menuIndex = engineKeys.indexOf(S.engine);
    highlight();
  };
  const closeMenu = () => {
    menu.classList.remove('open');
    engineBtn.setAttribute('aria-expanded', 'false');
    menuIndex = -1;
    highlight();
  };
  const highlight = () => menu.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === menuIndex));

  engineBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closeMenu(); });

  const URL_RE = /^(https?:\/\/\S+|localhost(:\d+)?(\/\S*)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?|[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?)$/i;
  // 打开方式：新标签页（默认）/ 新窗口 / 当前页
  const go = (url) => {
    if (!IS_EXT) {
      const l = document.createElement('a');
      l.href = url; l.target = '_blank'; l.rel = 'noopener';
      document.body.append(l); l.click(); l.remove();
      return;
    }
    if (S.openMode === 'window') chrome.windows.create({ url, focused: true });
    else if (S.openMode === 'self') window.location.href = url;
    else chrome.tabs.getCurrent((cur) => chrome.tabs.create({ url, active: true, index: cur ? cur.index + 1 : undefined }));
  };
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    if (URL_RE.test(v) && !/\s/.test(v)) {
      go(/^https?:\/\//i.test(v) ? v : (/^localhost|^\d/.test(v) ? 'http://' : 'https://') + v);
    } else {
      go((ENGINES[S.engine] || ENGINES.google).url.replace('%s', encodeURIComponent(v)));
    }
  });

  input.addEventListener('input', () => $('#searchForm').classList.toggle('has-value', !!input.value));
  input.addEventListener('keydown', (e) => {
    const open = menu.classList.contains('open');
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      const i = engineKeys.indexOf(S.engine);
      setEngine(engineKeys[(i + (e.shiftKey ? -1 : 1) + engineKeys.length) % engineKeys.length]);
    } else if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      menuIndex = (menuIndex + (e.key === 'ArrowDown' ? 1 : -1) + engineKeys.length) % engineKeys.length;
      highlight();
    } else if (open && e.key === 'Enter') {
      e.preventDefault();
      setEngine(engineKeys[menuIndex]);
      closeMenu();
    } else if (e.key === 'Escape') {
      if (open) closeMenu(); else { input.value = ''; input.blur(); }
    }
  });

  /* ---------- 快捷方式 ---------- */
  const tilesEl = $('#tiles');
  let dragFrom = -1;
  const svgPen = '<svg viewBox="0 0 12 12"><path d="M7.6 2.4l2 2L4 10H2v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  const svgX = '<svg viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  const renderTiles = () => {
    tilesEl.replaceChildren();
    S.tiles.forEach((t, i) => {
      const a = document.createElement('a');
      a.className = 'tile';
      a.href = t.url;
      a.title = `${t.name}\n${hostOf(t.url)}`;
      a.draggable = true;
      a.style.setProperty('--glow', `var(--c${i % 5})`);
      a.style.setProperty('--glow2', `var(--c${(i + 2) % 5})`);
      const orb = document.createElement('span');
      orb.className = 'orb';
      orb.append(iconFor(t.url, t.name, i, t.icon, null, orb));
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = t.name;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'del';
      del.setAttribute('aria-label', I18N.t('tile.remove', { n: t.name }));
      del.innerHTML = svgX;
      del.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        S.tiles.splice(i, 1); save(); renderTiles();
      });
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'del edit';
      edit.setAttribute('aria-label', I18N.t('tile.edit', { n: t.name }));
      edit.innerHTML = svgPen;
      edit.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openModal(i); });
      a.append(orb, name, del, edit);
      // 普通点击按设置的打开方式；Ctrl/中键等保持浏览器默认行为
      a.addEventListener('click', (e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(t.url);
      });

      a.addEventListener('dragstart', (e) => { dragFrom = i; a.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      a.addEventListener('dragend', () => { dragFrom = -1; a.classList.remove('dragging'); tilesEl.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target')); });
      a.addEventListener('dragover', (e) => { if (dragFrom < 0) return; e.preventDefault(); a.classList.add('drop-target'); });
      a.addEventListener('dragleave', () => a.classList.remove('drop-target'));
      a.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragFrom < 0 || dragFrom === i) return;
        const [m] = S.tiles.splice(dragFrom, 1);
        S.tiles.splice(i, 0, m);
        save(); renderTiles();
      });
      tilesEl.append(a);
    });

    if (S.tiles.length < 20) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'tile add';
      add.innerHTML = '<span class="orb"><svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span><span class="name"></span>';
      add.querySelector('.name').textContent = I18N.t('add');
      add.style.setProperty('--glow', 'var(--c1)');
      add.addEventListener('click', openModal);
      tilesEl.append(add);
    }
  };

  /* ---------- 弹窗：添加 / 编辑快捷方式 ---------- */
  const modal = $('#modal');
  const picker = $('#iconPicker');
  let editing = -1;
  let pickedIcon = '';
  const buildPicker = () => {
    picker.replaceChildren();
    const opts = [['', t('auto')],
      ...Object.entries(GLY.logos).map(([id, l]) => ['logo:' + id, id === 'bilibili' ? t('tile.bilibili') : l.name]),
      ...Object.keys(GLY.list).map((id) => ['glyph:' + id, t('glyph.' + id)])];
    opts.forEach(([val, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.val = val;
      b.title = label;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', label);
      if (val.startsWith('logo:')) b.append(builtinLogo(val.slice(5)));
      else if (val) b.append(builtinGlyph(val.slice(6)));
      else { const a = document.createElement('span'); a.className = 'auto'; a.textContent = t('auto'); b.append(a); }
      b.addEventListener('click', () => { pickedIcon = val; $('#tileIcon').value = ''; syncPicker(); });
      picker.append(b);
    });
  };
  const syncPicker = () => picker.querySelectorAll('.pick').forEach((b) => {
    const on = b.dataset.val === pickedIcon;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  function openModal(index) {
    editing = typeof index === 'number' ? index : -1;
    const t = editing >= 0 ? S.tiles[editing] : null;
    $('#modalTitle').textContent = I18N.t(t ? 'modal.edit' : 'modal.add');
    $('#saveTile').textContent = I18N.t(t ? 'save' : 'add');
    $('#tileName').value = t ? t.name : '';
    $('#tileUrl').value = t ? t.url : '';
    const icon = t && t.icon ? t.icon : '';
    const builtin = /^(glyph|logo):/.test(icon);
    pickedIcon = builtin ? icon : '';
    $('#tileIcon').value = icon && !builtin ? icon : '';
    syncPicker();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#tileName').focus(), 50);
  }
  $('#tileIcon').addEventListener('input', () => { if ($('#tileIcon').value.trim()) { pickedIcon = ''; syncPicker(); } });
  const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); };
  $('#cancelTile').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  $('#tileForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let url = $('#tileUrl').value.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch { $('#tileUrl').focus(); return; }
    const tile = { name: $('#tileName').value.trim() || hostOf(url), url };
    const custom = $('#tileIcon').value.trim();
    if (custom) tile.icon = /^(https?:|data:)/i.test(custom) ? custom : 'https://' + custom;
    else if (pickedIcon) tile.icon = pickedIcon;
    if (editing >= 0) S.tiles[editing] = tile; else S.tiles.push(tile);
    save(); renderTiles(); closeModal();
  });

  /* ---------- 设置面板 ---------- */
  const panel = $('#panel');
  const openPanel = () => { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); };
  const closePanel = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); };
  $('#settingsBtn').addEventListener('click', (e) => { e.stopPropagation(); panel.classList.contains('open') ? closePanel() : openPanel(); });
  $('#closePanel').addEventListener('click', closePanel);
  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('open') && !panel.contains(e.target) && !$('#settingsBtn').contains(e.target)) closePanel();
  });

  const buildSwatches = () => {
    const box = $('#swatches');
    box.replaceChildren();
    Object.entries(PALETTES).forEach(([id, p]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.id = id;
      const c = p.colors;
      const chip = document.createElement('span');
      chip.className = 'chip';
      c.forEach((hex, i) => chip.style.setProperty('--s' + i, hex));
      const label = document.createElement('span');
      label.textContent = t('palette.' + id);
      b.append(chip, label);
      b.addEventListener('click', () => { S.palette = id; applyPalette(false); save(); });
      box.append(b);
    });
  };

  const bindControls = () => {
    const bind = (id, key, cb, parse = (v) => v) => {
      const el = $('#' + id);
      const isBox = el.type === 'checkbox';
      const sync = () => { isBox ? (el.checked = !!S[key]) : (el.value = S[key]); };
      sync();
      el.addEventListener(isBox ? 'change' : 'input', () => {
        S[key] = isBox ? el.checked : parse(el.value);
        cb(); save();
      });
      return sync;
    };
    const syncers = [
      bind('speed', 'speed', applyMotion, parseFloat),
      bind('intensity', 'intensity', applyMotion, parseFloat),
      bind('quality', 'quality', applyMotion),
      bind('mouse', 'mouse', applyMotion, parseFloat),
      bind('iconStyle', 'iconStyle', () => { applyIconStyle(); buildMenu(); $('#engineSel').value = S.engine; renderEngine(); renderTiles(); }),
      bind('grain', 'grain', applyMotion),
      bind('showBrand', 'showBrand', applyContent),
      bind('showTiles', 'showTiles', applyContent),
      bind('engineSel', 'engine', renderEngine),
      bind('openMode', 'openMode', () => {}),
    ];
    $('#refreshIcons').addEventListener('click', () => {
      iconStore = {};
      try { localStorage.removeItem(ICON_KEY); } catch { /* noop */ }
      buildMenu(); $('#engineSel').value = S.engine; renderEngine(); renderTiles();
      $('#refreshIcons').textContent = t('refreshing');
      setTimeout(() => { $('#refreshIcons').textContent = t('refresh'); }, 2500);
    });
    $('#resetBtn').addEventListener('click', () => {
      S = clone(DEFAULTS);
      syncers.forEach((f) => f());
      applyAll(false);
      save();
    });
    return () => syncers.forEach((f) => f());
  };

  /* ---------- 全局快捷键 ---------- */
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape') { closePanel(); closeModal(); }
  });

  /* ---------- 启动 ---------- */
  function applyIconStyle() { document.body.classList.toggle('icons-mono', S.iconStyle === 'mono'); }
  const syncLangToggle = () => document.querySelectorAll('#langToggle button').forEach((b) => {
    const on = b.dataset.lang === S.lang;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  });
  const applyLang = () => {
    I18N.set(S.lang);
    syncLangToggle();
    buildSwatches(); applyPalette(true);
    buildMenu(); $('#engineSel').value = S.engine;
    buildPicker();
  };
  document.querySelectorAll('#langToggle button').forEach((b) => b.addEventListener('click', () => {
    if (S.lang === b.dataset.lang) return;
    S.lang = b.dataset.lang;
    applyLang(); renderEngine(); renderTiles(); save();
  }));
  function applyAll(instant) {
    applyLang();
    applyIconStyle();
    applyPalette(instant);
    applyMotion();
    applyContent();
    renderEngine();
    renderTiles();
  }

  if (IS_EXT) $('#version').textContent = 'Halo Drift ' + chrome.runtime.getManifest().version;
  applyLang();
  const resync = bindControls();
  applyAll(true);
  if (aurora) aurora.start();
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('ready')));

  if (SYNC) {
    chrome.storage.sync.get(KEY, (r) => {
      const remote = r && r[KEY];
      if (remote && JSON.stringify(remote) !== JSON.stringify(S)) {
        S = Object.assign(clone(DEFAULTS), migrate(remote));
        if (migrated) save();
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* noop */ }
        resync();
        applyAll(false);
      }
    });
  }

})();
