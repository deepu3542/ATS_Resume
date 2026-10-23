/* Copyright (c) 2026 ATS Resume. All rights reserved. */
/* Data model, templates and storage */
// Shared template + paper definitions. The live preview (CSS) and the PDF engine (jsPDF)
// both read from here so what you see is what you download.

const PAPERS = {
  letter: { id: 'letter', label: 'US Letter', w: 612, h: 792 },
  a4: { id: 'a4', label: 'A4', w: 595.28, h: 841.89 },
};

const TEMPLATES = {
  classic: {
    id: 'classic',
    name: 'ATS Classic',
    blurb: 'One column, plain black headings. The safest layout for automated parsing.',
    font: 'helvetica',
    cssFont: "Arial, Helvetica, sans-serif",
    nameSize: 20,
    align: 'center',
    nameColor: [0, 0, 0],
    titleColor: [40, 40, 40],
    headColor: [0, 0, 0],
    rule: [0, 0, 0],
    text: [20, 20, 20],
    muted: [70, 70, 70],
    upper: true,
    margin: 46,
    body: 10,
    leading: 1.32,
  },
  modern: {
    id: 'modern',
    name: 'Emerald Modern',
    blurb: 'Left-aligned header with a single emerald accent. Still one column, still plain text.',
    font: 'helvetica',
    cssFont: "Arial, Helvetica, sans-serif",
    nameSize: 25,
    align: 'left',
    nameColor: [10, 43, 32],
    titleColor: [14, 110, 76],
    headColor: [14, 110, 76],
    rule: [91, 212, 143],
    text: [28, 36, 32],
    muted: [84, 98, 91],
    upper: false,
    margin: 44,
    body: 10,
    leading: 1.34,
  },
  executive: {
    id: 'executive',
    name: 'Executive Serif',
    blurb: 'Traditional serif type with centered header, suited to senior and formal roles.',
    font: 'times',
    cssFont: "'Times New Roman', Times, serif",
    nameSize: 22,
    align: 'center',
    nameColor: [10, 43, 32],
    titleColor: [50, 60, 55],
    headColor: [10, 43, 32],
    rule: [10, 43, 32],
    text: [20, 24, 22],
    muted: [75, 85, 80],
    upper: true,
    margin: 50,
    body: 10.5,
    leading: 1.28,
  },
};

const TEMPLATE_LIST = Object.values(TEMPLATES);
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

let counter = 0;
const uid = (prefix = 'id') => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};


const emptyExperience = () => ({
  id: uid('exp'), role: '', company: '', location: '', start: '', end: '', current: false, bullets: '',
});
const emptyEducation = () => ({
  id: uid('edu'), school: '', degree: '', field: '', location: '', start: '', end: '', details: '',
});
const emptySkillGroup = () => ({ id: uid('skl'), label: '', items: '' });
const emptyProject = () => ({ id: uid('prj'), name: '', link: '', bullets: '' });

