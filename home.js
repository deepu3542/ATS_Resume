/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Home page: live resume in the hero, template gallery, rotating word, tilt, particles */
(() => {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Live sample resume in the hero + a real score computed from it
  const demo = { ...sampleResume(), templateId: 'modern' };
  mountPaper($('#hero-fit'), { guides: false }).render(demo);
  $('#hero-score').textContent = analyzeResume(demo).score;

  // Template gallery renders the same sample in each template
  document.querySelectorAll('[data-tpl]').forEach((card) => {
    mountPaper(card.querySelector('.paper-fit'), { guides: false }).render({ ...sampleResume(), templateId: card.dataset.tpl });
  });

  // Rotating word in the headline
  const words = [...document.querySelectorAll('.rotator span')];
  if (words.length > 1 && !reduce) {
    let i = 0;
    setInterval(() => {
      const prev = words[i];
      i = (i + 1) % words.length;
      prev.classList.remove('on'); prev.classList.add('off');
      words[i].classList.remove('off'); words[i].classList.add('on');
      setTimeout(() => prev.classList.remove('off'), 700);
    }, 2600);
  }

  // Floating particles
  const box = document.querySelector('.hero-particles');
  if (box && !reduce) {
    for (let n = 0; n < 24; n += 1) {
      const s = document.createElement('i');
      s.className = 'spark';
      const size = 2 + Math.random() * 4;
      s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${9 + Math.random() * 9}s;animation-delay:${-Math.random() * 14}s;--dx:${(Math.random() - 0.5) * 90}px`;
      box.append(s);
    }
  }

  // Pointer tilt + glow (mouse only)
  const stage = document.querySelector('.hero-stage');
  const hero = document.querySelector('.hero');
  if (stage && hero && fine && !reduce) {
    hero.addEventListener('pointermove', (e) => {
      const hr = hero.getBoundingClientRect();
      hero.style.setProperty('--gx', `${e.clientX - hr.left}px`);
      hero.style.setProperty('--gy', `${e.clientY - hr.top}px`);
      const r = stage.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      stage.style.setProperty('--ry', nx.toFixed(3)); stage.style.setProperty('--rx', ny.toFixed(3));
      stage.style.setProperty('--px', nx.toFixed(3)); stage.style.setProperty('--py', ny.toFixed(3));
    });
    hero.addEventListener('pointerleave', () => { ['--ry', '--rx', '--px', '--py'].forEach((k) => stage.style.setProperty(k, '0')); });
  }
})();
