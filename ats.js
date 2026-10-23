/* Copyright (c) 2026 ATS Resume. All rights reserved. */
const ACTION_VERBS = new Set((
  'accelerated achieved administered analyzed architected assembled audited authored automated boosted built calculated ' +
  'championed coached collaborated completed configured consolidated constructed contributed converted coordinated created ' +
  'cut debugged decreased delivered deployed designed developed directed drove eliminated enabled engineered enhanced established ' +
  'evaluated executed expanded facilitated founded generated guided identified implemented improved increased initiated integrated ' +
  'introduced investigated launched led maintained managed mentored migrated modernized monitored negotiated optimized organized ' +
  'orchestrated owned partnered piloted planned presented prioritized produced programmed reduced refactored released replaced ' +
  'researched resolved restructured reviewed scaled secured shipped simplified solved spearheaded standardized streamlined ' +
  'strengthened supervised supported tested trained transformed translated upgraded validated wrote ran won saved grew drafted ' +
  'documented operated oversaw performed processed prepared published recruited served taught tracked unified'
).split(' '));


/* =====================================================================
   ATS engine. A transparent, rule-based score built from the checklist:
     Keywords   40 pts  exact phrases, 8-15 matches, placement, acronyms, density, title
     Formatting 20 pts  single column, standard headings, standard font, contact in body, file type
     Content    40 pts  contact, work experience, education, skills, verbs, numbers, certifications
   Real applicant tracking systems do not publish how they score, so this is an
   estimate against best-practice rules, not a prediction of any employer's system.
   ===================================================================== */

const STOP = new Set((
  'a about above after again all also am an and any are as at be because been before being below between both but by can could did do does ' +
  'doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most ' +
  'my no nor not of off on once only or other our ours out over own same she should so some such than that the their theirs them then there ' +
  'these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours ' +
  'ability able across including include includes etc experience experienced strong work working works team teams role roles job position ' +
  'candidate candidates company looking seeking join years year plus preferred required requirements responsibilities qualifications ' +
  'knowledge skills skill using use used new within well must may need needs ideal opportunity benefits equal employer apply best good ' +
  'great excellent demonstrated proven related relevant like part full time ensure help helping support supporting responsible high ' +
  'based across various multiple e.g i.e eg ie per day days week weeks month months paid salary location remote hybrid onsite office ' +
  'looking seek hiring hire join us love passion passionate people environment growth career culture mission values diverse inclusive'
).split(' '));

