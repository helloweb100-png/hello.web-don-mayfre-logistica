/* ==========================================================================
   DON MAYFREN LOGÍSTICA (DML) · Interacciones y animaciones
   Vanilla JS, sin dependencias. Un solo bucle de animación (rAF) lee el scroll
   y mueve todo lo que depende de él, con inercia (damping) para que se sienta
   suave sin secuestrar el scroll nativo.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     CONFIGURACIÓN DEL CLIENTE  (lo único que hay que editar para publicar)
     ------------------------------------------------------------------------ */
  const CONFIG = {
    // TODO: número de WhatsApp del cliente, formato internacional SIN "+" ni espacios
    whatsapp: '520000000000',
    whatsappDisplay: '+52 000 000 0000',
    saludo: 'Hola, vengo de la página web de Don Mayfren Logística.',

    // TODO: reemplazar por los destinos reales cuando el cliente los envíe.
    // lon/lat en grados. "group": puertos | industrial | frontera
    hubs: [
      { id: 'manzanillo',  name: 'Manzanillo',       group: 'puertos',    lon: -104.32, lat: 19.05, info: 'Puerto del Pacífico para contenedores, con salida hacia el occidente y el centro del país.' },
      { id: 'lazaro',      name: 'Lázaro Cárdenas',  group: 'puertos',    lon: -102.17, lat: 17.96, info: 'Puerto del Pacífico con acceso directo al centro del país.' },
      { id: 'veracruz',    name: 'Veracruz',         group: 'puertos',    lon:  -96.13, lat: 19.19, info: 'Puerto del Golfo con ruta hacia el altiplano y el centro de México.' },
      { id: 'altamira',    name: 'Altamira',         group: 'puertos',    lon:  -97.90, lat: 22.40, info: 'Puerto del Golfo con conexión hacia el noreste industrial.' },
      { id: 'cdmx',        name: 'Ciudad de México', group: 'industrial', lon:  -99.13, lat: 19.43, info: 'Gran centro de consumo y distribución del país.' },
      { id: 'guadalajara', name: 'Guadalajara',      group: 'industrial', lon: -103.35, lat: 20.67, info: 'Polo industrial y de distribución del occidente.' },
      { id: 'queretaro',   name: 'Querétaro',        group: 'industrial', lon: -100.39, lat: 20.59, info: 'Corazón del Bajío industrial, punto de paso entre norte y centro.' },
      { id: 'monterrey',   name: 'Monterrey',        group: 'industrial', lon: -100.31, lat: 25.67, info: 'Capital industrial del norte y puerta hacia la frontera.' },
      { id: 'laredo',      name: 'Nuevo Laredo',     group: 'frontera',   lon:  -99.51, lat: 27.48, info: 'Cruce fronterizo clave para el comercio con Estados Unidos.' }
    ],
    rutas: [
      ['manzanillo', 'guadalajara'], ['manzanillo', 'cdmx'], ['lazaro', 'cdmx'], ['veracruz', 'cdmx'],
      ['cdmx', 'queretaro'], ['guadalajara', 'queretaro'], ['queretaro', 'monterrey'],
      ['altamira', 'monterrey'], ['monterrey', 'laredo'], ['queretaro', 'laredo']
    ]
  };

  const GROUPS = {
    puertos:    { label: 'Puertos',              icon: 'i-anchor' },
    industrial: { label: 'Centros industriales', icon: 'i-factory' },
    frontera:   { label: 'Frontera',             icon: 'i-map-pin' }
  };

  /* ------------------------------------------------------------------------
     UTILIDADES
     ------------------------------------------------------------------------ */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  const S = { y: 0, dy: 0, vh: innerHeight, vw: innerWidth, dt: 0.016, t: 0 };
  const tasks = [];      // se ejecutan en cada frame
  const measures = [];   // se ejecutan al cambiar el tamaño del documento
  let measured = false;

  const docTop = el => el.getBoundingClientRect().top + window.scrollY;

  function runMeasure() {
    S.vh = innerHeight; S.vw = innerWidth;
    measures.forEach(fn => fn());
    measured = true;
  }
  let measureTimer = 0;
  const scheduleMeasure = () => { clearTimeout(measureTimer); measureTimer = setTimeout(runMeasure, 120); };

  function frame(now) {
    const y = window.scrollY;
    S.dt = Math.min(0.05, (now - (frame.last || now)) / 1000) || 0.016;
    frame.last = now;
    S.dy = y - S.y; S.y = y; S.t = now / 1000;
    if (measured) for (let i = 0; i < tasks.length; i++) tasks[i](S);
    requestAnimationFrame(frame);
  }

  /* Observa visibilidad y devuelve un objeto { on } siempre actualizado */
  function watchVisible(el, margin = '120px') {
    const state = { on: false };
    if (!el) return state;
    new IntersectionObserver(es => { state.on = es[0].isIntersecting; }, { rootMargin: `${margin} 0px` }).observe(el);
    return state;
  }

  /* ------------------------------------------------------------------------
     DIVISIÓN DE TEXTO EN PALABRAS
     ------------------------------------------------------------------------ */
  function splitText(rootEl, wrap) {
    const words = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const el = wrap(part, words.length);
            words.push(el.inner || el.outer);
            frag.appendChild(el.outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(rootEl);
    return words;
  }

  /* ------------------------------------------------------------------------
     1. LOADER
     ------------------------------------------------------------------------ */
  function initLoader() {
    const loader = $('#loader');
    if (!loader || !root.classList.contains('js')) { revealPage(); return; }

    const num = $('#ld-num');
    const MIN = reduced ? 500 : 2700;
    const start = performance.now();
    let loaded = false, shown = 0, finished = false;

    root.classList.add('is-locked');
    const done = () => { loaded = true; };
    if (document.readyState === 'complete') done(); else addEventListener('load', done, { once: true });
    setTimeout(done, 7000); // tope por si un recurso tarda demasiado

    (function tick() {
      const t = performance.now() - start;
      const target = loaded ? 100 : Math.min(90, (t / MIN) * 90);
      shown += (Math.min(target, (t / MIN) * 100) - shown) * 0.1;
      if (loaded && t >= MIN && shown > 99.4) shown = 100;
      loader.style.setProperty('--lp', shown.toFixed(1));
      loader.querySelector('.ld-ring').style.setProperty('--lp', shown.toFixed(1));
      num.textContent = Math.round(shown);
      if (shown >= 100 && !finished) { finished = true; closeLoader(); return; }
      requestAnimationFrame(tick);
    })();

    function closeLoader() {
      loader.classList.add('is-done');
      setTimeout(revealPage, reduced ? 0 : 450);
      setTimeout(() => {
        loader.remove();
        root.classList.remove('is-locked');
      }, reduced ? 50 : 1250);
    }
  }

  function revealPage() {
    document.body.classList.add('is-ready');
    startRotator();
    setTimeout(() => $('.wa-float')?.classList.add('is-in'), 1400);
    setTimeout(() => $('.wa-float')?.classList.add('show-tip'), 5200);
    setTimeout(() => $('.wa-float')?.classList.remove('show-tip'), 10500);
  }

  /* ------------------------------------------------------------------------
     2. NAVEGACIÓN, MENÚ, PROGRESO
     ------------------------------------------------------------------------ */
  function initNav() {
    const nav = $('#nav');
    const burger = $('#burger');
    const menu = $('#menu');
    const bar = $('.progress i');
    const themed = $$('[data-nav]').filter(el => el !== root);
    const linkMap = $$('.nav-links a').map(a => ({ a, id: a.getAttribute('href').slice(1) }));
    let zones = [], secs = [], docH = 1, current = '', theme = '';

    measures.push(() => {
      zones = themed.map(el => ({ top: docTop(el), bottom: docTop(el) + el.offsetHeight, theme: el.dataset.nav }));
      secs = linkMap.map(l => { const el = document.getElementById(l.id); return { a: l.a, top: el ? docTop(el) : 1e9 }; });
      const contact = document.getElementById('contacto');
      if (contact) secs.push({ a: null, top: docTop(contact) }); // al llegar al contacto no se resalta ningún enlace
      docH = document.documentElement.scrollHeight - S.vh;
    });

    tasks.push(s => {
      const probe = s.y + 40;
      const z = zones.find(z => probe >= z.top && probe < z.bottom);
      if (z && z.theme !== theme) { theme = z.theme; root.dataset.nav = theme; }

      let cur = '';
      for (const sec of secs) if (s.y + s.vh * 0.4 >= sec.top) cur = sec.a ? sec.a.getAttribute('href') : '';
      if (cur !== current) {
        current = cur;
        secs.forEach(sec => { if (sec.a) sec.a.classList.toggle('is-current', sec.a.getAttribute('href') === cur); });
      }
      nav.classList.toggle('is-compact', s.y > 40);
      bar.style.setProperty('--sp', clamp(s.y / docH).toFixed(4));
    });

    // Menú móvil
    const links = $$('.menu-nav a', menu);
    links.forEach((a, i) => a.style.setProperty('--mi', i));
    menu.inert = true;
    const setMenu = open => {
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      menu.inert = !open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      nav.classList.toggle('menu-open', open);
      root.classList.toggle('is-locked', open);
    };
    burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); burger.focus(); } });
    matchMedia('(min-width:1060px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* ------------------------------------------------------------------------
     3. REVELACIONES AL HACER SCROLL
     ------------------------------------------------------------------------ */
  function initReveals() {
    $$('[data-split]').forEach(el => {
      splitText(el, (word, i) => {
        const outer = document.createElement('span'); outer.className = 'w';
        const inner = document.createElement('span'); inner.textContent = word;
        inner.style.setProperty('--wi', i);
        outer.appendChild(inner);
        return { outer, inner };
      });
    });
    const targets = $$('[data-reveal],[data-split]');
    if (!('IntersectionObserver' in window) || reduced) { targets.forEach(t => t.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(t => io.observe(t));
  }

  /* ------------------------------------------------------------------------
     4. HERO: palabra rotativa, paralaje y rayas de velocidad
     ------------------------------------------------------------------------ */
  let rotatorStarted = false;
  function startRotator() {
    if (rotatorStarted) return;
    rotatorStarted = true;
    const items = $$('.rot-item');
    if (items.length < 2 || reduced) return;
    const hero = $('.hero');
    const vis = watchVisible(hero, '0px');
    let i = 0;
    setInterval(() => {
      if (!vis.on || document.hidden) return;
      const out = items[i];
      i = (i + 1) % items.length;
      const inn = items[i];
      out.classList.remove('is-on'); out.classList.add('is-out');
      inn.classList.remove('is-out'); inn.classList.add('is-on');
      setTimeout(() => out.classList.remove('is-out'), 1000);
    }, 3000);
  }

  function initHero() {
    const hero = $('.hero');
    const media = $('.hero-media');
    const inner = $('.hero-inner');
    const canvas = $('.hero-fx');
    if (!hero) return;
    const vis = watchVisible(hero, '0px');

    // Paralaje con el scroll
    tasks.push(s => {
      if (!vis.on) return;
      const y = s.y;
      media.style.transform = `translate3d(0,${(y * 0.28).toFixed(1)}px,0)`;
      inner.style.transform = `translate3d(0,${(y * 0.1).toFixed(1)}px,0)`;
      inner.style.opacity = clamp(1 - y / (s.vh * 0.85)).toFixed(3);
    });

    if (!canvas || reduced) return;
    const ctx = canvas.getContext('2d');
    const COLORS = ['225,184,69', '248,231,166', '143,178,230', '255,255,255'];
    let w = 0, h = 0, streaks = [], dust = [];
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const make = initial => {
      const depth = Math.random();
      return {
        x: initial ? Math.random() * w : -Math.random() * 320,
        y: Math.random() * h,
        len: 70 + depth * 280,
        v: 220 + depth * 980,
        th: 0.6 + depth * 1.7,
        a: 0.12 + depth * 0.5,
        c: COLORS[Math.random() < 0.55 ? 0 : (Math.random() * COLORS.length) | 0],
        depth
      };
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 1.75);
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const small = w < 700;
      streaks = Array.from({ length: small ? 24 : 58 }, () => make(true));
      dust = Array.from({ length: small ? 28 : 70 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3, v: 8 + Math.random() * 26, a: 0.15 + Math.random() * 0.45 }));
    };
    measures.push(resize);
    if (finePointer) hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width - 0.5;
      mouse.ty = (e.clientY - r.top) / r.height - 0.5;
    });

    tasks.push(s => {
      if (!vis.on || !w) return;
      const boost = 1 + clamp(Math.abs(s.dy) * 0.06, 0, 3.5);
      mouse.x = lerp(mouse.x, mouse.tx, 0.06); mouse.y = lerp(mouse.y, mouse.ty, 0.06);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (const k of streaks) {
        k.x += k.v * s.dt * boost;
        if (k.x - k.len > w) Object.assign(k, make(false), { y: Math.random() * h });
        const ox = mouse.x * k.depth * 26, oy = mouse.y * k.depth * 14;
        const x1 = k.x + ox, x0 = x1 - k.len, y = k.y + oy;
        const g = ctx.createLinearGradient(x0, y, x1, y);
        g.addColorStop(0, `rgba(${k.c},0)`);
        g.addColorStop(1, `rgba(${k.c},${k.a})`);
        ctx.strokeStyle = g; ctx.lineWidth = k.th;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      }
      for (const p of dust) {
        p.x += p.v * s.dt; if (p.x > w + 4) { p.x = -4; p.y = Math.random() * h; }
        ctx.fillStyle = `rgba(248,231,166,${p.a})`;
        ctx.fillRect(p.x + mouse.x * 18, p.y + mouse.y * 10, p.r, p.r);
      }
    });
  }

  /* ------------------------------------------------------------------------
     5. CINTA DE RUMBO (velocidad ligada al scroll, invierte al subir)
     ------------------------------------------------------------------------ */
  function initTicker() {
    const track = $('.ticker-track');
    const set = $('.ticker-set');
    if (!track || !set || reduced) return;
    const vis = watchVisible($('.ticker'), '0px');
    let setW = 0, x = 0, dir = 1;
    measures.push(() => {
      $$('.ticker-set + .ticker-set', track).forEach(n => n.remove());
      setW = set.getBoundingClientRect().width;
      const copies = Math.ceil((S.vw * 2) / setW) + 1;
      for (let i = 0; i < copies; i++) track.appendChild(set.cloneNode(true));
    });
    tasks.push(s => {
      if (!vis.on || !setW) return;
      if (s.dy > 0.5) dir = lerp(dir, 1, 0.12); else if (s.dy < -0.5) dir = lerp(dir, -1, 0.12);
      const speed = 70 + Math.min(Math.abs(s.dy) * 22, 1100);
      x -= dir * speed * s.dt;
      if (x <= -setW) x += setW; else if (x > 0) x -= setW;
      track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    });
  }

  /* ------------------------------------------------------------------------
     6. MANIFIESTO (las palabras se iluminan con el scroll)
     ------------------------------------------------------------------------ */
  function initManifesto() {
    const sec = $('.manifesto');
    const text = $('#manifesto-text');
    if (!sec || !text) return;
    const words = splitText(text, word => {
      const el = document.createElement('span'); el.className = 'mw'; el.textContent = word;
      return { outer: el };
    });
    if (reduced) return;
    let top = 0, h = 1, cur = 0;
    const last = new Array(words.length).fill(-1);
    measures.push(() => { top = docTop(sec); h = sec.offsetHeight; });
    tasks.push(s => {
      const raw = (s.y - top) / (h - s.vh);
      if (raw < -0.15 || raw > 1.15) return;
      cur = damp(cur, clamp(raw), 7, s.dt);
      const q = clamp((cur - 0.05) / 0.72) * (words.length + 1.5);
      for (let i = 0; i < words.length; i++) {
        const o = 0.14 + 0.86 * clamp(q - i);
        if (Math.abs(o - last[i]) > 0.01) { words[i].style.opacity = o.toFixed(2); last[i] = o; }
      }
    });
  }

  /* ------------------------------------------------------------------------
     7. IMAGEN QUE SE ABRE
     ------------------------------------------------------------------------ */
  function initExpand() {
    const sec = $('.expand');
    const sticky = $('.expand-sticky');
    if (!sec || !sticky || reduced) return;
    let top = 0, h = 1, ep = 0, co = 0;
    sticky.style.setProperty('--ep', 0);
    sticky.style.setProperty('--co', 0);
    measures.push(() => { top = docTop(sec); h = sec.offsetHeight; });
    tasks.push(s => {
      const raw = (s.y - top) / (h - s.vh);
      if (raw < -0.2 || raw > 1.2) return;
      const p = clamp(raw);
      ep = damp(ep, easeOut(clamp(p / 0.55)), 9, s.dt);
      co = damp(co, clamp((p - 0.58) / 0.2), 9, s.dt);
      sticky.style.setProperty('--ep', ep.toFixed(4));
      sticky.style.setProperty('--co', co.toFixed(4));
    });
  }

  /* ------------------------------------------------------------------------
     8. TARJETAS QUE SE APILAN
     ------------------------------------------------------------------------ */
  function initStack() {
    const cards = $$('[data-stack]');
    const wrap = $('.stack');
    if (cards.length < 2 || !wrap || reduced) return;
    const vis = watchVisible(wrap, '200px');
    let stick = [];
    measures.push(() => { stick = cards.map(c => parseFloat(getComputedStyle(c).top) || 0); });
    tasks.push(s => {
      if (!vis.on) return;
      for (let i = 0; i < cards.length - 1; i++) {
        const r = cards[i + 1].getBoundingClientRect();
        const p = clamp((s.vh - r.top) / (s.vh - stick[i + 1]));
        cards[i].style.transform = `scale(${(1 - 0.055 * p).toFixed(4)})`;
        cards[i].style.setProperty('--dim', (0.55 * p).toFixed(3));
      }
    });
  }

  /* ------------------------------------------------------------------------
     9. MAPA DE CORREDORES (matriz de puntos de México)
     ------------------------------------------------------------------------ */
  const MX_MAIN = [[-114.8,31.8],[-114.81,32.49],[-111.07,31.33],[-109.05,31.33],[-108.2,31.78],[-106.53,31.78],[-105.1,30.7],[-104.5,29.6],[-103.15,29.0],[-102.6,29.75],[-101.4,29.77],[-100.65,29.1],[-100.35,28.2],[-99.5,27.5],[-99.1,26.4],[-98.2,26.06],[-97.15,25.96],[-97.6,24.4],[-97.8,22.9],[-97.75,22.1],[-97.75,21.55],[-97.3,20.95],[-96.8,20.2],[-96.2,19.4],[-96.1,19.15],[-95.8,18.8],[-95.1,18.4],[-94.4,18.15],[-93.8,18.4],[-92.65,18.55],[-91.8,18.65],[-90.8,19.3],[-90.5,19.9],[-90.4,20.9],[-89.7,21.3],[-88.1,21.6],[-87.05,21.6],[-86.8,21.1],[-87.45,20.2],[-87.8,19.0],[-87.7,18.3],[-88.3,18.5],[-89.15,17.95],[-89.15,17.82],[-90.98,17.82],[-91.43,17.25],[-90.65,16.5],[-90.45,16.07],[-91.7,16.07],[-92.2,15.25],[-92.15,14.55],[-93.1,15.5],[-94.3,16.1],[-95.2,16.15],[-96.5,15.7],[-97.8,15.95],[-98.8,16.6],[-99.9,16.85],[-101.0,17.45],[-102.2,17.95],[-103.5,18.3],[-104.3,19.05],[-105.0,19.9],[-105.55,20.65],[-105.4,21.5],[-105.75,22.4],[-106.4,23.2],[-107.5,24.5],[-108.3,25.3],[-109.1,25.65],[-109.9,26.4],[-110.5,27.2],[-110.95,27.9],[-111.9,28.8],[-112.5,29.7],[-112.85,30.5],[-113.3,31.2]];
  const MX_BAJA = [[-117.12,32.53],[-116.1,32.6],[-114.72,32.72],[-114.8,31.8],[-114.7,31.0],[-114.2,30.1],[-113.2,29.2],[-112.5,28.3],[-112.0,27.0],[-111.4,26.1],[-111.1,25.3],[-110.3,24.2],[-109.5,23.5],[-109.9,22.9],[-110.5,23.1],[-111.6,24.0],[-112.1,24.5],[-112.2,25.2],[-113.5,26.7],[-114.0,27.3],[-115.05,27.85],[-115.4,28.9],[-115.9,30.0],[-116.0,30.5],[-116.6,31.7],[-117.0,32.2]];

  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function initCorridors() {
    const canvas = $('#map');
    const groupsEl = $('.hub-groups');
    const info = $('#hub-info');
    if (!canvas || !groupsEl) return;

    // Chips de destinos
    const hubs = CONFIG.hubs;
    groupsEl.innerHTML = '';
    Object.keys(GROUPS).forEach(g => {
      const items = hubs.filter(h => h.group === g);
      if (!items.length) return;
      const box = document.createElement('div'); box.className = 'hub-group';
      box.innerHTML = `<h3>${GROUPS[g].label}</h3><div class="hub-chips"></div>`;
      const chips = $('.hub-chips', box);
      items.forEach(h => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'hub'; b.dataset.hub = h.id; b.setAttribute('aria-pressed', 'false');
        b.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${GROUPS[g].icon}"/></svg>${h.name}`;
        chips.appendChild(b);
      });
      groupsEl.appendChild(box);
    });
    const buttons = $$('.hub', groupsEl);

    const ctx = canvas.getContext('2d');
    const vis = watchVisible(canvas.parentElement, '100px');
    const LON0 = -118.2, LON1 = -86.3, LAT0 = 14.2, LAT1 = 33.0, KX = Math.cos(24 * Math.PI / 180);
    let W = 0, H = 0, scale = 1, ox = 0, oy = 0, dpr = 1;
    let dots = [], nodes = [], routes = [];
    let active = hubs[4]?.id || hubs[0].id, activeSince = 0, userAt = -99;
    let hoverIdx = -1;

    const project = (lon, lat) => [ox + (lon - LON0) * KX * scale, oy + (LAT1 - lat) * scale];

    function build() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      if (!W) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const degW = (LON1 - LON0) * KX, degH = LAT1 - LAT0;
      scale = Math.min(W / degW, H / degH) * 0.97;
      ox = (W - degW * scale) / 2; oy = (H - degH * scale) / 2;
      const step = W < 520 ? 0.4 : 0.3;
      dots = [];
      for (let lat = LAT1; lat > LAT0; lat -= step) {
        for (let lon = LON0; lon < LON1; lon += step / KX * 1) {
          if (inPoly(lon, lat, MX_MAIN) || inPoly(lon, lat, MX_BAJA)) {
            const [x, y] = project(lon, lat);
            dots.push({ x, y, ph: (x * 0.013 + y * 0.021) % 6.28 });
          }
        }
      }
      nodes = hubs.map(h => { const [x, y] = project(h.lon, h.lat); return { id: h.id, name: h.name, x, y }; });
      const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
      routes = CONFIG.rutas.map(([a, b], i) => {
        const A = byId[a], B = byId[b];
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
        const nx = -dy / len, ny = dx / len, bend = len * 0.2 * (ny > 0 ? -1 : 1) * (nx > 0 ? 1 : 1);
        return { a, b, A, B, cx: mx + nx * bend, cy: my + ny * bend - len * 0.06, off: i * 0.173 };
      });
    }
    measures.push(build);

    function setActive(id, byUser) {
      if (!id) return;
      active = id; activeSince = S.t;
      if (byUser) userAt = S.t;
      const h = hubs.find(x => x.id === id);
      buttons.forEach(b => { const on = b.dataset.hub === id; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
      info.innerHTML = `<strong>${h.name}.</strong> ${h.info}`;
      if (reduced) draw(S.t);
    }
    buttons.forEach(b => {
      b.addEventListener('click', () => setActive(b.dataset.hub, true));
      b.addEventListener('mouseenter', () => setActive(b.dataset.hub, true));
      b.addEventListener('focus', () => setActive(b.dataset.hub, true));
    });
    canvas.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 28 * 28;
      nodes.forEach((n, i) => { const d = (n.x - mx) ** 2 + (n.y - my) ** 2; if (d < bd) { bd = d; best = i; } });
      hoverIdx = best;
      if (best >= 0 && nodes[best].id !== active) setActive(nodes[best].id, true);
    });
    canvas.addEventListener('pointerleave', () => { hoverIdx = -1; });
    canvas.addEventListener('click', () => { if (hoverIdx >= 0) setActive(nodes[hoverIdx].id, true); });

    const bez = (r, t) => {
      const u = 1 - t;
      return [u * u * r.A.x + 2 * u * t * r.cx + t * t * r.B.x, u * u * r.A.y + 2 * u * t * r.cy + t * t * r.B.y];
    };

    function draw(t) {
      if (!W) return;
      ctx.clearRect(0, 0, W, H);
      const an = nodes.find(n => n.id === active);
      const cycle = ((t - activeSince) % 3.2) / 3.2;
      const waveR = cycle * Math.max(W, H) * 0.55, waveW = Math.max(W, H) * 0.07;

      // Matriz de puntos
      const sz = W < 520 ? 1.9 : 2.4;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        let a = 0.36 + 0.14 * Math.sin(t * 1.1 + d.ph), gold = 0;
        if (an) {
          const dd = Math.hypot(d.x - an.x, d.y - an.y);
          const k = Math.exp(-Math.pow((dd - waveR) / waveW, 2));
          gold = k * (1 - cycle);
          a += gold * 0.75;
        }
        ctx.fillStyle = gold > 0.12 ? `rgba(239,208,120,${Math.min(a, 1).toFixed(2)})` : `rgba(143,178,230,${a.toFixed(2)})`;
        ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
      }

      // Rutas
      routes.forEach((r, i) => {
        const on = r.a === active || r.b === active;
        ctx.beginPath(); ctx.moveTo(r.A.x, r.A.y); ctx.quadraticCurveTo(r.cx, r.cy, r.B.x, r.B.y);
        ctx.setLineDash(on ? [] : [3, 7]);
        ctx.lineDashOffset = -t * 14;
        ctx.strokeStyle = on ? 'rgba(239,208,120,.95)' : 'rgba(143,178,230,.5)';
        ctx.lineWidth = on ? 1.8 : 1;
        if (on) { ctx.shadowColor = 'rgba(225,184,69,.9)'; ctx.shadowBlur = 12; }
        ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]);
        // "camión" viajando por la ruta
        const p = (t * (on ? 0.32 : 0.14) + r.off) % 1;
        const [px, py] = bez(r, p);
        ctx.fillStyle = on ? '#fff4c4' : 'rgba(143,178,230,.8)';
        ctx.beginPath(); ctx.arc(px, py, on ? 3 : 2, 0, 6.283); ctx.fill();
      });

      // Nodos
            nodes.forEach((n, i) => {
        const on = n.id === active;
        if (on) {
          const pr = ((t - activeSince) % 1.6) / 1.6;
          ctx.strokeStyle = `rgba(239,208,120,${(1 - pr).toFixed(2)})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(n.x, n.y, 6 + pr * 22, 0, 6.283); ctx.stroke();
        }
        ctx.fillStyle = on ? '#e1b845' : '#fff';
        ctx.beginPath(); ctx.arc(n.x, n.y, on ? 5.5 : 3.6, 0, 6.283); ctx.fill();
        ctx.strokeStyle = on ? 'rgba(255,244,196,.9)' : 'rgba(8,26,53,.9)'; ctx.lineWidth = 2; ctx.stroke();
        if (on) {
          ctx.font = '600 13px "JetBrains Mono", monospace';
          const left = n.x > W * 0.72;
          ctx.textAlign = left ? 'right' : 'left';
          ctx.fillStyle = '#f8e7a6';
          ctx.fillText(n.name, n.x + (left ? -11 : 11), n.y - 8);
        }
      });
    }

    let lastAuto = 0;
    tasks.push(s => {
      if (!vis.on) return;
      if (!reduced && s.t - userAt > 9 && s.t - lastAuto > 3.2) {
        lastAuto = s.t;
        const i = hubs.findIndex(h => h.id === active);
        setActive(hubs[(i + 1) % hubs.length].id, false);
      }
      if (!reduced) draw(s.t);
    });
    setActive(active, false);
    if (reduced) measures.push(() => draw(0));
  }

  /* ------------------------------------------------------------------------
     10. PROCESO (la línea de ruta avanza con el scroll)
     ------------------------------------------------------------------------ */
  function initTimeline() {
    const tl = $('#tl');
    if (!tl) return;
    const steps = $$('.tl-step', tl);
    let offs = [], cur = 0;
    measures.push(() => { offs = steps.map(st => st.offsetTop + 22); });
    const vis = watchVisible(tl, '100px');
    tasks.push(s => {
      if (!vis.on) return;
      const r = tl.getBoundingClientRect();
      const head = s.vh * 0.6 - r.top;               // punto de lectura respecto al inicio del timeline
      const total = Math.max(1, r.height - 44);
      cur = reduced ? clamp((head - 22) / total) : damp(cur, clamp((head - 22) / total), 9, s.dt);
      tl.style.setProperty('--tp', cur.toFixed(4));
      steps.forEach((st, i) => st.classList.toggle('on', head >= offs[i]));
    });
  }

  /* ------------------------------------------------------------------------
     11. FLOTA: galería horizontal fijada con el scroll
     ------------------------------------------------------------------------ */
  function initFleet() {
    const sec = $('.fleet');
    const track = $('#fleet-track');
    if (!sec || !track) return;
    const mq = matchMedia('(min-width:1024px) and (hover:hover) and (pointer:fine)');
    let pinned = false, top = 0, h = 1, travel = 0, cur = 0;

    measures.unshift(() => {
      pinned = mq.matches && !reduced;
      sec.classList.toggle('is-pinned', pinned);
      if (pinned) {
        travel = Math.max(0, track.scrollWidth - innerWidth);
        sec.style.height = `${travel + innerHeight}px`;
      } else {
        sec.style.height = '';
        track.style.removeProperty('--fx');
      }
    });
    measures.push(() => { top = docTop(sec); h = sec.offsetHeight; });

    tasks.push(s => {
      if (!pinned) return;
      const raw = (s.y - top) / Math.max(1, h - s.vh);
      if (raw < -0.2 || raw > 1.2) return;
      cur = damp(cur, clamp(raw), 8, s.dt);
      track.style.setProperty('--fx', `${(-cur * travel).toFixed(1)}px`);
    });
    mq.addEventListener('change', scheduleMeasure);
  }

  /* ------------------------------------------------------------------------
     12. FRANJAS DE COLABORADORES Y PREGUNTAS FRECUENTES
     ------------------------------------------------------------------------ */
  function initAccordions() {
    const strips = $$('.strip');
    const open = target => strips.forEach(s => {
      const on = s === target;
      s.classList.toggle('is-open', on);
      $('.strip-btn', s).setAttribute('aria-expanded', String(on));
    });
    strips.forEach(s => {
      $('.strip-btn', s).addEventListener('click', () => open(s));
      if (finePointer && matchMedia('(min-width:900px)').matches) s.addEventListener('mouseenter', () => open(s));
    });

    const items = $$('.acc-item');
    items.forEach(it => {
      const q = $('.acc-q', it), a = $('.acc-a', it);
      q.addEventListener('click', () => {
        const willOpen = q.getAttribute('aria-expanded') !== 'true';
        items.forEach(o => {
          const oq = $('.acc-q', o), oa = $('.acc-a', o);
          const on = o === it && willOpen;
          oq.setAttribute('aria-expanded', String(on));
          oa.classList.toggle('is-open', on);
        });
      });
    });
    // La primera pregunta arranca abierta
    const first = items[0];
    if (first) { $('.acc-q', first).setAttribute('aria-expanded', 'true'); $('.acc-a', first).classList.add('is-open'); }
  }

  /* ------------------------------------------------------------------------
     13. FORMULARIO → WHATSAPP
     ------------------------------------------------------------------------ */
  function initForm() {
    const waURL = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;

    // Todos los enlaces a WhatsApp salen de la misma configuración
    $$('[data-wa]').forEach(a => {
      a.href = waURL(CONFIG.saludo);
      if (a.hasAttribute('data-wa-text')) a.textContent = CONFIG.whatsappDisplay;
    });

    const form = $('#wa-form');
    if (!form) return;
    const seg = $('.seg', form);
    const panels = $$('[data-panel]', form);
    const label = $('#submit-label');
    const status = $('#form-status');

    function setTipo(tipo) {
      const radio = $(`input[name="tipo"][value="${tipo}"]`, form);
      if (!radio) return;
      radio.checked = true;
      seg.dataset.tipo = tipo;
      panels.forEach(p => {
        const on = p.dataset.panel === tipo;
        p.hidden = !on;
        $$('input,select,textarea', p).forEach(f => { f.disabled = !on; });
      });
      label.textContent = tipo === 'cliente' ? 'Enviar mi solicitud por WhatsApp' : 'Enviar mi perfil por WhatsApp';
      status.hidden = true;
    }
    $$('input[name="tipo"]', form).forEach(r => r.addEventListener('change', () => setTipo(r.value)));
    setTipo('cliente');

    // Los botones CTA de toda la página eligen el tipo de formulario
    $$('[data-cta]').forEach(a => a.addEventListener('click', () => {
      setTipo(a.dataset.cta);
      if (a.dataset.service) {
        const sel = $('#f-servicio');
        const opt = Array.from(sel.options).find(o => o.value === a.dataset.service || o.text === a.dataset.service);
        if (opt) { sel.value = opt.value; clearInvalid(sel); }
      }
    }));

    function clearInvalid(f) {
      f.removeAttribute('aria-invalid');
      const err = document.getElementById(f.getAttribute('aria-describedby') || '');
      if (err) err.hidden = true;
    }
    form.addEventListener('input', e => { if (e.target.matches('[aria-invalid]')) clearInvalid(e.target); });
    form.addEventListener('change', e => { if (e.target.matches('[aria-invalid]')) clearInvalid(e.target); });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const tipo = form.elements.tipo.value;
      const panel = $(`[data-panel="${tipo}"]`, form);
      let firstBad = null;
      $$('[required]', panel).forEach(f => {
        const bad = !f.value.trim();
        f.setAttribute('aria-invalid', String(bad));
        const err = document.getElementById(f.getAttribute('aria-describedby') || '');
        if (err) err.hidden = !bad;
        if (!bad) f.removeAttribute('aria-invalid');
        if (bad && !firstBad) firstBad = f;
      });
      if (firstBad) { firstBad.focus(); return; }

      const d = Object.fromEntries(new FormData(form).entries());
      const v = k => (d[k] || '').toString().trim();
      const lines = [];
      if (tipo === 'cliente') {
        lines.push(`Hola, soy ${v('nombre')}${v('empresa') ? ` de ${v('empresa')}` : ''}. Quiero cotizar el transporte de: ${v('servicio')}.`);
        if (v('origen')) lines.push(`Origen: ${v('origen')}`);
        if (v('destino')) lines.push(`Destino: ${v('destino')}`);
        if (v('detalles')) lines.push(`Detalles de la carga: ${v('detalles')}`);
        if (v('telefono')) lines.push(`Mi teléfono: ${v('telefono')}`);
      } else {
        lines.push(`Hola, soy ${v('nombre')}. Me interesa colaborar con DML como: ${v('perfil')}.`);
        if (v('experiencia')) lines.push(`Experiencia: ${v('experiencia')}`);
        if (v('licencia')) lines.push(`Licencia federal: ${v('licencia')}`);
        if (v('mensaje')) lines.push(v('mensaje'));
        if (v('telefono')) lines.push(`Mi teléfono: ${v('telefono')}`);
      }
      lines.push('Enviado desde la página web de DML.');

      const url = waURL(lines.join('\n'));
      $('a', status).href = url;
      status.hidden = false;
      window.open(url, '_blank', 'noopener');
    });
  }

  /* ------------------------------------------------------------------------
     14. DETALLES: foco de luz, botones magnéticos, footer, año
     ------------------------------------------------------------------------ */
  function initDetails() {
    $$('[data-spot]').forEach(el => el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    }));

    if (finePointer && !reduced) {
      $$('[data-magnetic]').forEach(el => {
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - (r.left + r.width / 2)) * 0.22;
          const y = (e.clientY - (r.top + r.height / 2)) * 0.32;
          el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });
    }

    // La marca del footer se "llena" de dorado al llegar al final de la página
    const fm = $('.footer-mark');
    const rect = $('#fm-rect');
    if (fm && rect) {
      let cur = reduced ? 1 : 0;
      if (reduced) rect.setAttribute('width', 920);
      else tasks.push(s => {
        const r = fm.getBoundingClientRect();
        const p = clamp((s.vh - r.top) / (s.vh * 0.75));
        cur = damp(cur, p, 5, s.dt);
        rect.setAttribute('width', (cur * 920).toFixed(1));
      });
    }

    const year = $('#year'); if (year) year.textContent = new Date().getFullYear();
  }

  /* ------------------------------------------------------------------------
     ARRANQUE
     ------------------------------------------------------------------------ */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);

  initLoader();
  initReveals();
  initNav();
  initHero();
  initTicker();
  initManifesto();
  initExpand();
  initStack();
  initCorridors();
  initTimeline();
  initFleet();
  initAccordions();
  initForm();
  initDetails();

  const boot = () => { runMeasure(); requestAnimationFrame(frame); };
  boot();
  addEventListener('load', scheduleMeasure);
  addEventListener('resize', scheduleMeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(document.body);
})();
