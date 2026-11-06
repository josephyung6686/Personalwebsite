/* Tuck's Needs You screen, with the sample content prototype 38 renders at #needs. Everything above initTuckDemos is pure:
   the same render functions draw the server's first paint and every browser repaint, so there's one copy of the markup. */

export type Answer = { kind: 'yes' | 'no'; n: number; to: string[] };
export type DemoState = {
  i: number | null; // the open decision; null is the done screen
  answers: Record<string, Answer>;
  skipped: string[];
  out: Record<string, string[]>; // unticked files, per decision
  dest: Record<string, string[]>; // a folder chosen instead of Tuck's pick, per decision
};
export type DemoAction =
  | { type: 'open'; i: number }
  | { type: 'answer'; kind: 'yes' | 'no' }
  | { type: 'skip' }
  | { type: 'toggle'; file: string }
  | { type: 'tickAll' }
  | { type: 'dest'; path: string[] | null }
  | { type: 'acceptAll' }
  | { type: 'undo' }
  | { type: 'restart' };

type FileRow = [name: string, date: string];
export type Decision = {
  id: string; type: string; tone: string; title: string; yes: string; no: string;
  from: string[]; to: string[]; isNew?: boolean; rename?: string; isPrivate?: boolean;
  alts: string[][]; why: [string, string][]; sure: number; files: FileRow[];
};