const emptyResume = () => ({
  version: 1,
  templateId: 'classic',
  paper: 'letter',
  personal: { name: '', title: '', email: '', phone: '', location: '', website: '', linkedin: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: '',
  jobDescription: '',
  targetTitle: '',
});

const sampleResume = () => ({
  version: 1,
  templateId: 'modern',
  paper: 'letter',
  personal: {
    name: 'Priya Raman',
    title: 'Frontend Engineer',
    email: 'priya.raman@example.com',
    phone: '+91 98765 43210',
    location: 'Hyderabad, India',
    website: 'priyaraman.dev',
    linkedin: 'linkedin.com/in/priyaraman',
  },
  summary:
    'Frontend engineer with four years of experience building accessible, high-traffic web applications in React and TypeScript. Comfortable owning features from design handoff to production, and focused on performance, testing, and clear collaboration with designers and backend teams.',
  experience: [
    {
      id: uid('exp'), role: 'Frontend Engineer', company: 'Lumen Commerce', location: 'Hyderabad, India',
      start: 'Jul 2022', end: '', current: true,
      bullets: [
        'Led the migration of the checkout flow to React and TypeScript, reducing page load time by 38% across 2M monthly sessions',
        'Built a shared accessibility-first component library used by 6 product teams, cutting duplicate UI code by 45%',
        'Introduced Playwright end-to-end tests that caught 120+ regressions before release',
        'Mentored 3 junior developers through code reviews and weekly pairing sessions',
      ].join('\n'),
    },
    {
      id: uid('exp'), role: 'Software Engineering Intern', company: 'Northwind Labs', location: 'Bengaluru, India',
      start: 'Jan 2022', end: 'Jun 2022', current: false,
      bullets: [
        'Developed an internal analytics dashboard with React and Chart.js used by 40 support agents daily',
        'Reduced API calls by 30% by adding client-side caching and request batching',
      ].join('\n'),
    },
  ],
  education: [
    {
      id: uid('edu'), school: 'National Institute of Technology, Warangal', degree: 'B.Tech', field: 'Computer Science and Engineering',
      location: 'Warangal, India', start: '2018', end: '2022', details: 'CGPA 8.7/10. Teaching assistant for Data Structures.',
    },
  ],
  skills: [
    { id: uid('skl'), label: 'Languages', items: 'JavaScript, TypeScript, HTML5, CSS3, SQL' },
    { id: uid('skl'), label: 'Frameworks', items: 'React, Next.js, Vite, Redux, Node.js' },
    { id: uid('skl'), label: 'Tools', items: 'Git, Playwright, Jest, Figma, GitHub Actions' },
  ],
  projects: [
    {
      id: uid('prj'), name: 'OpenTimetable', link: 'github.com/priyaraman/opentimetable',
      bullets: [
        'Built an open-source scheduling app with 900+ GitHub stars and 25 contributors',
        'Implemented drag-and-drop planning with full keyboard support and screen reader announcements',
      ].join('\n'),
    },
  ],
  certifications: 'Google UX Design Professional Certificate\nAWS Certified Cloud Practitioner',
  jobDescription: '',
  targetTitle: '',
});

const str = (v) => (typeof v === 'string' ? v : '');
const arr = (v) => (Array.isArray(v) ? v : []);

// Accepts anything (corrupt storage, imported JSON) and returns a safe resume object.
function normalizeResume(input) {
  const base = emptyResume();
  if (!input || typeof input !== 'object') return base;
  const p = input.personal && typeof input.personal === 'object' ? input.personal : {};
  return {
    version: 1,
    templateId: ['classic', 'modern', 'executive'].includes(input.templateId) ? input.templateId : base.templateId,
    paper: input.paper === 'a4' ? 'a4' : 'letter',
    personal: Object.fromEntries(Object.keys(base.personal).map((k) => [k, str(p[k])])),
    summary: str(input.summary),
    experience: arr(input.experience).filter((e) => e && typeof e === 'object').map((e) => ({
      id: str(e.id) || uid('exp'), role: str(e.role), company: str(e.company), location: str(e.location),
      start: str(e.start), end: str(e.end), current: Boolean(e.current), bullets: str(e.bullets),
    })),
    education: arr(input.education).filter((e) => e && typeof e === 'object').map((e) => ({
      id: str(e.id) || uid('edu'), school: str(e.school), degree: str(e.degree), field: str(e.field),
      location: str(e.location), start: str(e.start), end: str(e.end), details: str(e.details),
    })),
    skills: arr(input.skills).filter((s) => s && typeof s === 'object').map((s) => ({
      id: str(s.id) || uid('skl'), label: str(s.label), items: str(s.items),
    })),
    projects: arr(input.projects).filter((s) => s && typeof s === 'object').map((s) => ({
      id: str(s.id) || uid('prj'), name: str(s.name), link: str(s.link), bullets: str(s.bullets),
    })),
    certifications: str(input.certifications),
    jobDescription: str(input.jobDescription),
    targetTitle: str(input.targetTitle),
  };
}


const KEY = 'ats-resume:v1';

function loadResume() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeResume(JSON.parse(raw));
  } catch {
    return null; // blocked storage or corrupted JSON: fall back to defaults
  }
}

function saveResume(resume) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(resume));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function clearSaved() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

function exportJson(resume) {
  const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `${fileSafe(resume.personal.name) || 'resume'}-ats-resume.json`);
}

function parseImportedJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (!data || typeof data !== 'object' || !('personal' in data)) {
    throw new Error('That file does not look like a saved resume export.');
  }
  return normalizeResume(data);
}

const fileSafe = (s) => (s || '').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  if (!('download' in HTMLAnchorElement.prototype)) { window.open(url, '_blank'); return; }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}
