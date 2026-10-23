/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* ATS checker page: score a saved resume, pasted text or an uploaded .docx/.txt against a job post. Everything runs in the browser. */
(() => {
  'use strict';
  const saved = loadResume();
  const st = { src: saved ? 'saved' : 'paste', fileText: '', fileMeta: null, fileName: '' };
  const results = $('#results');
  let lastReport = null;

  // ---------- source switching ----------
  const panels = { saved: $('#src-saved'), paste: $('#src-paste'), upload: $('#src-upload') };
  function setSource(src) {
    st.src = src;
    Object.entries(panels).forEach(([k, el]) => { el.hidden = k !== src; });
    document.querySelectorAll('.opt').forEach((l) => l.classList.toggle('on', l.querySelector('input').value === src));
    document.querySelector(`input[name=src][value=${src}]`).checked = true;
  }
  document.querySelectorAll('input[name=src]').forEach((r) => r.addEventListener('change', () => setSource(r.value)));

  const note = $('#saved-note');
  if (saved && (saved.personal.name || saved.summary || saved.experience.length)) {
    const words = documentText(buildDocument(saved)).split(/\s+/).filter(Boolean).length;
    note.innerHTML = '';
    note.append(h('p', {}, h('strong', {}, saved.personal.name || 'Your saved resume'), ` is ready to check (about ${words} words, ${(TEMPLATES[saved.templateId] || TEMPLATES.classic).name} template).`),
      h('p', { class: 'hint' }, 'The job description and title you enter here are also saved to your resume in the builder.'));
    $('#c-jd').value = saved.jobDescription || '';
    $('#c-title').value = saved.targetTitle || '';
  } else {
    note.append(h('p', {}, 'No saved resume was found in this browser.'),
      h('p', { class: 'hint' }, 'Create one in the ', h('a', { href: 'builder.html' }, 'builder'), ', or choose Paste text or Upload. If you opened these files directly from your computer, some browsers keep storage separate for each page; serving the folder with a local web server fixes that.'));
    st.src = 'paste';
  }
  setSource(st.src);

  // ---------- upload ----------
  const fileInput = $('#c-file');
  async function handleFile(file) {
    if (!file) return;
    const out = $('#file-status');
    try {
      if (file.size > 5000000) throw new Error('That file is larger than 5 MB.');
      if (/\.docx$/i.test(file.name)) {
        const d = await readDocx(file);
        st.fileText = d.text; st.fileMeta = d.meta;
      } else if (/\.(txt|md)$/i.test(file.name) || file.type === 'text/plain') {
        st.fileText = await file.text(); st.fileMeta = { source: 'text' };
      } else if (/\.pdf$/i.test(file.name)) {
        throw new Error('PDF files cannot be read here. Open the PDF, copy its text, and use Paste text. (A PDF you download from the builder can be checked by choosing My saved resume.)');
      } else throw new Error('Please choose a .docx or .txt file.');
      st.fileName = file.name;
      out.className = 'file-status ok'; out.textContent = `${file.name} loaded (${st.fileText.split(/\s+/).filter(Boolean).length} words).`;
    } catch (err) {
      st.fileText = ''; st.fileMeta = null; st.fileName = '';
      out.className = 'file-status bad'; out.textContent = err.message || 'Could not read that file.';
    }
  }
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) { setSource('upload'); handleFile(f); } });

  // ---------- run ----------
  function showError(msg) {
    results.replaceChildren(h('div', { class: 'notice bad', role: 'alert' }, ico('alert', 16), h('span', {}, msg)));
  }
  function run() {
    const jd = $('#c-jd').value; const title = $('#c-title').value;
    let parsed;
    if (st.src === 'saved') {
      if (!saved) { showError('No saved resume was found. Use Paste text or Upload instead, or build one first.'); return; }
      saved.jobDescription = jd; saved.targetTitle = title; saveResume(saved);
      parsed = parseResumeObject(saved);
    } else if (st.src === 'paste') {
      const t = $('#c-text').value;
      if (t.trim().split(/\s+/).length < 40) { showError('Paste the full text of your resume (at least a few lines) so it can be checked.'); $('#c-text').focus(); return; }
      parsed = parsePlainText(t, { source: 'text' });
    } else {
      if (!st.fileText) { showError('Choose a .docx or .txt file first.'); return; }
      parsed = parsePlainText(st.fileText, st.fileMeta);
    }
    if (jd.trim() && jd.trim().length < 40) { showError('The job description looks very short. Paste the full posting for a meaningful keyword check, or clear it to skip keywords.'); return; }
    lastReport = scoreParsed(parsed, { jd, title });
    const box = h('div', { class: 'report' });
    results.replaceChildren(h('div', { class: 'glass report-card' }, h('div', { class: 'report-head' }, h('h2', {}, 'Your ATS report'),
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn btn-quiet btn-sm', id: 'copy-report' }, ico('copy', 14), 'Copy summary'))), box));
    renderAtsReport(box, lastReport, { compact: false, onAddJob: () => $('#c-jd').focus() });
    $('#copy-report').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(reportAsText(lastReport, title)); notify('Report summary copied.'); }
      catch { notify('Could not copy automatically.', { type: 'error' }); }
    });
    results.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  $('#run').addEventListener('click', run);

  $('#example').addEventListener('click', () => {
    const s = sampleResume();
    $('#c-text').value = documentText(buildDocument(s));
    $('#c-title').value = 'Frontend Engineer';
    $('#c-jd').value = `Frontend Engineer (React)\nWe are looking for a Frontend Engineer to build accessible web applications using React and TypeScript. You will collaborate with designers and backend teams, write unit tests with Jest, and improve web performance.\nRequirements:\n- 3+ years building single-page applications with React, TypeScript and Redux\n- Experience with Playwright or Cypress for end-to-end testing\n- Knowledge of web accessibility (WCAG) and performance optimization\n- Familiarity with CI/CD pipelines, GitHub Actions and Node.js\n- Comfortable working with REST APIs and GraphQL\nNice to have: Next.js, Figma, Search Engine Optimization (SEO), Key Performance Indicators (KPIs).`;
    setSource('paste');
    notify('Example loaded. Press Check my resume.');
  });
})();