export const DECISIONS: Decision[] = [
  { id: 'labs', type: 'New folder', tone: 'new', title: 'Make a Labs folder in PHYS 1401', yes: 'Make Labs and move {n}', no: 'Leave them in PHYS 1401',
    from: ['Studying', 'PHYS 1401'], to: ['Studying', 'PHYS 1401', 'Labs'], isNew: true,
    alts: [['Studying', 'PHYS 1401'], ['Studying', 'PHYS 1401', 'Lab Reports'], ['Studying']], sure: 92,
    why: [['Found', '12 files named for PHYS 1401 labs'], ['Names', 'Lab 1 to Lab 7, plus data sheets'], ['Saved from', 'Desktop, Downloads and Documents'], ['Dates', '21 Sep to 2 Nov'], ['Size', '7 MB']],
    files: [['Lab 7.pdf', '2 Nov'], ['Lab 6.pdf', '30 Oct'], ['Lab 6 data.xlsx', '30 Oct'], ['Lab 5 prelab.pdf', '26 Oct'], ['Lab 5.pdf', '26 Oct'], ['Lab 4 handout.pdf', '22 Oct'], ['Lab 4 data.xlsx', '22 Oct'], ['Lab 3.pdf', '18 Oct'], ['Lab 3 data.xlsx', '18 Oct'], ['Lab 2.pdf', '5 Oct'], ['Lab 1.pdf', '28 Sep'], ['Lab safety form.pdf', '21 Sep']] },
  { id: 'photo', type: 'Where it goes', tone: 'where', title: 'File IMG_2210.HEIC in PHYS 1401', yes: 'Move to PHYS 1401', no: 'Keep in Photos › Trips',
    from: ['Photos', 'Trips'], to: ['Studying', 'PHYS 1401'], rename: 'PHYS 1401 whiteboard, 3 Nov.heic',
    alts: [['Studying', 'PHYS 1401', 'Labs'], ['Photos', 'Trips'], ['Studying', 'ECON 2257']], sure: 71,
    why: [['Taken', 'Tuesday 3 Nov at 10:12 AM'], ['Matches', 'Your PHYS 1401 lecture, 10:10 to 11:25'], ['Shows', 'Equations on a whiteboard'], ['Size', '2.4 MB']],
    files: [['IMG_2210.HEIC', '3 Nov']] },
  { id: 'resumes', type: 'Old versions', tone: 'old', title: 'Move 7 older resumes into Old Resumes', yes: 'Make Old Resumes and move {n}', no: 'Keep them with Resume (6)',
    from: ['Job Search', 'Resumes'], to: ['Job Search', 'Resumes', 'Old Resumes'], isNew: true,
    alts: [['Job Search'], ['Job Search', 'Resumes']], sure: 88,
    why: [['Newest', 'Resume (6).pdf stays where it is'], ['Found', '7 earlier versions with the same layout'], ['Saved from', 'Documents, Desktop and Downloads'], ['Dates', '7 Mar to 12 Sep'], ['Size', '6 MB']],
    files: [['Resume final.pdf', '12 Sep'], ['Resume (5).pdf', '23 Jul'], ['Resume (4).pdf', '22 Jun'], ['Resume (3).pdf', '22 May'], ['Resume (2).pdf', '22 Apr'], ['Resume (1).pdf', '25 Mar'], ['Resume (old).docx', '7 Mar']] },
  { id: 'merge', type: 'Duplicate folders', tone: 'merge', title: 'Combine the two Website Proposal folders', yes: 'Combine into one folder', no: 'Keep both folders',
    from: ['Downloads', 'Website Proposal (1)'], to: ['Work', 'GRC Associates', 'Website Proposal'],
    alts: [['Work', 'GRC Associates'], ['Work']], sure: 96,
    why: [['Same files', 'All 14 match exactly'], ['Copy came from', 'An email on 3 Oct'], ['Original', 'Work › GRC Associates › Website Proposal'], ['Dates', '13 Sep to 4 Nov'], ['Size', '7 MB']],
    files: [['Website Proposal.docx', '4 Nov'], ['Website Proposal v2.docx', '30 Oct'], ['Sitemap.pdf', '28 Oct'], ['Budget.xlsx', '23 Oct'], ['Wireframes v3.png', '20 Oct'], ['Wireframes v2.png', '14 Oct'], ['Wireframes v1.png', '8 Oct'], ['Client brief.pdf', '6 Oct'], ['Timeline.xlsx', '4 Oct'], ['Competitor review.docx', '30 Sep'], ['Homepage copy.docx', '26 Sep'], ['Moodboard.png', '21 Sep'], ['Kickoff notes.docx', '17 Sep'], ['Proposal feedback.docx', '13 Sep']] },
  { id: 'private', type: 'Private file', tone: 'priv', title: 'Keep Barnard club budget.xlsx private', yes: 'Make it private', no: 'Not private',
    from: ['Home and Money', 'Bills'], to: ['Home and Money', 'Bills'], isPrivate: true,
    alts: [['Projects', 'Robotics club'], ['Home and Money', 'Bills']], sure: 74,
    why: [['Contains', '23 names with amounts paid'], ['Looks like', 'A bank statement with totals'], ['Came from', 'iCloud Drive'], ['Size', '58 KB']],
    files: [['Barnard club budget.xlsx', '3 Nov']] },
  { id: 'fit', type: 'Folder fit', tone: 'fit', title: 'Keep Robotics club in Projects', yes: 'Keep it in Projects', no: 'It doesn’t fit',
    from: ['Projects', 'Robotics club'], to: ['Projects', 'Robotics club'],
    alts: [['Studying', 'ENGI 1006'], ['Projects']], sure: 64,
    why: [['Your build notes', '6 files'], ['ENGI 1006 lab sheets', '4 files'], ['Shared with', '3 club members'], ['Dates', '22 Sep to 30 Oct'], ['Size', '6 MB']],
    files: [['Robot arm wiring.pdf', '30 Oct'], ['Sensor test.xlsx', '25 Oct'], ['Meeting minutes Oct.docx', '22 Oct'], ['Motor specs.pdf', '14 Oct'], ['Arm CAD v3.step', '10 Oct'], ['Competition rules 2026.pdf', '7 Oct'], ['Budget request.xlsx', '2 Oct'], ['Build log.docx', '29 Sep'], ['Team photo.HEIC', '25 Sep'], ['Meeting minutes Sep.docx', '22 Sep']] },
];

export const START: DemoState = { i: 0, answers: {}, skipped: [], out: {}, dest: {} };

const TOTAL = DECISIONS.length;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const unticked = (s: DemoState, d: Decision) => s.out[d.id] ?? [];
const sameFolder = (a: string[], b: string[]) => a.join('/') === b.join('/');

export const included = (s: DemoState, i: number) => DECISIONS[i].files.length - unticked(s, DECISIONS[i]).length;
export const doneCount = (s: DemoState) => DECISIONS.filter((d) => s.answers[d.id]).length;
export const isFinished = (s: DemoState) => doneCount(s) === TOTAL;
export const filesWaiting = (s: DemoState) => DECISIONS.reduce((n, d, i) => (s.answers[d.id] ? n : n + included(s, i)), 0);
export const waitingCount = (s: DemoState) => TOTAL - doneCount(s);
export const accepted = (p: DemoState, n: DemoState) => DECISIONS.some((d) => n.answers[d.id]?.kind === 'yes' && !p.answers[d.id]);

