(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const animate = hasGsap && !reduceMotion;

  /* ───────── Pricing data (from the design) ───────── */
  const PLANS = {
    soc: [
      ['Starter', '14,999', '89,999', '12 posts', '2 reels'],
      ['Growth', '24,999', '1,49,999', '16 posts', '4 reels', true],
      ['Pro', '31,999', '1,91,999', '20 posts', '8 reels'],
    ],
    prt: [
      ['Basic', '4,999', '29,999', '5 designs / mo'],
      ['Business', '9,999', '59,999', '10 designs / mo', '', true],
      ['Pro', '14,999', '89,999', '18 designs / mo'],
    ],
  };
  let period = 'm';

  const priceText = (row) => '₹' + (period === '6' ? row[2] : row[1]);
  const unitText = (row, kind) => {
    const unit = period === '6' ? 'per 6 months' : 'per month';
    return kind === 'soc' ? unit : `${unit} · ${row[3]}`;
  };

  function renderPlans() {
    for (const kind of ['soc', 'prt']) {
      const row = document.getElementById('row-' + kind);
      PLANS[kind].forEach((r) => {
        const [name, , , a, b, pop] = r;
        const el = document.createElement('div');
        el.className = 'plan' + (pop ? ' is-pop' : '');
        el.innerHTML =
          `<div class="plan-name"><span>${name}</span>${pop ? '<span class="plan-badge">★ POPULAR</span>' : ''}</div>` +
          `<div class="plan-price"><span>${priceText(r)}</span></div>` +
          `<div class="plan-unit">${unitText(r, kind)}</div>` +
          (kind === 'soc' ? `<div class="plan-meta">${a} · ${b}</div>` : '');
        row.appendChild(el);
      });
    }
  }

  function writePrices() {
    for (const kind of ['soc', 'prt']) {
      document.querySelectorAll(`#row-${kind} .plan`).forEach((cell, i) => {
        cell.querySelector('.plan-price span').textContent = priceText(PLANS[kind][i]);
        cell.querySelector('.plan-unit').textContent = unitText(PLANS[kind][i], kind);
      });
    }
  }

  // Old prices slide up and out, new ones slide up and in
  function updatePrices() {
    if (!animate) return writePrices();
    const spans = '.plan-price span, .plan-unit';
    gsap.killTweensOf(spans);
    gsap.timeline()
      .to(spans, { yPercent: -60, opacity: 0, duration: 0.22, ease: 'power2.in', stagger: 0.015 })
      .add(writePrices)
      .fromTo(spans, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.025 });
  }

  renderPlans();

  const toggle = document.querySelector('.toggle');
  const thumb = toggle.querySelector('.toggle-thumb');
  const tabs = toggle.querySelectorAll('button');

  function moveThumb() {
    const active = toggle.querySelector('[aria-selected="true"]');
    thumb.style.width = active.offsetWidth + 'px';
    thumb.style.transform = `translateX(${active.offsetLeft - 6}px)`;
  }

  tabs.forEach((btn) => btn.addEventListener('click', () => {
    if (btn.dataset.period === period) return;
    period = btn.dataset.period;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === btn)));
    moveThumb();
    updatePrices();
  }));

  /* ───────── Scale fixed-size artwork to its container ─────────
     Uses `zoom` so artwork is re-rendered at its real size (crisp, and no
     upscaled bitmaps for the GPU to stretch every frame). */
  const canZoom = CSS.supports('zoom', '2');
  function fitAll() {
    document.querySelectorAll('.fit').forEach((el) => {
      const w = +el.dataset.w, h = +el.dataset.h, max = +(el.dataset.max || 1);
      el.style.maxWidth = w * max + 'px';
      const s = Math.min(max, el.clientWidth / w);
      const inner = el.firstElementChild;
      inner.style.width = w + 'px';
      inner.style.height = h + 'px';
      if (canZoom) inner.style.zoom = s;
      else inner.style.transform = `scale(${s})`;
      el.style.height = h * s + 'px';
    });
  }

  fitAll();
  moveThumb();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fitAll();
      moveThumb();
      if (animate) { measureMarquee(); ScrollTrigger.refresh(); }
    }, 120);
  });

  if (!animate) return;

  /* ───────── Smooth scroll ───────── */
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = new Lenis({
    lerp: 0.075,          // lower = longer, silkier glide
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const nav = document.getElementById('nav');

  // Keep the nav on screen while jumping via anchor links
  let jumping = false;
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      jumping = true;
      nav.classList.remove('is-hidden');
      lenis.scrollTo(target, {
        offset: a.getAttribute('href') === '#top' ? 0 : -80,
        duration: 1.8,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        onComplete: () => { jumping = false; },
      });
    });
  });

  /* ───────── Nav + progress ───────── */
  let navScrolled = false, navHidden = false;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      const scrolled = y > 40;
      const hidden = !jumping && self.direction === 1 && y > 400;
      if (scrolled !== navScrolled) nav.classList.toggle('is-scrolled', (navScrolled = scrolled));
      if (!jumping && hidden !== navHidden) nav.classList.toggle('is-hidden', (navHidden = hidden));
    },
  });
  gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });

  /* ───────── Hero intro ───────── */
  gsap.timeline({ delay: 0.1 })
    .from('.hero-title .line-inner', { yPercent: 115, duration: 1.6, ease: 'power4.out', stagger: 0.12 })
    .from('[data-intro]', { y: 24, opacity: 0, duration: 1.4 }, '-=1.1')
    .from('.nav', { y: -24, opacity: 0, duration: 1.2, clearProps: 'transform,opacity' }, '<');

  /* ───────── Hero parallax: cards rise at different depths, headline lines drift apart ───────── */
  const hero = document.getElementById('hero');
  const heroST = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true };

  gsap.utils.toArray('.hero [data-speed]').forEach((el) => {
    gsap.to(el, { y: () => -window.innerHeight * parseFloat(el.dataset.speed), ease: 'none', scrollTrigger: heroST });
  });
  gsap.utils.toArray('.hero-title [data-x]').forEach((el) => {
    gsap.to(el, { x: () => window.innerWidth * parseFloat(el.dataset.x), ease: 'none', scrollTrigger: heroST });
  });
  gsap.to('.hero-foot', {
    y: () => window.innerHeight * 0.12, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'center top', end: 'bottom top', scrub: true },
  });

  // Pause the hero's looping CSS animations while it's off screen
  ScrollTrigger.create({
    trigger: hero, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => hero.classList.toggle('is-offscreen', !self.isActive),
  });

  /* Mouse depth on the card stack */
  if (finePointer) {
    const tilts = gsap.utils.toArray('.hero [data-depth]').map((layer) => {
      const t = layer.querySelector('.tilt');
      return {
        d: parseFloat(layer.dataset.depth),
        x: gsap.quickTo(t, 'x', { duration: 1.6, ease: 'power3.out' }),
        y: gsap.quickTo(t, 'y', { duration: 1.6, ease: 'power3.out' }),
      };
    });
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      tilts.forEach((t) => { t.x(-nx * t.d); t.y(-ny * t.d); });
    });
    hero.addEventListener('pointerleave', () => tilts.forEach((t) => { t.x(0); t.y(0); }));
  }

  /* ───────── Marquee: drifts on its own, eases faster and skews with scroll velocity ───────── */
  const marquee = document.querySelector('.marquee');
  const track = marquee.querySelector('.marquee-track');
  let mqHalf = 0, mqX = 0, mqDir = 1, mqSpeed = 0.06, mqSkew = 0, mqVisible = true;
  function measureMarquee() { mqHalf = track.scrollWidth / 2; }
  measureMarquee();

  const setX = gsap.quickSetter(track, 'x', 'px');
  const setSkew = gsap.quickSetter(track, 'skewX', 'deg');
  ScrollTrigger.create({ trigger: marquee, start: 'top bottom', end: 'bottom top', onToggle: (s) => { mqVisible = s.isActive; } });

  gsap.ticker.add((time, dt) => {
    if (!mqVisible || !mqHalf) return;
    const v = lenis.velocity || 0;
    if (Math.abs(v) > 0.5) mqDir = v > 0 ? 1 : -1;
    // Frame-rate independent easing toward target speed and skew
    const k = 1 - Math.pow(0.9, dt / 16.67);
    mqSpeed += (0.06 + Math.min(Math.abs(v) * 0.03, 1) - mqSpeed) * k;
    mqSkew += (gsap.utils.clamp(-6, 6, -v * 0.25) - mqSkew) * k;
    mqX -= mqSpeed * dt * mqDir;
    mqX = ((mqX % mqHalf) - mqHalf) % mqHalf;
    setX(mqX);
    setSkew(mqSkew);
  });

  /* ───────── Reveals (batched so neighbours stagger together) ───────── */
  gsap.set('.reveal', { y: 56, opacity: 0 });
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1.5, ease: 'power3.out', stagger: 0.12, overwrite: true }),
  });

  gsap.utils.toArray('.split').forEach((el) => {
    gsap.from(el.querySelectorAll('.line-inner'), {
      yPercent: 115, duration: 1.5, ease: 'power4.out', stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  gsap.utils.toArray('.price-row').forEach((row) => {
    gsap.from(row.querySelectorAll('.row-label, .plan'), {
      y: 40, opacity: 0, duration: 1.4, stagger: 0.1,
      scrollTrigger: { trigger: row, start: 'top 88%', once: true },
    });
  });

  /* ───────── Service artwork: each piece floats at its own speed ───────── */
  gsap.utils.toArray('.fan-item').forEach((el) => {
    const py = parseFloat(el.dataset.py) || 0;
    gsap.fromTo(el, { y: py }, {
      y: -py, ease: 'none',
      scrollTrigger: { trigger: el.closest('.svc'), start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ───────── Count-ups ───────── */
  gsap.utils.toArray('.count').forEach((el) => {
    const to = +el.dataset.to;
    const obj = { v: 0 };
    el.textContent = '0';
    gsap.to(obj, {
      v: to, duration: to > 10 ? 2 : 1.2, ease: 'power2.out',
      onUpdate: () => { el.textContent = Math.round(obj.v); },
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });

  /* ───────── Contact: headline slides in, CTA is magnetic ───────── */
  gsap.fromTo('.move-title', { xPercent: 14 }, {
    xPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
  gsap.fromTo('.move-title .dot', { scale: 0, transformOrigin: '50% 80%' }, {
    scale: 1, ease: 'back.out(2.2)', duration: 1.1,
    scrollTrigger: { trigger: '.contact', start: 'top 70%', once: true },
  });

  if (finePointer) {
    document.querySelectorAll('.magnetic').forEach((btn) => {
      const label = btn.firstElementChild;
      const opts = { duration: 1, ease: 'elastic.out(1, .5)' };
      const bx = gsap.quickTo(btn, 'x', opts), by = gsap.quickTo(btn, 'y', opts);
      const lx = gsap.quickTo(label, 'x', opts), ly = gsap.quickTo(label, 'y', opts);
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        bx(dx * 0.3); by(dy * 0.4); lx(dx * 0.15); ly(dy * 0.2);
      });
      btn.addEventListener('pointerleave', () => { bx(0); by(0); lx(0); ly(0); });
    });
  }

  // Layout settles once web fonts arrive: re-measure everything then
  const settle = () => { fitAll(); moveThumb(); measureMarquee(); ScrollTrigger.refresh(); };
  if (document.fonts) document.fonts.ready.then(settle);
  window.addEventListener('load', settle);
})();
