/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* MiniPdf: a small, dependency-free PDF writer.
   Produces real selectable text using the standard PDF fonts (Helvetica and Times), so no
   external library or network request is needed. It implements just the calls pdf.js uses. */
class MiniPdf {
  constructor({ w, h }) {
    this.w = w; this.h = h;
    this.pages = [[]];
    this.fontName = 'helvetica'; this.fontStyle = 'normal'; this.size = 10;
    this.fill = [0, 0, 0]; this.stroke = [0, 0, 0]; this.lineW = 1;
    this.info = {};
    this.ctx = document.createElement('canvas').getContext('2d');
  }

  setProperties(info) { this.info = { ...this.info, ...info }; }
  setFont(name, style = 'normal') { this.fontName = name; this.fontStyle = style; }
  setFontSize(s) { this.size = s; }
  setTextColor(r, g, b) { this.fill = [r, g, b]; }
  setDrawColor(r, g, b) { this.stroke = [r, g, b]; }
  setLineWidth(w) { this.lineW = w; }
  addPage() { this.pages.push([]); }

  static num(n) { return (Math.round(n * 100) / 100).toString(); }
  static col(c) { return c.map((v) => MiniPdf.num(v / 255)).join(' '); }

  // PDF base-14 font resource for the current font
  fontKey() {
    const times = this.fontName === 'times';
    const bold = this.fontStyle === 'bold' || this.fontStyle === 'bolditalic';
    const italic = this.fontStyle === 'italic' || this.fontStyle === 'bolditalic';
    return `${times ? 'T' : 'H'}${bold ? 'B' : ''}${italic ? 'I' : ''}`;
  }

  // Width in points. Canvas fonts that are metric-compatible with Helvetica (Arial) and
  // Times (Times New Roman) are used for measuring; a small safety margin avoids overflow.
  getTextWidth(text) {
    const times = this.fontName === 'times';
    const bold = this.fontStyle === 'bold' || this.fontStyle === 'bolditalic';
    const italic = this.fontStyle === 'italic' || this.fontStyle === 'bolditalic';
    const family = times ? '"Times New Roman", Times, "Liberation Serif", serif' : 'Arial, Helvetica, "Liberation Sans", sans-serif';
    this.ctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}100px ${family}`;
    return (this.ctx.measureText(String(text)).width * this.size / 100) * 1.015;
  }

  splitTextToSize(text, maxW) {
    const out = [];
    String(text).split(/\r?\n/).forEach((para) => {
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      const push = () => { if (line) out.push(line); line = ''; };
      words.forEach((word) => {
        let w = word;
        const trial = line ? `${line} ${w}` : w;
        if (this.getTextWidth(trial) <= maxW) { line = trial; return; }
        push();
        // break very long words by character
        while (this.getTextWidth(w) > maxW && w.length > 1) {
          let i = w.length - 1;
          while (i > 1 && this.getTextWidth(w.slice(0, i)) > maxW) i -= 1;
          out.push(w.slice(0, i)); w = w.slice(i);
        }
        line = w;
      });
      push();
      if (!words.length) out.push('');
    });
    return out;
  }

  static encode(str) {
    const map = { 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97 };
    let s = '';
    for (const ch of String(str)) {
      let c = ch.codePointAt(0);
      if (map[c]) c = map[c];
      if (c > 255 || c < 32) c = c === 9 ? 32 : 63;
      const chr = String.fromCharCode(c);
      s += chr === '\\' || chr === '(' || chr === ')' ? `\\${chr}` : chr;
    }
    return s;
  }

  text(str, x, y, opts) {
    let px = x;
    if (opts && opts.align) {
      const wdt = this.getTextWidth(str);
      if (opts.align === 'right') px = x - wdt; else if (opts.align === 'center') px = x - wdt / 2;
    }
    const n = MiniPdf.num;
    this.pages[this.pages.length - 1].push(
      `BT /${this.fontKey()} ${n(this.size)} Tf ${MiniPdf.col(this.fill)} rg 1 0 0 1 ${n(px)} ${n(this.h - y)} Tm (${MiniPdf.encode(str)}) Tj ET`);
  }

  line(x1, y1, x2, y2) {
    const n = MiniPdf.num;
    this.pages[this.pages.length - 1].push(
      `${MiniPdf.col(this.stroke)} RG ${n(this.lineW)} w ${n(x1)} ${n(this.h - y1)} m ${n(x2)} ${n(this.h - y2)} l S`);
  }

  build() {
    const fonts = [['H', 'Helvetica'], ['HB', 'Helvetica-Bold'], ['HI', 'Helvetica-Oblique'], ['HBI', 'Helvetica-BoldOblique'],
      ['T', 'Times-Roman'], ['TB', 'Times-Bold'], ['TI', 'Times-Italic'], ['TBI', 'Times-BoldItalic']];
    const objs = [];
    const add = (body) => { objs.push(body); return objs.length; };
    const catalog = add('');
    const pagesRoot = add('');
    const fontIds = fonts.map(([, base]) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`));
    const fontRes = fonts.map(([k], i) => `/${k} ${fontIds[i]} 0 R`).join(' ');
    const kids = [];
    this.pages.forEach((ops) => {
      const stream = ops.join('\n');
      const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const page = add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${MiniPdf.num(this.w)} ${MiniPdf.num(this.h)}] /Resources << /Font << ${fontRes} >> >> /Contents ${content} 0 R >>`);
      kids.push(`${page} 0 R`);
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
    objs[pagesRoot - 1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
    const hex = (s) => `<FEFF${[...String(s || '')].map((c) => c.codePointAt(0).toString(16).padStart(4, '0').slice(-4)).join('')}>`;
    const infoId = add(`<< /Title ${hex(this.info.title)} /Author ${hex(this.info.author)} /Subject ${hex(this.info.subject)} /Creator ${hex(this.info.creator)} >>`);

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((o) => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  }

  output(type) {
    const bytes = this.build();
    return type === 'blob' ? new Blob([bytes], { type: 'application/pdf' }) : bytes;
  }
}