export function yesLabel(s: DemoState, i: number): string {
  const d = DECISIONS[i], n = plural(included(s, i), 'file'), dest = s.dest[d.id];
  return dest ? `Move ${n} to ${dest[dest.length - 1]}` : d.yes.replace('{n}', n);
}

/* the prototype's rule: the next one waiting that wasn't skipped, then the skipped ones, wrapping round */
function nextOpen(s: DemoState, from: number): number | null {
  for (const skipped of [false, true]) {
    for (let k = 1; k <= TOTAL; k++) {
      const d = DECISIONS[(from + k) % TOTAL];
      if (!s.answers[d.id] && s.skipped.includes(d.id) === skipped) return (from + k) % TOTAL;
    }
  }
  return null;
}

export function reduce(s: DemoState, a: DemoAction): DemoState {
  if (a.type === 'restart') return START;
  if (a.type === 'open') return { ...s, i: a.i };
  if (a.type === 'acceptAll') {
    if (isFinished(s)) return s;
    const answers = { ...s.answers };
    DECISIONS.forEach((d, i) => { answers[d.id] ??= { kind: 'yes', n: included(s, i) || d.files.length, to: s.dest[d.id] ?? d.to }; });
    return { ...s, i: null, answers, skipped: [] };
  }
  if (s.i === null) return s;
  const d = DECISIONS[s.i], given = s.answers[d.id];
  if (a.type === 'undo') {
    if (!given) return s;
    const { [d.id]: _gone, ...answers } = s.answers;
    return { ...s, answers };
  }
  if (given) return s;
  switch (a.type) {
    case 'answer': {
      const n = included(s, s.i);
      if (a.kind === 'yes' && !n) return s;
      const next = { ...s, skipped: s.skipped.filter((x) => x !== d.id), answers: { ...s.answers, [d.id]: { kind: a.kind, n, to: a.kind === 'yes' ? s.dest[d.id] ?? d.to : d.from } } };
      return { ...next, i: nextOpen(next, s.i) };
    }
    case 'skip': {
      const next = { ...s, skipped: s.skipped.includes(d.id) ? s.skipped : [...s.skipped, d.id] };
      return { ...next, i: nextOpen(next, s.i) };
    }
    case 'toggle': {
      const off = unticked(s, d);
      return { ...s, out: { ...s.out, [d.id]: off.includes(a.file) ? off.filter((f) => f !== a.file) : [...off, a.file] } };
    }
    case 'tickAll':
      return { ...s, out: { ...s.out, [d.id]: unticked(s, d).length ? [] : d.files.map((f) => f[0]) } };
    case 'dest': {
      const dest = { ...s.dest };
      if (!a.path || sameFolder(a.path, d.to)) delete dest[d.id]; else dest[d.id] = a.path;
      return { ...s, dest };
    }
  }
}

/* C opens the menu, so the host handles it. Space, arrows and Page keys stay the browser's. */
export function actionForKey(key: string): DemoAction | null {
  const k = key.toLowerCase();
  return k === 'y' ? { type: 'answer', kind: 'yes' } : k === 'n' ? { type: 'answer', kind: 'no' } : k === 's' ? { type: 'skip' } : null;
}

const answerLine = (d: Decision, a: Answer) => a.kind === 'no' ? 'Left as is'
  : d.isPrivate && sameFolder(a.to, d.to) ? 'Private: never sent to AI'
  : `Done: ${plural(a.n, 'file')} in ${a.to[a.to.length - 1]}`;

export function statusFor(p: DemoState, n: DemoState, a: DemoAction): string {
  if (a.type === 'restart') return `Started over. ${plural(TOTAL, 'decision')} waiting.`;
  if (a.type === 'open') { const d = DECISIONS[a.i]; return `Decision ${a.i + 1} of ${TOTAL}: ${d.title}.${n.answers[d.id] ? ' Already answered.' : ''}`; }
  const finished = `All ${TOTAL} answered. Nothing moved on disk.`;
  if (a.type === 'acceptAll') return finished;
  if (p.i === null) return '';
  const d = DECISIONS[p.i];
  if (n === p) return a.type === 'answer' && a.kind === 'yes' && !p.answers[d.id] ? 'Tick at least one file first.' : '';
  const next = n.i === null ? finished : `Next: ${DECISIONS[n.i].title}.`;
  switch (a.type) {
    case 'answer': return `${answerLine(d, n.answers[d.id])}. ${doneCount(n)} of ${TOTAL} done. ${next}`;
    case 'skip': return `Skipped: ${d.title}. ${next}`;
    case 'toggle': case 'tickAll': return `${included(n, p.i)} of ${plural(d.files.length, 'file')} included.`;
    case 'dest': return `Goes to ${(n.dest[d.id] ?? d.to).join(' › ')}.`;
    case 'undo': return `Undone. ${d.title} waits again.`;
  }
}

