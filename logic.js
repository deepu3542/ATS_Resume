/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Document builder and writing hints */
// Turns the editable resume into a neutral document structure.
// Both the HTML preview and the PDF engine render from this, so they can't drift apart.

const lines = (text) =>
  (text || '').split(/\r?\n/).map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

const dateRange = ({ start, end, current }) => {
  const s = (start || '').trim();
  const e = current ? 'Present' : (end || '').trim();
  if (s && e) return `${s} – ${e}`;
  return s || e || '';
};

const join = (parts, sep = ', ') => parts.map((p) => (p || '').trim()).filter(Boolean).join(sep);

function buildDocument(r) {
  const p = r.personal;
  const sections = [];

  if (r.summary.trim()) {
    sections.push({ key: 'summary', title: 'Professional Summary', blocks: [{ type: 'text', text: r.summary.trim().replace(/\s+/g, ' ') }] });
  }

  const skills = r.skills.filter((s) => s.items.trim());
  if (skills.length) {
    sections.push({
      key: 'skills', title: 'Skills',
      blocks: skills.map((s) => ({ type: 'skill', label: s.label.trim() || 'Skills', text: s.items.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).join(', ') })),
    });
  }

  const exp = r.experience.filter((e) => e.role.trim() || e.company.trim());
  if (exp.length) {
    sections.push({
      key: 'experience', title: 'Work Experience',
      blocks: exp.map((e) => ({
        type: 'entry', title: e.role.trim() || e.company.trim(), right: dateRange(e),
        sub: e.role.trim() ? join([e.company, e.location]) : (e.location || '').trim(), bullets: lines(e.bullets),
      })),
    });
  }

  const prj = r.projects.filter((x) => x.name.trim());
  if (prj.length) {
    sections.push({
      key: 'projects', title: 'Projects',
      blocks: prj.map((x) => ({ type: 'entry', title: x.name.trim(), right: x.link.trim(), sub: '', bullets: lines(x.bullets) })),
    });
  }

  const edu = r.education.filter((e) => e.school.trim() || e.degree.trim());
  if (edu.length) {
    sections.push({
      key: 'education', title: 'Education',
      blocks: edu.map((e) => ({
        type: 'entry', title: join([e.degree, e.field], ', ') || e.school.trim(), right: dateRange(e),
        sub: join([join([e.degree, e.field], ', ') ? e.school : '', e.location]), bullets: lines(e.details),
      })),
    });
  }

  const certs = lines(r.certifications);
  if (certs.length) {
    sections.push({ key: 'certifications', title: 'Certifications', blocks: [{ type: 'bullets', bullets: certs }] });
  }

  return {
    name: p.name.trim(),
    title: p.title.trim(),
    contact: [p.email, p.phone, p.location, p.website, p.linkedin].map((x) => x.trim()).filter(Boolean),
    sections,
  };
}

function documentText(doc) {
  const out = [doc.name, doc.title, ...doc.contact];
  doc.sections.forEach((s) => {
    out.push(s.title);
    s.blocks.forEach((b) => {
      if (b.type === 'text') out.push(b.text);
      if (b.type === 'skill') out.push(b.label, b.text);
      if (b.type === 'entry') out.push(b.title, b.right, b.sub, ...b.bullets);
      if (b.type === 'bullets') out.push(...b.bullets);
    });
  });
  return out.filter(Boolean).join('\n');
}

const isDocumentEmpty = (doc) => !doc.name && doc.sections.length === 0;


// On-device writing assistant. Rule-based: no network, no API key, nothing leaves the browser.

