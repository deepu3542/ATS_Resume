/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Site-wide behaviour: preloader, header, menu, reveal, spotlight, ripple, counters, page transitions */
(() => {
  'use strict';
  window.ATS_BOOT = true;
  const body = document.body;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const qa = (s, r = document) => [...r.querySelectorAll(s)];

  /* ----- placeholders ----- */
  qa('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); });
  const mail = (window.ATS_SITE || {}).contactEmail || '';
  qa('[data-contact-email]').forEach((e) => { e.textContent = mail; if (e.tagName === 'A') e.href = `mailto:${mail}`; });

  /* ----- preloader ----- */
  function finishLoading() { body.classList.remove('is-loading'); body.classList.add('loaded'); }
  function preloader() {
    const pl = document.getElementById('preloader');
    if (!pl) { finishLoading(); return; }
    let seen = false, reload = false;
    try {
      seen = sessionStorage.getItem('ar-pl') === '1';
      const nav = performance.getEntriesByType('navigation')[0];
      reload = !!nav && nav.type === 'reload';
      sessionStorage.setItem('ar-pl', '1');
    } catch { /* storage blocked: show the preloader */ }
    if (reduce || (seen && !reload)) { pl.remove(); finishLoading(); return; }

    const bar = pl.querySelector('.pl-bar');
    const fill = pl.querySelector('.pl-bar i');
    const count = pl.querySelector('.pl-count');
    const start = performance.now();
    const MIN = 2700;
    let pageReady = document.readyState === 'complete';
    let fontsReady = !document.fonts;
    window.addEventListener('load', () => { pageReady = true; });
    if (document.fonts) document.fonts.ready.then(() => { fontsReady = true; }).catch(() => { fontsReady = true; });
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      pl.classList.add('done');
      setTimeout(finishLoading, 450);
      setTimeout(() => pl.remove(), 1400);
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / MIN);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const cap = pageReady && fontsReady ? 1 : 0.92;
      const p = Math.min(cap, eased);
      pl.style.setProperty('--pl', p.toFixed(3));
      count.textContent = `${Math.round(p * 100)}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      if (p >= 1) setTimeout(finish, 250);
      else if (now - start > 6000) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  preloader();

  /* ----- header, progress, back to top ----- */
  const header = document.querySelector('.topbar');
  const progress = document.querySelector('.progress');
  const toTop = document.querySelector('.to-top');
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    if (header) header.classList.toggle('scrolled', y > 12);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
    }
    if (toTop) toTop.classList.toggle('show', y > 700);
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));

  /* ----- mobile menu ----- */
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    const set = (open) => { nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
    menuBtn.addEventListener('click', () => set(!nav.classList.contains('open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); menuBtn.focus(); } });
    document.addEventListener('click', (e) => { if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) set(false); });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  }

  /* ----- reveal on scroll ----- */
  const revealEls = qa('.reveal, .how');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else revealEls.forEach((el) => el.classList.add('in'));

  /* ----- count-up numbers ----- */
  qa('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduce || !('IntersectionObserver' in window)) { el.textContent = target + suffix; return; }
    el.textContent = `0${suffix}`;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4))) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
  });

  /* ----- spotlight cards, ripple, magnetic buttons ----- */
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest && e.target.closest('.spot');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }
  }, { passive: true });

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest && e.target.closest('.btn');
    if (!btn || btn.disabled || reduce) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.append(dot);
    setTimeout(() => dot.remove(), 650);
  });

  if (fine && !reduce) {
    qa('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ----- privacy table of contents scroll-spy ----- */
  const tocLinks = qa('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const map = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { tocLinks.forEach((a) => a.classList.remove('active')); map.get(en.target.id)?.classList.add('active'); }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    qa('.prose section[id]').forEach((s) => spy.observe(s));
  }

  /* ----- page transitions ----- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!/^[\w-]+\.html(\?[^#]*)?(#.*)?$/.test(href)) return;
    if (reduce) return;
    e.preventDefault();
    body.classList.add('leaving');
    setTimeout(() => { window.location.href = href; }, 260);
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) body.classList.remove('leaving'); });
})();