/* ---------- markup. Phosphor shapes, inlined. No user text ever reaches these strings. */
const CHECK = 'M230 78l-128 128-6 2-6-2-56-56-2-6q0-3 2-6 3-2 6-2l6 2 50 51 122-123 6-2q3 0 6 2 2 3 2 6l-2 6z';
const MINUS = 'M224 128q0 3-2 6-3 2-6 2h-176q-3 0-6-2-2-3-2-6 0-3 2-6 3-2 6-2h176q3 0 6 2 2 3 2 6z';
const CARET = 'M214 102l-80 80-6 2-6-2-80-80-2-6q0-3 2-6 3-2 6-2l6 2 74 75 74-75 6-2q3 0 6 2 2 3 2 6l-2 6z';
const FOLDER = 'M232 88v113q0 6-4 11-5 4-11 4h-177q-7 0-11-5-5-4-5-11v-136q0-7 5-11 4-5 11-5h53l5 1 5 2 28 21h85q7 0 11 5 5 4 5 11z';
const LOCK = 'M208 80h-32v-24q0-20-14-34-14-14-34-14-20 0-34 14-14 14-14 34v24h-32q-7 0-11 5-5 4-5 11v112q0 7 5 11 4 5 11 5h160q7 0 11-5 5-4 5-11v-112q0-7-5-11-4-5-11-5zM96 56q0-13 9-23 10-9 23-9 13 0 23 9 9 10 9 23v24h-64z';
const ic = (d: string) => `<svg class="td-ic" viewBox="0 0 256 256" aria-hidden="true"><path d="${d}"/></svg>`;

const FACES = {
  idle: '<ellipse cx="82" cy="124" rx="6.5" ry="8.5" fill="#18233A"/><ellipse cx="120" cy="121" rx="6.5" ry="8.5" fill="#18233A"/><circle cx="84" cy="121" r="2" fill="#fff"/><circle cx="122" cy="118" r="2" fill="#fff"/><path d="M95 140 Q101 145 107 139" fill="none" stroke="#18233A" stroke-width="3.5" stroke-linecap="round"/>',
  happy: '<g fill="none" stroke="#18233A" stroke-linecap="round"><path d="M75 127 Q82 117 89 127" stroke-width="4.5"/><path d="M113 124 Q120 114 127 124" stroke-width="4.5"/><path d="M93 138 Q101 148 109 137" stroke-width="3.8"/></g>',
};
export const mascot = (face: keyof typeof FACES) => `<svg class="td-tuck" viewBox="0 0 200 220" aria-hidden="true"><filter id="td-wob-${face}"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3.5"/></filter><g filter="url(#td-wob-${face})"><rect x="68" y="26" width="64" height="48" rx="8" fill="#9CC3FF" transform="rotate(6 100 50)"/><rect x="38" y="40" width="56" height="30" rx="11" fill="#DCE2EC" transform="rotate(-4 100 110)"/><rect x="72" y="158" width="20" height="30" rx="10" fill="#F2F3F7"/><rect x="110" y="158" width="20" height="30" rx="10" fill="#F2F3F7"/><rect x="34" y="54" width="132" height="116" rx="26" fill="#F2F3F7" transform="rotate(-4 100 110)"/><path d="M38 96 C78 88 124 86 164 84" fill="none" stroke="#C9D2E3" stroke-width="4" stroke-linecap="round"/><path d="M30 118 C18 120 14 136 24 142 C32 146 38 138 36 130 Z" fill="#F2F3F7"/><path d="M168 112 C180 112 186 128 176 135 C168 140 162 132 164 124 Z" fill="#F2F3F7"/>${FACES[face]}</g></svg>`;