const GERUND = {
  managing: 'Managed', leading: 'Led', building: 'Built', developing: 'Developed', creating: 'Created', designing: 'Designed',
  handling: 'Handled', maintaining: 'Maintained', coordinating: 'Coordinated', implementing: 'Implemented', analyzing: 'Analyzed',
  analysing: 'Analysed', supporting: 'Supported', writing: 'Wrote', testing: 'Tested', running: 'Ran', organizing: 'Organized',
  training: 'Trained', improving: 'Improved', reducing: 'Reduced', increasing: 'Increased', delivering: 'Delivered',
  deploying: 'Deployed', monitoring: 'Monitored', preparing: 'Prepared', processing: 'Processed', owning: 'Owned',
  overseeing: 'Oversaw', planning: 'Planned', reviewing: 'Reviewed', resolving: 'Resolved', launching: 'Launched',
};

const WEAK = [
  { re: /^(was |were )?responsible for\s+/i, fallback: 'Led' },
  { re: /^(was |were )?in charge of\s+/i, fallback: 'Led' },
  { re: /^worked on\s+/i, fallback: 'Built' },
  { re: /^worked with\s+/i, fallback: 'Partnered with' },
  { re: /^helped (to )?\s*/i, fallback: 'Supported' },
  { re: /^assisted (with|in)\s+/i, fallback: 'Supported' },
  { re: /^participated in\s+/i, fallback: 'Contributed to' },
  { re: /^tasked with\s+/i, fallback: 'Delivered' },
  { re: /^duties (included|include)\s*:?\s*/i, fallback: 'Handled' },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function reviewBullet(raw) {
  const text = raw.replace(/^\s*[-•*]\s*/, '').trim();
  if (!text) return null;
  const issues = [];
  let rewrite = null;

  const weak = WEAK.find((w) => w.re.test(text));
  if (weak) {
    const rest = text.replace(weak.re, '');
    const first = rest.split(/\s+/)[0]?.toLowerCase() || '';
    if (GERUND[first]) {
      rewrite = `${GERUND[first]} ${rest.slice(first.length).trim()}`.trim();
    }
    // Without a clear gerund we do not guess a verb: that could change what you actually did.
    issues.push('Opens with a passive phrase. Start with what you did.');
  } else {
    const first = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    if (!ACTION_VERBS.has(first)) {
      issues.push('Start with an action verb such as Led, Built, Reduced, or Delivered.');
      if (GERUND[first]) rewrite = `${GERUND[first]} ${text.slice(first.length).trim()}`;
    }
  }
  if (!/\d/.test(text)) issues.push('Add a number: how many, how much, how often, or how fast.');
  if (text.split(/\s+/).length > 32) issues.push('This runs long. Aim for under 30 words.');
  if (/\b(various|several|many|etc|stuff|things)\b/i.test(text)) issues.push('Replace vague words with specifics.');
  if (/\bI\b|\bmy\b/i.test(text)) issues.push('Drop first-person words. Resume bullets are written without "I" or "my".');

  if (rewrite) rewrite = cap(rewrite.replace(/\s+/g, ' '));
  return { text, issues, rewrite: rewrite && rewrite !== text ? rewrite : null };
}

function reviewBullets(block) {
  return (block || '').split(/\r?\n/).map((line, index) => ({ index, line, review: reviewBullet(line) }));
}

// Draft a first-pass summary from what the person has already entered.
function draftSummary(resume) {
  const { personal, experience, skills, education } = resume;
  const title = personal.title.trim() || 'Professional';
  const recent = experience.find((e) => e.company.trim());
  const skillList = skills.flatMap((s) => s.items.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)).slice(0, 4);
  const edu = education.find((e) => e.degree.trim() || e.field.trim());

  const parts = [];
  parts.push(recent ? `${title} with hands-on experience at ${recent.company.trim()}${experience.length > 1 ? ' and other teams' : ''}.` : `${title} with a strong foundation built through ${edu ? 'formal study and ' : ''}project work.`);
  if (skillList.length) parts.push(`Skilled in ${skillList.length > 1 ? `${skillList.slice(0, -1).join(', ')} and ${skillList[skillList.length - 1]}` : skillList[0]}.`);
  parts.push('Focused on delivering measurable results and working closely with teammates. Edit this draft to add your strongest achievement.');
  return parts.join(' ');
}
