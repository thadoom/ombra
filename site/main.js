// Ombra site: nav, release info from GitHub, the download sheet, the walking mark in the hero,
// the app tour.
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
  [".feat-groups > div", ".rail button", ".steps li", ".faq details", ".foot-in > *", ".mobile-menu a"].forEach((sel) =>
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
    const blocks = $$(".section-head, .feat-groups, .tour, .steps, .install-cta, .faq, .foot");
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
})();
