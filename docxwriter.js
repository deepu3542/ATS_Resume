/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Word (.docx) export: a real, single-column Word file with standard headings,
   a real bullet list and standard fonts. Built without any library. */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zipStore(files) {
  const enc = new TextEncoder();
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  const u32 = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
  const chunks = []; const central = []; let offset = 0;
  files.forEach((f) => {
    const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = crc32(data);
    const local = new Uint8Array([0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]);
    chunks.push(local, name, data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += local.length + name.length + data.length;
  });
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), 0, 0]);
  return new Blob([...chunks, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function createDocx(resume) {
  const doc = buildDocument(resume);
  if (isDocumentEmpty(doc)) throw new Error('Add your name and at least one section before downloading.');
  const T = TEMPLATES[resume.templateId] || TEMPLATES.classic;
  const paper = PAPERS[resume.paper] || PAPERS.letter;
  const font = T.font === 'times' ? 'Times New Roman' : 'Arial';
  const xe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const hex = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const half = (pt) => Math.round(pt * 2);
  const margin = Math.round(T.margin * 20);
  const textW = Math.round(paper.w * 20) - margin * 2;
  const jc = T.align === 'center' ? 'center' : 'left';

  const run = (text, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${xe(text)}</w:t></w:r>`;
  const tab = '<w:r><w:tab/></w:r>';
  const para = (inner, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.keepNext ? '<w:keepNext/>' : ''}${o.bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}${o.tabs ? `<w:tabs>${o.tabs}</w:tabs>` : ''}${o.before != null || o.after != null ? `<w:spacing${o.before != null ? ` w:before="${o.before}"` : ''}${o.after != null ? ` w:after="${o.after}"` : ''}/>` : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${inner}</w:p>`;
  const body = [];
  const sz = half(T.body);
  if (doc.name) body.push(para(run(doc.name), { style: 'Title', jc }));
  if (doc.title) body.push(para(run(doc.title, { color: hex(T.titleColor), sz: half(T.body + 2) }), { jc, after: 20 }));
  if (doc.contact.length) body.push(para(run(doc.contact.join('  |  '), { color: hex(T.muted), sz: half(T.body - 0.5) }), { jc, after: 40 }));
  const bullet = (t) => para(run(t), { bullet: true });
  doc.sections.forEach((s) => {
    body.push(para(run(s.title), { style: 'Heading2' }));
    s.blocks.forEach((b, i) => {
      if (b.type === 'text') body.push(para(run(b.text)));
      else if (b.type === 'skill') body.push(para(run(`${b.label}: `, { b: true }) + run(b.text)));
      else if (b.type === 'bullets') b.bullets.forEach((t) => body.push(bullet(t)));
      else if (b.type === 'entry') {
        body.push(para(run(b.title, { b: true }) + (b.right ? tab + run(b.right, { color: hex(T.muted) }) : ''), { keepNext: true, before: i ? 80 : 0, tabs: `<w:tab w:val="right" w:pos="${textW}"/>` }));
        if (b.sub) body.push(para(run(b.sub, { i: true, color: hex(T.muted) }), { keepNext: !!b.bullets.length }));
        b.bullets.forEach((t) => body.push(bullet(t)));
      }
    });
  });

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const documentXml = `${head}<w:document ${W}><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${Math.round(paper.w * 20)}" w:h="${Math.round(paper.h * 20)}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml = `${head}<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:color w:val="${hex(T.text)}"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${Math.round(T.leading * 240)}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="20"/></w:pPr><w:rPr><w:b/><w:color w:val="${hex(T.nameColor)}"/><w:sz w:val="${half(T.nameSize)}"/><w:szCs w:val="${half(T.nameSize)}"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${hex(T.rule)}"/></w:pBdr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/>${T.upper ? '<w:caps/>' : ''}<w:color w:val="${hex(T.headColor)}"/><w:sz w:val="${half(T.body + 1)}"/><w:szCs w:val="${half(T.body + 1)}"/></w:rPr></w:style></w:styles>`;
  const numberingXml = `${head}<w:numbering ${W}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="260"/></w:pPr><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:hint="default"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
  const types = `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`;
  const core = `${head}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(doc.name || 'Resume')} - Resume</dc:title><dc:creator>${xe(doc.name || '')}</dc:creator></cp:coreProperties>`;
  return zipStore([
    { name: '[Content_Types].xml', data: types }, { name: '_rels/.rels', data: rels }, { name: 'word/document.xml', data: documentXml },
    { name: 'word/_rels/document.xml.rels', data: docRels }, { name: 'word/styles.xml', data: stylesXml }, { name: 'word/numbering.xml', data: numberingXml }, { name: 'docProps/core.xml', data: core },
  ]);
}

function downloadDocx(resume) {
  const blob = createDocx(resume);
  triggerDownload(blob, `${fileSafe(resume.personal.name) || 'resume'}-resume.docx`);
}
