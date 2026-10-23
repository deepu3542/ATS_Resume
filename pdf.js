/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* PDF engine: draws the resume with MiniPdf (no external library) */

// Standard PDF fonts only cover WinAnsi. Map common typographic characters, drop the rest.
const MAP = { '\u2018': "'", '\u2019': "'", '\u201C': '"', '\u201D': '"', '\u2026': '...', '\u00A0': ' ', '\u2192': '->', '\u2212': '-', '\u2011': '-' };
const KEEP = new Set(['\u2013', '\u2014', '\u2022']);
function clean(text) {
  let out = '';
  for (const ch of String(text || '')) {
    if (MAP[ch]) out += MAP[ch];
    else if (ch.charCodeAt(0) <= 255 || KEEP.has(ch)) out += ch;
  }
  return out.replace(/[\u0000-\u0008\u000B-\u001F]/g, '');
}

async function createPdf(resume) {
  const doc = buildDocument(resume);
  if (isDocumentEmpty(doc)) throw new Error('Add your name and at least one section before downloading.');

  const paper = PAPERS[resume.paper] || PAPERS.letter;
  const T = TEMPLATES[resume.templateId] || TEMPLATES.classic;
  const pdf = new MiniPdf({ w: paper.w, h: paper.h });
  pdf.setProperties({ title: `${doc.name || 'Resume'} - Resume`, author: doc.name || '', subject: 'Resume', creator: 'ATS Resume' });

  const M = T.margin;
  const W = paper.w - M * 2;
  const bottom = paper.h - M;
  let y = M;

  const lead = (size) => size * T.leading;
  const font = (style, size) => { pdf.setFont(T.font, style); pdf.setFontSize(size); };
  const color = (c) => pdf.setTextColor(c[0], c[1], c[2]);
  const ensure = (h) => { if (y + h > bottom) { pdf.addPage(); y = M; } };
  const wrap = (text, style, size, width) => { font(style, size); return pdf.splitTextToSize(clean(text), Math.max(width, 20)); };
  const baseline = (size) => y + size * 0.92;

  function textBlock(text, { style = 'normal', size = T.body, x = M, width = W, c = T.text, align = 'left', after = 0 } = {}) {
    wrap(text, style, size, width).forEach((ln) => {
      ensure(lead(size));
      font(style, size); color(c);
      const px = align === 'center' ? M + W / 2 : x;
      pdf.text(ln, px, baseline(size), align === 'center' ? { align: 'center' } : undefined);
      y += lead(size);
    });
    y += after;
  }

  // Header
  if (doc.name) textBlock(doc.name, { style: 'bold', size: T.nameSize, c: T.nameColor, align: T.align, after: 1 });
  if (doc.title) textBlock(doc.title, { size: T.body + 2, c: T.titleColor, align: T.align, after: 1 });
  if (doc.contact.length) textBlock(doc.contact.join('  |  '), { size: T.body - 0.5, c: T.muted, align: T.align });
  y += 4;

  doc.sections.forEach((section) => {
    // keep heading with at least first entry line
    ensure(lead(T.body + 1) + 8 + lead(T.body) * 2);
    y += 8;
    const title = T.upper ? section.title.toUpperCase() : section.title;
    font('bold', T.body + 1); color(T.headColor);
    pdf.text(clean(title), M, baseline(T.body + 1));
    y += lead(T.body + 1) - 1;
    pdf.setDrawColor(T.rule[0], T.rule[1], T.rule[2]);
    pdf.setLineWidth(0.6);
    pdf.line(M, y, M + W, y);
    y += 5;

    const labelW = section.blocks.some((b) => b.type === 'skill')
      ? Math.min(110, Math.max(...section.blocks.filter((b) => b.type === 'skill').map((b) => { font('bold', T.body); return pdf.getTextWidth(clean(b.label) + ': '); })))
      : 0;

    section.blocks.forEach((b, i) => {
      if (b.type === 'text') textBlock(b.text);

      if (b.type === 'skill') {
        const rows = wrap(b.text, 'normal', T.body, W - labelW);
        ensure(lead(T.body));
        font('bold', T.body); color(T.text);
        pdf.text(clean(b.label) + ':', M, baseline(T.body));
        rows.forEach((ln) => {
          ensure(lead(T.body));
          font('normal', T.body); color(T.text);
          pdf.text(ln, M + labelW, baseline(T.body));
          y += lead(T.body);
        });
      }

      if (b.type === 'entry') {
        if (i > 0) y += 4;
        font('normal', T.body);
        const rightW = b.right ? pdf.getTextWidth(clean(b.right)) : 0;
        const titleLines = wrap(b.title, 'bold', T.body + 0.5, W - rightW - 12);
        ensure(lead(T.body) * 2 + 2);
        titleLines.forEach((ln, idx) => {
          ensure(lead(T.body + 0.5));
          font('bold', T.body + 0.5); color(T.text);
          pdf.text(ln, M, baseline(T.body + 0.5));
          if (idx === 0 && b.right) { font('normal', T.body); color(T.muted); pdf.text(clean(b.right), M + W, baseline(T.body), { align: 'right' }); }
          y += lead(T.body + 0.5);
        });
        if (b.sub) textBlock(b.sub, { style: 'italic', c: T.muted });
        b.bullets.forEach((bl) => {
          const rows = wrap(bl, 'normal', T.body, W - 14);
          rows.forEach((ln, idx) => {
            ensure(lead(T.body));
            font('normal', T.body); color(T.text);
            if (idx === 0) pdf.text('\u2022', M + 3, baseline(T.body));
            pdf.text(ln, M + 14, baseline(T.body));
            y += lead(T.body);
          });
        });
      }

      if (b.type === 'bullets') {
        b.bullets.forEach((bl) => {
          wrap(bl, 'normal', T.body, W - 14).forEach((ln, idx) => {
            ensure(lead(T.body));
            font('normal', T.body); color(T.text);
            if (idx === 0) pdf.text('\u2022', M + 3, baseline(T.body));
            pdf.text(ln, M + 14, baseline(T.body));
            y += lead(T.body);
          });
        });
      }
    });
  });

  return pdf;
}

async function downloadPdf(resume) {
  const pdf = await createPdf(resume);
  const name = fileSafe(resume.personal.name) || 'resume';
  triggerDownload(pdf.output('blob'), `${name}-resume.pdf`);
}