const TOKEN_RE = /[A-Za-z0-9][A-Za-z0-9+#.]*[A-Za-z0-9+#]|[A-Za-z0-9]/g;
function tokenizeRich(text) {
  const out = [];
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m; let prevEnd = 0;
  while ((m = re.exec(text))) {
    const gap = text.slice(prevEnd, m.index);
    out.push({ t: m[0].toLowerCase(), o: m[0], i: m.index, end: m.index + m[0].length, brk: out.length === 0 || /[,;:!?()\[\]\n\r\u2022|]|\.(\s|$)/.test(gap) });
    prevEnd = m.index + m[0].length;
  }
  return out;
}
const stem = (w) => w.replace(/(ing|ed|es|s)$/, (m, _p, off) => (off >= 3 ? '' : m));
const tokensOf = (text) => tokenizeRich(text).map((x) => x.t);

function countPhrase(tokens, phrase) {
  const n = phrase.length; if (!n) return 0;
  let c = 0;
  for (let i = 0; i + n <= tokens.length; i += 1) {
    let ok = true;
    for (let j = 0; j < n; j += 1) if (tokens[i + j] !== phrase[j]) { ok = false; break; }
    if (ok) { c += 1; i += n - 1; }
  }
  return c;
}

/* ----- keyword extraction from a job description (phrases first, then single terms) ----- */
function extractKeywords(jd, limit = 15) {
  const toks = tokenizeRich(jd);
  const bad = (x) => STOP.has(x.t) || /^\d[\d+.,%]*$/.test(x.t) || x.t.length < 2;
  const runs = []; let cur = [];
  toks.forEach((x) => {
    if (bad(x)) { if (cur.length) runs.push(cur); cur = []; return; }
    if (x.brk && cur.length) { runs.push(cur); cur = []; }
    cur.push(x);
  });
  if (cur.length) runs.push(cur);

  const cands = new Map();
  const special = (o) => /[a-z][A-Z]/.test(o) || /^[A-Z]{2,}[a-z]?s?$/.test(o) || /[+#]/.test(o) || /[a-z0-9]\.[a-z]/i.test(o);
  runs.forEach((run) => {
    for (let n = 1; n <= 3; n += 1) {
      for (let i = 0; i + n <= run.length; i += 1) {
        const w = run.slice(i, i + n);
        const key = w.map((x) => x.t).join(' ');
        const e = cands.get(key) || { key, tokens: w.map((x) => x.t), n, count: 0, display: jd.slice(w[0].i, w[w.length - 1].end), sp: false, caps: false };
        e.count += 1;
        if (w.some((x) => special(x.o))) e.sp = true;
        if (w.every((x) => /^[A-Z]/.test(x.o)) && (n > 1 || !w[0].brk)) e.caps = true;
        cands.set(key, e);
      }
    }
  });
  const SOLO_STOP = new Set(['key', 'build', 'write', 'review', 'drive', 'manage', 'lead', 'create', 'develop', 'design', 'maintain', 'provide', 'deliver']);
  const valid = [...cands.values()].filter((e) => {
    if (e.n === 1) return !SOLO_STOP.has(e.key) && (e.count >= 2 || e.sp || e.caps);
    return e.count >= 2 || e.caps;
  });
  valid.forEach((e) => { e.score = e.count * (e.n === 1 ? 1 : 1.6) + (e.sp ? 3 : 0) + (e.caps ? 2.5 : 0) + (e.n - 1) * 0.3; });
  valid.sort((a, b) => b.score - a.score || b.n - a.n || a.key.localeCompare(b.key));

  const picked = [];
  const contains = (big, small) => { for (let i = 0; i + small.length <= big.length; i += 1) { if (small.every((t, j) => big[i + j] === t)) return true; } return false; };
  for (const e of valid) {
    if (picked.length >= limit) break;
    if (picked.some((p) => (p.n > e.n && contains(p.tokens, e.tokens) && e.count <= p.count + 1) || (e.n > p.n && contains(e.tokens, p.tokens) && p.count <= e.count + 1))) continue;
    picked.push(e);
  }
  return picked.map((e) => ({ term: e.display.replace(/\s+/g, ' '), key: e.key, tokens: e.tokens, jdCount: e.count }));
}

/* ----- acronyms (use both the full term and the acronym) ----- */
const ACRONYMS = {
  SEO: 'Search Engine Optimization', SEM: 'Search Engine Marketing', KPI: 'Key Performance Indicators', CRM: 'Customer Relationship Management',
  ROI: 'Return on Investment', PPC: 'Pay-Per-Click', CMS: 'Content Management System', ERP: 'Enterprise Resource Planning', QA: 'Quality Assurance',
  SLA: 'Service Level Agreement', OKR: 'Objectives and Key Results', B2B: 'Business-to-Business', B2C: 'Business-to-Consumer', SaaS: 'Software as a Service',
  ETL: 'Extract, Transform, Load', NLP: 'Natural Language Processing', AWS: 'Amazon Web Services', SDLC: 'Software Development Life Cycle',
  CTR: 'Click-Through Rate', CPA: 'Cost Per Acquisition', EBITDA: 'Earnings Before Interest, Taxes, Depreciation and Amortization',
};
const CERT_ACRONYMS = {
  PMP: 'Project Management Professional', CAPM: 'Certified Associate in Project Management', CISSP: 'Certified Information Systems Security Professional',
  CISA: 'Certified Information Systems Auditor', CPA: 'Certified Public Accountant', CFA: 'Chartered Financial Analyst', CCNA: 'Cisco Certified Network Associate',
  CEH: 'Certified Ethical Hacker', CSM: 'Certified ScrumMaster', PSM: 'Professional Scrum Master', PHR: 'Professional in Human Resources', SPHR: 'Senior Professional in Human Resources',
  'SHRM-CP': 'SHRM Certified Professional', CSPO: 'Certified Scrum Product Owner', OSCP: 'Offensive Security Certified Professional',
};

function checkAcronyms(jdTok, resTok, resText) {
  const rows = [];
  Object.entries(ACRONYMS).forEach(([acr, full]) => {
    const a = acr.toLowerCase();
    const fullTok = tokensOf(full);
    const inJd = jdTok.length && (jdTok.includes(a) || jdTok.includes(`${a}s`) || countPhrase(jdTok, fullTok) > 0);
    const hasAcr = resTok.includes(a) || resTok.includes(`${a}s`);
    const hasFull = countPhrase(resTok, fullTok) > 0;
    if (!inJd && !(hasAcr || hasFull)) return;
    if (!jdTok.length && !hasAcr && !hasFull) return;
    rows.push({ acr, full, hasAcr, hasFull, ok: hasAcr && hasFull, inJd: !!inJd });
  });
  return rows;
}

/* ----- parsing a resume into the shape the scorer reads ----- */
const HEAD = {
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'career summary', 'objective', 'career objective'],
  experience: ['work experience', 'professional experience', 'experience', 'employment history', 'work history', 'employment'],
  education: ['education', 'academic background', 'education and training', 'academic qualifications'],
  skills: ['skills', 'technical skills', 'core competencies', 'key skills', 'skills and tools', 'skills summary'],
  certifications: ['certifications', 'certificates', 'licenses and certifications', 'certifications and licenses', 'licenses', 'certification'],
  projects: ['projects', 'personal projects', 'selected projects', 'academic projects'],
};
const NONSTANDARD = ['my journey', 'my story', 'about me', 'who i am', 'what i do', 'where i have worked', 'where ive worked', 'my experience', 'my skills',
  'my toolbox', 'toolbox', 'superpowers', 'career story', 'my background', 'things i know', 'what i know', 'the story so far', 'my adventures', 'my path', 'what i bring'];
const headKey = (line) => {
  const l = line.replace(/[&]/g, ' and ').replace(/[:\-_=*#•|]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!l || l.length > 40) return null;
  for (const [k, list] of Object.entries(HEAD)) if (list.includes(l)) return { key: k, standard: true, raw: line.replace(/[:\-_=*#•|]+/g, ' ').replace(/\s+/g, ' ').trim() };
  if (NONSTANDARD.includes(l.replace(/'/g, ''))) return { key: null, standard: false, raw: line.trim() };
  return null;
};
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const MONTHS = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE_LINE = new RegExp(`((${MONTHS}\\s+)?(19|20)\\d{2}\\s*(-|\\u2013|\\u2014|to)\\s*((${MONTHS}\\s+)?(19|20)\\d{2}|present|current|now))`, 'i');
const BULLET_RE = /^\s*([\u2022\u25CF\u25AA\u25E6*\-\u2013\u2014>]|\d+[.)])\s+/;
const bulletText = (l) => l.replace(BULLET_RE, '').trim();

function parsePlainText(text, meta = {}) {
  const raw = String(text || '').replace(/\r/g, '');
  const all = raw.split('\n').map((l) => l.trim());
  const sections = {}; const headings = [];
  let cur = '_header';
  sections._header = [];
  all.forEach((line) => {
    if (!line) return;
    const hk = line.length < 45 && !EMAIL_RE.test(line) ? headKey(line) : null;
    if (hk) { headings.push(hk); cur = hk.key || '_other'; if (!sections[cur]) sections[cur] = []; return; }
    (sections[cur] = sections[cur] || []).push(line);
  });
  const header = sections._header || [];
  const email = (raw.match(EMAIL_RE) || [''])[0];
  const pm = raw.match(PHONE_RE);
  const phone = pm && pm[0].replace(/\D/g, '').length >= 8 && pm[0].replace(/\D/g, '').length <= 15 ? pm[0].trim() : '';
  const name = header.find((l) => !EMAIL_RE.test(l) && !PHONE_RE.test(l) && l.split(/\s+/).length <= 5 && !/\d/.test(l)) || '';

  const isBullet = (l) => BULLET_RE.test(l);
  const expLines = sections.experience || [];
  const prjLines = sections.projects || [];
  const pickBullets = (arr) => {
    const marked = arr.filter(isBullet).map(bulletText);
    if (marked.length) return marked;
    return arr.filter((l) => l.split(/\s+/).length >= 6 && !DATE_LINE.test(l));
  };
  const roleLines = expLines.filter((l) => DATE_LINE.test(l) && !isBullet(l));
  const skillItems = (sections.skills || []).flatMap((l) => bulletText(l).replace(/^[^:]{1,30}:/, '').split(/[,|;\u2022]/)).map((x) => x.trim()).filter((x) => x && x.length < 40);
  return {
    name, email, phone, header,
    hasLocation: header.some((l) => /,\s*[A-Za-z]/.test(l) && !EMAIL_RE.test(l)) || /linkedin\.com/i.test(raw),
    sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.join('\n')])),
    present: { summary: !!(sections.summary || []).length, experience: !!expLines.length, education: !!(sections.education || []).length, skills: !!(sections.skills || []).length, certifications: !!(sections.certifications || []).length, projects: !!prjLines.length },
    headings,
    bullets: [...pickBullets(expLines), ...pickBullets(prjLines)],
    roles: roleLines.length ? roleLines.map(() => ({ hasDates: true })) : (expLines.length ? [{ hasDates: false }] : []),
    skillItems,
    certLines: (sections.certifications || []).map(bulletText).filter(Boolean),
    rawText: raw, meta: { source: 'text', ...meta },
  };
}

function parseResumeObject(resume) {
  const doc = buildDocument(resume);
  const T = TEMPLATES[resume.templateId] || TEMPLATES.classic;
  const sec = (k) => doc.sections.find((s) => s.key === k);
  const flat = (s) => (s ? s.blocks.map((b) => (b.type === 'text' ? b.text : b.type === 'skill' ? `${b.label}: ${b.text}` : b.type === 'bullets' ? b.bullets.join('\n') : [b.title, b.right, b.sub, ...b.bullets].filter(Boolean).join('\n'))).join('\n') : '');
  const entries = (k) => (sec(k) ? sec(k).blocks.filter((b) => b.type === 'entry') : []);
  return {
    name: doc.name, email: resume.personal.email.trim(), phone: resume.personal.phone.trim(), header: doc.contact, hasLocation: !!(resume.personal.location.trim() || resume.personal.linkedin.trim()),
    sections: Object.fromEntries(['summary', 'skills', 'experience', 'projects', 'education', 'certifications'].map((k) => [k, flat(sec(k))])),
    present: Object.fromEntries(['summary', 'skills', 'experience', 'projects', 'education', 'certifications'].map((k) => [k, !!sec(k)])),
    headings: doc.sections.map((s) => ({ raw: s.title, key: s.key, standard: true })),
    bullets: [...entries('experience'), ...entries('projects')].flatMap((e) => e.bullets),
    roles: entries('experience').map((e) => ({ hasDates: !!e.right })),
    skillItems: sec('skills') ? sec('skills').blocks.flatMap((b) => b.text.split(',')).map((x) => x.trim()).filter(Boolean) : [],
    certLines: sec('certifications') ? sec('certifications').blocks.flatMap((b) => b.bullets) : [],
    rawText: documentText(doc),
    summaryWords: resume.summary.trim() ? resume.summary.trim().split(/\s+/).length : 0,
    meta: { source: 'builder', layout: 'ok', fontFamily: T.font === 'times' ? 'Times New Roman' : 'Arial', fontSize: T.body, contactInBody: true, file: 'pdf+docx' },
  };
}

/* ----- scoring ----- */
const CAT = { keywords: 'Keywords', formatting: 'Formatting', content: 'Content' };
const STD_FONTS = ['arial', 'calibri', 'times new roman', 'helvetica', 'times'];

function scoreParsed(p, { jd = '', title = '' } = {}) {
  const checks = [];
  const add = (id, cat, label, max, factor, detail, fix) => {
    const f = factor === null ? null : Math.max(0, Math.min(1, factor));
    checks.push({ id, cat, group: CAT[cat], label, max, factor: f, status: f === null ? 'na' : f >= 0.999 ? 'pass' : f >= 0.5 ? 'warn' : 'fail', detail, fix: f !== null && f < 0.999 ? fix : '' });
  };
  const text = p.rawText;
  const resTok = tokenizeRich(text);
  const resT = resTok.map((x) => x.t);
  const words = (text.match(/\S+/g) || []).length;
  const hasJd = jd.trim().length >= 40;

  /* ===== KEYWORDS (40) ===== */
  let kw = null;
  if (!hasJd) {
    ['Keyword match rate', 'Keyword count', 'Keyword placement', 'Exact phrasing', 'Acronyms and full terms', 'Keyword density', 'Job title match']
      .forEach((l, i) => add(['kw-rate', 'kw-count', 'kw-place', 'kw-exact', 'kw-acro', 'kw-density', 'kw-title'][i], 'keywords', l, [17, 5, 6, 3, 3, 3, 3][i], null, 'Add a job description to measure this.', ''));
  } else {
    const terms = extractKeywords(jd);
    const secTok = { summary: tokensOf(p.sections.summary || ''), skills: tokensOf(p.sections.skills || ''), experience: tokensOf(`${p.sections.experience || ''}\n${p.sections.projects || ''}`) };
    const rows = terms.map((t) => {
      const count = countPhrase(resT, t.tokens);
      const row = { term: t.term, key: t.key, tokens: t.tokens, jdCount: t.jdCount, count, status: count ? 'exact' : 'missing', variant: '', sections: { summary: countPhrase(secTok.summary, t.tokens) > 0, skills: countPhrase(secTok.skills, t.tokens) > 0, experience: countPhrase(secTok.experience, t.tokens) > 0 } };
      const n = t.tokens.length; const compact = t.tokens.join(''); const kStem = t.tokens.map(stem).join(' ');
      for (let i = 0; i < resT.length && !row.variant; i += 1) {
        for (let len = 1; len <= n + 1 && i + len <= resT.length; len += 1) {
          const w = resT.slice(i, i + len);
          if (w.join('') === compact && w.join(' ') !== t.tokens.join(' ')) { row.variant = text.slice(resTok[i].i, resTok[i + len - 1].end); row.vkind = 'spelling'; break; }
          if (len === n && w.map(stem).join(' ') === kStem && w.join(' ') !== t.tokens.join(' ')) { row.variant = text.slice(resTok[i].i, resTok[i + len - 1].end); row.vkind = 'form'; break; }
        }
      }
      if (count && !['ms', 'microsoft'].includes(t.tokens[0])) {
        for (let i = 1; i + n <= resT.length; i += 1) {
          if (['ms', 'microsoft'].includes(resT[i - 1]) && t.tokens.every((x, j) => resT[i + j] === x)) { row.variant = text.slice(resTok[i - 1].i, resTok[i + n - 1].end); row.vkind = 'prefix'; break; }
        }
      }
      if (!count && row.variant) row.status = 'variant';
      return row;
    });
    const matched = rows.filter((r) => r.count > 0);
    const rate = rows.length ? matched.length / rows.length : 0;
    kw = { terms: rows, matched: matched.map((r) => r.term), missing: rows.filter((r) => !r.count).map((r) => r.term), rate };

    add('kw-rate', 'keywords', 'Keyword match rate', 17, Math.min(1, rate / 0.8),
      `${matched.length} of ${rows.length} top terms from the job description appear in your resume (${Math.round(rate * 100)}%).`,
      'Work the missing terms into your Skills and Work Experience bullets, using the exact wording from the posting, only where they are true.');
    const target = Math.min(8, rows.length);
    add('kw-count', 'keywords', 'Keyword count (8 to 15)', 5, target ? Math.min(1, matched.length / target) : 0,
      `${matched.length} matching keyword${matched.length === 1 ? '' : 's'}. The target is 8 to 15.`, 'Aim for at least 8 matching keywords from the posting.');
    const secScores = ['summary', 'skills', 'experience'].map((k) => { const c = rows.filter((r) => r.sections[k]).length; return { k, c, f: c >= 2 ? 1 : c === 1 ? 0.5 : 0 }; });
    const missingSec = secScores.filter((s) => s.f < 1).map((s) => ({ summary: 'Summary', skills: 'Skills', experience: 'Work Experience' }[s.k]));
    add('kw-place', 'keywords', 'Keywords in Summary, Skills and Experience', 6, secScores.reduce((n, s) => n + s.f, 0) / 3,
      `Matching keywords found: Summary ${secScores[0].c}, Skills ${secScores[1].c}, Work Experience ${secScores[2].c}. Aim for at least 2 in each.`,
      `Add more posting keywords to: ${missingSec.join(', ')}.`);
    const variants = rows.filter((r) => r.variant);
    add('kw-exact', 'keywords', 'Exact phrasing from the posting', 3, 1 - variants.length / 3,
      variants.length ? `Different wording found: ${variants.slice(0, 4).map((r) => `"${r.variant}" instead of "${r.term}"`).join('; ')}.` : 'No altered spellings of posting terms found.',
      'Copy the exact phrasing from the posting. If it says "Power BI", write "Power BI", not "MS Power BI" or "PowerBI".');
    const acr = checkAcronyms(tokensOf(jd), resT, text);
    kw.acronyms = acr;
    if (!acr.length) add('kw-acro', 'keywords', 'Acronyms and full terms', 3, null, 'No common acronyms found in the posting or your resume.', '');
    else add('kw-acro', 'keywords', 'Acronyms and full terms', 3, acr.filter((a) => a.ok).length / acr.length,
      `${acr.filter((a) => a.ok).length} of ${acr.length} acronym${acr.length === 1 ? '' : 's'} appear with the full term too.`,
      `Write both forms, for example: ${acr.filter((a) => !a.ok).slice(0, 3).map((a) => `${a.full} (${a.acr})`).join('; ')}.`);
    const over = rows.filter((r) => r.count > 3);
    kw.over = over.map((r) => ({ term: r.term, count: r.count }));
    add('kw-density', 'keywords', 'No keyword stuffing', 3, over.length ? 1 - over.length * 0.5 : 1,
      over.length ? `Repeated more than 3 times: ${over.slice(0, 4).map((r) => `${r.term} (${r.count}x)`).join(', ')}.` : 'No term is repeated more than 3 times.',
      'Two or three mentions of a key term is enough. Rephrase repeats so the resume does not look like spam.');
    const t = title.trim();
    if (!t) add('kw-title', 'keywords', 'Job title match', 3, null, 'Enter the exact job title from the posting to check this.', '');
    else {
      const tk = tokensOf(t); const c = countPhrase(resT, tk);
      const near = !c && (() => { const k2 = tk.map(stem).join(' '); for (let i = 0; i + tk.length <= resT.length; i += 1) if (resT.slice(i, i + tk.length).map(stem).join(' ') === k2) return true; return false; })();
      add('kw-title', 'keywords', 'Job title match', 3, c ? 1 : near ? 0.5 : 0, c ? `"${t}" appears in your resume.` : near ? `A close but not exact match to "${t}" was found.` : `"${t}" does not appear in your resume.`,
        `Use the exact job title "${t}" in your header title or Summary (only if it honestly describes you).`);
    }
  }

  /* ===== FORMATTING (20) ===== */
  const m = p.meta || {};
  const odd = text.match(/[^\x20-\x7E\n\t\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u00A0\u00C0-\u017F]/g) || [];
  let layoutF = null; let layoutD = ''; let layoutFix = 'Use a single column with no tables, text boxes, sidebars or graphics.';
  if (m.source === 'builder') { layoutF = 1; layoutD = 'Single column, plain text. No tables, text boxes, sidebars or graphics.'; }
  else if (m.source === 'docx') {
    const probs = [m.tables && 'tables', m.textboxes && 'text boxes', m.columns && 'multiple columns', m.images && 'images or shapes'].filter(Boolean);
    layoutF = probs.length ? (m.tables || m.textboxes || m.columns ? 0 : 0.5) : 1;
    layoutD = probs.length ? `Found ${probs.join(', ')}. Many systems read these in the wrong order or skip them.` : 'No tables, text boxes, columns or images found in the document.';
  }
  if (layoutF !== null && odd.length) { layoutF *= 0.6; layoutD += ` Also found ${odd.length} unusual symbol(s), such as "${odd[0]}".`; }
  add('fmt-layout', 'formatting', 'Single column, no tables or graphics', 5, layoutF, layoutD || 'Layout cannot be judged from pasted text. Upload a .docx or use the builder to check it.', layoutFix);

  const nonstd = p.headings.filter((h) => !h.standard);
  const stdCount = p.headings.filter((h) => h.standard).length;
  add('fmt-headings', 'formatting', 'Standard section headings', 6, !p.headings.length ? 0 : 1 - nonstd.length * 0.5,
    !p.headings.length ? 'No standard section headings were found.' : nonstd.length ? `Creative heading(s) found: ${nonstd.map((h) => `"${h.raw}"`).join(', ')}.` : `${stdCount} standard heading${stdCount === 1 ? '' : 's'} found: ${p.headings.map((h) => h.raw).slice(0, 6).join(', ')}.`,
    'Use plain headings: Work Experience, Education, Skills, Certifications. Avoid creative names like "My Journey".');

  let fontF = null; let fontD = 'Fonts cannot be read from pasted text. Use Arial, Calibri or Times New Roman at 10 to 12 pt.';
  if (m.source === 'builder') {
    const okSize = m.fontSize >= 10 && m.fontSize <= 12;
    fontF = okSize ? 1 : 0.5; fontD = `${m.fontFamily} at ${m.fontSize} pt (Helvetica is the Arial-compatible PDF font).`;
  } else if (m.source === 'docx' && (m.fonts || []).length) {
    const fontsOk = m.fonts.every((f) => STD_FONTS.includes(f.toLowerCase()));
    const sizeOk = !m.bodySize || (m.bodySize >= 10 && m.bodySize <= 12);
    fontF = (fontsOk ? 0.5 : 0) + (sizeOk ? 0.5 : 0);
    fontD = `Fonts: ${m.fonts.join(', ')}${m.bodySize ? `. Body size about ${m.bodySize} pt` : ''}.`;
  }
  add('fmt-font', 'formatting', 'Standard font, 10 to 12 pt', 3, fontF, fontD, 'Use Arial, Calibri or Times New Roman at 10 to 12 pt.');

  let ctF = null; let ctD = 'Cannot tell whether contact details sit in a header. Keep them in the main body.';
  if (m.source === 'builder') { ctF = 1; ctD = 'Contact details are in the body of the document, not a header or footer.'; }
  else if (m.source === 'docx') { ctF = m.contactInHeader ? 0 : 1; ctD = m.contactInHeader ? 'Your email or phone is inside the Word header or footer, which many systems ignore.' : 'Contact details are in the main body.'; }
  add('fmt-contact', 'formatting', 'Contact info in the body', 3, ctF, ctD, 'Move contact details out of the header/footer and into the main body.');

  let fileF = null; let fileD = 'File type unknown for pasted text. Save as .docx (safest) or a text-based PDF.';
  if (m.source === 'builder') { fileF = 1; fileD = 'You can download a text-based PDF or a Word .docx. Use .docx when the posting allows it.'; }
  else if (m.source === 'docx') { fileF = 1; fileD = 'A .docx file, the safest format for most systems.'; }
  add('fmt-file', 'formatting', 'Safe file type (.docx or text PDF)', 3, fileF, fileD, '');

  /* ===== CONTENT (40) ===== */
  add('ct-name', 'content', 'Name', 1, p.name ? 1 : 0, p.name ? 'Your name is at the top.' : 'Add your full name at the top.', 'Put your full name on the first line.');
  add('ct-email', 'content', 'Email address', 3, EMAIL_RE.test(p.email) ? 1 : 0, EMAIL_RE.test(p.email) ? 'Valid email found.' : 'No valid email address found.', 'Add a professional email address in the body.');
  const digits = (p.phone || '').replace(/\D/g, '').length;
  add('ct-phone', 'content', 'Phone number', 2, digits >= 8 && digits <= 15 ? 1 : 0, digits >= 8 && digits <= 15 ? 'Phone number found.' : 'No valid phone number found.', 'Add a phone number with country code.');
  const roles = p.roles || [];
  const hasExp = roles.length > 0;
  add('ct-exp', 'content', 'Work experience', 6, hasExp ? 1 : p.present.projects ? 0.5 : 0, hasExp ? `${roles.length} role${roles.length === 1 ? '' : 's'} found.` : p.present.projects ? 'No work experience, but projects were found.' : 'No work experience found.', 'Add at least one role, internship or project under Work Experience.');
  const dated = roles.filter((r) => r.hasDates).length;
  add('ct-dates', 'content', 'Dates on every role', 2, !roles.length ? null : dated / roles.length, !roles.length ? '' : dated === roles.length ? 'Every role has dates.' : `${roles.length - dated} role(s) have no dates.`, 'Give every role start and end dates (for example Jun 2022 - Present).');
  add('ct-edu', 'content', 'Education', 5, p.present.education || (p.sections.education || '').length ? 1 : 0, p.present.education ? 'Education section found.' : 'No education section found.', 'Add your education, even if it is ongoing.');
  const sk = (p.skillItems || []).length;
  add('ct-skills', 'content', 'Skills (8 or more)', 5, sk >= 8 ? 1 : sk >= 4 ? 0.5 : 0, `${sk} skill${sk === 1 ? '' : 's'} listed.`, 'List at least 8 relevant skills, using the posting\'s exact names.');
  const bl = p.bullets || [];
  const vb = bl.filter((b) => ACTION_VERBS.has(b.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '')));
  const vr = bl.length ? vb.length / bl.length : 0;
  add('ct-verbs', 'content', 'Bullets start with action verbs', 5, !bl.length ? 0 : Math.min(1, vr / 0.8), !bl.length ? 'No bullet points found.' : `${vb.length} of ${bl.length} bullets start with an action verb such as Led, Built, Optimized or Implemented.`, 'Start every bullet with a strong action verb: Led, Built, Optimized, Implemented.');
  const mb = bl.filter((b) => /\d/.test(b));
  const mr = bl.length ? mb.length / bl.length : 0;
  add('ct-metrics', 'content', 'Achievements quantified', 6, !bl.length ? 0 : Math.min(1, mr / 0.5), !bl.length ? 'No bullet points found.' : `${mb.length} of ${bl.length} bullets include a number or percentage. Aim for about half or more.`, 'Quantify results: "Increased conversion by 30%", "Managed a team of 5".');
  const certs = p.certLines || [];
  if (!certs.length) add('ct-certs', 'content', 'Certifications spelled out', 3, null, 'No certifications listed.', '');
  else {
    const weak = certs.filter((l) => {
      const w = l.split(/\s+/).filter(Boolean);
      const ac = Object.keys(CERT_ACRONYMS).find((a) => new RegExp(`(^|[^A-Za-z])${a}([^A-Za-z]|$)`).test(l));
      if (ac) return !l.toLowerCase().includes(CERT_ACRONYMS[ac].toLowerCase());
      return w.length <= 2 && /[A-Z]{2,}/.test(l);
    });
    kwCertWeak = weak;
    add('ct-certs', 'content', 'Certifications spelled out', 3, 1 - weak.length / certs.length,
      weak.length ? `Spell out: ${weak.slice(0, 3).map((l) => `"${l}"`).join(', ')}.` : 'Every certification uses its full name.',
      weak.length ? `Use the full name, for example: ${weak.slice(0, 2).map((l) => { const ac = Object.keys(CERT_ACRONYMS).find((a) => l.includes(a)); return ac ? `${ac} \u2013 ${CERT_ACRONYMS[ac]}` : `${l} \u2013 full certification name`; }).join('; ')}.` : '');
  }
  const sw = p.summaryWords !== undefined ? p.summaryWords : (p.sections.summary || '').split(/\s+/).filter(Boolean).length;
  add('ct-summary', 'content', 'Professional summary (25 to 90 words)', 1, sw >= 25 && sw <= 90 ? 1 : sw ? 0.5 : 0, sw ? `${sw} words.` : 'No summary found.', 'Add a 2 to 3 sentence summary that uses your top keywords.');
  add('ct-length', 'content', 'Length (300 to 900 words)', 1, words >= 300 && words <= 900 ? 1 : words >= 200 && words <= 1100 ? 0.5 : 0, `About ${words} words.`, 'Keep the resume between 300 and 900 words so it fits one or two pages.');

  /* ===== totals ===== */
  const cats = {};
  Object.keys(CAT).forEach((k) => {
    const list = checks.filter((c) => c.cat === k && c.factor !== null);
    cats[k] = { label: CAT[k], max: list.reduce((n, c) => n + c.max, 0), earned: Math.round(list.reduce((n, c) => n + c.max * c.factor, 0) * 10) / 10, possible: checks.filter((c) => c.cat === k).reduce((n, c) => n + c.max, 0) };
  });
  const applicable = checks.filter((c) => c.factor !== null).reduce((n, c) => n + c.max, 0);
  const earned = checks.reduce((n, c) => n + (c.factor === null ? 0 : c.max * c.factor), 0);
  const score = applicable ? Math.round((earned / applicable) * 100) : 0;
  const fixes = checks.filter((c) => c.factor !== null && c.factor < 0.999 && c.fix)
    .map((c) => ({ id: c.id, label: c.label, gain: Math.round(((c.max * (1 - c.factor)) / applicable) * 1000) / 10, fix: c.fix, cat: c.cat }))
    .sort((a, b) => b.gain - a.gain);
  return { score, tailored: hasJd, categories: cats, checks, fixes, keywords: kw, words, hasJd, applicable, source: m.source };
}
var kwCertWeak = [];

function analyzeResume(resume) {
  return scoreParsed(parseResumeObject(resume), { jd: resume.jobDescription || '', title: resume.targetTitle || '' });
}
const scoreLabel = (s) => (s >= 85 ? 'Strong' : s >= 70 ? 'Good, with gaps' : s >= 50 ? 'Needs work' : 'Just getting started');