const HUE: Record<string, string> = { Studying: 'study', Work: 'work', 'Job Search': 'job', 'Home and Money': 'home', Photos: 'photo', Projects: 'proj' };
const KIND: Record<string, string> = { pdf: 'pdf', docx: 'doc', xlsx: 'xls', png: 'img', heic: 'img', step: 'txt' };
const btn = (attrs: string, cls: string, label: string, key: string, after = '') =>
  `<button type="button" ${attrs} class="td-btn ${cls}" aria-keyshortcuts="${key}">${label}${after}<kbd class="td-kbd" aria-hidden="true">${key.toUpperCase()}</kbd></button>`;

const folderPath = (p: string[], isNew = false) => `<span class="td-path"><span style="color:var(--a-${HUE[p[0]] ?? 'none'})">${ic(FOLDER)}</span>${p.map((x, k) => `${k ? '<span class="td-sep">›</span>' : ''}<span>${x}</span>`).join('')}${isNew ? '<span class="td-new">new folder</span>' : ''}</span>`;

function row(s: DemoState, d: Decision, k: number): string {
  const a = s.answers[d.id], cur = s.i === k;
  const meta = a ? (a.kind === 'yes' ? 'Done' : 'Left as is') : s.skipped.includes(d.id) ? 'Skipped' : plural(included(s, k), 'file');
  return `<li><button type="button" class="td-it${cur ? ' cur' : ''}${a ? (a.kind === 'yes' ? ' ok' : ' no') : ''}" data-q="${k}" data-fk="q${k}" data-t="${d.tone}"${cur ? ' aria-current="true"' : ''}><span class="td-num">${a ? ic(a.kind === 'yes' ? CHECK : MINUS) : k + 1}</span><span class="td-itx"><span class="td-ty">${d.type}</span><span class="td-ti">${d.title}</span><span class="td-mt">${meta}</span></span></button></li>`;
}

export function renderList(s: DemoState): string {
  const left = waitingCount(s), done = doneCount(s);
  const head = left > 1 ? `<button type="button" class="td-btn sm" data-all data-fk="all">Accept all ${left}</button>`
    : !left && s.i !== null ? '<button type="button" class="td-btn sm" data-restart data-fk="restart">Start over</button>' : '';
  return `<div class="td-lh"><div class="td-lt"><h3>Needs You</h3>${head}</div>
<p>${left ? `${plural(left, 'decision')} waiting. Nothing changes until you answer.` : 'All done.'}</p>
<div class="td-steps" role="progressbar" aria-label="Decisions done" aria-valuemin="0" aria-valuemax="${TOTAL}" aria-valuenow="${done}" aria-valuetext="${done} of ${TOTAL} done">${DECISIONS.map((d, k) => `<i${s.answers[d.id] ? ' class="done"' : s.i === k ? ' class="cur"' : ''}></i>`).join('')}</div>
<div class="td-stepl"><span>${done} of ${TOTAL} done</span><span>${plural(filesWaiting(s), 'file')} waiting</span></div></div>
<ol class="td-items">${DECISIONS.map((d, k) => row(s, d, k)).join('')}</ol>
<p class="td-lf">Nothing moves on disk. Every answer can be undone in History.</p>`;
}

function donePanel(s: DemoState): string {
  const placed = DECISIONS.reduce((n, d) => (s.answers[d.id]?.kind === 'yes' ? n + s.answers[d.id].n : n), 0);
  return `<div class="td-done">${mascot('happy')}<h4>All ${TOTAL} answered</h4><p>Nothing moved on disk. ${placed ? `Tuck changed its plan for ${plural(placed, 'file')}, and any answer can be undone.` : 'You left everything as it was.'}</p><button type="button" class="td-btn pri" data-restart data-fk="restart">Start over</button></div>`;
}

