// Ombra site: nav, the app tour tabs, and the live smoothing chart.
(() => {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- nav ----------
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
  };
  toggle.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); } });
  window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  // highlight the section in view
  const links = [...document.querySelectorAll(".nav-links a")];
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((a) => a.classList.remove("active"));
        const a = byId.get(en.target.id);
        if (a) a.classList.add("active");
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---------- tour tabs (WAI-ARIA tabs pattern) ----------
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(t.getAttribute("aria-controls"));
      p.hidden = !on;
      if (on) { p.classList.remove("enter"); void p.offsetWidth; p.classList.add("enter"); }
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t, false));
    t.addEventListener("keydown", (e) => {
      let j = -1;
      if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); select(tabs[j], true); }
    });
  });

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

  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const pauseBtn = document.querySelector(".pause");
  const mJ = document.getElementById("m-jitter"), mL = document.getElementById("m-lag");
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

  const note = document.getElementById("m-note");
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

  const C = { grid: "#2a2825", axis: "#4f4a44", label: "#a0988c", raw: "#ffb547", out: "#6cf2a0" };
  const font = '500 11px "Cascadia Mono", Consolas, ui-monospace, monospace';
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
      ctx.fillStyle = "rgba(18,17,16,.92)"; ctx.strokeStyle = C.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(ix, iy, iw, ih, 8) : ctx.rect(ix, iy, iw, ih); ctx.fill(); ctx.stroke();
      const n = 120, s = raw.length - n;
      const zy = (v) => iy + ih / 2 - v * (ih / 2 - 10) / 2;   // ±2° full height
      const zx = (i) => ix + 8 + (i / (n - 1)) * (iw - 16);
      const zl = (arr, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); for (let i = 0; i < n; i++) { const v = arr[s + i] - tru[s + i]; const py = Math.max(iy + 2, Math.min(iy + ih - 2, zy(v))); i ? ctx.lineTo(zx(i), py) : ctx.moveTo(zx(i), py); } ctx.stroke(); };
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      zl(raw, "rgba(255,181,71,.8)", 1.2); zl(out, C.out, 2);
      ctx.restore();
      ctx.fillStyle = C.label; ctx.textAlign = "left"; ctx.fillText("zoom: error vs true motion, ±2°", ix + 8, iy + ih + 12);
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

  document.querySelectorAll(".seg [role=radio]").forEach((b, i, all) => {
    b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1;
    const pick = (btn, focus) => {
      all.forEach((x) => { const on = x === btn; x.setAttribute("aria-checked", String(on)); x.tabIndex = on ? 0 : -1; });
      preset = btn.dataset.preset; refilter(); showMetrics(); draw();
      if (focus) btn.focus();
    };
    b.addEventListener("click", () => pick(b, false));
    b.addEventListener("keydown", (e) => {
      let j = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % all.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + all.length) % all.length;
      if (j >= 0) { e.preventDefault(); pick(all[j], true); }
    });
  });

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
