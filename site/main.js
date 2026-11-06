// Ombra site: nav, release info from GitHub, the download sheet, the walking mark in the hero,
// the app tour and the live smoothing chart.
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const html = document.documentElement;

  // ---------- entrances (the styles live in style.css, "motion") ----------
  // Headings are split into words so each one can catch up with its shadows.
  function splitWords(el) {
    const words = [];
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 1) { walk(n); continue; }
        if (n.nodeType !== 3) continue;
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
          const w = document.createElement("span");
          w.className = "w"; w.textContent = part;
          frag.appendChild(w); words.push(w);
        }
        n.replaceWith(frag);
      }
    };
    walk(el);
    words.forEach((w, i) => w.style.setProperty("--i", i));
    el.classList.add("split");
    return words.length;
  }
  const h1 = $(".hero h1");
  if (h1) splitWords(h1);
  $$(".section-head").forEach((head) => {
    const h = $("h2", head);
    if (h) head.style.setProperty("--words", splitWords(h));
  });
  // stagger order inside lists
  [".facts > div", ".rail button", ".steps li", ".faq details", ".foot-in > *", ".mobile-menu a"].forEach((sel) =>
    $$(sel).forEach((el, i) => el.style.setProperty("--i", i)));

  // the page starts once the font is in (or after 600 ms), so words don't jump mid-entrance
  const ready = new Promise((resolve) => {
    let done = false;
    const go = () => { if (!done) { done = true; resolve(); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    else go();
    setTimeout(go, 600);
  });
  ready.then(() => {
    html.classList.add("loaded");
    if (h1) h1.classList.add("in");
    const blocks = $$(".section-head, .facts, .tour, .demo, .steps, .install-cta, .faq, .foot");
    const reveal = (el) => { el.classList.add("in"); $$(".split", el).forEach((s) => s.classList.add("in")); };
    if (!("IntersectionObserver" in window)) { blocks.forEach(reveal); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
    }, { rootMargin: "0px 0px -12% 0px" });
    blocks.forEach((b) => io.observe(b));
  });

  // ---------- nav ----------
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = $(".nav-toggle");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
  };
  toggle.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  const links = $$(".nav-links a");
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => a.classList.toggle("active", a === byId.get(en.target.id)));
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---------- release and stars, from GitHub's public API (cached for 30 min) ----------
  // The download links don't depend on this: releases/latest/download/Ombra-Setup.exe always
  // points at the newest installer. This only fills in the version, size and star count.
  const STAR_MIN = 10;          // below this the count is not shown
  const CACHE = "ombra-gh-v1", TTL = 30 * 60 * 1000;
  const getJSON = (url) => fetch(url, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  async function ghInfo() {
    try { const c = JSON.parse(localStorage.getItem(CACHE)); if (c && Date.now() - c.t < TTL) return c; } catch (_) { /* no storage */ }
    const [repo, rel] = await Promise.all([
      getJSON("https://api.github.com/repos/thadoom/ombra"),
      getJSON("https://api.github.com/repos/thadoom/ombra/releases/latest"),
    ]);
    const asset = rel && (rel.assets || []).find((a) => a.name === "Ombra-Setup.exe");
    const info = {
      t: Date.now(),
      stars: repo ? repo.stargazers_count : null,
      version: rel ? String(rel.tag_name || "").replace(/^v/, "") : null,
      size: asset ? asset.size : null,
    };
    if (repo || rel) { try { localStorage.setItem(CACHE, JSON.stringify(info)); } catch (_) { /* no storage */ } }
    return info;
  }
  ghInfo().then((g) => {
    if (g.version) {
      const size = g.size ? `, ${(g.size / 1048576).toFixed(1)} MB` : "";
      $$(".js-release").forEach((el) => { el.textContent = `Version ${g.version}${size}`; });
    }
    if (typeof g.stars === "number" && g.stars >= STAR_MIN) {
      $$(".js-star .count").forEach((el) => { el.textContent = g.stars.toLocaleString("en"); el.hidden = false; });
    }
  });

  // ---------- download sheet: what to do while the installer downloads ----------
  const toast = $("#dl-toast"), card = $(".dl-card", toast);
  let hideTimer = 0;
  const hideToast = () => {
    clearTimeout(hideTimer);
    if (toast.hidden) return;
    if (reduceMotion) { toast.hidden = true; return; }
    card.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px)" }],
      { duration: 180, easing: "ease-in" }).onfinish = () => { toast.hidden = true; };
  };
  const armHide = () => { clearTimeout(hideTimer); hideTimer = setTimeout(hideToast, 30000); };
  const showToast = () => {
    const wasHidden = toast.hidden;
    toast.hidden = false;
    armHide();
    if (!wasHidden || reduceMotion) return;
    // it arrives the way the mark moves: the card first, its two shadows catching up
    card.animate([
      { opacity: 0, transform: "translateX(28px)", boxShadow: "0 0 0 #2f6b50, 0 0 0 #24443a, 0 24px 60px -20px rgba(0,0,0,0)" },
      { opacity: 1, transform: "none", offset: 0.45 },
      { opacity: 1, transform: "none", boxShadow: "-8px 0 0 #2f6b50, -16px 0 0 #24443a, 0 24px 60px -20px rgba(0,0,0,.8)" },
    ], { duration: 620, easing: "cubic-bezier(.3,1.3,.5,1)" });
  };
  $$(".js-download").forEach((a) => a.addEventListener("click", showToast));
  $(".dl-close", toast).addEventListener("click", hideToast);
  toast.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  toast.addEventListener("pointerleave", armHide);
  toast.addEventListener("focusin", () => clearTimeout(hideTimer));
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!menu.hidden) { setMenu(false); toggle.focus(); }
    else if (!toast.hidden) hideToast();
  });

  // ---------- elastic pill with two echoes (rail, sub-tabs) ----------
  function placePill(group, btn, instant) {
    const pill = $(".pill", group);
    if (!pill || !btn) return;
    if (instant || reduceMotion) group.classList.add("instant");
    pill.style.setProperty("--x", btn.offsetLeft + "px");
    pill.style.setProperty("--y", btn.offsetTop + "px");
    pill.style.setProperty("--w", btn.offsetWidth + "px");
    pill.style.setProperty("--h", btn.offsetHeight + "px");
    if (instant || reduceMotion) { void group.offsetWidth; group.classList.remove("instant"); }
  }
  const keepPill = (group, current) => {
    if ("ResizeObserver" in window) new ResizeObserver(() => placePill(group, current(), true)).observe(group);
    else window.addEventListener("resize", () => placePill(group, current(), true));
    document.fonts && document.fonts.ready.then(() => placePill(group, current(), true));
  };

  // ---------- hero: the mark walking, its two shadows a step behind ----------
  // Same figure, strokes and colours as assets/logo.svg; joints in its 512-unit space.
  const fig = $(".figure");
  if (fig) {
    const layers = $$(".echo", fig).map((g) => ({
      po: $("path.o", g), co: $("circle.o", g), pf: $("path.f", g), cf: $("circle.f", g),
    }));
    const D = Math.PI / 180;
    const at = (p, len, deg) => [p[0] + len * Math.sin(deg * D), p[1] + len * Math.cos(deg * D)];
    function pose(phi) {
      const H = [246, 296 - 5 * Math.cos(2 * phi)];
      const lean = 12.6 + 1.2 * Math.sin(2 * phi);
      const up = (len, extra = 0) => [H[0] + len * Math.sin((lean + extra) * D), H[1] - len * Math.cos((lean + extra) * D)];
      const N = up(100), S = up(82), C = [N[0] + 62 * Math.sin((lean + 4) * D), N[1] - 62 * Math.cos((lean + 4) * D)];
      const legs = [0, 1].map((s) => {
        const ph = phi + s * Math.PI;
        const thigh = 12 + 32 * Math.sin(ph);
        const flex = Math.max(6, 33 + 27 * Math.cos(ph + 0.3));
        const K = at(H, 75, thigh);
        return [K, at(K, 70, thigh - flex)];
      });
      const arms = [0, 1].map((s) => {
        const ph = phi + s * Math.PI + Math.PI;
        const upper = 8 + 26 * Math.sin(ph);
        const E = at(S, 66, upper);
        return [E, at(E, 50, upper + 12 + 12 * Math.max(0, Math.sin(ph)))];
      });
      return { H, N, S, C, legs, arms };
    }
    const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
    function draw(layer, P, dx, dy) {
      const T = (p) => [p[0] + dx, p[1] + dy];
      const H = T(P.H), N = T(P.N), S = T(P.S), C = T(P.C);
      const [l0, l1] = P.legs.map(([K, F]) => [T(K), T(F)]);
      const [a0, a1] = P.arms.map(([E, W]) => [T(E), T(W)]);
      const d = `M${f(N)}L${f(H)}M${f(H)}L${f(l0[0])}L${f(l0[1])}M${f(H)}L${f(l1[0])}L${f(l1[1])}` +
        `M${f(S)}L${f(a0[0])}L${f(a0[1])}M${f(S)}L${f(a1[0])}L${f(a1[1])}`;
      layer.po.setAttribute("d", d); layer.pf.setAttribute("d", d);
      for (const c of [layer.co, layer.cf]) { c.setAttribute("cx", C[0].toFixed(1)); c.setAttribute("cy", C[1].toFixed(1)); }
    }

    const BASE_X = 40, ECHO = 34;           // the mark's echo spacing
    const LAG = [0.22, 0.11, 0];            // seconds behind: far echo, near echo, figure
    const PERIOD = 1.5;                     // one full stride
    let light = { x: 1, y: 0 }, lightT = { x: 1, y: 0 };
    let t0 = 0, last = 0, running = false, onScreen = true;
    const phiAt = (t) => Math.PI / 2 + (2 * Math.PI * t) / PERIOD;
    // the opening: shadows start hidden under the figure and spring out, like the app's logo
    const intro = (t) => (t <= 0 ? 0 : 1 - Math.exp(-7 * t) * Math.cos(10 * t));

    function render(t) {
      const k = intro(t - 0.5);             // the figure fades in first, then its shadows spring out
      layers.forEach((L, i) => {
        const n = 2 - i;                      // 2 = far, 1 = near, 0 = figure
        const dx = -ECHO * n * light.x * k, dy = -12 * n * light.y * k;
        draw(L, pose(phiAt(Math.max(0, t - LAG[i]))), BASE_X + dx, dy);
      });
    }
    function frame(now) {
      if (!running) return;
      if (!t0) t0 = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const a = 1 - Math.exp(-dt * 7);
      light.x += (lightT.x - light.x) * a; light.y += (lightT.y - light.y) * a;
      render((now - t0) / 1000);
      requestAnimationFrame(frame);
    }
    const start = () => { if (running || reduceMotion) return; running = true; last = 0; requestAnimationFrame(frame); };
    const stop = () => { running = false; };

    if (reduceMotion) {
      render(100); // still: the mark's own pose
    } else {
      render(0);
      // the light follows the pointer over the figure; the shadows fall away from it
      const art = $(".hero-art");
      art.addEventListener("pointermove", (e) => {
        const r = art.getBoundingClientRect();
        lightT.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.45), -1, 1);
        lightT.y = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.5), -1, 1);
      });
      art.addEventListener("pointerleave", () => { lightT = { x: 1, y: 0 }; });
      // pause off screen; keep the stride continuous when it comes back
      let pausedAt = 0;
      ready.then(() => {
        if (!("IntersectionObserver" in window)) { start(); return; }
        new IntersectionObserver((en) => {
          onScreen = en[0].isIntersecting;
          if (onScreen) { if (pausedAt && t0) t0 += performance.now() - pausedAt; pausedAt = 0; start(); }
          else { pausedAt = performance.now(); stop(); }
        }).observe(art);
      });
    }
  }

  // ---------- tour: rail tabs, the shadow sweep between screenshots ----------
  const rail = $(".rail");
  if (rail) {
    const tabs = $$('[role="tab"]', rail);
    const shots = $$(".shots img");
    const bands = $$(".sweep i");
    let cur = 0, busy = null;
    const show = (i) => {
      shots.forEach((img, j) => { img.hidden = j !== i; });
      tabs.forEach((t, j) => {
        const p = document.getElementById(t.getAttribute("aria-controls"));
        p.hidden = j !== i;
        if (j === i) p.classList.add("enter");   // its copy rises in as the shadow passes
      });
    };
    const select = (i, focus) => {
      if (i === cur) { if (focus) tabs[i].focus(); return; }
      const dir = i > cur ? 1 : -1;
      tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(j === i)); t.tabIndex = j === i ? 0 : -1; });
      placePill(rail, tabs[i]);
      if (focus) tabs[i].focus();
      tabs[i].scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      cur = i;
      if (reduceMotion || !bands[0].animate) { show(i); return; }
      // a shadow crosses the window; the new page is there once it has passed
      if (busy) busy.forEach((a) => a.cancel());
      const from = dir > 0 ? "-101%" : "101%", to = dir > 0 ? "101%" : "-101%";
      const DUR = 640;
      busy = bands.map((b, j) => b.animate(
        [{ transform: `translateX(${from})` }, { transform: `translateX(${to})` }],
        { duration: DUR, delay: (2 - j) * 80, easing: "cubic-bezier(.65,0,.35,1)", fill: "backwards" }));
      setTimeout(() => { if (cur === i) show(i); }, DUR / 2);
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i, false));
      t.addEventListener("keydown", (e) => {
        let j = -1;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        if (j >= 0) { e.preventDefault(); select(j, true); }
      });
    });
    placePill(rail, tabs[0], true);
    keepPill(rail, () => tabs[cur]);
    // warm the other screenshots once the tour is close, so the sweep never reveals a blank
    const warm = () => shots.forEach((img) => { const im = new Image(); im.src = img.currentSrc || img.src; });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { warm(); io.disconnect(); } }, { rootMargin: "600px 0px" });
      io.observe(rail);
    } else warm();
  }

  // ---------- smoothing chart ----------
  // Same maths as src/common/filter.h (rotation part) and the presets in rs/ombra/src/settings.rs:
  // [rot_min_cutoff, rot_beta, rot_d_cutoff]
  const PRESETS = {
    smooth: [2.5, 1.5, 3.0],
    balanced: [3.5, 1.5, 5.0],
    responsive: [5.0, 2.5, 5.0],
    off: null,
  };
  const HZ = 100, DT = 1 / HZ, DEG = Math.PI / 180;
  const alpha = (cutoff, dt) => { const tau = 1 / (2 * Math.PI * Math.max(cutoff, 1e-3)); return 1 / (1 + tau / dt); };

  function makeFilter(p) {
    let init = false, x = 0, speed = 0;
    return (raw) => {
      if (!p) return raw;
      if (!init) { init = true; x = raw; return x; }
      const s = Math.abs(raw - x) * DEG / DT;                 // rad/s
      speed += alpha(p[2], DT) * (s - speed);
      const cutoff = p[0] + p[1] * speed;
      x += alpha(cutoff, DT) * (raw - x);
      return x;
    };
  }

  // A foot tracker: rest, a kick, rest, a few steps of sway. Deterministic noise so the numbers are stable.
  const PERIOD = 6.4;
  const smooth = (u) => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  function truth(t) {
    t %= PERIOD;
    if (t >= 1.6 && t < 2.0) return 55 * smooth((t - 1.6) / 0.4);
    if (t >= 2.0 && t < 2.25) return 55;
    if (t >= 2.25 && t < 2.75) return 55 * (1 - smooth((t - 2.25) / 0.5));
    if (t >= 3.9 && t < 5.5) { const u = (t - 3.9) / 1.6; return 14 * Math.sin(2 * Math.PI * 1.25 * (t - 3.9)) * Math.sin(Math.PI * u); }
    return 0;
  }
  const isRest = (t) => { t %= PERIOD; return (t > 0.3 && t < 1.55) || (t > 3.1 && t < 3.85) || (t > 5.9); };
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  const NOISE = 0.55; // degrees, typical IMU jitter at rest

  // stable numbers per preset over 20 periods
  function metrics(p) {
    const r = rng(7), f = makeFilter(p), n = Math.round(PERIOD * 20 * HZ);
    const tr = new Float64Array(n), out = new Float64Array(n);
    let restSq = 0, restN = 0;
    for (let i = 0; i < n; i++) {
      const t = i * DT; tr[i] = truth(t); out[i] = f(tr[i] + gauss(r) * NOISE);
      if (i > HZ && isRest(t)) { restSq += (out[i] - tr[i]) ** 2; restN++; }
    }
    // lag over the kicks: the shift that best lines the output up with the true motion
    // (searched in 0.5 ms steps, with the true motion interpolated between samples)
    let best = 0, bestErr = Infinity;
    for (let k = 0; k <= 400; k++) {
      const sh = k / 20, k0 = Math.floor(sh), fr = sh - k0;
      let e = 0;
      for (let c = 1; c < 20; c++) {
        const a = Math.round((c * PERIOD + 1.55) * HZ), b = Math.round((c * PERIOD + 2.8) * HZ);
        for (let i = a; i < b; i++) { const v = tr[i - k0] * (1 - fr) + tr[i - k0 - 1] * fr; e += (out[i] - v) ** 2; }
      }
      if (e < bestErr) { bestErr = e; best = sh; }
    }
    return { jitter: Math.sqrt(restSq / restN), lag: best * 1000 / HZ };
  }
  const M = {};
  for (const k of Object.keys(PRESETS)) M[k] = metrics(PRESETS[k]);

  const canvas = $("#chart");
  const ctx = canvas.getContext("2d");
  const pauseBtn = $(".pause");
  const mJ = $("#m-jitter"), mL = $("#m-lag");
  const WIN = 4.5;                                   // seconds on screen
  const N = Math.round(WIN * HZ);
  const raw = [], tru = [];
  let out = [];
  const noise = rng(11);
  let preset = "balanced", filter = makeFilter(PRESETS[preset]);
  let simT = 0, acc = 0, last = 0, paused = reduceMotion, visible = true;

  function pushSample() {
    const tv = truth(simT), rv = tv + gauss(noise) * NOISE;
    tru.push(tv); raw.push(rv); out.push(filter(rv));
    if (raw.length > N) { raw.shift(); tru.shift(); out.shift(); }
    simT += DT;
  }
  function refilter() {
    filter = makeFilter(PRESETS[preset]);
    out = raw.map((v) => filter(v));
  }
  // start with a full window, positioned so the first view shows a kick
  simT = PERIOD - 0.6;
  for (let i = 0; i < N; i++) pushSample();

  const note = $("#m-note");
  const NAMES = { smooth: "Smooth", balanced: "Balanced", responsive: "Responsive" };
  function showMetrics() {
    const m = M[preset];
    mJ.textContent = m.jitter.toFixed(2) + "°";
    mL.textContent = Math.round(m.lag) + " ms";
    if (preset === "off") {
      note.textContent = "Off: SteamVR gets the raw sensor data, with all of its jitter and no added delay.";
    } else {
      const cut = Math.round((1 - m.jitter / M.off.jitter) * 100);
      note.textContent = `${NAMES[preset]} cuts jitter at rest by ${cut}% and follows a fast kick ${Math.round(m.lag)} ms behind. SteamVR prediction, from the velocity Ombra sends, hides most of that delay.`;
    }
  }

  let W = 0, H = 0, dpr = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  const C = { grid: "#212b28", axis: "#3a4843", label: "#9ca8a2", raw: "#ffb547", out: "#6bf0a2", inset: "rgba(24,32,30,.94)" };
  const font = '500 11px Sora, "Segoe UI", system-ui, sans-serif';
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const padL = 46, padR = 16, padT = 22, padB = 22;
    const lo = -20, hi = 65;
    const x = (i) => padL + (i / (N - 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    ctx.font = font; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    for (let v = -15; v <= 60; v += 15) {
      ctx.strokeStyle = v === 0 ? C.axis : C.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, Math.round(y(v)) + 0.5); ctx.lineTo(W - padR, Math.round(y(v)) + 0.5); ctx.stroke();
      ctx.fillStyle = C.label; ctx.fillText(v + "°", padL - 8, y(v));
    }
    const line = (arr, color, width, alphaV) => {
      ctx.globalAlpha = alphaV; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) { const px = x(i), py = y(arr[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.globalAlpha = 1;
    };
    line(raw, C.raw, 1.4, 0.85);
    line(out, C.out, 2.6, 1);
    // zoomed inset on the most recent rest, so the jitter is visible at this scale
    const iw = Math.min(220, W * 0.34), ih = Math.min(96, H * 0.32), ix = W - padR - iw - 48, iy = padT + 4;
    if (W > 420) {
      ctx.fillStyle = C.inset; ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ix, iy, iw, ih, 8) : ctx.rect(ix, iy, iw, ih); ctx.fill(); ctx.stroke();
      const n = 120, s = raw.length - n;
      const zy = (v) => iy + ih / 2 - v * (ih / 2 - 10) / 2;   // ±2° full height
      const zx = (i) => ix + 8 + (i / (n - 1)) * (iw - 16);
      const zl = (arr, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); for (let i = 0; i < n; i++) { const v = arr[s + i] - tru[s + i]; const py = Math.max(iy + 2, Math.min(iy + ih - 2, zy(v))); i ? ctx.lineTo(zx(i), py) : ctx.moveTo(zx(i), py); } ctx.stroke(); };
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      zl(raw, "rgba(255,181,71,.8)", 1.2); zl(out, C.out, 2);
      ctx.restore();
      ctx.fillStyle = C.label; ctx.textAlign = "left"; ctx.fillText("Zoom: error against the true motion, ±2°", ix + 8, iy + ih + 12);
    }
  }

  function frame(now) {
    if (!last) last = now;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused && visible) {
      acc += dt;
      while (acc >= DT) { pushSample(); acc -= DT; }
      draw();
    }
    requestAnimationFrame(frame);
  }

  const seg = $(".seg");
  const radios = $$("[role=radio]", seg);
  const pick = (btn, focus) => {
    radios.forEach((x) => { const on = x === btn; x.setAttribute("aria-checked", String(on)); x.tabIndex = on ? 0 : -1; });
    placePill(seg, btn);
    preset = btn.dataset.preset; refilter(); showMetrics(); draw();
    if (focus) btn.focus();
  };
  radios.forEach((b, i) => {
    b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1;
    b.addEventListener("click", () => pick(b, false));
    b.addEventListener("keydown", (e) => {
      let j = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % radios.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + radios.length) % radios.length;
      if (j >= 0) { e.preventDefault(); pick(radios[j], true); }
    });
  });
  const checked = () => radios.find((r) => r.getAttribute("aria-checked") === "true");
  placePill(seg, checked(), true);
  keepPill(seg, checked);

  const setPaused = (p) => { paused = p; pauseBtn.setAttribute("aria-pressed", String(p)); pauseBtn.setAttribute("aria-label", p ? "Play chart" : "Pause chart"); };
  pauseBtn.addEventListener("click", () => setPaused(!paused));
  setPaused(paused);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(canvas);
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  resize();
  showMetrics();
  requestAnimationFrame(frame);
})();
