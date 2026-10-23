/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Reads a .docx in the browser (nothing is uploaded) to extract text and layout facts for the ATS checker. */
async function readZip(buf) {
  const u8 = new Uint8Array(buf); const dv = new DataView(buf);
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e -= 1;
  if (e < 0) throw new Error('This does not look like a .docx file.');
  const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const files = {};
  for (let i = 0; i < count; i += 1) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true); const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true); const elen = dv.getUint16(p + 30, true); const clen = dv.getUint16(p + 32, true); const lho = dv.getUint32(p + 42, true);
    files[new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen))] = { method, csize, lho };
    p += 46 + nlen + elen + clen;
  }
  return { u8, dv, files };
}
async function zipText(z, name) {
  const f = z.files[name]; if (!f) return null;
  const nlen = z.dv.getUint16(f.lho + 26, true); const elen = z.dv.getUint16(f.lho + 28, true);
  const start = f.lho + 30 + nlen + elen; const data = z.u8.subarray(start, start + f.csize);
  if (f.method === 0) return new TextDecoder().decode(data);
  if (f.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .docx files here. Paste the text of your resume instead.');
    const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    return new TextDecoder().decode(out);
  }
  throw new Error('This .docx uses a compression method that is not supported.');
}
const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, '&');
function xmlToLines(xml) {
  return xml.split('</w:p>').map((p) => {
    let t = ''; const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g; let m;
    while ((m = re.exec(p))) { if (m[0] === '<w:tab/>') t += '\t'; else if (m[0] === '<w:br/>') t += '\n'; else t += m[1]; }
    t = decodeXml(t);
    return /<w:numPr>/.test(p) && t.trim() ? `\u2022 ${t}` : t;
  }).join('\n');
}
async function readDocx(file) {
  const z = await readZip(await file.arrayBuffer());
  const docXml = await zipText(z, 'word/document.xml');
  if (!docXml) throw new Error('This file has no document content. Is it a Word .docx?');
  const stylesXml = (await zipText(z, 'word/styles.xml')) || '';
  let hf = '';
  for (const name of Object.keys(z.files)) if (/^word\/(header|footer)\d*\.xml$/.test(name)) hf += `\n${xmlToLines(await zipText(z, name))}`;
  const fonts = [...new Set([...(docXml + stylesXml).matchAll(/w:ascii="([^"]+)"/g)].map((m) => m[1]))].filter((f) => !/symbol|wingdings/i.test(f));
  const sizes = {}; [...docXml.matchAll(/<w:sz w:val="(\d+)"/g)].forEach((m) => { sizes[m[1]] = (sizes[m[1]] || 0) + 1; });
  let top = null; Object.entries(sizes).forEach(([k, v]) => { if (!top || v > top[1]) top = [k, v]; });
  const dflt = (stylesXml.match(/<w:docDefaults>[\s\S]*?<w:sz w:val="(\d+)"/) || [])[1];
  const normal = ((stylesXml.match(/<w:style[^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/) || [''])[0].match(/<w:sz w:val="(\d+)"/) || [])[1];
  const cols = docXml.match(/<w:cols[^>]*w:num="(\d+)"/);
  return {
    text: xmlToLines(docXml),
    meta: {
      source: 'docx', tables: /<w:tbl>/.test(docXml), textboxes: /<w:txbxContent/.test(docXml), images: /<w:drawing|<w:pict/.test(docXml),
      columns: !!cols && Number(cols[1]) > 1, fonts, bodySize: normal ? Number(normal) / 2 : dflt ? Number(dflt) / 2 : top ? Number(top[0]) / 2 : 0,
      contactInHeader: EMAIL_RE.test(hf) || /(\+?\d[\d\s().-]{7,}\d)/.test(hf),
    },
  };
}
