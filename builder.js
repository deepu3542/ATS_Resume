/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Builder page logic */
(() => {
  'use strict';
  // ---------- state ----------
  let resume = loadResume() || sampleResume();
  const ui = { tab: 'contact', pane: 'edit', closed: new Set(), status: 'idle', busy: false };
  const TABS = [['contact', 'Contact'], ['summary', 'Summary'], ['experience', 'Experience'], ['education', 'Education'],
    ['skills', 'Skills'], ['projects', 'Projects'], ['match', 'Job match'], ['more', 'More']];

  // ---------- ATS panel (shared renderer) ----------
  function addKeyword(term) {
    const before = clone(resume.skills);
    if (!resume.skills.length) resume.skills.push(emptySkillGroup());
    const g = resume.skills[0];
    if (!g.label) g.label = 'Skills';
    g.items = g.items.trim() ? `${g.items.trim().replace(/[,\s]+$/, '')}, ${term}` : term;
    if (ui.tab === 'skills') renderPanel();
    update();
    notify(`Added "${term}" to Skills. Keep it only if it is true for you.`, { action: { label: 'Undo', onClick: () => { resume.skills = before; if (ui.tab === 'skills') renderPanel(); update(); } } });
  }
  function renderAts(a) {
    renderAtsReport($('#ats-body'), a, { compact: true, animate: false, onAddJob: () => { setTab('match'); setPane('edit'); }, onAddKeyword: addKeyword });
  }

  // ---------- editor fields ----------
  let fieldSeq = 0;
  function field({ label, bind, list, id, prop, value, type = 'text', multiline, rows = 3, hint, wide, placeholder, autocomplete, inputmode, review }) {
    const fid = `f${++fieldSeq}`;
    const attrs = { id: fid, placeholder, autocomplete, inputmode, 'data-bind': bind, 'data-list': list, 'data-id': id, 'data-prop': prop,
      'aria-describedby': hint ? `${fid}-h` : undefined, value };
    const input = multiline ? h('textarea', { rows, ...attrs }) : h('input', { type, ...attrs });
    if (review) input.dataset.review = '1';
    return h('div', { class: `field${wide ? ' field-wide' : ''}` }, h('label', { for: fid }, label), input,
      hint && h('p', { class: 'hint', id: `${fid}-h` }, hint));
  }
  const personalField = (key, label, extra = {}) => field({ label, bind: `personal.${key}`, value: resume.personal[key], ...extra });

  // Writing review (on-device suggestions) attached under a bullets textarea.
  function reviewHost(ta) {
    const host = h('div', { class: 'review-host' });
    host.__ta = ta;
    renderReview(host);
    return host;
  }
  function renderReview(host) {
    const ta = host.__ta;
    const wasOpen = host.querySelector('details')?.open;
    const all = reviewBullets(ta.value).filter((x) => x.review);
    const items = all.filter((x) => x.review.issues.length);
    host.replaceChildren();
    if (!all.length) return;
    if (!items.length) { host.append(h('p', { class: 'review-ok' }, ico('check', 15), 'Every bullet starts with an action verb and includes a number.')); return; }
    const trim = (s, n) => (s.length > n ? `${s.slice(0, n)}...` : s);
    const det = h('details', { class: 'review' },
      h('summary', {}, ico('spark', 15), h('span', {}, `${items.length} of ${all.length} bullets can be stronger`), ico('chevron', 15)),
      h('ul', {}, items.map(({ index, review }) => h('li', {},
        h('p', { class: 'review-line' }, trim(review.text, 90)),
        h('ul', { class: 'review-issues' }, review.issues.map((m) => h('li', {}, m))),
        review.rewrite && h('button', { type: 'button', class: 'btn btn-quiet btn-sm', onclick: () => {
          const next = ta.value.split(/\r?\n/); next[index] = review.rewrite; ta.value = next.join('\n');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        } }, `Use: ${trim(review.rewrite, 70)}`)))),
      h('p', { class: 'hint' }, 'Suggestions come from simple rules that run in your browser. They are prompts, not rewrites of your facts.'));
    if (wasOpen) det.open = true;
    host.append(det);
  }
  function bulletsField(opts) {
    const f = field({ ...opts, multiline: true, review: true });
    return [f, reviewHost(f.querySelector('textarea'))];
  }

  // Repeating-entry list (roles, schools, skill groups, projects)
  function listSection({ key, make, addLabel, noun, titleOf, emptyText, body }) {
    const items = resume[key];
    const wrap = h('div', { class: 'list' });
    if (!items.length) wrap.append(h('p', { class: 'empty-inline' }, emptyText));
    items.forEach((item, i) => {
      const title = titleOf(item) || `New ${noun.toLowerCase()}`;
      const closed = ui.closed.has(item.id);
      const move = (d) => { const j = i + d; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; renderPanel(); update(); };
      const remove = () => {
        const before = clone(items);
        resume[key] = items.filter((_, k) => k !== i);
        renderPanel(); update();
        notify(`${noun} removed`, { action: { label: 'Undo', onClick: () => { resume[key] = before; renderPanel(); update(); } } });
      };
      wrap.append(h('section', { class: 'item', 'aria-label': title },
        h('div', { class: 'item-head' },
          h('button', { type: 'button', class: 'item-title', 'aria-expanded': String(!closed), onclick: () => { closed ? ui.closed.delete(item.id) : ui.closed.add(item.id); renderPanel(); } },
            h('span', { class: `chev${closed ? '' : ' open'}` }, ico('chevron', 16)), h('span', { 'data-title-for': item.id }, title)),
          h('div', { class: 'item-tools' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${title} up`, disabled: i === 0, onclick: () => move(-1) }, ico('up', 16)),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move ${title} down`, disabled: i === items.length - 1, onclick: () => move(1) }, ico('down', 16)),
            h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': `Remove ${title}`, onclick: remove }, ico('trash', 16)))),
        !closed && h('div', { class: 'item-body' }, body(item))));
    });
    wrap.append(h('button', { type: 'button', class: 'btn btn-quiet add-btn', onclick: () => { const n = make(); resume[key].push(n); renderPanel(); update(); } }, ico('plus', 16), addLabel));
    wrap.__titleOf = { key, titleOf, noun };
    return wrap;
  }
  const lf = (key, item, prop, label, extra = {}) => field({ label, list: key, id: item.id, prop, value: item[prop], ...extra });

  // ---------- tab panels ----------
  const panels = {
    contact: () => h('div', { class: 'grid' },
      personalField('name', 'Full name', { autocomplete: 'name' }),
      personalField('title', 'Professional title', { placeholder: 'e.g. Data Analyst', autocomplete: 'organization-title' }),
      personalField('email', 'Email', { type: 'email', inputmode: 'email', autocomplete: 'email' }),
      personalField('phone', 'Phone', { type: 'tel', inputmode: 'tel', autocomplete: 'tel' }),
      personalField('location', 'Location', { placeholder: 'City, Country', autocomplete: 'address-level2' }),
      personalField('website', 'Website or portfolio', { placeholder: 'yourname.dev', autocomplete: 'url' }),
      personalField('linkedin', 'LinkedIn', { placeholder: 'linkedin.com/in/yourname', wide: true })),

    summary: () => {
      const words = () => (resume.summary.trim() ? resume.summary.trim().split(/\s+/).length : 0);
      return h('div', {},
        field({ label: 'Professional summary', bind: 'summary', value: resume.summary, multiline: true, rows: 6, hint: `${words()} words. Two to three sentences, 25 to 90 words, works well.` }),
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => {
          const before = resume.summary; resume.summary = draftSummary(resume); renderPanel(); update();
          notify('Summary drafted from your details', { action: { label: 'Undo', onClick: () => { resume.summary = before; renderPanel(); update(); } } });
        } }, ico('spark', 16), 'Draft from my details'),
        h('p', { class: 'hint' }, 'The draft uses your title, latest employer and top skills. Rewrite it in your own voice.'));
    },

    experience: () => listSection({
      key: 'experience', make: emptyExperience, addLabel: 'Add role', noun: 'Role',
      emptyText: 'No roles yet. Internships, freelance work and volunteering all count.',
      titleOf: (e) => [e.role, e.company].filter(Boolean).join(' at '),
      body: (e) => [
        h('div', { class: 'grid' },
          lf('experience', e, 'role', 'Job title'), lf('experience', e, 'company', 'Company'), lf('experience', e, 'location', 'Location'),
          lf('experience', e, 'start', 'Start date', { placeholder: 'Jun 2022' }),
          !e.current && lf('experience', e, 'end', 'End date', { placeholder: 'Aug 2024' }),
          h('div', { class: 'check-row' },
            h('input', { type: 'checkbox', id: `cur-${e.id}`, 'data-list': 'experience', 'data-id': e.id, 'data-prop': 'current', checked: e.current }),
            h('label', { for: `cur-${e.id}` }, 'I currently work here'))),
        bulletsField({ label: 'Achievements, one per line', list: 'experience', id: e.id, prop: 'bullets', value: e.bullets, rows: 6, hint: 'Start each line with an action verb and include a number where you can.' })],
    }),

    education: () => listSection({
      key: 'education', make: emptyEducation, addLabel: 'Add education', noun: 'Education', emptyText: 'No education added yet.',
      titleOf: (e) => [e.degree, e.school].filter(Boolean).join(', '),
      body: (e) => h('div', { class: 'grid' },
        lf('education', e, 'school', 'School', { wide: true }), lf('education', e, 'degree', 'Degree', { placeholder: 'B.Tech' }),
        lf('education', e, 'field', 'Field of study'), lf('education', e, 'location', 'Location'),
        lf('education', e, 'start', 'Start year', { placeholder: '2018' }), lf('education', e, 'end', 'End year', { placeholder: '2022 or Expected 2026' }),
        lf('education', e, 'details', 'Details, one per line', { multiline: true, wide: true, hint: 'Grades, honors, relevant coursework.' })),
    }),

    skills: () => listSection({
      key: 'skills', make: emptySkillGroup, addLabel: 'Add skill group', noun: 'Skill group',
      emptyText: 'Group your skills, for example Languages, Tools, or Methods.', titleOf: (s) => s.label,
      body: (s) => h('div', { class: 'grid' },
        lf('skills', s, 'label', 'Group name', { placeholder: 'Languages', wide: true }),
        lf('skills', s, 'items', 'Skills', { placeholder: 'Python, SQL, Tableau', wide: true, hint: 'Separate with commas. Use the exact names job posts use.' })),
    }),

    projects: () => listSection({
      key: 'projects', make: emptyProject, addLabel: 'Add project', noun: 'Project',
      emptyText: 'Projects help most when you have limited work history.', titleOf: (x) => x.name,
      body: (x) => [
        h('div', { class: 'grid' }, lf('projects', x, 'name', 'Project name'), lf('projects', x, 'link', 'Link', { placeholder: 'github.com/you/project' })),
        bulletsField({ label: 'What you built, one point per line', list: 'projects', id: x.id, prop: 'bullets', value: x.bullets, rows: 4 })],
    }),

    match: () => h('div', {},
      field({ label: 'Target job title (exactly as written in the posting)', bind: 'targetTitle', value: resume.targetTitle, placeholder: 'e.g. Frontend Engineer',
        hint: 'Using the exact title in your header title or summary can add many points, but only if it honestly describes you.' }),
      field({ label: 'Job description', bind: 'jobDescription', value: resume.jobDescription, multiline: true, rows: 12, placeholder: 'Paste the full job post here.',
        hint: 'ATS Resume picks the top terms from the post and checks that your resume uses the exact same phrasing. This stays on your device.' }),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => setPane('score') }, ico('gauge', 16), 'See keyword match'),
        h('a', { class: 'btn btn-quiet', href: 'ats-checker.html' }, 'Open full ATS checker')),
      h('ul', { class: 'tips' },
        h('li', {}, 'Copy phrases exactly. "Power BI" is not "MS Power BI" or "PowerBI".'),
        h('li', {}, 'Use 8 to 15 posting keywords, spread across Summary, Skills and Work Experience bullets.'),
        h('li', {}, 'Write both forms of acronyms, like Search Engine Optimization (SEO).'),
        h('li', {}, 'Mention a key term two or three times at most. More looks like keyword stuffing.'),
        h('li', {}, 'Tailor each application: the exact job title and top 3 keywords make the biggest difference.'))),

    more: () => {
      const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'Import a saved resume backup file' });
      const replaceAll = (next, msg) => {
        const before = clone(resume);
        resume = next; renderPanel(); renderTemplateControls(); update();
        notify(msg, { action: { label: 'Undo', onClick: () => { resume = before; renderPanel(); renderTemplateControls(); update(); } } });
      };
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0]; fileInput.value = '';
        if (!file) return;
        try {
          if (file.size > 2000000) throw new Error('That file is larger than 2 MB.');
          replaceAll(parseImportedJson(await file.text()), `Imported ${file.name}`);
        } catch (err) { notify(err.message || 'Could not import that file.', { type: 'error' }); }
      });
      const keep = { templateId: resume.templateId, paper: resume.paper };
      return h('div', { class: 'more' },
        field({ label: 'Certifications, one per line', bind: 'certifications', value: resume.certifications, multiline: true, rows: 4 }),
        h('h3', { class: 'subhead' }, 'Your data'),
        h('p', { class: 'hint' }, 'Everything is stored in this browser only. Export a file to back it up or move to another device.'),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { exportJson(resume); notify('Backup downloaded'); } }, ico('download', 16), 'Export backup'),
          h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => fileInput.click() }, ico('upload', 16), 'Import backup'), fileInput),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => replaceAll({ ...sampleResume(), ...keep }, 'Sample resume loaded') }, ico('file', 16), 'Load sample resume'),
          h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => replaceAll({ ...emptyResume(), ...keep }, 'Resume cleared') }, ico('plus', 16), 'Start blank')),
        h('button', { type: 'button', class: 'btn btn-danger', onclick: () => { clearSaved(); notify('Saved copy deleted. Editing again will save a new copy.'); } }, ico('trash', 16), 'Delete saved copy'));
    },
  };

  function renderTabs() {
    const bar = $('#tabs');
    bar.replaceChildren(...TABS.map(([id, label], i) => h('button', {
      type: 'button', role: 'tab', id: `tab-${id}`, class: 'tab', 'aria-selected': String(ui.tab === id), 'aria-controls': 'tab-panel', tabindex: ui.tab === id ? '0' : '-1',
      onclick: () => setTab(id),
      onkeydown: (e) => {
        let j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % TABS.length; else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = TABS.length - 1;
        if (j !== null) { e.preventDefault(); setTab(TABS[j][0]); $(`#tab-${TABS[j][0]}`).focus(); }
      },
    }, label)));
  }
  function setTab(id) { ui.tab = id; renderTabs(); renderPanel(); $(`#tab-${id}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  function renderPanel() {
    const panel = $('#tab-panel');
    panel.setAttribute('aria-labelledby', `tab-${ui.tab}`);
    panel.replaceChildren(panels[ui.tab]());
  }

  // Delegated input handling: update state in place so typing never loses focus.
  function readBind(t) {
    const d = t.dataset;
    const val = t.type === 'checkbox' ? t.checked : t.value;
    if (d.list) {
      const item = resume[d.list].find((x) => x.id === d.id);
      if (!item) return;
      item[d.prop] = val;
      const holder = t.closest('.item');
      if (holder) {
        const titleEl = holder.querySelector(`[data-title-for="${d.id}"]`);
        if (titleEl) {
          const fns = { experience: (e) => [e.role, e.company].filter(Boolean).join(' at '), education: (e) => [e.degree, e.school].filter(Boolean).join(', '),
            skills: (s) => s.label, projects: (x) => x.name };
          const noun = { experience: 'role', education: 'education', skills: 'skill group', projects: 'project' }[d.list];
          titleEl.textContent = fns[d.list](item) || `New ${noun}`;
        }
      }
    } else if (d.bind) {
      const path = d.bind.split('.');
      if (path.length === 2) resume[path[0]][path[1]] = val; else resume[path[0]] = val;
    }
  }
  $('#tab-panel').addEventListener('input', (e) => {
    const t = e.target;
    if (!t.dataset.bind && !t.dataset.list) return;
    readBind(t);
    if (t.dataset.review) { const host = t.closest('.field').nextElementSibling; if (host && host.__ta) renderReview(host); }
    if (t.dataset.bind === 'summary') {
      const n = resume.summary.trim() ? resume.summary.trim().split(/\s+/).length : 0;
      const hint = t.parentElement.querySelector('.hint'); if (hint) hint.textContent = `${n} words. Two to three sentences, 25 to 90 words, works well.`;
    }
    update();
  });
  $('#tab-panel').addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' && e.target.dataset.prop === 'current') { readBind(e.target); renderPanel(); update(); }
  });

  // ---------- template + paper controls ----------
  function renderTemplateControls() {
    const box = $('#templates');
    box.querySelectorAll('.tpl').forEach((n) => n.remove());
    TEMPLATE_LIST.forEach((t) => {
      const on = resume.templateId === t.id;
      box.append(h('label', { class: `tpl${on ? ' on' : ''}` },
        h('input', { type: 'radio', name: 'template', value: t.id, checked: on, onchange: () => { resume.templateId = t.id; renderTemplateControls(); update(); } }),
        h('span', { class: `tpl-thumb tpl-${t.id}`, 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
        h('span', { class: 'tpl-name' }, t.name), h('span', { class: 'tpl-blurb' }, t.blurb)));
    });
    $('#paper-seg').replaceChildren(...Object.values(PAPERS).map((p) => h('button', {
      type: 'button', 'aria-pressed': String(resume.paper === p.id), onclick: () => { resume.paper = p.id; renderTemplateControls(); update(); } }, p.label)));
  }

  // ---------- panes (small screens) ----------
  function setPane(p) {
    ui.pane = p;
    $('#view-builder').dataset.pane = p;
    $('#seg').querySelectorAll('button').forEach((b) => (b.dataset.id === p ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    requestAnimationFrame(() => builderPaper.layout());
  }
  function renderSeg() {
    $('#seg').replaceChildren(...[['edit', 'Edit', 'edit'], ['preview', 'Preview', 'eye'], ['score', 'Score', 'gauge']].map(([id, label, icon]) =>
      h('button', { type: 'button', class: `seg-${id}`, 'data-id': id, onclick: () => setPane(id) }, ico(icon, 18), h('span', {}, label),
        id === 'score' && h('b', { class: 'seg-badge', id: 'seg-score' }, '0'))));
  }

  // ---------- update loop ----------
  const builderPaper = mountPaper($('#paper-fit'), { onPages: (n) => { $('#pages').textContent = `${n} page${n > 1 ? 's' : ''} (approximate)`; } });
  let raf = 0, saveTimer = 0;
  const STATUS = { idle: 'Saved on this device after your first edit', saving: 'Saving...', saved: 'Saved on this device', error: 'Could not save. Storage may be full or blocked.' };
  function setStatus(s) { ui.status = s; const el = $('#save-status'); el.textContent = STATUS[s]; el.className = `save-status save-${s}`; }
  function update() {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      builderPaper.render(resume);
      const a = analyzeResume(resume);
      renderAts(a);
      const badge = $('#seg-score'); if (badge) badge.textContent = a.score;
    });
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => setStatus(saveResume(resume).ok ? 'saved' : 'error'), 450);
  }

  // ---------- download ----------
  $('#download').addEventListener('click', async () => {
    if (ui.busy) return;
    ui.busy = true; const btn = $('#download'); btn.disabled = true; $('#download-label').textContent = 'Creating PDF...';
    try { await downloadPdf(resume); notify('PDF downloaded. Text in it is selectable and searchable.'); }
    catch (err) { console.error(err); notify(err.message || 'The PDF could not be created. Try again.', { type: 'error' }); }
    finally { ui.busy = false; btn.disabled = false; $('#download-label').textContent = 'Download PDF'; }
  });
  $('#download').prepend(ico('download', 16));
  $('#download-docx').prepend(ico('file', 16));
  $('#download-docx').addEventListener('click', () => {
    try { downloadDocx(resume); notify('Word file downloaded. Use .docx when the posting allows it.'); }
    catch (err) { console.error(err); notify(err.message || 'The Word file could not be created.', { type: 'error' }); }
  });


  // ---------- boot ----------
  const params = new URLSearchParams(location.search);
  const wanted = params.get('template');
  if (wanted && TEMPLATES[wanted]) resume.templateId = wanted;
  renderTabs(); renderPanel(); renderSeg(); renderTemplateControls(); setStatus('idle'); setPane('edit');
  builderPaper.render(resume);
  { const a = analyzeResume(resume); renderAts(a); $('#seg-score').textContent = a.score; }
  if (wanted && TEMPLATES[wanted]) update();
})();
