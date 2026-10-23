/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Shared ATS report renderer: compact (builder side panel) and full (ATS checker page) */
const fmtPts = (n) => String(Math.round(n * 10) / 10);

function renderAtsReport(box, r, opts = {}) {
  const compact = !!opts.compact;
  const STATUS = { pass: 'Passed', warn: 'Needs attention', fail: 'Missing', na: 'Not measured' };
  const radius = 50; const circ = 2 * Math.PI * radius;
  const still = opts.animate === false;
  const wasOpen = box.querySelector('.all-checks') ? box.querySelector('.all-checks').open : false;

  const ring = h('div', { class: 'ring', role: 'img', 'aria-label': `ATS score ${r.score} out of 100` });
  ring.innerHTML = `<svg viewBox="0 0 120 120" width="128" height="128" aria-hidden="true"><circle cx="60" cy="60" r="${radius}" class="ring-track"/><circle cx="60" cy="60" r="${radius}" class="ring-fill" stroke-dasharray="${circ}" stroke-dashoffset="${still ? circ * (1 - r.score / 100) : circ}" transform="rotate(-90 60 60)"/></svg><div class="ring-num"><strong>${still ? r.score : 0}</strong><span>/ 100</span></div>`;
  const fill = ring.querySelector('.ring-fill'); const num = ring.querySelector('strong');
  if (!still) requestAnimationFrame(() => {
    fill.style.strokeDashoffset = circ * (1 - r.score / 100);
    const t0 = performance.now(); const dur = opts.animate === false ? 0 : 900;
    const step = (now) => { const p = dur ? Math.min(1, (now - t0) / dur) : 1; num.textContent = Math.round(r.score * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });

  const cat = (k) => {
    const c = r.categories[k]; const locked = c.max === 0;
    return h('div', { class: 'cat' },
      h('div', { class: 'cat-top' }, h('span', { class: 'cat-name' }, `${c.label} (${c.possible} pts)`), h('span', { class: 'cat-pts' }, locked ? 'Needs a job description' : c.max < c.possible ? `${fmtPts(c.earned)} / ${c.max} measured` : `${fmtPts(c.earned)} / ${c.max}`)),
      h('div', { class: 'bar', 'aria-hidden': 'true' }, h('i', { class: locked ? 'locked' : '', style: `width:${locked ? 0 : (c.earned / c.max) * 100}%` })));
  };

  const fixesN = compact ? 3 : 8;
  const fixList = r.fixes.slice(0, fixesN);
  const fixes = h('section', { class: 'ats-group', 'aria-label': 'Biggest fixes' },
    h('h3', { class: 'subhead' }, 'Fix these first'),
    fixList.length ? h('ol', { class: 'fixes' }, fixList.map((f) => h('li', {}, h('span', { class: 'gain' }, `+${fmtPts(f.gain)}`), h('div', {}, h('strong', {}, f.label), h('p', {}, f.fix)))))
      : h('p', { class: 'muted' }, 'Nothing left to fix against this checklist.'));

  const kwBlock = () => {
    if (!r.hasJd) {
      return h('section', { class: 'ats-group', 'aria-label': 'Keywords' }, h('h3', { class: 'subhead' }, 'Job description keywords'),
        h('div', { class: 'empty-inline' }, h('p', {}, 'Paste a job post (and its exact job title) to unlock the 40-point Keywords category.'),
          opts.onAddJob && h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: opts.onAddJob }, 'Add a job description')));
    }
    const k = r.keywords;
    if (compact) {
      const miss = k.terms.filter((t) => !t.count);
      return h('section', { class: 'ats-group', 'aria-label': 'Keywords' }, h('h3', { class: 'subhead' }, 'Job description keywords'),
        h('p', { class: 'chip-label' }, `Found (${k.matched.length})`),
        h('ul', { class: 'chips' }, k.matched.length ? k.matched.map((t) => h('li', { class: 'chip chip-yes' }, t)) : h('li', { class: 'muted' }, 'None yet')),
        h('p', { class: 'chip-label' }, `Missing (${miss.length})`),
        h('ul', { class: 'chips' }, miss.length ? miss.map((t) => h('li', {}, opts.onAddKeyword
          ? h('button', { type: 'button', class: 'chip chip-no chip-btn', title: 'Add to Skills (only if true for you)', onclick: () => opts.onAddKeyword(t.term) }, `+ ${t.term}`)
          : h('span', { class: 'chip chip-no' }, t.term))) : h('li', { class: 'muted' }, 'Nothing missing')),
        h('p', { class: 'hint' }, 'Click a missing term to add it to Skills with the posting\'s exact wording. Only keep terms that are true for you, and also use them in your Summary and Work Experience bullets.'));
    }
    const place = (t) => ['summary', 'skills', 'experience'].filter((s) => t.sections[s]).map((s) => ({ summary: 'Summary', skills: 'Skills', experience: 'Experience' }[s])).join(', ') || '\u2013';
    return h('section', { class: 'ats-group', 'aria-label': 'Keywords' },
      h('h3', { class: 'subhead' }, 'Keyword match (exact phrases)'),
      h('p', { class: 'hint' }, 'Top terms from the job description. A term only counts when your resume uses the exact phrase.'),
      h('div', { class: 'table-wrap kw-table' }, h('table', {},
        h('thead', {}, h('tr', {}, ['Keyword', 'In posting', 'In resume', 'Status', 'Found in'].map((x) => h('th', { scope: 'col' }, x)))),
        h('tbody', {}, k.terms.map((t) => h('tr', {},
          h('th', { scope: 'row' }, t.term),
          h('td', {}, `${t.jdCount}x`), h('td', {}, `${t.count}x`),
          h('td', {}, h('span', { class: `pill pill-${t.status}` }, t.status === 'exact' ? (t.vkind === 'prefix' ? 'Exact (see note)' : 'Exact match') : t.status === 'variant' ? 'Different wording' : 'Missing'),
            t.variant && h('div', { class: 'vnote' }, t.vkind === 'prefix' ? `Written as "${t.variant}". Drop the extra word.` : `You wrote "${t.variant}". Use "${t.term}".`)),
          h('td', {}, place(t))))))),
      k.acronyms && k.acronyms.length > 0 && h('div', { class: 'acro' },
        h('h3', { class: 'subhead' }, 'Acronyms and full terms'),
        h('ul', { class: 'chips' }, k.acronyms.map((a) => h('li', { class: `chip ${a.ok ? 'chip-yes' : 'chip-no'}` }, a.ok ? `${a.full} (${a.acr})` : `Write: ${a.full} (${a.acr})`)))),
      k.over && k.over.length > 0 && h('p', { class: 'hint warn-note' }, `Repeated too often: ${k.over.map((o) => `${o.term} (${o.count}x)`).join(', ')}. Two or three mentions is enough.`));
  };

  const groups = ['keywords', 'formatting', 'content'];
  const checkList = h('div', { class: 'check-groups' }, groups.map((g) => h('section', { class: 'ats-group', 'aria-label': r.categories[g].label },
    h('h3', { class: 'subhead' }, r.categories[g].label),
    h('ul', { class: 'checks' }, r.checks.filter((c) => c.cat === g).map((c) => h('li', { class: `check check-${c.status}` },
      h('span', { class: 'check-mark' }, ico(c.status === 'pass' ? 'check' : c.status === 'na' ? 'minus' : c.status === 'warn' ? 'alert' : 'x', 14)),
      h('div', { class: 'check-body' }, h('p', { class: 'check-title' }, c.label, h('span', { class: 'sr-only' }, ` ${STATUS[c.status]}`)), h('p', { class: 'check-detail' }, c.detail)),
      h('span', { class: 'check-pts' }, c.factor === null ? 'n/a' : `${fmtPts(c.max * c.factor)}/${c.max}`)))))));

  const parts = [
    h('div', { class: 'ats-top' }, ring, h('div', {}, h('p', { class: 'ats-label' }, scoreLabel(r.score)),
      h('p', { class: 'muted' }, r.fixes.length ? `${r.fixes.length} thing${r.fixes.length === 1 ? '' : 's'} to improve.` : 'Every check passed.'))),
    h('div', { class: 'cats' }, groups.map(cat)),
    !r.hasJd && h('p', { class: 'notice' }, ico('alert', 16), h('span', {}, 'Not tailored yet. Without a job description the 40 Keyword points are skipped, so this score covers the other 60 points scaled to 100. Add a job description and the exact job title for the full score.')),
    h('p', { class: 'hint ats-note' }, ico('shield', 14), h('span', {}, 'This is a transparent estimate against ATS best practices. Real applicant tracking systems do not publish how they score, so no tool can give you an exact employer score.')),
    fixes,
    kwBlock(),
    compact ? h('details', { class: 'all-checks' }, h('summary', {}, `All ${r.checks.length} checks`), checkList) : checkList,
    compact && h('a', { class: 'btn btn-quiet btn-sm full-link', href: 'ats-checker.html' }, 'Open the full ATS checker ', h('span', { class: 'arrow' }, ico('arrow', 14))),
  ];
  box.replaceChildren(...parts.flat(Infinity).filter(Boolean));
  if (wasOpen) { const d = box.querySelector('.all-checks'); if (d) d.open = true; }
}

function reportAsText(r, title = '') {
  const lines = [`ATS score: ${r.score}/100 (${scoreLabel(r.score)})${r.tailored ? '' : ' - not tailored to a job description'}`, ''];
  Object.values(r.categories).forEach((c) => lines.push(`${c.label}: ${c.max ? `${fmtPts(c.earned)}/${c.max}` : 'needs a job description'}`));
  if (title) lines.push('', `Target title: ${title}`);
  if (r.fixes.length) { lines.push('', 'Fix first:'); r.fixes.slice(0, 8).forEach((f, i) => lines.push(`${i + 1}. [+${fmtPts(f.gain)}] ${f.label}: ${f.fix}`)); }
  if (r.keywords) { lines.push('', `Keywords found: ${r.keywords.matched.join(', ') || 'none'}`, `Keywords missing: ${r.keywords.missing.join(', ') || 'none'}`); }
  return lines.join('\n');
}
