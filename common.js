/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Shared helpers: DOM builder, icons, toasts, paper preview */
const PX = 4 / 3;
const $ = (s, r = document) => r.querySelector(s);

// ---------- tiny DOM helpers ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  kids.flat(Infinity).forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
  return el;
}
const ICONS = {
  plus: 'M12 5v14M5 12h14', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', download: 'M12 4v11M7 11l5 5 5-5M5 20h14', check: 'M5 12l5 5 9-10',
  alert: 'M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z', x: 'M6 6l12 12M18 6L6 18',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', upload: 'M12 20V9M7 13l5-5 5 5M5 4h14',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', gauge: 'M4 18a8 8 0 1116 0M12 18l4-6', chevron: 'M9 6l6 6-6 6',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', minus: 'M5 12h14', copy: 'M8 8h11v13H8zM5 16V3h11', arrow: 'M5 12h14M13 6l6 6-6 6',
};
const iconStr = (n, s = 18) => `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${ICONS[n]}"/></svg>`;
const ico = (n, s) => h('span', { class: 'ico', html: iconStr(n, s) });
const clone = (x) => JSON.parse(JSON.stringify(x));


// ---------- toasts ----------
let toastSeq = 0;
function notify(message, opts = {}) {
  const id = ++toastSeq;
  const box = $('#toasts');
  const el = h('div', { class: `toast toast-${opts.type || 'ok'}`, role: opts.type === 'error' ? 'alert' : 'status' },
    ico(opts.type === 'error' ? 'alert' : 'check', 16), h('span', {}, message));
  const close = () => el.remove();
  if (opts.action) el.append(h('button', { type: 'button', class: 'toast-action', onclick: () => { opts.action.onClick(); close(); } }, opts.action.label));
  el.append(h('button', { type: 'button', class: 'icon-btn toast-close', 'aria-label': 'Dismiss notification', onclick: close }, ico('x', 14)));
  while (box.children.length >= 3) box.firstChild.remove();
  box.append(el);
  setTimeout(close, opts.action ? 9000 : 5000);
  return id;
}

// ---------- paper preview ----------
function mountPaper(fit, { guides = true, onPages } = {}) {
  const paper = h('article', { class: 'paper', 'aria-label': 'Resume preview' });
  fit.append(paper);
  let current = null;
  function layout() {
    if (!current || !fit.clientWidth) return;
    const P = PAPERS[current.paper] || PAPERS.letter;
    const scale = Math.min(1, fit.clientWidth / (P.w * PX));
    paper.style.transform = `scale(${scale})`;
    fit.style.height = `${paper.offsetHeight * scale}px`;
    if (onPages) onPages(Math.max(1, Math.ceil((paper.offsetHeight - 2) / (P.h * PX))));
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(fit.parentElement);
  window.addEventListener('resize', layout);
  function render(r) {
    current = r;
    const doc = buildDocument(r);
    const T = TEMPLATES[r.templateId] || TEMPLATES.classic;
    const P = PAPERS[r.paper] || PAPERS.letter;
    const vars = {
      '--pw': `${P.w}pt`, '--ph': `${P.h}pt`, '--m': `${T.margin}pt`, '--font': T.cssFont, '--name-size': `${T.nameSize}pt`,
      '--body': `${T.body}pt`, '--lead': T.leading, '--c-name': rgb(T.nameColor), '--c-title': rgb(T.titleColor),
      '--c-head': rgb(T.headColor), '--c-rule': rgb(T.rule), '--c-text': rgb(T.text), '--c-muted': rgb(T.muted),
      '--align': T.align, '--upper': T.upper ? 'uppercase' : 'none',
    };
    Object.entries(vars).forEach(([k, v]) => paper.style.setProperty(k, v));
    paper.replaceChildren();
    if (!doc.name && !doc.sections.length) {
      paper.append(h('p', { class: 'p-empty' }, 'Your resume appears here as you type.'));
    } else {
      paper.append(h('header', { class: 'p-head' },
        doc.name && h('div', { class: 'p-name' }, doc.name),
        doc.title && h('div', { class: 'p-title' }, doc.title),
        doc.contact.length > 0 && h('div', { class: 'p-contact' }, doc.contact.join('  |  '))));
      doc.sections.forEach((s) => paper.append(h('section', { class: 'p-section' },
        h('h3', { class: 'p-heading' }, s.title), s.blocks.map(blockEl))));
    }
    if (guides) paper.append(h('div', { class: 'p-guides', 'aria-hidden': 'true' }));
    layout();
  }
  return { render, layout };
}
const bulletsEl = (list) => h('ul', { class: 'p-bullets' }, list.map((x) => h('li', {}, x)));
function blockEl(b) {
  if (b.type === 'text') return h('p', { class: 'p-text' }, b.text);
  if (b.type === 'skill') return h('p', { class: 'p-skill' }, h('strong', {}, `${b.label}:`), ` ${b.text}`);
  if (b.type === 'bullets') return bulletsEl(b.bullets);
  return h('div', { class: 'p-entry' },
    h('div', { class: 'p-entry-top' }, h('strong', {}, b.title), b.right && h('span', { class: 'p-right' }, b.right)),
    b.sub && h('div', { class: 'p-sub' }, b.sub),
    b.bullets.length > 0 && bulletsEl(b.bullets));
}

