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
  // Japanese and Chinese have no spaces: the browser's word segmenter finds the words there.
  const seg = /^(ja|zh)/.test(html.lang) && window.Intl && Intl.Segmenter ? new Intl.Segmenter(html.lang, { granularity: "word" }) : null;
  // Punctuation (、。！) stays glued to the word before it, so it never starts a line.
  const parts = (s) => {
    if (!seg) return s.split(/(\s+)/);
    const out = [];
    for (const x of seg.segment(s)) {
      if (!x.isWordLike && !/^\s+$/.test(x.segment) && out.length) out[out.length - 1] += x.segment;
      else out.push(x.segment);
    }
    return out;
  };
  function splitWords(el) {
    const words = [];
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 1) { walk(n); continue; }
        if (n.nodeType !== 3) continue;
        const frag = document.createDocumentFragment();
        for (const part of parts(n.textContent)) {
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
  [".steps li", ".faq details", ".foot-in > *", ".mobile-menu a", ".solo li", ".more-list li", ".news-side > *"].forEach((sel) =>
    $$(sel).forEach((el, i) => el.style.setProperty("--i", i)));
  $$(".rail").forEach((r) => $$("button", r).forEach((b, i) => b.style.setProperty("--i", i)));
  $$(".ledger ul").forEach((ul) => [...ul.children].forEach((li, i) => li.style.setProperty("--i", i)));

  // the page starts once the font is in (or after 600 ms), so words don't jump mid-entrance
  const revealBlock = (el) => { el.classList.add("in"); $$(".split", el).forEach((s) => s.classList.add("in")); };
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
    const blocks = $$(".section-head, .tour, .solo, .more-list, .ledger, .news-in, .steps, .install-cta, .faq, .foot");
    // inside a section still shut (see the walker below), it waits until the section starts opening
    const reveal = (el) => {
      const sec = el.closest(".shut:not(.opening)");
      if (sec) (sec.__wait = sec.__wait || []).push(el); else revealBlock(el);
    };
    if (!("IntersectionObserver" in window)) { blocks.forEach(reveal); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { reveal(en.target); io.unobserve(en.target); }
    }, { rootMargin: "0px 0px -12% 0px" });
    blocks.forEach((b) => io.observe(b));
  });

  // ---------- nav ----------
  const nav = $(".nav");
  // it gathers into its floating tile a little way down and opens out again only right at the top,
  // so it never flickers at the threshold
  const onScroll = () => { const y = window.scrollY; if (y > 28) nav.classList.add("scrolled"); else if (y < 6) nav.classList.remove("scrolled"); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // texts in this page's language, from <html data-t-*>; English defaults inline
  const ds = document.documentElement.dataset;
  const T = { menuOpen: ds.tMenuOpen || "Open menu", menuClose: ds.tMenuClose || "Close menu", version: ds.tVersion || "Version {v}" };
  const toggle = $(".nav-toggle");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? T.menuClose : T.menuOpen);
    menu.hidden = !open;
  };
  toggle.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  // ---------- releases and stars, from GitHub's public API (cached for 30 min) ----------
  // The download links don't depend on this: releases/latest/download/Ombra-Setup.exe always
  // points at the newest installer. This fills in the version, size and star count, and the news.
  const STAR_MIN = 10;          // below this the count is not shown
  const CACHE = "ombra-gh-v2", TTL = 30 * 60 * 1000;
  const getJSON = (url) => fetch(url, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);

  // The "What's new" part of a release's notes (always written from the same template, see the release
  // notes of thadoom/ombra): English groups are a **Title** line and its bullets; the Italian part, in
  // <details>, has one bullet per group that starts with its **title**. Text before the groups is a note.
  function notes(md, it) {
    md = String(md || "").replace(/\r/g, "");
    const d = md.indexOf("<details");
    const part = it ? (d < 0 ? "" : md.slice(d)) : (d < 0 ? md : md.slice(0, d));
    const lead = it ? "" : ((md.match(/<p align="center">[\s\S]*?<\/p>/g) || [])
      .map((p) => p.replace(/<[^>]+>/g, "").trim()).find(Boolean) || "");
    const m = (it ? /^###\s.*(novit|cosa c).*$/im : /^##\s.*what's (new|in it).*$/im).exec(part);
    const out = { lead, note: "", groups: [] };
    if (!m) return out;
    let sec = part.slice(m.index + m[0].length);
    const end = sec.search(it ? /^#{2,3}\s|<\/details>/m : /^##\s/m);
    if (end >= 0) sec = sec.slice(0, end);
    const G = out.groups;
    for (const raw of sec.split("\n")) {
      const line = raw.trim();
      let g;
      if (!line) continue;
      if (line[0] === ">") {
        const x = line.replace(/^>\s?/, "");
        if (!/^\[!\w+\]$/.test(x)) out.note += (out.note ? " " : "") + x;
      } else if (!it && (g = /^\*\*([^*]+)\*\*$/.exec(line))) {
        G.push({ h: g[1], li: [] });
      } else if (/^[-*]\s/.test(line)) {
        const item = line.replace(/^[-*]\s+/, "");
        if (it && (g = /^\*\*([^*]+?)\*\*\s*:?\s*([\s\S]*)$/.exec(item))) G.push({ h: g[1].replace(/:$/, ""), li: [g[2].charAt(0).toUpperCase() + g[2].slice(1)] });
        else { if (!G.length) G.push({ h: "", li: [] }); G[G.length - 1].li.push(item); }
      } else if (!G.length) out.note += (out.note ? " " : "") + line;
      else { const last = G[G.length - 1]; if (last.li.length) last.li[last.li.length - 1] += " " + line; }
    }
    return out;
  }
  // Markdown inline to safe HTML: everything is escaped first, then only bold, italics and code come back
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inline = (s) => esc(String(s).replace(/<[^>]+>/g, ""))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  async function ghInfo() {
    try { const c = JSON.parse(localStorage.getItem(CACHE)); if (c && Date.now() - c.t < TTL) return c; } catch (_) { /* no storage */ }
    const [repo, list] = await Promise.all([
      getJSON("https://api.github.com/repos/thadoom/ombra"),
      getJSON("https://api.github.com/repos/thadoom/ombra/releases?per_page=8"),
    ]);
    const rels = (Array.isArray(list) ? list : []).filter((r) => !r.draft && !r.prerelease);
    const rel = rels[0];
    const asset = rel && (rel.assets || []).find((a) => a.name === "Ombra-Setup.exe");
    const info = {
      t: Date.now(),
      stars: repo ? repo.stargazers_count : null,
      version: rel ? String(rel.tag_name || "").replace(/^v/, "") : null,
      size: asset ? asset.size : null,
      rels: rels.slice(0, 5).map((r) => ({
        v: String(r.tag_name || "").replace(/^v/, ""), date: r.published_at, url: r.html_url,
        en: notes(r.body, false), it: notes(r.body, true),
      })),
    };
    if (repo || rel) { try { localStorage.setItem(CACHE, JSON.stringify(info)); } catch (_) { /* no storage */ } }
    return info;
  }

  // ---------- news: the latest release, written out; the ones before as a short list ----------
  function showNews(rels) {
    const box = $("#news");
    if (!box || !rels || !rels.length) return;
    const lang = html.lang || "en", it = /^it/.test(lang), t = box.dataset;
    const pick = (r) => (it && r.it && r.it.groups.length ? r.it : r.en);
    const day = (s, o) => { try { return new Intl.DateTimeFormat(lang, o).format(new Date(s)); } catch (_) { return s.slice(0, 10); } };
    const cur = rels[0], n = pick(cur), when = new Date(cur.date);
    const card = $(".rel", box);
    $(".rel-num", card).textContent = cur.v;
    let ago = "";
    const days = Math.round((when.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    if (window.Intl && Intl.RelativeTimeFormat && days > -30) ago = new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(days, "day");
    $(".rel-meta", card).innerHTML = `<span class="rel-tag">${esc(t.tLatest || "Latest")}</span>` +
      `<time datetime="${esc(cur.date)}">${esc(day(cur.date, { day: "numeric", month: "long", year: "numeric" }))}</time>` +
      (ago ? `<span aria-hidden="true">·</span><span>${esc(ago)}</span>` : "");
    const lead = $(".rel-lead", card);
    lead.innerHTML = inline(n.lead || "");
    lead.hidden = !n.lead;
    $(".rel-full", card).href = cur.url;
    // the line above the hero's title: the version and what it is about, in a few words
    const pill = $(".hero-new");
    if (pill) {
      const short = !it && n.lead ? n.lead.split(/[:,.]/)[0] : n.groups.map((g) => g.h).filter(Boolean).slice(0, 2).join(" · ");
      $(".hero-new-text", pill).innerHTML = `<b>${esc(cur.v)}</b> · ${inline(short)}`;
      $(".hero-new-tag", pill).hidden = days < -30;   // "new" only while it is
    }
    // two groups show; the rest opens under them
    const SHOW = 2;
    const group = (g) => `<div class="rel-group">${g.h ? `<h3>${inline(g.h)}</h3>` : ""}<ul class="ticks">${g.li.map((x) => `<li>${inline(x)}</li>`).join("")}</ul></div>`;
    const rest = n.groups.slice(SHOW);
    const body = $(".rel-body", card);
    body.innerHTML =
      (n.note ? `<p class="rel-note">${inline(n.note)}</p>` : "") +
      (!it && !/^en/.test(lang) ? `<p class="rel-lang">${esc(t.tEnglish || "")}</p>` : "") +
      `<div class="rel-groups">${n.groups.slice(0, SHOW).map(group).join("")}</div>` +
      (rest.length ? `<div class="rel-rest" id="rel-rest" hidden>${rest.map(group).join("")}</div>` +
        `<button class="rel-toggle" type="button" aria-expanded="false" aria-controls="rel-rest"><span>${esc(t.tMore || "")}</span><i aria-hidden="true"></i></button>` : "");
    [...body.children].forEach((el, i) => el.style.setProperty("--i", i));
    body.classList.add("fresh");
    const btn = $(".rel-toggle", body), more = $(".rel-rest", body);
    if (btn) btn.addEventListener("click", () => {
      const open = more.hidden;
      btn.setAttribute("aria-expanded", String(open));
      $("span", btn).textContent = open ? t.tLess : t.tMore;
      if (reduceMotion || !more.animate) { more.hidden = !open; return; }
      if (open) more.hidden = false;
      const h = more.scrollHeight;
      more.animate([{ height: (open ? 0 : h) + "px", opacity: open ? 0 : 1 }, { height: (open ? h : 0) + "px", opacity: open ? 1 : 0 }],
        { duration: open ? 480 : 300, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => { if (!open) more.hidden = true; };
    });
    // before that: version, date and what it was about
    const past = rels.slice(1, 5);
    if (!past.length) return;
    $(".past-list", box).innerHTML = past.map((r) => {
      const p = pick(r);
      // a patch says what it fixes in its note; otherwise the tagline, or the titles of its groups
      const what = (p.note && p.note.split(/(?<=[.!?。])\s/)[0]) || (!it && p.lead) || p.groups.map((g) => g.h).filter(Boolean).slice(0, 3).join(" · ");
      return `<li><a href="${esc(r.url)}"><span class="past-v">${esc(r.v)}</span><span class="past-what">${inline(what)}</span>` +
        `<time datetime="${esc(r.date)}">${esc(day(r.date, { day: "numeric", month: "short", year: "numeric" }))}</time></a></li>`;
    }).join("");
    $(".past", box).hidden = false;
  }

  ghInfo().then((g) => {
    if (g.version) {
      const size = g.size ? `, ${(g.size / 1048576).toFixed(1)} MB` : "";
      $$(".js-release").forEach((el) => { el.textContent = T.version.replace("{v}", g.version) + size; });
    }
    if (typeof g.stars === "number" && g.stars >= STAR_MIN) {
      $$(".js-star .count").forEach((el) => { el.textContent = g.stars.toLocaleString(document.documentElement.lang || "en"); el.hidden = false; });
    }
    showNews(g.rels);
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
  // the mark's walk: joints in its 512-unit space (assets/logo.svg), walking right
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
  const fig = $(".figure");
  if (fig) {
    const layers = $$(".echo", fig).map((g) => ({
      po: $("path.o", g), co: $("circle.o", g), pf: $("path.f", g), cf: $("circle.f", g),
    }));
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
      fig.__phi = phiAt(Math.max(0, t));    // the traveller below starts its fall mid-stride
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

    // ---------- the mark leaves the hero and travels down the page with you ----------
    // Wide screens with a pointer only, never with reduced motion. One small figure, drawn like the hero's,
    // that stands on things: the current tab of each tour (it hops when the tab changes), the top of a
    // window, the ledger, the news, the download button, the name in the footer. Scrolling to the next one
    // makes it step off and fall there, and what it lands on gives a little. Its two shadows are simply where
    // it was a moment ago, so they trail behind a fall and settle to its left, as in the mark.
    // It is also a toy. Take hold of it (the hero's one too) and it dangles and swings under your hand; let go
    // and it flies, bounces off the sides of the window and lands, dizzy if you spun or shook it, then hops
    // back where it belongs. A poke makes it jump and wave, three quick pokes a backflip. Left alone on a
    // ledge it sits down and swings its legs, and later it dozes off (point near it and it wakes with a start).
    // Hover it for a moment and it raises a hand: click for a high five. Hold the button down on it and it
    // charges up, let go and it shoots off the top of the screen and lands back. It points at the Download
    // and Discord buttons while you hover them, and cheers when you click Download. Come back to the tab
    // after a while and it waves. Type "ombra" anywhere and it dances, its two shadows a beat behind.
    // Point near it and it looks at you. At the very bottom of the page it comes forward, big, its shadows
    // springing out like the logo's, and waves goodbye.
    if (!reduceMotion && window.matchMedia("(hover: hover) and (min-width: 961px)").matches) ready.then(() => {
      const S = 0.25, GY = 462, FX = 286;      // px per unit; ground line and feet centre in the mark's units
      const HANG = 363;                        // hanging: from its hands down to the ground line, in units
      const mix = (a, b, k) => a + (b - a) * k;
      const ease = (u) => u * u * (3 - 2 * u);
      const norm = (r) => ((r % 360) + 540) % 360 - 180;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "figure walker"); svg.setAttribute("viewBox", "70 80 400 400"); svg.setAttribute("aria-hidden", "true");
      svg.innerHTML = fig.innerHTML +
        '<g class="daze" style="display:none">' + '<path d="M0-18 5-5 18 0 5 5 0 18-5 5-18 0-5-5Z"/>'.repeat(3) + "</g>" +
        '<g class="zz" style="display:none">' + "<text>z</text>".repeat(3) + "</g>" +
        '<g class="fx" style="display:none">' + "<path/>".repeat(7) + "</g>";
      document.body.appendChild(svg);
      html.classList.add("mark-play");
      const W = $$(".echo", svg).map((g) => ({ po: $("path.o", g), co: $("circle.o", g), pf: $("path.f", g), cf: $("circle.f", g) }));
      const daze = $(".daze", svg), stars = $$("path", daze);
      const zz = $(".zz", svg), zs = $$("text", zz), fxg = $(".fx", svg), rays = $$("path", fxg);
      // q: phi = stride, walk / air / crouch / sit / wave = 0..1 how much of each, lx / ly = where it looks, t = seconds
      function wpose(q) {
        const legs = [0, 1].map((s) => {
          const ph = q.phi + s * Math.PI;
          let th = mix(s ? -6 : 9, 12 + 32 * Math.sin(ph), q.walk), fl = mix(7, Math.max(6, 33 + 27 * Math.cos(ph + 0.3)), q.walk);
          th = mix(th, (s ? -18 : 34) + 10 * Math.sin(q.t * 9 + s * 2), q.air); fl = mix(fl, 58, q.air);
          th = mix(th, s ? 38 : 58, q.crouch); fl = mix(fl, 100, q.crouch);
          // sitting on an edge: thighs forward, shins hanging over it and swinging in turn
          const sw = Math.sin(q.t * 2.3 + s * Math.PI);
          th = mix(th, s ? 78 : 88, q.sit); fl = mix(fl, (s ? 78 : 88) - 20 * sw, q.sit);
          // hanging from the bar: legs loose, kicking a little
          th = mix(th, (s ? -24 : 30) + 9 * Math.sin(q.t * 2.1 + s * 1.3), q.hang); fl = mix(fl, (s ? 6 : 30) + 16 * Math.max(0, Math.sin(q.t * 2.6 + s * 2)), q.hang);
          th = mix(th, s ? -28 : 30, q.push); fl = mix(fl, 10, q.push);              // pushing: feet wide
          const cb = Math.max(0, Math.sin(q.cp + s * Math.PI));
          th = mix(th, 35 + 45 * cb, q.climb); fl = mix(fl, 70 + 30 * cb, q.climb);   // climbing: knees up in turn
          // dancing: knees up in turn, on the beat
          const db = Math.max(0, Math.sin(q.t * 8 + s * Math.PI));
          th = mix(th, (s ? -6 : 8) + 34 * db, q.dance); fl = mix(fl, 8 + 70 * db, q.dance);
          return [th, fl];
        });
        const arms = [0, 1].map((s) => {
          const ph = q.phi + s * Math.PI + Math.PI;
          let up = mix(s ? -5 : 9, 8 + 26 * Math.sin(ph), q.walk), bend = mix(10, 12 + 12 * Math.max(0, Math.sin(ph)), q.walk);
          up = mix(up, (s ? -150 : 155) + 14 * Math.sin(q.t * 11 + s * 1.7), q.air); bend = mix(bend, 18, q.air);
          up = mix(up, s ? 30 : 60, q.crouch); bend = mix(bend, 35, q.crouch);
          up = mix(up, s ? -40 : 38, q.sit); bend = mix(bend, s ? -20 : 34, q.sit);   // one hand behind, one on the knee
          up = mix(up, s ? -145 : 145, q.hang); bend = mix(bend, s ? -20 : 20, q.hang);  // arms in a V, hands on the bar
          // dancing: arms pumping in turn; cheering: both up, shaking; sleeping: limp
          const da = Math.sin(q.t * 8 + s * Math.PI);
          up = mix(up, (s ? -1 : 1) * (75 + 70 * da), q.dance); bend = mix(bend, (s ? -1 : 1) * (40 + 30 * da), q.dance);
          up = mix(up, (s ? -158 : 158) + 9 * Math.sin(q.t * 16 + s * 2), q.cheer); bend = mix(bend, s ? -14 : 14, q.cheer);
          up = mix(up, s ? -8 : 14, q.sleep); bend = mix(bend, 4, q.sleep);
          up = mix(up, s ? -92 : 92, q.push); bend = mix(bend, s ? -4 : 4, q.push);  // pushing: both arms out, one each way
          up = mix(up, 148 + 24 * Math.sin(q.cp + s * Math.PI + Math.PI), q.climb); bend = mix(bend, 22, q.climb);   // climbing: hand over hand
          up += 16 * Math.sin(q.sp + s * Math.PI) * q.shim; bend += 10 * Math.max(0, Math.sin(q.sp + s * Math.PI)) * q.shim;   // along the bar, one hand then the other
          if (!s) {
            up = mix(up, q.pa, q.point); bend = mix(bend, 0, q.point);          // the whole arm towards a button
            up = mix(up, 168, q.five); bend = mix(bend, 6, q.five);             // a hand up, for a high five
            up = mix(up, 112, q.wave); bend = mix(bend, 50 + 24 * Math.sin(q.t * 7), q.wave);   // elbow out, forearm waving
          }
          return [up, bend];
        });
        const lean = mix(mix(mix(mix(mix(3, 12.6, q.walk), -5, q.air), 24, q.crouch), -6, q.sit), 0, q.hang) + 5 * q.lx
          + 9 * Math.sin(q.t * 4) * q.dance - 6 * q.cheer + 26 * q.sleep + 10 * q.climb;      // asleep, it nods forward
        // the hip sits wherever keeps the lower foot on the ground line; sitting, it sits on the line;
        // hanging, where its hands meet the bar (HANG units above the ground line)
        const hy = GY - 20 - Math.max(...legs.map(([th, fl]) => 75 * Math.cos(th * D) + 70 * Math.cos((th - fl) * D)));
        const H = [246, mix(mix(hy, GY - 26, q.sit), GY - HANG + 184, q.hang)];   // 82 to the shoulders, 102 up the arms
        const up = (len, extra = 0) => [H[0] + len * Math.sin((lean + extra) * D), H[1] - len * Math.cos((lean + extra) * D)];
        const N = up(100), Sh = up(82);
        return {
          H, N, S: Sh, C: [N[0] + 62 * Math.sin((lean + 4 + 14 * q.sleep) * D) + 14 * q.lx, N[1] - 62 * Math.cos((lean + 4 + 14 * q.sleep) * D) + 10 * q.ly],
          legs: legs.map(([th, fl]) => { const K = at(H, 75, th); return [K, at(K, 70, th - fl)]; }),
          arms: arms.map(([u, b]) => { const E = at(Sh, 66, u); return [E, at(E, 50, u + b)]; }),
        };
      }
      const drawW = (layer, P, ox, oy, flip) => {
        const T = (p) => [(flip ? 2 * FX - p[0] - BASE_X : p[0] + BASE_X) + ox, p[1] + oy];
        const H = T(P.H), N = T(P.N), Sh = T(P.S), C = T(P.C);
        const [l0, l1] = P.legs.map(([K, F]) => [T(K), T(F)]), [a0, a1] = P.arms.map(([E, Wr]) => [T(E), T(Wr)]);
        const d = `M${f(N)}L${f(H)}M${f(H)}L${f(l0[0])}L${f(l0[1])}M${f(H)}L${f(l1[0])}L${f(l1[1])}` +
          `M${f(Sh)}L${f(a0[0])}L${f(a0[1])}M${f(Sh)}L${f(a1[0])}L${f(a1[1])}`;
        layer.po.setAttribute("d", d); layer.pf.setAttribute("d", d);
        for (const c of [layer.co, layer.cf]) { c.setAttribute("cx", C[0].toFixed(1)); c.setAttribute("cy", C[1].toFixed(1)); }
        return { C, hand: a0[1], feet: [(l0[1][0] + l1[1][0]) / 2, Math.max(l0[1][1], l1[1][1])] };
      };

      // what it stands on, in page order; `at` = how far up the screen (0..1) the thing must be to call it over.
      // Every section's title is one (it stands on the last word), so there is always something close by.
      const anchors = [{ el: fig, kind: "hero" }], rest = [];
      $$(".section-head h2").forEach((h) => { const w = $$(".w", h).pop() || h; rest.push({ el: h, kind: "title", at: 0.7, word: w, give: w }); });
      $$(".chapter").forEach((sec) => {
        const tour = $(".tour", sec), box = $(".depth", sec);
        if (tour) rest.push({ el: tour, kind: "tab", rail: $(".rail", tour) });
        else if (box) rest.push({ el: box, kind: "edge", give: $(".window", box) });
      });
      [[".ledger", "edge", 0.6], [".rel", "edge", 0.6], [".install-cta .btn-primary", "press", 0.72], [".foot-mark", "mark", 0.93]].forEach(([sel, kind, a]) => {
        const el = $(sel); if (el) rest.push({ el, kind, at: a, give: el });
      });
      const docTop = (el) => el.getBoundingClientRect().top + scrollY;
      anchors.push(...rest.sort((a, b) => docTop(a.el) - docTop(b.el)));
      // where its feet go, in window coordinates; s = its size there. When that place has gone up under the
      // nav bar, it hangs from the bar's bottom edge instead, so it never leaves the screen while you read.
      const bar = $(".nav-bg");
      const point = (a) => {
        if (a.kind === "hero") { const r = fig.getBoundingClientRect(), s = r.width / 400; return { x: r.left + (FX - 70) * s, y: r.top + (GY - 80) * s, s }; }
        let c;
        const r = a.kind === "tab" ? $('[aria-selected="true"]', a.rail).getBoundingClientRect() : (a.word || a.el).getBoundingClientRect();
        if (a.kind === "tab") c = { x: r.right - 24, y: r.top + 3, s: S };
        else if (a.kind === "title") c = { x: r.left + r.width * 0.55, y: r.top + r.height * 0.16, s: S };
        else if (a.kind === "edge") {   // it walks along the top edge as the thing scrolls up the screen
          const k = clamp((innerHeight * 0.6 - r.top) / (innerHeight * 0.6 - 110), 0, 1);
          c = { x: r.left + 64 + (r.width - 128) * k, y: r.top + 2, s: S, walk: true };
        } else if (a.kind === "mark") return { x: r.left + r.width * 0.47, y: r.top + r.height * 0.17, s: S * 1.2, wave: true };   // on top of the m
        else c = { x: r.left + r.width / 2, y: r.top + 3, s: S };
        const br = bar.getBoundingClientRect(), hy = br.bottom + HANG * c.s - 2;
        if (c.y < hy) {
          // over a tour it hangs in the gap between the tabs and the window, clear of both; always under the bar
          const x = a.kind === "tab" ? (a.el.classList.contains("flip") ? r.left - 30 : r.right + 30) : c.x;
          return { x: clamp(x, Math.max(90, br.left + 40), Math.min(innerWidth - 90, br.right - 40)), y: hy, s: c.s, hang: true };
        }
        return c;
      };
      // what it lands on gives a little
      const land = (a, hard) => {
        const opts = { duration: hard ? 700 : 520, easing: "cubic-bezier(.3,1.45,.5,1)" };
        if (a.kind === "tab") {
          const h = $('[aria-selected="true"]', a.rail).offsetHeight;
          $$(".pill i", a.rail).forEach((i) => i.animate([{ marginTop: "0px", height: h + "px" }, { marginTop: "7px", height: h - 7 + "px", offset: 0.3 }, { marginTop: "0px", height: h + "px" }], opts));
        } else if (a.kind === "press") {
          a.el.classList.add("pressed"); setTimeout(() => a.el.classList.remove("pressed"), 420);
        } else if (a.give) a.give.animate([{ translate: "0 0" }, { translate: hard ? "0 16px" : "0 7px", offset: 0.3 }, { translate: "0 0" }], opts);
      };

      let idx = 0, pos = null, tr = null, shown = false, lastLand = -9, phi = 0, walk = 0, wave = 0, left = false, lastC = null, lastT = 0;
      // the toy: grab = held, fly = thrown, dazed = landed hard, trick = a hop or a backflip, fin = the goodbye
      let grab = null, fly = null, dazed = null, trick = null, fin = null, finDone = false, down = null, ptr = null;
      let rot = 0, rotV = 0, sit = 0, hang = 0, idleT = 0, waveUntil = 0, pokes = [], sv = 0, lastSY = scrollY;
      // the extras: pointing at a button, a hand up for a high five, asleep, a burst of lines
      let pointAt = null, pointK = 0, pa = 90, five = 0, hoverT = 0, sleep = 0, fx = null, typed = "", hiddenAt = 0;
      // trav = getting somewhere on foot (walking, jumping, dropping, climbing); hide = sulking behind a window
      let trav = null, hide = null, annoy = [];

      // ----- the page as a world: what it can stand on, climb and bump into -----
      // Tops of things are floors (it lands on them only when falling onto them, so it can jump up through
      // text); the big things (windows, cards) also have sides to hit and climb, and undersides to bump.
      const SOLID = ".depth, .rel, .ledger, .discord-card, .hero-new, .btn, .rail button, .past-list a, .faq summary, .steps li, .more-list li, .foot-mark";
      const WORDS = "h1 .w, .section-head h2 .w";
      const LINES = ".lede, .hero-meta, .section-head p, .panel h3, .panel > p, .ticks li, .more-list h3, .more-list p, .steps h3, .steps p, .ledger li, .rel-lead, .rel-group h3, .discord-card h3, .discord-card p, .install-cta p";
      const solidEls = $$(SOLID), wordEls = $$(WORDS), lineEls = $$(LINES), rng = document.createRange();
      let worldT = -1, world = null;
      const getWorld = (t) => {
        if (worldT === t) return world;
        worldT = t;
        const vh = innerHeight, sx = scrollX, sy = scrollY, plats = [], walls = [];
        const near = (r) => r.width > 0 && r.bottom > -300 && r.top < vh + 300;
        for (const el of solidEls) {
          const r = el.getBoundingClientRect();
          if (!near(r) || el.closest(".shut")) continue;
          const pl = { el, l: r.left + sx, r: r.right + sx, top: r.top + sy, b: r.bottom + sy, kind: "block" };
          plats.push(pl); if (r.height > 60) walls.push(pl);
        }
        for (const el of wordEls) {
          const r = el.getBoundingClientRect();
          if (!near(r) || el.closest(".shut")) continue;
          plats.push({ el, l: r.left + sx, r: r.right + sx, top: r.top + sy + r.height * 0.16, b: r.bottom + sy - r.height * 0.15, kind: "word" });
        }
        for (const el of lineEls) {
          const r0 = el.getBoundingClientRect();
          if (!near(r0) || el.closest(".shut")) continue;
          rng.selectNodeContents(el);
          const lines = new Map();
          for (const r of rng.getClientRects()) {
            if (r.width < 2) continue;
            const k = Math.round(r.top / 6), L = lines.get(k);
            if (L) { L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right); } else lines.set(k, { l: r.left, r: r.right, top: r.top, h: r.height });
          }
          for (const L of lines.values()) plats.push({ el, l: L.l + sx, r: L.r + sx, top: L.top + sy + L.h * 0.22, b: L.top + sy + L.h, kind: "line" });
        }
        return (world = { plats, walls });
      };
      // what it touches gives: a word or a button is pushed aside and springs back; a window wobbles
      const bumped = new WeakMap();
      const bump = (el, dx, dy, t) => {
        if (!el || !el.animate || t - (bumped.get(el) || -9) < 0.5) return;
        bumped.set(el, t);
        const word = el.classList.contains("w"), big = el.classList.contains("depth") || el.classList.contains("rel") || el.classList.contains("ledger");
        const k = word ? 9 : big ? 3 : 5;
        const mid = { translate: `${(dx * k).toFixed(1)}px ${(dy * k).toFixed(1)}px`, offset: 0.22 };
        if (word) mid.rotate = `${(dx * 9 + dy * 3).toFixed(1)}deg`;
        el.animate([{ translate: "0 0", rotate: word ? "0deg" : undefined }, mid, { translate: "0 0", rotate: word ? "0deg" : undefined }].map((f) => { const o = { ...f }; if (o.rotate === undefined) delete o.rotate; return o; }),
          { duration: word ? 720 : 560, easing: "cubic-bezier(.3,1.6,.5,1)" });
      };
      // its body against words and buttons while it is dragged or flying: they get out of the way
      const brush = (t) => {
        const Wd = getWorld(t), h = 330 * pos.s, x0 = pos.x - 16, x1 = pos.x + 16, y0 = pos.y - h, y1 = pos.y - 4;
        for (const pl of Wd.plats) {
          if (pl.kind === "line" || pl.r < x0 || pl.l > x1 || pl.b < y0 || pl.top > y1) continue;
          if (pl.kind === "block" && !pl.el.classList.contains("btn") && !pl.el.matches(".rail button, .hero-new, .past-list a")) continue;
          bump(pl.el, Math.sign((pl.l + pl.r) / 2 - pos.x) || 1, 0, t);
        }
      };
      // one physics step for a free body: gravity, the window's sides and bottom, and the page's things
      const HW = 12;                                     // half its width, px
      const phys = (bd, dt, t, extra) => {
        const Wd = getWorld(t), hgt = 370 * pos.s, ev = {};
        bd.vy += 2600 * dt;
        let nx = bd.x + bd.vx * dt, ny = bd.y + bd.vy * dt;
        for (const w of Wd.walls) {                      // sides
          if (ny - hgt + 12 >= w.b || ny - 8 <= w.top) continue;
          if (bd.x + HW <= w.l + 1 && nx + HW > w.l) { nx = w.l - HW; ev.wall = { w, side: 1 }; }
          else if (bd.x - HW >= w.r - 1 && nx - HW < w.r) { nx = w.r + HW; ev.wall = { w, side: -1 }; }
        }
        if (ev.wall) { ev.hitV = bd.vx; bump(ev.wall.w.el, ev.wall.side, 0, t); bd.vx = -bd.vx * 0.25; }
        if (bd.vy < 0) for (const w of Wd.walls) {       // undersides
          if (bd.y - hgt >= w.b - 1 && ny - hgt < w.b && nx + HW > w.l && nx - HW < w.r) { ny = w.b + hgt; bd.vy = 80; ev.bonk = w; bump(w.el, 0, -1, t); }
        }
        if (bd.vy > 0) {                                 // tops: the highest one it crosses
          let best = null;
          if (bd.ignore && bd.y > bd.ignore.top + 12) bd.ignore = null;   // dropped through the one it stood on
          for (const pl of extra ? Wd.plats.concat(extra) : Wd.plats) {
            if (bd.ignore && pl.el === bd.ignore.el && Math.abs(pl.top - bd.ignore.top) < 3) continue;
            if (bd.y <= pl.top + 1 && ny >= pl.top && nx >= pl.l - 6 && nx <= pl.r + 6 && (!best || pl.top < best.top)) best = pl;
          }
          if (best) { ny = best.top; ev.land = best; ev.landV = bd.vy; }
        }
        const lo = scrollX + HW + 6, hi = scrollX + innerWidth - HW - 6;
        if (nx < lo) { nx = lo; bd.vx = Math.abs(bd.vx) * 0.5; } else if (nx > hi) { nx = hi; bd.vx = -Math.abs(bd.vx) * 0.5; }
        const floor = scrollY + innerHeight - 8;
        if (!ev.land && ny >= floor) { ny = floor; ev.land = { floor: true, top: floor, l: -1e9, r: 1e9 }; ev.landV = bd.vy; }
        bd.x = nx; bd.y = ny;
        return ev;
      };
      // the thing under its feet now, if any
      const underFeet = (t) => getWorld(t).plats.filter((pl) => Math.abs(pl.top - pos.y) < 6 && pos.x >= pl.l - 6 && pos.x <= pl.r + 6).sort((a, b) => a.top - b.top)[0] || null;
      // Going up, like a climber, never a giant leap. Within reach (about two and a half times its height) it
      // jumps and catches the edge of the next thing above, hangs there a moment and pulls itself up. Higher
      // than that, or nothing to catch, it climbs the window's own frame: runs to the nearer side, climbs it
      // hand over hand, swings across to the bar and goes along under it, one hand then the other, then lets
      // go above where it is headed. The farther it has to go, the faster it climbs.
      const REACH = 245;                                 // feet to a ledge it can still catch, px
      const grabTo = (v, gx, gy, pl, t) => {
        const apex = gy + HANG * S - 2, h = Math.max(16, v.y - apex), vy = Math.sqrt(2 * 2600 * h);
        Object.assign(v, { mode: "grab", g0: t, gt: vy / 2600, gf: { x: v.x, y: v.y }, gp: { x: gx, y: gy, pl } });
        left = gx < v.x;
      };
      const planUp = (v, T, c, t, Wd) => {
        if (!c.hang && v.y - T.y <= REACH && Math.abs(T.x - v.x) < 240) { grabTo(v, T.x, T.y, null, t); return; }
        let best = null, bestS = 1e9;
        if (!c.hang) for (const pl of Wd.plats) {
          const rise = v.y - pl.top;
          if (rise < 26 || rise > REACH || pl.top < T.y - 4) continue;
          const gx = clamp(v.x + Math.sign(T.x - v.x) * 60, pl.l + 8, pl.r - 8);
          if (Math.abs(gx - v.x) > 230) continue;
          const sc = (pl.top - T.y) + Math.abs(gx - T.x) * 0.25;   // as high, and as close to where it is going, as it can
          if (sc < bestS) { bestS = sc; best = { pl, gx }; }
        }
        // a shaft nearby, between two windows or cards, that goes higher than any edge: up it Mario's way
        let shaft = null;
        if (!c.hang) for (const a of Wd.walls) for (const b of Wd.walls) {
          const gap = b.l - a.r, top = Math.max(a.top, b.top), bot = Math.min(a.b, b.b), sx = (a.r + b.l) / 2;
          if (a === b || gap < 28 || gap > 170 || bot - top < 120 || top > v.y - 60 || bot < v.y - REACH || Math.abs(sx - v.x) > 280) continue;
          if (!shaft || top < shaft.top) shaft = { a, b, sx, top, bot };
        }
        if (shaft && (!best || shaft.top < best.pl.top - 40)) { Object.assign(v, { mode: "toShaft", shaft }); return; }
        if (best) {
          let { pl, gx } = best;
          if (pl.kind === "block" && v.x > pl.l - 10 && v.x < pl.r + 10) gx = v.x - pl.l < pl.r - v.x ? pl.l - 4 : pl.r + 4;   // right under it: catch its corner
          grabTo(v, gx, pl.top, pl, t);
        } else Object.assign(v, { mode: "toEdge", side: v.x - scrollX < innerWidth / 2 ? -1 : 1 });
      };
      const startTrav = (t, sup, wait, w0) => {
        trav = { t0: t, mode: sup ? "ground" : "air", sup, x: pos.x, y: pos.y, vx: 0, vy: 0, wait: wait ? t + wait : 0, want0: w0, cp: 0, sp: 0 };
        tr = null;
      };
      const look = { x: 0, y: 0 }, hist = [];
      const spot = $(".spot"), bye = $("#bye");

      // ----- the sections below arrive shut, and it opens each one its own way -----
      // One continuous act down the page: it opens a section, jumps onto its title, carries on to the next.
      // Each opening edge carries the mark's two shadows. Scroll past too fast and a section opens by itself,
      // so you are never left in front of an empty one. (Content is only hidden while this runs: no script,
      // reduced motion or a small screen, and every section is simply there.)
      const PERSP = 1600;                               // the unfolding panel's perspective, px
      const NS = "http://www.w3.org/2000/svg";
      const PLAN = { tracking: "shadow", vrchat: "bubble", safety: "doors", "in-vr": "dive", yours: "unfold",
        more: "curtain", privacy: "shadow", news: "bubble", install: "unfold", faq: "dive" };
      const shut = $$("main > .section").filter((sec) => sec.getBoundingClientRect().top > innerHeight - 40);
      const opening = [];                               // sections finishing by themselves: { sec, t0, from }
      let act = null;                                   // the one it is opening now
      const dims = (sec) => { const w = sec.__w; return { W: sec.clientWidth, H: sec.offsetHeight, wl: w.offsetLeft, wt: w.offsetTop, ww: w.offsetWidth, wh: w.offsetHeight }; };
      // section coordinates to the wrap's own (what clip-path measures from)
      const poly = (Dm, pts) => "polygon(" + pts.map(([x, y]) => `${(x - Dm.wl).toFixed(1)}px ${(y - Dm.wt).toFixed(1)}px`).join(",") + ")";
      const rrect = (l, t, r, b, k) => { k = Math.min(k, (r - l) / 2, (b - t) / 2);
        return `M${l + k} ${t}H${r - k}Q${r} ${t} ${r} ${t + k}V${b - k}Q${r} ${b} ${r - k} ${b}H${l + k}Q${l} ${b} ${l} ${b - k}V${t + k}Q${l} ${t} ${l + k} ${t}Z`; };
      // each opening: p = 0 shut .. 1 open -> the clip of the content and the edge to draw (section coordinates)
      const SHAPE = {
        // its shadow, cast: a ray sweeps round from where it stands like a sundial's; the two echoes trail the ray
        shadow: (Dm, q, o) => {
          const [ox] = o, R = Math.hypot(Dm.W, Dm.H) * 1.2, phi = mix(-4, 182, q), pts = [[ox, 0]];
          for (let a = -4; a < phi; a += 6) pts.push([ox + R * Math.cos(a * D), R * Math.sin(a * D)]);
          pts.push([ox + R * Math.cos(phi * D), R * Math.sin(phi * D)]);
          const ray = (a) => `M${ox} 0L${(ox + R * Math.cos(a * D)).toFixed(1)} ${(R * Math.sin(a * D)).toFixed(1)}`;
          return { clip: poly(Dm, pts), d: q > 0 && q < 1 ? ray(phi) : "", dn: q > 0 && q < 1 ? ray(phi - 3.5) : "", df: q > 0 && q < 1 ? ray(phi - 7) : "" };
        },
        // the content swings down from its top edge like a drawbridge (q may pass 1 a little: the bounce)
        unfold: (Dm, q) => {
          const th = 90 * (1 - q), sn = Math.sin(th * D), f = PERSP / (PERSP + Dm.wh * Math.max(0, sn));
          const yb = Dm.wt + Dm.wh * Math.cos(th * D) * f, hw = (Dm.ww / 2) * f, cx = Dm.wl + Dm.ww / 2;
          return { clip: "none", tf: `perspective(${PERSP}px) rotateX(${(-th).toFixed(2)}deg)`, d: q > 0.02 && q < 0.995 ? `M${cx - hw} ${yb}H${cx + hw}` : "" };
        },
        doors: (Dm, q) => { const cx = Dm.W / 2, h = q * (cx + 30);
          return { clip: poly(Dm, [[cx - h, 0], [cx + h, 0], [cx + h, Dm.H], [cx - h, Dm.H]]), d: `M${cx - h} 0V${Dm.H}M${cx + h} 0V${Dm.H}` }; },
        curtain: (Dm, q) => { const x = q * (Dm.W + 30); return { clip: poly(Dm, [[0, 0], [x, 0], [x, Dm.H], [0, Dm.H]]), d: `M${x} 0V${Dm.H}` }; },
        curtainR: (Dm, q) => { const x = Dm.W - q * (Dm.W + 30); return { clip: poly(Dm, [[x, 0], [Dm.W, 0], [Dm.W, Dm.H], [x, Dm.H]]), d: `M${x} 0V${Dm.H}` }; },
        dive: (Dm, q) => { const cx = Dm.W / 2, R = Math.hypot(cx + 10, Dm.H + 10) * q;
          return { clip: `circle(${R.toFixed(1)}px at ${(cx - Dm.wl).toFixed(1)}px ${(-Dm.wt).toFixed(1)}px)`, d: R > 1 ? `M${cx - R} 0A${R} ${R} 0 0 0 ${cx + R} 0` : "" }; },
        // a chat bubble by its head, "typing", that grows into the whole section
        bubble: (Dm, q, o) => { const [ox, oy] = o, l = mix(ox, -2, q), tp = mix(oy - 42, -2, q), r = mix(ox + 74, Dm.W + 2, q), b = mix(oy, Dm.H + 2, q), k = 20 * (1 - q) + 2;
          const d = rrect(l, tp, r, b, k);
          return { clip: `path("${rrect(l - Dm.wl, tp - Dm.wt, r - Dm.wl, b - Dm.wt, k)}")`, d, dots: [ox + 37, oy - 21, clamp(1 - q * 6, 0, 1)] }; },
      };
      const drawSec = (sec, q) => {
        const Dm = dims(sec), out = SHAPE[sec.__type](Dm, q, sec.__origin), w = sec.__w;
        w.style.clipPath = out.clip;
        if (out.tf) { w.style.transformOrigin = "50% 0"; w.style.transform = out.tf; }
        const [zf, zn, zm, d1, d2, d3] = sec.__z.children;
        zm.style.fillOpacity = out.dots ? out.dots[2] : 0;   // only the small typing bubble is filled
        zf.setAttribute("d", out.df !== undefined ? out.df : out.d); zn.setAttribute("d", out.dn !== undefined ? out.dn : out.d); zm.setAttribute("d", out.d);
        const dots = out.dots || [0, 0, 0], tt = performance.now() / 1000;
        [d1, d2, d3].forEach((c, i) => {
          c.setAttribute("cx", (dots[0] + (i - 1) * 16).toFixed(1));
          c.setAttribute("cy", (dots[1] - 5 * Math.max(0, Math.sin(tt * 10 - i * 0.9))).toFixed(1));
          c.style.opacity = dots[2];
        });
      };
      html.classList.add("acts");                       // sections become positioned: the edges draw in their space
      shut.forEach((sec) => {
        sec.__w = $(".wrap", sec) || sec.firstElementChild;
        sec.__type = PLAN[sec.id] || "doors";
        sec.__origin = sec.__type === "shadow" ? [sec.__w.offsetLeft + 30, 0] : [sec.__w.offsetLeft + 96, -84];   // where it stands
        const z = document.createElementNS(NS, "svg");
        z.setAttribute("class", "edge act-" + sec.__type); z.setAttribute("aria-hidden", "true");
        z.innerHTML = '<path class="zf"/><path class="zn"/><path class="zm"/><circle r="5"/><circle r="5"/><circle r="5"/>';
        sec.appendChild(z); sec.__z = z;
        sec.classList.add("shut");
        drawSec(sec, 0);
      });
      const opens = (sec) => {                         // the section starts opening: its entrances play as it opens
        if (sec.classList.contains("opening")) return;
        sec.classList.add("opening"); sec.__z.classList.add("live");
        (sec.__wait || []).forEach(revealBlock); sec.__wait = null;
      };
      const openDone = (sec) => {
        const i = shut.indexOf(sec);
        if (i < 0) return;
        shut.splice(i, 1);
        sec.classList.remove("shut", "opening");
        sec.__w.style.clipPath = ""; sec.__w.style.transform = ""; sec.__w.style.transformOrigin = "";
        sec.__z.classList.add("gone");
        setTimeout(() => sec.__z.remove(), 800);
        (sec.__wait || []).forEach(revealBlock); sec.__wait = null;
      };
      const autoOpen = (sec, t, from) => { if (!opening.some((o) => o.sec === sec)) { opens(sec); opening.push({ sec, t0: t, from: from || 0 }); } };
      // what it does in each opening: where it starts (feet, section coordinates), and frame by frame
      // (k = 0..1 of its part) where it is, how it stands, and how far the section is open (a.p)
      const PLAY = {
        // it points along its own shadow as the light comes round
        shadow: { at: (a, Dm, sec) => [sec.__origin[0], 0],
          set: (a) => { a.end = 1; a.dur = 1.5; },
          go: (a, Dm, k, q, t, sec) => {
            a.p = ease(k); const phi = mix(-4, 182, a.p), back = phi > 90;
            q.point = clamp(k / 0.1, 0, 1); q.pa = back ? phi - 90 : 90 - phi; q.crouch = 0.15;
            return { x: sec.__origin[0], y: 0, left: back };
          } },
        // hanging from the panel's edge, it rides it down; the panel lands with a little bounce
        unfold: { at: (a, Dm) => [Dm.wl + Dm.ww / 2, HANG * S - 2], hang: true,
          set: (a, Dm) => { a.end = 1; a.dur = 1.35; a.reach = clamp(a.hv - Dm.wt, 150, Dm.wh); },
          go: (a, Dm, k, q, t) => {
            a.p = k < 0.62 ? Math.pow(k / 0.62, 2) : 1 + 0.07 * Math.sin((k - 0.62) / 0.38 * Math.PI * 2) * (1 - (k - 0.62) / 0.38);
            const th = 90 * (1 - a.p), L = a.reach, f = PERSP / (PERSP + L * Math.max(0, Math.sin(th * D)));
            q.hang = 1;
            return { x: Dm.wl + Dm.ww / 2, y: Dm.wt + L * Math.cos(th * D) * f + HANG * S - 2, sway: 10 * Math.sin(t * 8) * (1 - k) };
          } },
        doors: { at: (a, Dm) => [Dm.W / 2, 0],
          set: (a) => { a.end = 1; a.dur = 1.15; },
          go: (a, Dm, k, q, t) => { a.p = Math.pow(ease(clamp((k - 0.12) / 0.88, 0, 1)), 1.2); q.push = clamp(k / 0.12, 0, 1); q.crouch = 0.3 * q.push;
            return { x: Dm.W / 2 + Math.sin(t * 45) * 1.4 * (1 - a.p), y: 0 }; } },
        curtain: { at: () => [24, 0],
          set: (a, Dm) => { a.end = 1; a.dur = clamp(Dm.W / 1000, 0.9, 1.4); },
          go: (a, Dm, k, q) => { a.p = k; const x = clamp(a.p * (Dm.W + 30), 24, Dm.W - 24);
            q.walk = 1; q.phi = (x / (160 * S)) * 2 * Math.PI * 0.5; q.point = 1; q.pa = -50; return { x, y: 0 }; } },
        curtainR: { at: (a, Dm) => [Dm.W - 24, 0], left: true,
          set: (a, Dm) => { a.end = 1; a.dur = clamp(Dm.W / 1000, 0.9, 1.4); },
          go: (a, Dm, k, q) => { a.p = k; const x = clamp(Dm.W - a.p * (Dm.W + 30), 24, Dm.W - 24);
            q.walk = 1; q.phi = ((Dm.W - x) / (160 * S)) * 2 * Math.PI * 0.5; q.point = 1; q.pa = -50; return { x, y: 0, left: true }; } },
        dive: { at: (a, Dm) => [Dm.W / 2, 0],
          set: (a, Dm) => { a.end = Math.hypot(Dm.W / 2, a.hv) / Math.hypot(Dm.W / 2 + 10, Dm.H + 10); a.dur = 1.35; },
          go: (a, Dm, k, q) => {
            const x = Dm.W / 2;
            if (k < 0.42) { const e = ease(k / 0.42); q.air = 1; a.p = 0; return { x, y: -170 * Math.sin(e * Math.PI / 2), rot: 180 * e }; }   // up, turning over
            if (k < 0.55) { const e = (k - 0.42) / 0.13; q.air = 1; a.p = 0; return { x, y: mix(-170, -12, e * e), rot: 180 }; }               // head first, down
            const e = (k - 0.55) / 0.45;                                                                                                       // splash: out and back up
            a.p = a.end * (1 - Math.pow(1 - e, 3)); q.air = clamp((1 - e) / 0.3, 0, 1);
            return { x, y: -12 - 120 * Math.sin(Math.PI * e), rot: 180 + 180 * ease(e) };
          } },
        bubble: { at: (a, Dm, sec) => [sec.__origin[0] - 46, 0],
          set: (a) => { a.end = 1; a.dur = 1.5; },
          go: (a, Dm, k, q, t, sec) => {
            // first it "types" (the three dots in a small bubble), then the bubble grows into the section
            const e = clamp((k - 0.36) / 0.64, 0, 1);
            a.p = e <= 0 ? 0 : 1 - Math.exp(-6 * e) * Math.cos(5 * e) * (1 - e);
            q.wave = k < 0.36 ? 0.55 : clamp(1 - e * 2, 0, 1); q.lx = 0.6; q.ly = -0.3;
            return { x: sec.__origin[0] - 46, y: -5 * Math.abs(Math.sin(t * 9)) * (k < 0.36 ? 1 : 0) };
          } },
      };
      const startAct = (sec, t) => {
        const r = sec.getBoundingClientRect(), Dm = dims(sec), P = PLAY[sec.__type];
        act = { sec, P, t0: t, phase: "go", from: { ...pos }, hv: clamp(innerHeight * 0.96 - r.top, 200, Dm.H), p: 0 };
        sec.__z.classList.add("live");
        P.set(act, Dm);
        act.at = P.at(act, Dm, sec);
        tr = null; trick = null; sit = 0; sleep = 0;
      };
      // insurance: whatever happens to the animation, a section you have scrolled into is never left shut
      setInterval(() => { for (const sec of [...shut]) if (sec.getBoundingClientRect().top < innerHeight * 0.3 && !opening.some((o) => o.sec === sec) && !(act && act.sec === sec)) openDone(sec); }, 1200);
      const atBottom = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 6;
      const nowS = () => performance.now() / 1000;

      // a jump from where it is to anchor `want`; stride 1 = leaving the hero's walk, -1 = joining it again
      const hopTo = (want, T, t, stride) => {
        const from = { ...pos }, fy = from.y - scrollY, vh = innerHeight;
        // from far off screen it comes in from just outside the window instead
        if (fy < -170) from.y = scrollY - 170; else if (fy > vh + 170) from.y = scrollY + vh + 170;
        const dist = Math.hypot(T.x - from.x, T.y - from.y);
        tr = { from, t0: t, dur: clamp(0.42 + dist / 1900, 0.5, 1.15), up: T.y < from.y - 4, hop: clamp(dist * 0.18, 16, 60), stride };
        if (stride > 0) phi = fig.__phi || 0;
        left = T.x < from.x - 30;
        idx = want; idleT = t; trick = null; hang = 0;
      };

      // ----- hands on: a press that moves is a grab, one that doesn't is a poke -----
      addEventListener("pointermove", (e) => {
        ptr = { x: e.clientX, y: e.clientY };
        if (down && e.pointerId === down.id && !down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down.moved = true; startGrab(); }
      }, { passive: true });
      const onDown = (e) => {
        if (e.button !== 0 || !pos) return;
        e.preventDefault();
        ptr = { x: e.clientX, y: e.clientY };
        down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, t0: nowS() };
      };
      [$(".hit", fig), $(".hit", svg)].forEach((h) => h && h.addEventListener("pointerdown", onDown));
      const myHit = $(".hit", svg);
      myHit.addEventListener("pointerenter", () => { hoverT = nowS(); });
      myHit.addEventListener("pointerleave", () => { hoverT = 0; });
      const onUp = (e) => {
        if (!down || e.pointerId !== down.id) return;
        const was = down; down = null;
        if (was.moved) release();
        else if (nowS() - was.t0 > 0.45 && !fin && hang < 0.5) rocket();
        else poke();
      };
      addEventListener("pointerup", onUp);
      addEventListener("pointercancel", onUp);

      function startGrab() {
        if (fin) closeFin(nowS(), true);
        const p = { x: down.x + scrollX, y: down.y + scrollY };
        // it hangs from the point you took it by, and turns around it
        grab = { ox: pos.x - p.x, oy: pos.y - p.y, lx: p.x - (pos.x - (FX - 70) * pos.s), ly: p.y - (pos.y - (GY - 80) * pos.s), vx: 0, dir: 0, shake: 0 };
        if (act) { autoOpen(act.sec, nowS(), act.p); act = null; }
        tr = fly = dazed = trick = trav = null; sit = 0; hang = 0;
        html.classList.add("grabbing");
      }
      function release() {
        html.classList.remove("grabbing");
        if (!grab) return;
        const t = nowS();
        let e = hist[0];
        for (let j = hist.length - 1; j >= 0; j--) { e = hist[j]; if (t - e.t >= 0.07) break; }
        const dt = Math.max(0.016, t - e.t);
        let vx = (pos.x - e.x) / dt, vy = (pos.y - e.y) / dt;
        const sp = Math.hypot(vx, vy), CAP = 3200;
        if (sp > CAP) { vx *= CAP / sp; vy *= CAP / sp; }
        fly = { x: pos.x, y: pos.y, vx, vy, spin: sp > 1400, shake: grab.shake };
        if (fly.spin) rotV = clamp(vx * 0.8, -1000, 1000) || 700;
        grab = null;
      }
      function rocket() {
        const t = nowS();
        tr = null; sit = 0; sleep = 0; idleT = t;
        trick = { t0: t, kind: "rocket", dur: 1.6, top: pos.y - scrollY + 430 * pos.s + 40 };   // high enough to leave the screen
      }
      const burst = (at, t) => { fx = { t0: t, at }; };
      $$(".js-download, .btn-discord, .nav-discord").forEach((b) => {
        b.addEventListener("pointerenter", () => { pointAt = b; });
        b.addEventListener("pointerleave", () => { if (pointAt === b) pointAt = null; });
      });
      $$(".js-download").forEach((b) => b.addEventListener("click", () => {
        const t = nowS();
        if (!grab && !fly && !fin && hang < 0.5) { trick = { t0: t, kind: "cheer", dur: 1.5 }; idleT = t; }
      }));
      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
        typed = (typed + e.key.toLowerCase()).slice(-5);
        if (typed === "ombra" && !grab && !fly && !fin) { typed = ""; const t = nowS(); trick = { t0: t, kind: "dance", dur: 4.4 }; idleT = t; sleep = 0; }
      });
      document.addEventListener("visibilitychange", () => {
        const t = nowS();
        if (document.hidden) hiddenAt = t;
        else if (hiddenAt && t - hiddenAt > 15) { waveUntil = t + 2.4; idleT = t; sleep = 0; }   // welcome back
      });
      function poke() {
        const t = nowS();
        if (hide) { if (hide.phase === "peek") { hide.phase = "in"; hide.t0 = t; hide.wait = 2.2; } return; }   // it ducks
        annoy = annoy.filter((a) => t - a < 4); annoy.push(t);
        if (annoy.length >= 7 && !fin && !act && startHide(t)) { annoy = []; return; }
        if (five > 0.7 && !fin) {          // the hand was up: a high five
          five = 0; hoverT = t + 1.2; idleT = t; burst("hand", t);
          trick = { t0: t, kind: "hop", dur: 0.45 };
          return;
        }
        if (sleep > 0.5) { sleep = 0; idleT = t; trick = { t0: t, kind: "startle", dur: 0.5 }; return; }
        pokes = pokes.filter((p) => t - p < 1.3); pokes.push(t);
        idleT = t;
        if (fin) { if (!trick) trick = { t0: t, kind: "hop", dur: 0.5 }; return; }
        if (tr || fly || dazed || act || (trav && trav.mode !== "ground") || (trick && trick.kind === "flip")) return;
        if (anchors[idx].kind === "mark" && atBottom()) { startFin(t); return; }   // the goodbye, once more
        if (hang > 0.5) { rotV += (left ? -1 : 1) * 260; return; }                 // hanging: a push sets it swinging
        // the third quick poke turns whatever it is doing into a backflip, even mid-hop
        if (pokes.length >= 3) { trick = { t0: t, kind: "flip", dur: 0.95 }; pokes = []; }
        else if (trick) return;
        else { trick = { t0: t, kind: "hop", dur: 0.5 }; waveUntil = t + 1.6; }
      }

      // ----- poked too often: it shakes its head, runs behind the nearest window and sulks there, peeks over
      // the top (ducking again if you come close), and in the end climbs out over the edge -----
      function startHide(t) {
        const vh = innerHeight;
        const covers = $$(".depth, .rel, .ledger, .discord-card").map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => r.height > 150 && r.width > 200 && r.top > 70 && r.top < vh - 160 && !el.closest(".shut"));
        if (!covers.length) return false;
        const sx = pos.x - scrollX, sy = pos.y - scrollY;
        covers.sort((a, b) => Math.hypot(a.r.left + a.r.width / 2 - sx, a.r.top - sy) - Math.hypot(b.r.left + b.r.width / 2 - sx, b.r.top - sy));
        const cv = covers[0];
        const side = Math.abs(cv.r.left - sx) < Math.abs(cv.r.right - sx) ? 0 : 1;
        hide = { el: cv.el, phase: "huff", t0: t, from: null, fx: side ? cv.r.width - 80 : 80 };
        tr = trav = trick = null; sit = 0; sleep = 0;
        return true;
      }

      // ----- the goodbye -----
      function startFin(t) {
        const vh = innerHeight;
        fin = { t0: t, phase: "in", from: { ...pos }, sy: scrollY, shown: false,
          to: { x: scrollX + innerWidth * 0.4, y: scrollY + vh * 0.9, s: clamp((vh * 0.5) / 370, 0.6, 1.4) } };
        sit = 0; trick = null;
        spot.hidden = false; void spot.offsetWidth; spot.classList.add("on");
        svg.classList.add("big");
      }
      function closeFin(t, now) {
        if (!fin || fin.phase === "out") return;
        hideBye();
        spot.classList.remove("on");
        setTimeout(() => { if (!spot.classList.contains("on")) spot.hidden = true; }, 650);
        if (now) { fin = null; finDone = true; svg.classList.remove("big"); return; }
        fin.phase = "out"; fin.t1 = t; fin.back = { ...pos };
      }
      const showBye = () => {
        bye.hidden = false;
        bye.animate([{ opacity: 0, transform: "scale(.5) translateX(-24px)" }, { opacity: 1, transform: "none" }],
          { duration: 560, easing: "cubic-bezier(.3,1.45,.5,1)" });
      };
      const hideBye = () => {
        if (bye.hidden) return;
        bye.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.7)" }], { duration: 200, easing: "ease-in" })
          .onfinish = () => { bye.hidden = true; };
      };
      const placeBye = (hx, hy, s) => {
        const w = bye.offsetWidth, h = bye.offsetHeight, gap = 150 * s;   // clear of the waving hand
        let x = hx + gap, side = false;
        if (x + w > innerWidth - 16) { x = hx - gap - w; side = true; }
        const y = clamp(hy - h * 0.35, 80, innerHeight - h - 16);
        bye.classList.toggle("right-side", side);
        bye.style.left = x.toFixed(1) + "px"; bye.style.top = y.toFixed(1) + "px";
        bye.style.setProperty("--tail", clamp(hy - y - 10, 16, h - 36).toFixed(1) + "px");
      };
      addEventListener("scroll", () => { if (fin && fin.phase === "in" && Math.abs(scrollY - fin.sy) > 40) closeFin(nowS()); }, { passive: true });
      addEventListener("resize", () => { if (fin) closeFin(nowS(), true); });
      document.addEventListener("pointerdown", (e) => { if (fin && fin.phase === "in" && !bye.contains(e.target) && !svg.contains(e.target)) closeFin(nowS()); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && fin) closeFin(nowS()); });
      $(".bye-close", bye).addEventListener("click", () => closeFin(nowS()));

      const step = (now) => {
        requestAnimationFrame(step);
        const t = now / 1000, vh = innerHeight;
        const dt = lastT ? Math.min(0.05, Math.max(0.001, t - lastT)) : 0.016;
        lastT = t;
        const top = (i) => anchors[i].el.getBoundingClientRect().top;
        let want = idx;
        while (want + 1 < anchors.length && top(want + 1) < vh * (anchors[want + 1].at || 0.6)) want++;
        while (want > 0 && top(want) > vh * ((anchors[want].at || 0.6) + 0.18)) want--;
        const c = point(anchors[want]);
        const T = { x: c.x + scrollX, y: c.y + scrollY, s: c.s };
        if (!pos) { pos = { ...T }; idx = want; lastC = c; }
        // Shut sections. The deepest one you have reached is the one it performs for; any above it (passed
        // while scrolling fast) are skipped and simply open, even if it was in the middle of one. While the
        // page is flying past it waits, so it plays where you stop, not where you were.
        let cand = null;
        for (const sec of shut) if (sec.getBoundingClientRect().top < vh * 0.62) cand = sec;   // shut is in page order
        for (const sec of [...shut]) {
          if (sec === cand) break;
          if (sec.getBoundingClientRect().top >= vh * 0.62) continue;
          const o = opening.find((x) => x.sec === sec);
          if (o) opening.splice(opening.indexOf(o), 1);
          opens(sec); openDone(sec);
          if (act && act.sec === sec) { act = null; rot = 0; hang = 0; hopTo(want, T, t, want === 0 ? -1 : 0); }
        }
        if (cand && !(act && act.sec === cand) && !opening.some((o) => o.sec === cand)) {
          const top = cand.getBoundingClientRect().top;
          cand.__since = cand.__since || t;
          if (top < -vh * 0.2 || grab || fly || dazed || fin || hide || t - cand.__since > 1.6) autoOpen(cand, t, 0);
          else if (Math.abs(sv) < 1500 && !act) { trav = null; startAct(cand, t); }
        }
        for (const o of [...opening]) {
          const u = clamp((t - o.t0) / 0.7, 0, 1);
          drawSec(o.sec, mix(o.from, 1, u * u));
          if (u >= 1) { opening.splice(opening.indexOf(o), 1); openDone(o.sec); }
        }
        // back at the top: whatever it was up to further down (sulking, walking, opening a section, dazed
        // off screen), it drops it and comes straight home to walk big in the hero
        if (want === 0 && idx !== 0 && !grab && !fin && !tr) {
          const sy = pos.y - scrollY, off = sy < -80 || sy > vh + 80;
          if (hide || trav || act || (off && (fly || dazed || trick))) {
            if (act) { autoOpen(act.sec, t, act.p); act = null; }
            if (hide) { hide = null; svg.classList.remove("behind"); }
            trav = null; trick = null; rot = 0; hang = 0; sit = 0; sleep = 0;
            if (off) { fly = null; dazed = null; }
            if (!fly && !dazed) hopTo(0, T, t, -1);
          }
        }
        if (!(grab || fly || dazed || fin || act || trav || hide)) {
          // a real jump moves it both on the page and in the window (a sticky rail moves only on the page)
          const jumped = Math.min(Math.hypot(T.x - pos.x, T.y - pos.y), Math.hypot(c.x - lastC.x, c.y - lastC.y)) > 14;
          // also mid-air, when you scroll on to the next thing
          if (want !== idx || (!tr && jumped && !c.walk)) {
            // close by and in sight: it goes there on foot, over what is in between; otherwise one jump
            const sy0 = pos.y - scrollY, d = Math.hypot(T.x - pos.x, T.y - pos.y);
            const onFoot = !tr && idx !== 0 && want !== 0 && d < 1500 && c.y > 50 && c.y < vh - 20 && sy0 > 50 && sy0 < vh + 20;
            if (!onFoot) hopTo(want, T, t, idx === 0 ? 1 : want === 0 ? -1 : 0);
            else if (hang > 0.5) { startTrav(t, null, 0, want); if (c.hang) trav.mode = "shimmy"; }   // from the bar: along it, or let go
            else startTrav(t, underFeet(t), 0, want);
          }
        }
        lastC = c;
        const q = { phi, walk: 0, air: 0, crouch: 0, sit: 0, hang: 0, wave: 0, lx: 0, ly: 0, point: 0, pa, five: 0, cheer: 0, dance: 0, sleep: 0, push: 0, climb: 0, cp: t * 12, shim: 0, sp: 0, t };
        sv += ((scrollY - lastSY) / dt - sv) * 0.15; lastSY = scrollY;   // how fast the page moves, for the swing
        let lift = 0, echo = 1, still = false;   // still: the shadows stand under it (the goodbye), not where it was
        const spring = (target, k = 120, d = 14) => { rotV += ((target - rot) * k - rotV * d) * dt; rot += rotV * dt; };

        if (grab) {
          const nx = (ptr ? ptr.x : down.x) + scrollX + grab.ox, ny = (ptr ? ptr.y : down.y) + scrollY + grab.oy;
          const vx = (nx - pos.x) / dt;
          const dir = Math.abs(vx) > 500 ? Math.sign(vx) : 0;
          if (dir && dir !== grab.dir) { if (grab.dir) grab.shake++; grab.dir = dir; }
          grab.vx += (vx - grab.vx) * 0.25;
          pos.x = nx; pos.y = ny;
          // a pendulum: held above its middle, its feet trail behind your hand
          const below = grab.ly < (GY - 80 - 190) * pos.s ? 1 : -1;
          spring(clamp(grab.vx * 0.03 * below, -55, 55), 60, 5);
          q.air = 1;
          brush(t);
        } else if (fly) {
          // thrown: it flies into the page itself. It lands on whatever top it falls onto (the thing it
          // belongs on included), hits the sides of windows and cards (and grabs on to climb them if it hit
          // softly), bumps its head on their undersides, and anything it brushes past moves out of the way
          const ceil = scrollY + 70 + 380 * pos.s;
          if (fly.y < ceil && fly.vy < 0) { fly.y = ceil; fly.vy = -fly.vy * 0.3; }
          const ev = phys(fly, dt, t, c.y > 0 && c.y < vh ? [{ top: T.y, l: T.x - 30, r: T.x + 30, target: true }] : null);
          pos.x = fly.x; pos.y = fly.y;
          q.air = 1;
          brush(t);
          if (fly.spin) rot += rotV * dt; else spring(clamp(fly.vx * 0.02, -30, 30), 40, 6);
          if (ev.land) {
            const sup = ev.land.target || ev.land.floor ? null : ev.land;
            if (sup) bump(sup.el, 0, 1, t);
            if (ev.landV > 1150 && !ev.land.target) { fly.vy = -ev.landV * 0.34; fly.vx *= 0.6; fly.y -= 1; }    // a bounce
            else if (ev.land.target && !fly.spin) {
              pos.x = T.x; pos.y = T.y; pos.s = T.s; fly = null; idx = want; rot = norm(rot);
              land(anchors[idx]); lastLand = t; idleT = t;
            } else {
              const hard = fly.spin || fly.shake > 3 || ev.landV > 900;
              rot = norm(rot); lastLand = t;
              if (hard) dazed = { t0: t, dur: (fly.spin ? 1.7 : 0.8) + Math.min(1.4, fly.shake * 0.15), sup };
              else startTrav(t, sup, 3.5, want);        // it stays where it landed a while, then walks back
              fly = null;
            }
          } else if (ev.wall && Math.abs(ev.hitV) < 900 && !fly.spin && ev.wall.w.top < fly.y - 70) {
            // a soft hit on a wall: it grabs on and climbs
            startTrav(t, null, 0, want); trav.mode = "climb"; trav.wall = ev.wall; trav.x = fly.x; trav.y = fly.y; fly = null; rot = norm(rot);
          }
        } else if (dazed) {
          const u = t - dazed.t0;
          q.crouch = 0.35 + 0.6 * Math.max(0, Math.exp(-6 * u) * Math.cos(9 * u));
          spring(5 * Math.sin(u * 5), 120, 14);   // it sways a little before it gets its bearings
          if (u > dazed.dur) { const sup = dazed.sup; dazed = null; startTrav(t, sup, 0, want); }
        } else if (hide) {
          const h = hide, r = h.el.getBoundingClientRect(), cx = r.left + scrollX + h.fx, top = r.top + scrollY, u = t - h.t0;
          const behind = top + 140, peekY = top + 300 * S, outY = top;
          q.lx = left ? -0.5 : 0.5;
          if (h.phase === "huff") {                      // a shake of the head first
            q.lx = Math.sin(u * 30) * 0.9; q.crouch = 0.2;
            if (u > 0.55) { h.phase = "flee"; h.t0 = t; h.from = { ...pos }; }
          } else if (h.phase === "flee") {               // off it goes, and down behind the window
            const k = clamp(u / 0.65, 0, 1), ex = ease(k);
            pos.x = mix(h.from.x, cx, ex); pos.y = mix(h.from.y, behind, k * k) - 120 * Math.sin(Math.PI * k); pos.s = mix(h.from.s, S, ex);
            q.air = 1; left = cx < h.from.x;
            svg.classList.toggle("behind", k > 0.55);
            if (k >= 1) { h.phase = "in"; h.t0 = t; h.wait = 2.6; }
          } else if (h.phase === "in") {                 // sulking where nobody can see it
            pos.x = cx; pos.y = behind; q.crouch = 0.5;
            if (u > h.wait) { h.phase = "peek"; h.t0 = t; }
          } else if (h.phase === "peek") {               // just its head over the edge, watching you
            const k = clamp(u / 0.45, 0, 1);
            pos.x = cx; pos.y = mix(behind, peekY, ease(k));
            if (ptr) {
              const hx = ptr.x + scrollX - cx, hy = ptr.y + scrollY - (pos.y - 330 * S), d = Math.hypot(hx, hy) || 1;
              q.lx = hx / d; q.ly = hy / d; left = hx < 0;
              if (d < 170 && k >= 1) { h.phase = "in"; h.t0 = t; h.wait = 1.8; }   // too close: down again
            }
            if (u > 3.2) { h.phase = "out"; h.t0 = t; h.from = { ...pos }; }
          } else {                                       // over the top and out, back to business
            const k = clamp(u / 0.5, 0, 1);
            pos.x = h.from.x; pos.y = mix(h.from.y, outY, ease(k)) - 40 * Math.sin(Math.PI * k);
            q.air = 1 - k; q.climb = 1 - k;
            if (k > 0.5) svg.classList.remove("behind");
            if (k >= 1) { hide = null; startTrav(t, underFeet(t), 0, want); }
          }
        } else if (trav) {
          // on foot: walking along what it stands on, jumping up to things, dropping down onto the next
          // thing below, climbing the sides of windows; whatever it can't sort out in 6 s, one jump fixes
          const v = trav, Wd = getWorld(t), far = c.y < -120 || c.y > vh + 120;
          const arrive = () => { trav = null; pos.x = T.x; pos.y = T.y; pos.s = T.s; idx = want; land(anchors[idx]); lastLand = t; idleT = t; rot = 0; if (c.hang) hang = 1; };
          pos.s = S;
          // left far below the screen by a fast scroll up: it starts its climb just out of sight, not miles down
          if (v.y > scrollY + vh + 90 && v.mode !== "air" && v.mode !== "frame" && T.y < v.y) {
            v.side = v.x - scrollX < innerWidth / 2 ? -1 : 1;
            Object.assign(v, { mode: "frame", x: v.side < 0 ? scrollX + 16 : scrollX + innerWidth - 16, y: scrollY + vh + 60, cp: 0 });
          }
          if (v.mode === "frame" && v.y > scrollY + vh + 60) v.y = scrollY + vh + 60;
          if (far || t - v.t0 > 9) { trav = null; hopTo(want, T, t, want === 0 ? -1 : 0); }
          else if (v.mode === "ground") {
            const sup = v.sup && (v.sup.floor ? { ...v.sup, top: scrollY + vh - 8 } :
              Wd.plats.filter((pl) => pl.el === v.sup.el).sort((a, b) => Math.abs(a.top - v.y) - Math.abs(b.top - v.y))[0]);
            if (!sup || Math.abs(sup.top - v.y) > 40) { v.mode = "air"; v.vx = 0; v.vy = 0; }
            else {
              v.y = sup.top; v.sup = sup;
              const dx = T.x - v.x, dy = T.y - v.y, waiting = t < v.wait && want === v.want0;
              if (waiting) {                             // perched where it landed: it looks around
                q.lx = Math.sin(t * 1.3) * 0.6;
              } else if (Math.abs(dy) < 8 && Math.abs(dx) < 10) arrive();
              else if (Math.abs(dy) < 8) {               // same level: walk there
                const step = Math.sign(dx) * Math.min(Math.abs(dx), 260 * dt);
                v.x += step; left = dx < 0; phi += (Math.abs(step) / (160 * S)) * 2 * Math.PI; q.walk = 1;
                if (v.x < sup.l - 6 || v.x > sup.r + 6) {  // off the end: another top at the same height, or a fall
                  const next = Wd.plats.find((pl) => Math.abs(pl.top - sup.top) < 4 && v.x >= pl.l - 6 && v.x <= pl.r + 6);
                  if (next) v.sup = next; else { v.mode = "air"; v.vx = Math.sign(dx) * 200; v.vy = 0; }
                }
              } else if (dy < 0) planUp(v, T, c, t, Wd);    // up: climbing (see planUp)
              else {                                   // down: a little hop off towards it
                v.vx = clamp(dx * 2.2, -520, 520); v.vy = -330; v.mode = "air"; v.y -= 1; left = dx < 0; v.ignore = { el: sup.el, top: sup.top };
              }
            }
          } else if (v.mode === "air") {
            const ev = phys(v, dt, t, [{ top: T.y, l: T.x - 30, r: T.x + 30, target: true }]);
            if (v.vy > 0) v.vx += (clamp((T.x - v.x) * 3, -420, 420) - v.vx) * Math.min(1, dt * 2.5);   // it steers a little as it falls
            q.air = 1; brush(t);
            if (ev.land) {
              if (ev.land.target) arrive();
              else { v.mode = "ground"; v.sup = ev.land; lastLand = t; if (!ev.land.floor) bump(ev.land.el, 0, 1, t); }
            } else if (ev.wall && ev.wall.w.top < v.y - 70 && T.y < v.y - 20) { v.mode = "climb"; v.wall = ev.wall; }
          } else if (v.mode === "climb") {               // up the side of a window or card, hand over hand
            const w = Wd.walls.find((x) => x.el === v.wall.w.el) || v.wall.w;
            v.x = v.wall.side > 0 ? w.l - HW : w.r + HW; left = v.wall.side < 0;
            // another wall close behind it: Mario's way, kicking from one to the other
            const opp = w.top < v.y - 150 && Wd.walls.find((o) => o.el !== w.el && o.top < v.y - 100 && o.b > v.y - 60 &&
              (v.wall.side > 0 ? o.r <= v.x && v.x - o.r < 170 : o.l >= v.x && o.l - v.x < 170));
            if (opp) { Object.assign(v, { mode: "wallJump", j0: t, jf: { x: v.x, y: v.y }, jw: { w: opp, side: -v.wall.side } }); }
            else {
              const sp = clamp((v.y - w.top) * 2.4, 260, 1300);
              v.y -= sp * dt; v.cp += (sp * dt) / 16; q.climb = 1;
              if (v.y - 330 * S <= w.top) {              // hands over the edge: up and on to it
                v.mode = "mantle"; v.m0 = t; v.mf = { x: v.x, y: v.y }; v.mt = { x: v.wall.side > 0 ? w.l + 22 : w.r - 22, y: w.top, el: w.el }; v.hold = 0;
              }
            }
          } else if (v.mode === "wallJump") {            // a kick across to the other wall, a little higher up
            const k = clamp((t - v.j0) / 0.3, 0, 1), o = v.jw.w, tx = v.jw.side > 0 ? o.l - HW : o.r + HW;
            v.x = mix(v.jf.x, tx, ease(k)); v.y = v.jf.y - 80 * Math.sin(k * Math.PI / 2) - 30 * Math.sin(Math.PI * k);
            q.air = 1; left = v.jw.side < 0; rot = (v.jw.side > 0 ? 1 : -1) * 12 * Math.sin(Math.PI * k); rotV = 0;
            if (k >= 1) { v.mode = "climb"; v.wall = v.jw; rot = 0; }
          } else if (v.mode === "grab") {                // a jump to catch an edge above
            const k = clamp((t - v.g0) / v.gt, 0, 1), top = v.gp.y + HANG * S - 2;
            v.x = mix(v.gf.x, v.gp.x, ease(k)); v.y = v.gf.y - (v.gf.y - top) * (1 - (1 - k) * (1 - k));
            q.air = 1 - k; q.hang = k * k;               // the hands go up as it reaches the edge
            if (k >= 1) {
              const pl = v.gp.pl, mx = !pl ? v.gp.x : v.gp.x < pl.l ? pl.l + 16 : v.gp.x > pl.r ? pl.r - 16 : v.gp.x;
              v.mode = "mantle"; v.m0 = t; v.mf = { x: v.x, y: v.y }; v.mt = { x: mx, y: v.gp.y, el: pl && pl.el, target: !pl }; v.hold = 0.16;
              if (pl) bump(pl.el, 0, 1, t);
            }
          } else if (v.mode === "toShaft") {             // under the shaft, then a jump onto its first wall
            const sh = v.shaft, dx = sh.sx - v.x;
            const step = Math.sign(dx) * Math.min(Math.abs(dx), 380 * dt);
            v.x += step; left = dx < 0; phi += (Math.abs(step) / (160 * S)) * 2 * Math.PI; q.walk = 1;
            if (Math.abs(dx) < 1) Object.assign(v, { mode: "shaftJump", j0: t, jf: { x: v.x, y: v.y }, jy: Math.min(v.y - 10, sh.bot - 10) });
          } else if (v.mode === "shaftJump") {
            const k = clamp((t - v.j0) / 0.3, 0, 1), a = v.shaft.a;
            v.x = mix(v.jf.x, a.r + HW, ease(k)); v.y = mix(v.jf.y, v.jf.y - Math.max(30, v.jf.y - v.jy), 1 - (1 - k) * (1 - k));
            q.air = 1; left = true;
            if (k >= 1) { v.mode = "climb"; v.wall = { w: a, side: -1 }; v.cp = 0; }
          } else if (v.mode === "toEdge") {              // to the nearer side of the window, to climb its frame
            const ex = v.side < 0 ? scrollX + 16 : scrollX + innerWidth - 16, dx = ex - v.x;
            const sup = v.sup && !v.sup.floor && Wd.plats.find((pl) => pl.el === v.sup.el && Math.abs(pl.top - v.y) < 30);
            const step = Math.sign(dx) * Math.min(Math.abs(dx), 420 * dt);
            v.x += step; left = dx < 0; phi += (Math.abs(step) / (160 * S)) * 2 * Math.PI; q.walk = 1;
            if (sup) v.y = sup.top;
            if (Math.abs(dx) < 1) { v.mode = "frame"; v.cp = 0; }
            else if (sup && (v.x < sup.l - 6 || v.x > sup.r + 6)) { v.mode = "air"; v.vx = Math.sign(dx) * 300; v.vy = 0; }
          } else if (v.mode === "frame") {               // up the window's side, faster the farther it has to go
            const br = $(".nav-bg").getBoundingClientRect(), barY = br.bottom + scrollY + HANG * S - 2;
            const sp = clamp((v.y - barY) * 2.2, 420, 1900);
            v.y = Math.max(barY, v.y - sp * dt); v.cp += (sp * dt) / 16; q.climb = 1; left = v.side < 0;
            if (v.y <= barY + 0.5) {                     // up at the bar: a swing across to it
              const bx = v.side < 0 ? br.left + scrollX + 24 : br.right + scrollX - 24;
              Object.assign(v, { mode: "swing", j0: t, jf: { x: v.x, y: v.y }, jx: bx });
            }
          } else if (v.mode === "swing") {
            const k = clamp((t - v.j0) / 0.34, 0, 1);
            v.x = mix(v.jf.x, v.jx, ease(k)); v.y = v.jf.y - 26 * Math.sin(Math.PI * k);
            q.hang = 0.4 + 0.6 * k; q.air = 1 - k;
            if (k >= 1) { v.mode = "shimmy"; v.sp = 0; }
          } else if (v.mode === "shimmy") {              // along under the bar, one hand then the other
            const br = $(".nav-bg").getBoundingClientRect(), lo = br.left + scrollX + 24, hi = br.right + scrollX - 24;
            const gx = clamp(T.x, lo, hi), dx = gx - v.x, sp = clamp(Math.abs(dx) * 2.6, 240, 1400);
            v.y = br.bottom + scrollY + HANG * S - 2;
            v.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); v.sp += (Math.min(Math.abs(dx), sp * dt)) / 9;
            q.hang = 1; q.shim = 1; q.sp = v.sp; left = dx < 0;
            spring(clamp(-dx * 0.04, -10, 10), 40, 4);
            if (Math.abs(dx) < 2) {
              if (c.hang) arrive();
              else { v.mode = "air"; v.vx = 0; v.vy = 0; rot = 0; }   // above it: let go
            }
          } else {                                       // mantle: a moment hanging from the edge, then up and on to it
            const k0 = (t - v.m0 - (v.hold || 0)) / 0.3, k = clamp(k0, 0, 1);
            if (k0 < 0) { q.hang = 1; v.x = v.mf.x; v.y = v.mf.y; }
            else {
              v.x = mix(v.mf.x, v.mt.x, ease(k)); v.y = mix(v.mf.y, v.mt.y, ease(k)) - 24 * Math.sin(Math.PI * k);
              q.hang = 1 - k; q.climb = (1 - k) * 0.5; q.crouch = Math.sin(Math.PI * k) * 0.7;
            }
            if (k >= 1) {
              if (v.mt.target) arrive();
              else { v.mode = "ground"; v.sup = Wd.plats.find((pl) => pl.el === v.mt.el && Math.abs(pl.top - v.mt.y) < 6) || { el: v.mt.el, top: v.mt.y, l: v.mt.x - 40, r: v.mt.x + 40 }; lastLand = t; }
            }
          }
          if (trav) {
            pos.x = v.x; pos.y = v.y; q.cp = v.cp;
            const dl = t - lastLand;
            if (v.mode === "ground") q.crouch = Math.max(q.crouch, Math.max(0, Math.exp(-8 * dl) * Math.cos(10 * dl)) * 0.9);
            if (v.mode !== "shimmy" && v.mode !== "wallJump") spring(0);
          }
        } else if (fin) {
          still = true;
          spring(0);
          if (fin.phase === "in") {
            const u = t - fin.t0, { from, to } = fin;
            if (u < 0.35) {             // it gets ready
              const k = ease(u / 0.35);
              q.crouch = 0.85 * k; echo = 1 - k;
              pos.x = from.x; pos.y = from.y; pos.s = from.s;
            } else if (u < 1.25) {      // and jumps towards you, growing, its shadows tucked under it
              const k = (u - 0.35) / 0.9, ex = ease(k);
              pos.x = mix(from.x, to.x, ex); pos.y = mix(from.y, to.y, ex) - vh * 0.22 * Math.sin(Math.PI * k);
              pos.s = mix(from.s, to.s, ex);
              q.air = clamp(Math.min(k / 0.15, (1 - k) / 0.15), 0, 1); echo = 0;
            } else {                    // lands, the shadows spring out like the logo's, and it waves
              const v = u - 1.25;
              pos.x = to.x; pos.y = to.y; pos.s = to.s;
              q.crouch = Math.max(0, Math.exp(-7 * v) * Math.cos(10 * v)) * 0.9;
              echo = intro(v - 0.1);
              q.wave = clamp((v - 0.3) / 0.35, 0, 1);
              if (v > 0.45 && !fin.shown) { fin.shown = true; showBye(); }
              if (v > 10 && !bye.matches(":hover") && !bye.contains(document.activeElement)) closeFin(t);
            }
          } else {                      // back down onto the m
            const k = clamp((t - fin.t1) / 0.85, 0, 1), ex = ease(k), b = fin.back;
            pos.x = mix(b.x, T.x, ex); pos.y = mix(b.y, T.y, k * k) - 90 * Math.sin(Math.PI * k); pos.s = mix(b.s, T.s, ex);
            q.air = clamp(Math.min(k / 0.12, (1 - k) / 0.12), 0, 1);
            if (k >= 1) { fin = null; finDone = true; svg.classList.remove("big"); idx = want; land(anchors[idx]); lastLand = t; idleT = t; }
          }
          if (trick) {                   // a poke during the goodbye: a little hop
            const u = (t - trick.t0) / trick.dur;
            if (u >= 1) trick = null; else lift = 120 * pos.s * 4 * u * (1 - u);
          }
        } else if (act) {
          const a = act, sec = a.sec, r = sec.getBoundingClientRect(), Lx = r.left + scrollX, Ty = r.top + scrollY, u = t - a.t0, Dm = dims(sec);
          if (a.phase === "go") {        // a jump to where it starts
            const k = clamp(u / 0.55, 0, 1), ex = ease(k);
            pos.x = mix(a.from.x, Lx + a.at[0], ex); pos.y = mix(a.from.y, Ty + a.at[1], ex) - 80 * Math.sin(Math.PI * k); pos.s = mix(a.from.s, S, ex);
            q.air = 1 - ex; if (a.P.hang) q.hang = ex;
            left = !!a.P.left;
            spring(0);
            if (k >= 1) { a.phase = "play"; a.t0 = t; opens(sec); }
          } else {                       // its part
            const k = clamp(u / a.dur, 0, 1), w = a.P.go(a, Dm, k, q, t, sec);
            pos.x = Lx + w.x; pos.y = Ty + w.y; pos.s = S;
            if (w.left !== undefined) left = w.left;
            if (w.rot !== undefined) { rot = w.rot; rotV = 0; } else spring(w.sway || 0, 60, 6);
            drawSec(sec, a.p);
            if (k >= 1) {                // done with its part: the rest opens by itself, and it carries on
              autoOpen(sec, t, a.p);
              act = null; rot = norm(rot); hang = a.P.hang ? 1 : 0;
              hopTo(want, T, t, want === 0 ? -1 : 0);
            }
          }
        } else if (tr) {
          const u = clamp((t - tr.t0) / tr.dur, 0, 1), ex = u * u * (3 - 2 * u);
          pos.x = mix(tr.from.x, T.x, ex);
          pos.y = mix(tr.from.y, T.y, tr.up ? 1 - (1 - u) * (1 - u) : u * u) - tr.hop * Math.sin(Math.PI * u) * (tr.up ? 1 : 0.6);
          pos.s = mix(tr.from.s, T.s, ex);
          q.air = clamp(Math.min(u / 0.15, (1 - u) / 0.12), 0, 1);
          q.walk = tr.stride > 0 ? 1 - ex : tr.stride < 0 ? ex : 0;      // leaving or rejoining the hero's walk
          spring(0);
          if (u >= 1) { land(anchors[idx]); tr = null; lastLand = t; left = false; walk = 0; }
        } else {
          const dx = T.x - pos.x, moving = c.walk && Math.abs(dx) > 0.2;
          if (moving) { phi += (Math.abs(dx) / (160 * S)) * 2 * Math.PI; left = dx < 0; idleT = t; }
          walk += ((moving ? 1 : 0) - walk) * 0.18;
          wave += ((c.wave || t < waveUntil ? 1 : 0) - wave) * 0.08;
          pos.x = T.x; pos.y = T.y; pos.s = T.s;
          // it looks at the pointer when it comes near, and doesn't sit down while you're there
          let lx = 0, ly = 0;
          if (ptr) {
            const hx = ptr.x + scrollX - pos.x, hy = ptr.y + scrollY - (pos.y - 300 * pos.s), d = Math.hypot(hx, hy) || 1;
            const k = clamp(1 - d / 340, 0, 1);
            lx = (hx / d) * k; ly = (hy / d) * k;
            if (k > 0.3) idleT = t;
          }
          look.x += (lx - look.x) * 0.12; look.y += (ly - look.y) * 0.12;
          const kind = anchors[idx].kind, dl = t - lastLand;
          hang += ((c.hang ? 1 : 0) - hang) * (1 - Math.exp(-dt * 9));
          const ledge = (kind === "tab" || kind === "edge" || kind === "title") && !c.hang && !moving && !trick;
          const rest = ledge && t - idleT > 8 && dl > 8;
          sit += ((rest ? 1 : 0) - sit) * (1 - Math.exp(-dt * 2.5));
          // a long while sitting still and it dozes off; woken suddenly, it jumps
          const dozing = rest && t - idleT > 26;
          if (sleep > 0.6 && !dozing && !trick) trick = { t0: t, kind: "startle", dur: 0.5 };
          sleep += ((dozing ? 1 : 0) - sleep) * (1 - Math.exp(-dt * (dozing ? 0.8 : 6)));
          // it points at the button you are about to press
          let pk = 0;
          if (pointAt && !c.hang && !trick && !down) {
            const r = pointAt.getBoundingClientRect();
            if (r.bottom > 0 && r.top < vh) {
              const tx = r.left + r.width / 2 + scrollX - pos.x, ty = r.top + r.height / 2 + scrollY - (pos.y - 250 * pos.s);
              left = tx < 0; pa = Math.atan2(Math.abs(tx), ty) / D; pk = 1; idleT = t;
            }
          }
          pointK += (pk - pointK) * 0.14;
          // hovered a moment without a press: a hand goes up for a high five
          const fiveOn = hoverT && t - hoverT > 0.7 && !down && !c.hang && !trick && !moving && sleep < 0.3;
          five += ((fiveOn ? 1 : 0) - five) * 0.14;
          if (idx === 0) phi = fig.__phi || phi;
          q.phi = phi; q.walk = idx === 0 ? 1 : walk; q.wave = wave * (1 - hang); q.sit = sit * (1 - hang); q.hang = hang;
          q.lx = left ? -look.x : look.x; q.ly = look.y;
          q.crouch = Math.max(0, Math.exp(-8 * dl) * Math.cos(10 * dl)) * 0.9;     // the landing, sprung
          q.point = pointK; q.pa = pa; q.five = five; q.sleep = sleep * (1 - hang);
          // a fast scroll and it braces itself
          if (!c.hang) q.crouch = Math.max(q.crouch, clamp((Math.abs(sv) - 1800) / 3500, 0, 0.5));
          // the button held down on it: it crouches deep and trembles, charging
          if (down && !down.moved && t - down.t0 > 0.2 && hang < 0.5) { q.crouch = Math.max(q.crouch, clamp((t - down.t0 - 0.2) / 0.3, 0, 1)); pos.x += Math.sin(t * 70) * 1.4; }
          if (trick) {
            const u = (t - trick.t0) / trick.dur, k = trick.kind;
            const arc = 4 * u * (1 - u), edges = clamp(Math.min(u / 0.12, (1 - u) / 0.12), 0, 1);
            if (u >= 1) {
              trick = null; lastLand = t; rot = 0; rotV = 0;
              if (k === "rocket") { land(anchors[idx], true); burst("feet", t); }
            } else {
              q.sit = 0; q.sleep = 0; q.walk = k === "dance" && idx === 0 ? 1 : 0;
              if (k === "flip") { lift = 340 * pos.s * arc; rot = (left ? 1 : -1) * 360 * ease(clamp((u - 0.1) / 0.8, 0, 1)); q.crouch = Math.sin(Math.PI * u) * 0.95; }
              else if (k === "rocket") {
                // straight up and out of the window like a superhero, and back down the same way
                const rise = u < 0.5 ? 1 - Math.pow(1 - u * 2, 3) : 1 - Math.pow((u - 0.5) * 2, 2);
                lift = trick.top * Math.max(0, rise); q.cheer = edges; q.air = 1 - edges;
              } else if (k === "cheer") { lift = 90 * pos.s * Math.abs(Math.sin(u * Math.PI * 3)); q.cheer = edges; }
              else if (k === "dance") { lift = 26 * pos.s * Math.abs(Math.sin(t * 8)) * (1 - hang); q.dance = clamp(Math.min(u / 0.06, (1 - u) / 0.06), 0, 1); q.point = 0; q.five = 0; }
              else if (k === "startle") { lift = 120 * pos.s * arc; q.air = edges; }
              else { lift = 170 * pos.s * arc; q.air = edges; }
            }
          } else if (hang > 0.5) spring(clamp(-sv * 0.012, -28, 28), 30, 2.2);   // the page rushing past swings it
          else spring(0);
          if (!finDone && !fin && kind === "mark" && dl > 0.8 && !down && atBottom()) startFin(t);
        }

        // at the hero the hero's own figure is the mark; anywhere else, or in your hands, this one
        const away = idx !== 0 || !!(tr || grab || fly || dazed || fin || trick || act || trav || hide);
        if (away !== shown) { shown = away; svg.style.visibility = away ? "visible" : "hidden"; fig.style.visibility = away ? "hidden" : ""; }
        svg.classList.toggle("lifted", !!(grab || fly || dazed));
        const cy = pos.y - lift;
        hist.push({ t, x: pos.x, y: cy, q }); if (hist.length > 60) hist.shift();
        if (!shown) return;
        const s = pos.s, ox = (FX - 70) * s, oy = (GY - 80) * s, bx = pos.x - ox, by = cy - oy;
        const pivot = grab ? [grab.lx, grab.ly] : hang > 0.5 || q.hang > 0.5 ? [ox, oy - HANG * s] : [ox, oy - 190 * s];
        svg.style.width = svg.style.height = (400 * s).toFixed(1) + "px";
        svg.style.transformOrigin = `${pivot[0].toFixed(1)}px ${pivot[1].toFixed(1)}px`;
        svg.style.transform = `translate(${bx.toFixed(1)}px,${by.toFixed(1)}px)` + (Math.abs(rot) > 0.05 ? ` rotate(${rot.toFixed(2)}deg)` : "");
        let me = null;
        W.forEach((layer, i) => {
          const n = 2 - i;
          if (still) { const P = drawW(layer, wpose(q), -ECHO * n * echo, 0, left); if (!n) me = P; return; }
          const back = t - [0.2, 0.1, 0][i];
          let e = hist[hist.length - 1];
          for (let j = hist.length - 1; j >= 0; j--) { e = hist[j]; if (e.t <= back) break; }
          const P = drawW(layer, wpose(e.q), (e.x - pos.x) / s - ECHO * n, (e.y - cy) / s, left);
          if (!n) me = P;
        });
        const head = me.C;
        // asleep: z's float up from its head, growing and fading
        zz.style.display = q.sleep > 0.05 ? "" : "none";
        if (q.sleep > 0.05) zs.forEach((z, i) => {
          const k = (t * 0.45 + i / 3) % 1;
          z.setAttribute("x", (head[0] + (left ? -1 : 1) * (30 + 50 * k + 8 * Math.sin(k * 9))).toFixed(1));
          z.setAttribute("y", (head[1] - 50 - 130 * k).toFixed(1));
          z.setAttribute("font-size", (34 + 34 * k).toFixed(0));
          z.style.opacity = (Math.sin(Math.PI * k) * q.sleep).toFixed(2);
        });
        // a burst of short lines: the high five's slap, or the dust of a hard landing
        fxg.style.display = fx ? "" : "none";
        if (fx) {
          const u = (t - fx.t0) / 0.42, [cx0, cy0] = fx.at === "hand" ? me.hand : me.feet;
          if (u >= 1) fx = null;
          else rays.forEach((ray, i) => {
            const a = (fx.at === "feet" ? 180 + (i / 6) * 180 : i * (360 / 7) + 10) * D, r1 = 26 + 70 * ease(u), r2 = r1 + 34 * (1 - u);
            ray.setAttribute("d", `M${(cx0 + Math.cos(a) * r1).toFixed(1)} ${(cy0 + Math.sin(a) * r1).toFixed(1)}L${(cx0 + Math.cos(a) * r2).toFixed(1)} ${(cy0 + Math.sin(a) * r2).toFixed(1)}`);
            ray.style.opacity = (1 - u).toFixed(2);
          });
        }
        // dizzy: little stars go round its head
        daze.style.display = dazed ? "" : "none";
        if (dazed) stars.forEach((st, i) => {
          const a = t * 4 + i * 2.09;
          st.setAttribute("transform", `translate(${(head[0] + Math.cos(a) * 58).toFixed(1)} ${(head[1] - 66 + Math.sin(a) * 16).toFixed(1)}) rotate(${(a * 57).toFixed(0)}) scale(${(0.8 + 0.3 * Math.sin(a)).toFixed(2)})`);
        });
        // the goodbye: the spotlight and the bubble follow its head
        if (fin) {
          const hx = bx + (head[0] - 70) * s - scrollX, hy = by + (head[1] - 80) * s - scrollY;
          spot.style.setProperty("--x", hx.toFixed(0) + "px"); spot.style.setProperty("--y", (hy + 90 * s).toFixed(0) + "px");
          spot.style.setProperty("--r1", (240 * s).toFixed(0) + "px"); spot.style.setProperty("--r2", (640 * s).toFixed(0) + "px");
          if (!bye.hidden) placeBye(hx, hy, s);
        }
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- hero: the app itself, running; the stage turns a little towards the pointer ----------
  const stage = $(".hero-stage");
  if (stage && !reduceMotion) {
    const hero = $(".hero"), vid = $("video", stage), still = $("img", stage);
    // the recording in this page's language sits next to its screenshot: home.it.webp -> hero.it.mp4
    const saveData = navigator.connection && navigator.connection.saveData;
    if (vid && still && !saveData && "IntersectionObserver" in window) {
      vid.addEventListener("playing", () => vid.classList.add("on"), { once: true });
      new IntersectionObserver((en) => {
        if (!en[0].isIntersecting) { vid.pause(); return; }
        if (!vid.src) vid.src = still.getAttribute("src").replace(/home((?:\.[a-z]+)?)\.webp.*$/, "hero$1.mp4");
        vid.play().catch(() => { /* autoplay refused: the screenshot stays */ });
      }).observe(stage);
    }
    if (window.matchMedia("(hover: hover) and (min-width: 961px)").matches) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        stage.style.setProperty("--ry", (clamp((e.clientX - r.left) / r.width, 0, 1) - 0.5) * -9 + "deg");
        stage.style.setProperty("--rx", (clamp((e.clientY - r.top) / r.height, 0, 1) - 0.5) * 5 + "deg");
      });
      hero.addEventListener("pointerleave", () => { stage.style.removeProperty("--ry"); stage.style.removeProperty("--rx"); });
    }
  }

  // ---------- the video: plays in the page instead of leaving it ----------
  const theater = $("#theater");
  if (theater && theater.showModal) {
    const film = $("video", theater);
    $$(".js-watch").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      if (!film.src) film.src = a.href;
      theater.showModal();
      film.play().catch(() => { /* the controls are there */ });
    }));
    theater.addEventListener("close", () => film.pause());
    theater.addEventListener("click", (e) => { if (e.target === theater) theater.close(); });   // the backdrop
    $(".theater-close", theater).addEventListener("click", () => theater.close());
  }

  // ---------- tours: rail tabs, the shadow sweep between screenshots (one per chapter) ----------
  // chapter windows get a wrapper so their echoes can be planes behind them (style.css, .depth)
  $$(".tour .window, .solo .window").forEach((w) => {
    const d = document.createElement("div");
    d.className = "depth";
    w.replaceWith(d); d.appendChild(w);
  });
  const lean = !reduceMotion && !(navigator.connection && navigator.connection.saveData);
  $$(".tour").forEach((tour) => {
    const rail = $(".rail", tour);
    const tabs = $$('[role="tab"]', rail);
    const shots = $$(".shots img", tour);
    const bands = $$(".sweep i", tour);
    let cur = 0, busy = null, visible = false;
    // pages that have a recording (img data-clip) play it over their screenshot while the tour is on screen
    let clip = null;
    if (lean && shots.some((im) => im.dataset.clip)) {
      clip = document.createElement("video");
      clip.muted = clip.loop = clip.playsInline = true;
      clip.preload = "none"; clip.tabIndex = -1; clip.setAttribute("aria-hidden", "true");
      clip.addEventListener("playing", () => clip.classList.add("on"));
      $(".shots", tour).appendChild(clip);
    }
    const playClip = () => {
      if (!clip) return;
      const name = shots[cur].dataset.clip;
      clip.pause(); clip.classList.remove("on");
      if (!name || !visible) return;
      // the recording in this page's language sits next to its screenshot: calib.it.webp -> calib.it.mp4
      const url = shots[cur].getAttribute("src").replace(/[a-z0-9-]+((?:\.[a-z]{2})?)\.webp.*$/, name + "$1.mp4");
      if (clip.getAttribute("src") !== url) clip.src = url; else clip.currentTime = 0;
      clip.play().catch(() => { /* autoplay refused: the screenshot stays */ });
    };
    const show = (i) => {
      shots.forEach((img, j) => { img.hidden = j !== i; });
      tabs.forEach((t, j) => {
        const p = document.getElementById(t.getAttribute("aria-controls"));
        p.hidden = j !== i;
        if (j === i) p.classList.add("enter");   // its copy rises in as the shadow passes
      });
      playClip();
    };
    // The tour moves on by itself while it is on screen and nobody is pointing at it or tabbing through it;
    // the first click or key on a tab hands it over for good. The line under the tab (style.css, dwell) is the clock.
    let auto = !reduceMotion && tabs.length > 1 && window.matchMedia("(hover: hover)").matches;
    const hold = () => rail.classList.toggle("hold", !visible || tour.matches(":hover") || tour.contains(document.activeElement));
    const stopAuto = () => { auto = false; rail.classList.remove("auto", "hold"); };
    if (auto) {
      tabs.forEach((t, j) => t.style.setProperty("--dwell", shots[j].dataset.clip ? "10s" : "6s"));
      rail.classList.add("auto", "hold");
      rail.addEventListener("animationend", (e) => { if (auto && e.animationName === "dwell") select((cur + 1) % tabs.length, false, true); });
      ["pointerenter", "pointerleave", "focusin"].forEach((ev) => tour.addEventListener(ev, hold));
      tour.addEventListener("focusout", () => setTimeout(hold));
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (auto) hold(); playClip(); }, { threshold: 0.4 }).observe($(".window", tour));
    } else visible = true;
    const select = (i, focus, byAuto) => {
      if (!byAuto && auto) stopAuto();
      if (i === cur) { if (focus) tabs[i].focus(); return; }
      const dir = i > cur ? 1 : -1;
      tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(j === i)); t.tabIndex = j === i ? 0 : -1; });
      placePill(rail, tabs[i]);
      if (focus) tabs[i].focus();
      // by itself it must never scroll the page: only the rail, when the rail is a strip (narrow windows)
      if (byAuto) { if (rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: tabs[i].offsetLeft - 24, behavior: "smooth" }); }
      else tabs[i].scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
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
  });

  // ---------- nav: a mint mark under the chapter you're reading, its two shadows a step behind ----------
  const links = $$(".nav-links a");
  if (links.length && "IntersectionObserver" in window) {
    const bar = document.createElement("span");
    bar.className = "nav-mark"; bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = "<i></i><i></i><i></i>";
    $(".nav-links").appendChild(bar);
    const ul = $(".nav-links");
    let active = null;
    const mark = (a, instant) => {
      links.forEach((l) => (l === a ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
      bar.classList.toggle("on", !!a);
      if (!a) return;
      const r = a.getBoundingClientRect(), u = ul.getBoundingClientRect();
      if (instant || reduceMotion) bar.querySelectorAll("i").forEach((i) => (i.style.transition = "none"));
      bar.style.setProperty("--x", r.left - u.left + 12 + "px");
      bar.style.setProperty("--w", r.width - 24 + "px");
      $$("i", bar).forEach((i) => { i.style.setProperty("--x", r.left - u.left + 12 + "px"); i.style.setProperty("--w", r.width - 24 + "px"); });
      if (instant || reduceMotion) { void bar.offsetWidth; bar.querySelectorAll("i").forEach((i) => (i.style.transition = "")); }
    };
    const targets = links.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const seen = new Map();
    const pick = () => {
      // the chapter covering the line a third down the screen
      let best = null;
      for (const s of targets) { const r = s.getBoundingClientRect(); if (r.top <= innerHeight / 3 && r.bottom > innerHeight / 3) best = s; }
      const a = best ? links[targets.indexOf(best)] : null;
      if (a !== active) { mark(a, active === null); active = a; }
    };
    const io = new IntersectionObserver((en) => { en.forEach((e) => seen.set(e.target, e.isIntersecting)); pick(); }, { rootMargin: "-30% 0px -60% 0px" });
    targets.forEach((t) => io.observe(t));
    window.addEventListener("resize", () => active && mark(active, true));
  }

  // ---------- language menu: unfolds from its button, rows land, a pill with echoes follows ----------
  const langs = $(".langs");
  if (langs) {
    const sum = $("summary", langs), list = $(".langs-menu", langs);
    const rows = $$("a", list);
    const pill = document.createElement("li");
    pill.className = "langs-pill"; pill.setAttribute("aria-hidden", "true"); pill.innerHTML = "<i></i><i></i><i></i>";
    list.prepend(pill);
    let anim = [], target = null;
    const movePill = (a, instant) => {
      if (!a) return;
      if (instant) list.classList.add("instant");
      pill.style.setProperty("--y", a.parentElement.offsetTop + "px");
      $$("i", pill).forEach((i) => { i.style.setProperty("--y", a.parentElement.offsetTop + "px"); i.style.setProperty("--h", a.offsetHeight + "px"); });
      rows.forEach((r) => r.classList.toggle("on", r === a));
      target = a;
      list.classList.add("has-pill");
      if (instant) { void list.offsetWidth; list.classList.remove("instant"); }
    };
    const current = () => rows.find((r) => r.hasAttribute("aria-current")) || rows[0];
    const stop = () => { anim.forEach((a) => a.cancel()); anim = []; };
    const open = () => {
      stop();
      langs.open = true;
      sum.setAttribute("aria-expanded", "true");
      movePill(current(), true);
      if (reduceMotion || !list.animate) return;
      const ease = "cubic-bezier(.3,1.3,.5,1)";
      // first the panel unrolls from the button, then its two shadows spring out to the left
      const flat = "0 0 0 #2f6b50, 0 0 0 #24443a, 0 24px 48px -12px rgba(0,0,0,.35)";
      anim.push(list.animate([
        { clipPath: "inset(0 -40px 100% -40px round 16px)", transform: "translateY(-6px)", boxShadow: flat, easing: "cubic-bezier(.2,.8,.2,1)" },
        { clipPath: "inset(0 -40px -80px -40px round 16px)", transform: "none", boxShadow: flat, offset: 0.5, easing: "cubic-bezier(.3,1.5,.5,1)" },
        { clipPath: "inset(0 -40px -80px -40px round 16px)", transform: "none", boxShadow: "-6px 0 0 #2f6b50, -12px 0 0 #24443a, 0 24px 48px -12px rgba(0,0,0,.7)" },
      ], { duration: 640, easing: "linear" }));
      rows.forEach((r, i) => {
        anim.push(r.animate([{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }],
          { duration: 420, delay: 90 + i * 28, easing: ease, fill: "backwards" }));
        anim.push($(".flag", r).animate([{ boxShadow: "0 0 0 1px #3a4843, 0 0 0 #2f6b50, 0 0 0 #24443a", transform: "translateX(-4px)" },
          { boxShadow: "0 0 0 1px #3a4843, -3px 0 0 #2f6b50, -6px 0 0 #24443a", transform: "none", offset: 0.6 },
          { boxShadow: "0 0 0 1px #3a4843, 0 0 0 #2f6b50, 0 0 0 #24443a", transform: "none" }],
          { duration: 620, delay: 120 + i * 28, easing: "ease-out", fill: "backwards" }));
      });
    };
    const close = (focusBack) => {
      if (!langs.open) return;
      stop();
      sum.setAttribute("aria-expanded", "false");
      if (focusBack) sum.focus();
      if (reduceMotion || !list.animate) { langs.open = false; return; }
      const a = list.animate([
        { clipPath: "inset(0 0 0% 0 round 16px)", opacity: 1 },
        { clipPath: "inset(0 0 100% 0 round 16px)", opacity: 0.4, transform: "translateY(-4px)" },
      ], { duration: 240, easing: "cubic-bezier(.65,0,.35,1)" });
      anim.push(a);
      a.finished.then(() => { langs.open = false; anim = []; }, () => {});
    };
    sum.setAttribute("aria-expanded", "false");
    sum.addEventListener("click", (e) => { e.preventDefault(); langs.open && sum.getAttribute("aria-expanded") === "true" ? close(false) : open(); });
    list.addEventListener("pointerover", (e) => { const a = e.target.closest("a"); if (a && a !== target) movePill(a); });
    list.addEventListener("pointerleave", () => movePill(current()));
    list.addEventListener("focusin", (e) => { const a = e.target.closest("a"); if (a) movePill(a); });
    list.addEventListener("keydown", (e) => {
      const i = rows.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        rows[(i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length].focus();
      }
    });
    sum.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); if (!langs.open) open(); (rows.find((r) => r.hasAttribute("aria-current")) || rows[0]).focus(); } });
    document.addEventListener("click", (e) => { if (!langs.contains(e.target)) close(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && langs.open) close(true); });
  }

  // ---------- FAQ: answers open and close smoothly; the + turns into a × ----------
  $$(".faq details").forEach((d) => {
    const sum = $("summary", d), ans = $(".answer", d);
    if (!ans || reduceMotion || !ans.animate) return;
    let anim = null;
    sum.addEventListener("click", (e) => {
      e.preventDefault();
      if (anim) anim.cancel();
      const opening = !d.open;
      const from = d.open ? ans.offsetHeight : 0;
      if (opening) d.open = true;
      const to = opening ? ans.scrollHeight : 0;
      anim = ans.animate(
        [{ height: from + "px", opacity: opening ? 0 : 1, transform: opening ? "translateY(-6px)" : "none" },
         { height: to + "px", opacity: opening ? 1 : 0, transform: opening ? "none" : "translateY(-6px)" }],
        { duration: opening ? 420 : 300, easing: "cubic-bezier(.2,.8,.2,1)" });
      const mine = anim;
      mine.finished.then(() => { if (anim !== mine) return; if (!opening) d.open = false; anim = null; }, () => {});
    });
  });

  // ---------- the trails: what Ombra sees of you, behind the whole page ----------
  // A body nobody sees walks back and forth across the page as you scroll down, like someone in a motion
  // capture room, turning at each side and coming down a row. Only its trackers show, as in a long
  // exposure: hip, chest, knees, ankles and elbows leave mint trails, the headset a cream one, so the feet
  // draw their arches, the hip its sway and the elbows their swing. Each trail ends in a small tracker with
  // its light blinking; further back it fades through the mark's two echo colours. The walk is the mark's
  // own (pose). Without script the page keeps its plain lines.
  (() => {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext && cv.getContext("2d");
    const hero = $(".hero");
    if (!ctx || !hero) return;
    cv.className = "trails"; cv.setAttribute("aria-hidden", "true");
    document.body.prepend(cv);
    html.classList.add("ribbon-on");
    const css = getComputedStyle(html), tok = (n, f) => (css.getPropertyValue(n).trim() || f);
    const MINT = tok("--mint", "#6bf0a2"), NEAR = tok("--echo-near", "#2f6b50"), FAR = tok("--echo-far", "#24443a");
    const CREAM = tok("--cream", "#f2ece1"), TILE = tok("--tile", "#18201e");
    // where each tracker sits on the mark's body; side 1 = the far side, drawn dimmer
    const chest = (P) => [P.H[0] + 70 * Math.sin(12.6 * D), P.H[1] - 70 * Math.cos(12.6 * D)];
    const TRACKERS = [
      { at: (P) => P.H, side: 0 }, { at: chest, side: 0 },
      { at: (P) => P.legs[0][0], side: 0 }, { at: (P) => P.legs[1][0], side: 1 },   // knees
      { at: (P) => P.legs[0][1], side: 0 }, { at: (P) => P.legs[1][1], side: 1 },   // ankles
      { at: (P) => P.arms[0][0], side: 1 }, { at: (P) => P.arms[1][0], side: 0 },   // elbows
      { at: (P) => P.C, side: 0, head: true },                                       // the headset
    ];
    let W = 0, H = 0, dpr = 1, raf = 0, now = -1;
    // the room: rows across the window, joined by a turn at each side
    let G = null;
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = W < 700 ? 0.3 : 0.52;                 // mark units -> px
      const R = clamp(H * 0.3, 170, 300);             // half the drop from one row to the next
      const m = clamp(W * 0.1, 40, 170), rx = Math.min(m * 0.8, R);
      const row = W - 2 * m, turn = (Math.PI * (rx + R)) / 2;
      const r = hero.getBoundingClientRect();
      G = { k, R, m, rx, row, turn, seg: row + turn, y0: r.bottom + window.scrollY + 60 * k, step: 600 * k };   // 600: the planted foot slides back 600 units a stride, so it stays put
    };
    // where the hip is after walking u px, and which way the body faces (1 right, -1 left, between: turning)
    const path = (u) => {
      const i = Math.floor(u / G.seg), v = u - i * G.seg, dir = i % 2 ? -1 : 1, y = G.y0 + i * 2 * G.R;
      if (v < G.row) return [dir > 0 ? G.m + v : W - G.m - v, y, dir];
      const a = (Math.PI * (v - G.row)) / G.turn, edge = dir > 0 ? W - G.m : G.m;
      return [edge + dir * G.rx * Math.sin(a), y + G.R * (1 - Math.cos(a)), dir * Math.cos(a)];
    };
    // how far it has walked when the window is at scroll y: one row and its turn per drop
    const walked = (sy) => Math.max(0, ((sy + H * 0.62 - G.y0) / (2 * G.R)) * G.seg);
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      if (now <= 0) return;
      const sy = window.scrollY, lead = clamp(now / 260, 0, 1), sample = 6;
      const from = Math.max(0, now - 2.2 * G.seg);
      const pts = TRACKERS.map(() => []);
      for (let u = from; u <= now + 0.01; u += sample) {
        const [x, y, dir] = path(u), P = pose(Math.PI / 2 + (2 * Math.PI * u) / G.step);
        TRACKERS.forEach((tr, j) => { const p = tr.at(P); pts[j].push([x + dir * (p[0] - P.H[0]) * G.k, y + (p[1] - P.H[1]) * G.k - sy]); });
      }
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      TRACKERS.forEach((tr, j) => {
        const P = pts[j], n = P.length;
        // the whole tail in the far echo, the newer part in the near one, the freshest in mint or cream
        [[FAR, 1, 2.2, 0.75], [NEAR, 0.45, 1.8, 0.8], [tr.head ? CREAM : MINT, 0.14, 1.4, tr.head ? 0.5 : 0.85]].forEach(([col, keep, wdt, a]) => {
          const start = Math.max(0, n - 1 - Math.round((keep * 2.2 * G.seg) / sample));
          ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.globalAlpha = lead * a * (tr.side ? 0.5 : 1);
          ctx.beginPath();
          for (let i = start; i < n; i++) (i === start ? ctx.moveTo : ctx.lineTo).call(ctx, P[i][0], P[i][1]);
          ctx.stroke();
        });
      });
      // the trackers themselves at the fresh end: a small puck with its light blinking
      const on = Math.sin(t / 330) > -0.3;
      TRACKERS.forEach((tr, j) => {
        const [x, y] = pts[j][pts[j].length - 1], w = tr.head ? 26 : 15, h = tr.head ? 13 : 10;
        ctx.globalAlpha = lead * (tr.side ? 0.55 : 1);
        ctx.fillStyle = TILE; ctx.strokeStyle = tr.head ? CREAM : MINT; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, 4); else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fill(); ctx.stroke();
        if (!tr.head) { ctx.globalAlpha *= on ? 1 : 0.25; ctx.fillStyle = MINT; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
    };
    const loop = (t) => {
      raf = 0;
      const w = walked(window.scrollY);
      now = now < 0 ? w : now + (w - now) * 0.1;      // it catches up with your scroll, at a walk
      draw(t);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    size();
    if (reduceMotion) {
      const still = () => { now = walked(window.scrollY); draw(0); };
      still();
      window.addEventListener("scroll", still, { passive: true });
      window.addEventListener("resize", () => { size(); still(); });
    } else {
      window.addEventListener("resize", size);
      document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) raf = requestAnimationFrame(loop); });
      raf = requestAnimationFrame(loop);
    }
  })();
})();