export function renderDetail(s: DemoState): string {
  if (s.i === null) return donePanel(s);
  const k = s.i, d = DECISIONS[k], a = s.answers[d.id], off = unticked(s, d), on = included(s, k), all = d.files.length, picked = s.dest[d.id], to = picked ?? d.to;
  const files = d.files.map(([name, date]) => {
    const out = off.includes(name), ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
    return `<tr${out ? ' class="off"' : ''}><td><label class="td-ck"><input type="checkbox" data-fx="${name}" data-fk="f:${name}" aria-label="Include ${name}"${out ? '' : ' checked'}${a ? ' disabled' : ''}></label></td><td class="td-n">${name}</td><td><span class="td-k td-k-${KIND[ext]}">${ext.toUpperCase()}</span></td><td>${date}</td></tr>`;
  }).join('');
  const options = [to, ...d.alts.filter((p) => !sameFolder(p, to))];
  const menu = `<div class="td-menu" role="menu" aria-label="Choose a folder" data-menu hidden>${options.map((p, j) => `<button type="button" role="menuitemradio" aria-checked="${!j}" tabindex="-1" data-dest="${p.join('|')}">${j ? '' : ic(CHECK)}<span>${p.join(' › ')}</span></button>`).join('')}${picked ? '<hr><button type="button" role="menuitem" tabindex="-1" data-dest="">Back to Tuck’s pick</button>' : ''}</div>`;
  const actions = a
    ? `<span class="td-ans">${ic(a.kind === 'yes' ? CHECK : MINUS)}${answerLine(d, a)}</span><span class="td-sp"></span><button type="button" class="td-btn" data-undo data-fk="undo">Undo</button>`
    : btn(`data-a="yes" data-fk="yes"${on ? '' : ' disabled'}`, 'pri', yesLabel(s, k), 'y')
      + btn('data-a="no" data-fk="no"', '', d.no, 'n')
      + `<span class="td-cfw">${btn('data-cf data-fk="cf" aria-haspopup="menu" aria-expanded="false"', '', 'Choose folder', 'c', ic(CARET))}${menu}</span><span class="td-sp"></span>`
      + btn('data-a="skip" data-fk="skip"', 'ghost', 'Skip', 's');
  return `<header class="td-dh"><div class="td-row1"><span class="td-tag" data-t="${d.tone}">${d.type}</span><span class="td-pos">Decision ${k + 1} of ${TOTAL}</span></div><h4>${d.title}</h4></header>
<div class="td-body"${a ? ' tabindex="0" aria-label="This decision"' : ''}>
<div class="td-box td-fbox"><p class="td-bh">Files <span>${on} of ${all} included</span>${!a && all > 1 ? `<span class="td-sp"></span><button type="button" class="td-mini" data-tickall data-fk="tickall">${on === all ? 'Untick all' : 'Tick all'}</button>` : ''}</p>
<div class="td-ts${a ? ' ro' : ''}"><table><thead><tr><th><span class="td-vh">Included</span></th><th>Name</th><th>Kind</th><th>Date</th></tr></thead><tbody>${files}</tbody></table></div></div>
<div class="td-sidecol"><div class="td-box"><p class="td-bh">Change</p><dl><dt>Now in</dt><dd>${folderPath(d.from)}</dd><dt>Goes to</dt><dd>${folderPath(to, !picked && d.isNew)}${d.isPrivate ? `<span class="td-lock">${ic(LOCK)}Private: never sent to AI</span>` : ''}</dd>${d.rename ? `<dt>New name</dt><dd>${d.rename}</dd>` : ''}</dl></div>
<div class="td-box"><p class="td-bh">Why</p><dl>${d.why.map(([t, v]) => `<dt>${t}</dt><dd>${v}</dd>`).join('')}<dt>Confidence</dt><dd><span class="td-conf"><span class="td-bar"><i style="width:${d.sure}%"></i></span>${d.sure}%</span></dd></dl></div></div>
</div>
<footer class="td-act">${actions}</footer>`;
}

export function initTuckDemos(): void {
  document.querySelectorAll<HTMLElement>('.tuck-demo').forEach(mount);
}

function mount(root: HTMLElement): void {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const list = root.querySelector<HTMLElement>('[data-list]')!, detail = root.querySelector<HTMLElement>('[data-detail]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!, count = root.querySelector<HTMLElement>('[data-count]')!;
  const panes = root.querySelector<HTMLElement>('.td-panes')!;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let s = START;

  const menu = () => detail.querySelector<HTMLElement>('[data-menu]');
  const chooser = () => detail.querySelector<HTMLElement>('[data-cf]');
  const onOutside = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.td-cfw')) closeMenu(false); };
  function closeMenu(refocus: boolean) {
    const m = menu();
    document.removeEventListener('pointerdown', onOutside);
    if (!m || m.hidden) return;
    m.hidden = true;
    chooser()?.setAttribute('aria-expanded', 'false');
    if (refocus) chooser()?.focus();
  }
  function openMenu() {
    const m = menu();
    if (!m) return;
    m.hidden = false;
    m.style.left = '';
    const over = m.getBoundingClientRect().right - detail.getBoundingClientRect().right + 8;
    if (over > 0) m.style.left = `${-over}px`;
    chooser()?.setAttribute('aria-expanded', 'true');
    m.querySelector('button')?.focus();
    document.addEventListener('pointerdown', onOutside);
  }

  function paint(prev: DemoState) {
    const active = document.activeElement as HTMLElement | null;
    const inside = !!active && active !== root && root.contains(active), fk = active?.dataset.fk;
    const sameCard = prev.i === s.i;
    const tops = ['.td-body', '.td-ts'].map((q) => detail.querySelector(q)?.scrollTop ?? 0);
    const listTop = list.querySelector('.td-items')?.scrollTop ?? 0;
    list.innerHTML = renderList(s);
    detail.innerHTML = renderDetail(s);
    const items = list.querySelector<HTMLElement>('.td-items')!;
    items.scrollTop = listTop;
    if (sameCard) ['.td-body', '.td-ts'].forEach((q, n) => { const e = detail.querySelector(q); if (e) e.scrollTop = tops[n]; });
    const n = waitingCount(s);
    count.hidden = !n;
    count.firstChild!.textContent = String(n);
    /* keep the open row visible inside the list, without moving the page */
    const cur = items.querySelector('.cur');
    if (cur) {
      const r = cur.getBoundingClientRect(), box = items.getBoundingClientRect();
      if (r.top < box.top) items.scrollTop -= box.top - r.top;
      else if (r.bottom > box.bottom) items.scrollTop += r.bottom - box.bottom;
    }
    /* repainting removed whatever had focus; put it back so the next key still works */
    if (inside) {
      const again = fk ? root.querySelector<HTMLElement>(`[data-fk="${fk}"]:not(:disabled)`) : null;
      (again ?? root.querySelector<HTMLElement>('[data-a="yes"]:not(:disabled),[data-undo],[data-restart]') ?? root).focus({ preventScroll: true });
    }
    if (sameCard) return;
    if (!calm()) detail.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.16,1,.3,1)' });
    /* stacked panes: the detail can be off screen, above or below */
    if (getComputedStyle(panes).display === 'block') {
      const top = detail.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.6) detail.scrollIntoView({ block: 'start', behavior: calm() ? 'auto' : 'smooth' });
    }
  }

  function go(a: DemoAction) {
    const prev = s;
    s = reduce(s, a);
    const said = statusFor(prev, s, a);
    if (said) status.textContent = said;
    if (s === prev) return;
    if (accepted(prev, s)) document.dispatchEvent(new CustomEvent('tuck:sorted'));
    paint(prev);
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    const { a, q, dest } = b.dataset;
    if ('cf' in b.dataset) { if (menu()?.hidden) openMenu(); else closeMenu(true); }
    else if (dest !== undefined) { closeMenu(true); go({ type: 'dest', path: dest ? dest.split('|') : null }); }
    else if (a === 'yes' || a === 'no') go({ type: 'answer', kind: a });
    else if (a === 'skip') go({ type: 'skip' });
    else if (q !== undefined) go({ type: 'open', i: Number(q) });
    else if ('all' in b.dataset) go({ type: 'acceptAll' });
    else if ('tickall' in b.dataset) go({ type: 'tickAll' });
    else if ('undo' in b.dataset) go({ type: 'undo' });
    else if ('restart' in b.dataset) go({ type: 'restart' });
  });
  detail.addEventListener('change', (e) => {
    const file = (e.target as HTMLElement).dataset.fx;
    if (file) go({ type: 'toggle', file });
  });

  /* only fires for focus inside the demo; a modifier means a browser shortcut, like Cmd+C */
  root.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const m = menu(), target = e.target as HTMLElement;
    if (m && !m.hidden) {
      const items = [...m.querySelectorAll('button')], at = items.indexOf(target as HTMLButtonElement);
      const to = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? -1 : null;
      if (to !== null) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') closeMenu(false);
      return;
    }
    if (e.repeat || target.closest('textarea,select,[contenteditable],input:not([type="checkbox"])')) return;
    if (e.key.toLowerCase() === 'c') {
      if (s.i !== null && !s.answers[DECISIONS[s.i].id]) { e.preventDefault(); openMenu(); }
      return;
    }
    const a = actionForKey(e.key);
    if (a && s.i !== null) { e.preventDefault(); go(a); }
  });
}
