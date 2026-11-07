/* Tuck Brain, the demo's lead screen. tuckPhone.ts imports this only when the demo nears the viewport, so nothing here runs or
   parses before then. Positions are precomputed (tuckBrainData.ts), so there is no force layout and no d3. */
import { NODES, FILES, POINTS, SOURCES, RELATIONS, PERSON_FILES, HUB_ICONS, UI_ICONS, type BrainNode } from './tuckBrainData';
import { DECISIONS, answerLine, type DemoState } from './tuckPhone';

export type BrainState = { sel: string | null; filter: 'all' | 'unsure'; q: string };
export type BrainAction = { type: 'select'; id: string } | { type: 'clear' } | { type: 'filter'; filter: BrainState['filter'] } | { type: 'query'; q: string };
export const BRAIN_START: BrainState = { sel: null, filter: 'all', q: '' };
export function reduceBrain(s: BrainState, a: BrainAction): BrainState {
  return a.type === 'select' ? { ...s, sel: a.id } : a.type === 'clear' ? { ...s, sel: null } : a.type === 'filter' ? { ...s, filter: a.filter } : { ...s, q: a.q };
}

const byId = new Map(NODES.map((n) => [n.id, n]));
const decode = (raw: string) => { const pv = raw[0] === '!', t = pv ? raw.slice(1) : raw; return { name: t.slice(1), src: SOURCES[t.charCodeAt(0) - 97], pv }; };
const namesOf = (id: string) => (FILES[id] ? FILES[id].split('|').map(decode) : []);
const kidsOf = (id: string) => NODES.filter((n) => n.p === id && n.k !== 'file');
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function fileCount(id: string): number {
  return (POINTS[id]?.length ?? 0) / 2 + kidsOf(id).reduce((n, k) => n + fileCount(k.id), 0);
}

type Resolved = BrainNode & { path?: string };
export function nodeOf(id: string): Resolved | undefined {
  const known = byId.get(id), at = id.indexOf('#');
  if (at < 0) return known;
  const p = id.slice(0, at), i = Number(id.slice(at + 1)), f = namesOf(p)[i], t = byId.get(p);
  if (!f || !t) return undefined;
  return { ...(known ?? { id, k: 'file' as const, l: f.name, p, x: t.x + POINTS[p][i * 2], y: t.y + POINTS[p][i * 2 + 1], r: 3 }), pv: f.pv ? 1 : undefined, path: `~/${f.src}` };
}

export const hueOf = (n: BrainNode): string => {
  if (n.k === 'root' || n.k === 'person') return '#3b6dff';
  let a: BrainNode | undefined = n;
  while (a && a.k !== 'area') a = a.p ? byId.get(a.p) : undefined;
  return a?.hue ?? '#7d8597';
};
const chain = (id: string) => { const out: string[] = []; let n = nodeOf(id); while (n) { out.unshift(n.id); n = n.p ? nodeOf(n.p) : n.k === 'root' ? undefined : byId.get('you'); } return out; };

export const unsure = (d: DemoState) => new Set(NODES.filter((n) => n.need !== undefined && !d.answers[DECISIONS[n.need].id]).map((n) => n.id));
const peopleOf = (id: string) => NODES.filter((n) => n.tops?.includes(id));

export function related(id: string): Set<string> {
  const n = nodeOf(id), on = new Set(chain(id));
  if (!n) return on;
  kidsOf(id).forEach((k) => on.add(k.id));
  peopleOf(id).forEach((p) => on.add(p.id));
  n.tops?.forEach((t) => chain(t).forEach((c) => on.add(c)));
  RELATIONS.forEach(([a, b]) => { if (a === id) on.add(b); if (b === id) on.add(a); });
  return on;
}

export function search(q: string): { id: string; label: string; sub: string }[] {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const out = NODES.filter((n) => n.k !== 'file' && n.l.toLowerCase().includes(t)).map((n) => ({ id: n.id, label: n.l, sub: n.k === 'area' ? 'Part of your life' : n.k === 'person' ? 'Person' : `${plural(fileCount(n.id), 'file')}` }));
  for (const p of Object.keys(FILES)) namesOf(p).forEach((f, i) => { if (f.name.toLowerCase().includes(t)) out.push({ id: `${p}#${i}`, label: f.name, sub: `In ${byId.get(p)!.l}` }); });
  return out.slice(0, 7);
}

/* the nodes that stay bright; null means all of them */
export function lit(s: BrainState, d: DemoState): Set<string> | null {
  if (s.sel) return related(s.sel);
  const hits = s.q.trim().length > 1 ? search(s.q).map((r) => r.id) : s.filter === 'unsure' ? [...unsure(d)] : null;
  if (!hits) return null;
  const on = new Set<string>();
  hits.forEach((id) => chain(id).forEach((c) => on.add(c)));
  return on;
}

export const crumbs = (id: string) => chain(id).map((c) => ({ id: c, label: nodeOf(c)!.l }));

const svgIcon = (d: string, cls = 'td-ic') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><path d="${d}"/></svg>`;
const kindClass = (f: string) => (/\.pdf$/i.test(f) ? 'pdf' : /\.(docx|pptx)$/i.test(f) ? 'doc' : /\.(xlsx|csv)$/i.test(f) ? 'xls' : /\.(png|jpe?g|heic|svg)$/i.test(f) ? 'img' : 'txt');
const row = (id: string, title: string, sub: string, hue: string) => `<li><button type="button" data-go="${id}"><i style="background:${hue}"></i><span><b>${title}</b><small>${sub}</small></span></button></li>`;

export function renderInspector(id: string, d: DemoState): string {
  const n = nodeOf(id);
  if (!n) return '';
  const icon = chain(id).map((c) => nodeOf(c)?.ic).find(Boolean), hue = hueOf(n), parent = n.p ? nodeOf(n.p) : n.k === 'root' ? undefined : byId.get('you'), count = n.k === 'file' ? 0 : fileCount(id);
  const open = unsure(d).has(id), need = n.need !== undefined ? DECISIONS[n.need] : null, given = need ? d.answers[need.id] : undefined;
  const head = n.k === 'root' ? `${plural(count, 'file')} · 38 folders` : `${parent && parent.k !== 'root' ? `In ${parent.l}` : n.k === 'person' ? 'Person' : 'Part of your life'}${count ? ` · ${plural(count, 'file')}` : ''}`;
  const lead = n.k === 'file' ? `Still in ${n.path}. Nothing moved on disk: Tuck only maps it here.` : n.k === 'root' ? 'Everything Tuck has read, in the shape of your life. Press a part to see what it knows and why.' : n.know ?? '';
  const q = need ? (given
    ? `<p class="tb-q">${answerLine(need, given)}. <button type="button" class="td-mini" data-needs="${n.need}">See it in Needs You</button></p>`
    : `<div class="tb-q"><b>${n.q}</b><p>${n.qw} Also in <button type="button" class="td-mini" data-needs="${n.need}">Needs You</button>.</p><div class="tb-yn"><button type="button" class="td-btn pri" data-ans="yes">Yes</button><button type="button" class="td-btn" data-ans="no">No</button></div></div>`) : '';
  const links = [
    ...(parent ? [row(parent.id, parent.l, parent.k === 'root' ? 'The centre of your map' : parent.k === 'area' ? 'Part of your life' : plural(fileCount(parent.id), 'file'), hueOf(parent))] : []),
    ...kidsOf(id).map((k) => row(k.id, k.l, k.k === 'area' ? plural(fileCount(k.id), 'file') : k.k === 'person' ? 'Person' : plural(fileCount(k.id), 'file'), hueOf(k))),
    ...peopleOf(id).map((p) => row(p.id, p.l, p.know ?? 'Person', hueOf(p))),
    ...(n.tops ?? []).map((t) => row(t, nodeOf(t)!.l, plural(fileCount(t), 'file'), hueOf(nodeOf(t)!))),
    ...RELATIONS.filter(([a, b]) => a === id || b === id).map(([a, b, why]) => { const o = nodeOf(a === id ? b : a)!; return row(o.id, o.l, why, hueOf(o)); }),
  ];
  const files = n.k === 'person' ? PERSON_FILES[id].map((f) => ({ name: f, go: '' })) : namesOf(id).map((f, i) => ({ name: f.name, go: `${id}#${i}` }));
  const more = (POINTS[id]?.length ?? 0) / 2 - files.length;
  const conf = n.k === 'topic' || n.k === 'file' ? `<p class="tb-conf${open ? ' no' : ''}">${open ? 'Not sure yet' : 'Sure'}<i></i></p>` : '';
  return `<header class="tb-ih"><span class="tb-disc" style="background:${hue}">${icon ? svgIcon(HUB_ICONS[icon]) : n.k === 'root' ? 'JY' : ''}</span><div><h4 tabindex="-1">${n.l}</h4><p>${head}</p>${conf}</div><button type="button" class="tb-x" data-clear aria-label="Close details">${svgIcon(UI_ICONS.close)}</button></header>
<div class="tb-ib" tabindex="0" aria-label="Details">${n.pv ? `<span class="td-lock">${svgIcon(UI_ICONS.lock)}Private: never sent to AI</span>` : ''}${lead ? `<p class="tb-lead">${lead}</p>` : ''}${n.why ? `<p class="tb-why">Why: ${n.why}.</p>` : ''}${q}
${links.length ? `<p class="tb-h">Connected to</p><ul class="tb-links">${links.join('')}</ul>` : ''}
${files.length ? `<p class="tb-h">Files <span>${files.length + Math.max(more, 0)}</span></p><ul class="tb-files">${files.map((f) => `<li>${f.go ? `<button type="button" data-go="${f.go}">` : '<span>'}<span class="td-k td-k-${kindClass(f.name)}">${f.name.split('.').pop()!.toUpperCase()}</span><span>${f.name}</span>${f.go ? '</button>' : '</span>'}</li>`).join('')}${more > 0 ? `<li class="tb-more">and ${more} more</li>` : ''}</ul>` : ''}</div>`;
}

/* the prototype's curves: links bend away from the centre, people on a fixed side */
function curve(a: BrainNode, b: BrainNode, part: boolean, person = false): string {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let nx = -dy / len, ny = dx / len;
  if ((mx + nx) ** 2 + (my + ny) ** 2 < mx * mx + my * my) { nx = -nx; ny = -ny; }
  const off = Math.min(60, len * (part ? 0.22 : 0.18));
  const [cx, cy] = person ? [mx - dy * 0.25, my + dx * 0.25] : [mx + nx * off, my + ny * off];
  return `M${a.x} ${a.y}Q${Math.round(cx)} ${Math.round(cy)} ${b.x} ${b.y}`;
}

const DELAY: Record<string, number> = { root: 0, area: 150, person: 900, topic: 650, file: 1100 };
const delay = (n: BrainNode) => DELAY[n.k] + Math.round(Math.hypot(n.x, n.y) * 1.1);

export function renderMap(): string {
  const edge = (a: BrainNode, b: BrainNode, cls: string, person = false) => `<path class="tb-e ${cls}" data-a="${a.id}" data-b="${b.id}" d="${curve(a, b, cls === 'e0', person)}" style="--d:${delay(b)}ms"/>`;
  const edges = NODES.flatMap((n) => {
    if (n.k === 'file') return [];
    if (n.k === 'person') return n.tops!.map((t) => edge(byId.get(t)!, n, 'ep', true));
    return n.p ? [edge(byId.get(n.p)!, n, n.k === 'area' ? 'e0' : 'e1')] : [];
  }).join('') + RELATIONS.map(([a, b]) => { const A = nodeOf(a), B = nodeOf(b); return A && B ? edge(A, B, 'er') : ''; }).join('');
  const first = NODES.findIndex((n) => n.k === 'root');
  const nodes = NODES.map((n, i) => {
    const hue = hueOf(n), r = n.r, tab = i === first ? '0' : '-1', c = n.k === 'file' ? 0 : fileCount(n.id);
    const name = `${n.l}${c ? `, ${plural(c, 'file')}` : n.k === 'person' ? ', person' : ''}`;
    const dots = POINTS[n.id] ? `<path class="tb-dots" d="${POINTS[n.id].reduce((s, v, k, all) => (k % 2 ? s : `${s}M${v} ${all[k + 1]}h0`), '')}"/>` : '';
    const glyph = n.k === 'root' ? `<circle r="${r}"/><text class="tb-jy" dy=".35em">JY</text>`
      : n.k === 'area' ? `<circle r="${r}"/><path class="tb-ico" transform="translate(${-r * 0.62} ${-r * 0.62}) scale(${(r * 1.24) / 64})" d="${HUB_ICONS[n.ic!]}"/>`
      : n.k === 'person' ? `<path class="tb-dia" d="M0-${r + 2}L${r + 2} 0L0 ${r + 2}L-${r + 2} 0z"/>`
      : n.k === 'file' ? `<circle class="tb-u" r="${Math.max(r, 3.4)}"/>`
      : `<circle r="${r}"/><circle class="tb-u" r="${r}"/>${n.pv ? `<path class="tb-ico" transform="translate(${-r * 0.62} ${-r * 0.62}) scale(${(r * 1.24) / 64})" d="${UI_ICONS.lock}"/>` : ''}`;
    const label = n.lx === undefined ? '' : `<text class="tb-l tb-l-${n.k}" x="${n.lx - n.x}" y="${n.ly! - n.y}" dy="1em">${n.l}</text>`;
    return `<g class="tb-n tb-${n.k}" data-id="${n.id}" role="button" tabindex="${tab}" aria-label="${name}" transform="translate(${n.x} ${n.y})" style="--h:${hue};--d:${delay(n)}ms">${dots}<circle class="tb-hit" r="${Math.max(r + 5, 12)}"/><g class="tb-g">${glyph}</g>${label}</g>`;
  }).join('');
  return `<g class="tb-cam">${edges}${nodes}<circle class="tb-ring" r="9"/></g>`;
}

const BOX = (() => {
  const xs = NODES.flatMap((n) => [n.x - 20, n.x + 20, (n.lx ?? n.x) - 10, (n.lx ?? n.x) + 80]), ys = NODES.flatMap((n) => [n.y - 26, n.y + 26, (n.ly ?? n.y) + 26]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
})();

export type BrainHost = { state(): DemoState; answer(i: number, kind: 'yes' | 'no'): void; openNeeds(i: number): void; say(msg: string): void; visible(): boolean };

export function mountBrain(root: HTMLElement, host: BrainHost) {
  const $ = <T extends HTMLElement>(q: string) => root.querySelector<T>(q)!;
  const stage = $('.tb-stage'), svg = root.querySelector<SVGSVGElement>('.tb-svg')!, insp = $('.tb-insp'), trail = $('.tb-crumbs'), pill = $('.tb-read');
  const input = $<HTMLInputElement>('.tb-q-in'), results = $('.tb-res'), zoomOut = $('.tb-zv');
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  svg.innerHTML = renderMap();
  const cam = svg.querySelector<SVGGElement>('.tb-cam')!, ring = svg.querySelector<SVGCircleElement>('.tb-ring')!;
  const nodes = [...svg.querySelectorAll<SVGGElement>('.tb-n')], edges = [...svg.querySelectorAll<SVGPathElement>('.tb-e')];
  let s = BRAIN_START, view = { x: 0, y: 0, k: 1 }, fitK = 1, moved = false, reading = 0;

  function apply() {
    cam.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
    svg.style.setProperty('--k', String(view.k));
    svg.style.setProperty('--ns', String(Math.max(1, 0.6 / view.k)));
    svg.classList.toggle('tb-far', view.k < 0.52);
    zoomOut.textContent = `${Math.round((view.k / fitK) * 100)}%`;
  }
  function fit() {
    const w = svg.clientWidth, h = svg.clientHeight;
    if (!w || !h) return;
    fitK = Math.min((w - 24) / (BOX.x1 - BOX.x0), (h - 44) / (BOX.y1 - BOX.y0));
    view = { k: fitK, x: w / 2 - (fitK * (BOX.x0 + BOX.x1)) / 2, y: h / 2 - (fitK * (BOX.y0 + BOX.y1)) / 2 };
    moved = false;
    apply();
  }
  const panelOver = () => getComputedStyle(insp).position === 'absolute';
  function centre(n: BrainNode, k = view.k) {
    const w = svg.clientWidth - (panelOver() ? insp.offsetWidth + 12 : 0);
    view = { k, x: w / 2 - n.x * k, y: svg.clientHeight / 2 - n.y * k };
    moved = true;
    apply();
  }

  function paint() {
    const d = host.state(), on = lit(s, d), open = unsure(d), rel = s.sel ? related(s.sel) : null;
    nodes.forEach((g) => {
      const id = g.dataset.id!;
      g.classList.toggle('dim', !!on && !on.has(id));
      g.classList.toggle('unsure', open.has(id));
      g.classList.toggle('on', !!rel && rel.has(id));
    });
    edges.forEach((e) => {
      const a = e.dataset.a!, b = e.dataset.b!, both = !!on && on.has(a) && on.has(b);
      e.classList.toggle('dim', !!on && !both);
      e.classList.toggle('on', !!rel && both && (a === s.sel || b === s.sel || chainHas(s.sel!, a, b)));
    });
    const n = s.sel ? nodeOf(s.sel) : null;
    ring.classList.toggle('show', !!n);
    if (n) ring.setAttribute('transform', `translate(${n.x} ${n.y})`);
    root.querySelector('.tb-un')!.textContent = String(open.size);
    root.querySelectorAll<HTMLElement>('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === s.filter)));
  }
  const chainHas = (id: string, a: string, b: string) => { const c = crumbs(id).map((x) => x.id); return c.includes(a) && c.includes(b); };

  function showPanel(focusTitle: boolean) {
    const n = s.sel ? nodeOf(s.sel) : null;
    stage.classList.toggle('tb-open', !!n);
    insp.hidden = !n;
    trail.hidden = !n;
    if (!n) return;
    insp.innerHTML = renderInspector(n.id, host.state());
    trail.innerHTML = crumbs(n.id).map((c, i, all) => `${i ? '<span aria-hidden="true">›</span>' : ''}<button type="button" data-go="${c.id}"${i === all.length - 1 ? ' aria-current="true"' : ''}>${c.label}</button>`).join('');
    if (focusTitle) insp.querySelector<HTMLElement>('h4')?.focus({ preventScroll: true });
  }
  function select(id: string, focusTitle = false) {
    const n = nodeOf(id);
    if (!n) return;
    s = reduceBrain(s, { type: 'select', id });
    svg.classList.remove('tb-wait');
    showPanel(focusTitle);
    paint();
    centre(n, panelOver() ? Math.max(view.k, fitK) : Math.max(view.k, Math.min(1, fitK * 2.2)));
    host.say(`${n.l}. ${related(id).size - 1} connected.`);
  }
  function clear() {
    const was = s.sel;
    s = reduceBrain(s, { type: 'clear' });
    showPanel(false);
    paint();
    fit();
    if (was) nodes.find((g) => g.dataset.id === was)?.focus({ preventScroll: true });
  }
  function roam(g: SVGGElement) {
    nodes.forEach((x) => x.setAttribute('tabindex', x === g ? '0' : '-1'));
    g.focus({ preventScroll: true });
  }
  /* arrow keys walk to the nearest node that way; the map is one tab stop */
  function nearest(from: BrainNode, key: string) {
    const [ax, ay] = key === 'ArrowLeft' ? [-1, 0] : key === 'ArrowRight' ? [1, 0] : key === 'ArrowUp' ? [0, -1] : [0, 1];
    let best: SVGGElement | null = null, score = Infinity;
    nodes.forEach((g) => {
      const n = byId.get(g.dataset.id!)!, dx = n.x - from.x, dy = n.y - from.y, along = dx * ax + dy * ay;
      if (along <= 0) return;
      const cost = along + Math.abs(dx * ay) * 2 + Math.abs(dy * ax) * 2;
      if (cost < score) { score = cost; best = g; }
    });
    return best as SVGGElement | null;
  }

  let drag: { x: number; y: number; vx: number; vy: number } | null = null, dragged = false;
  svg.addEventListener('pointerdown', (e) => {
    dragged = false;
    if (e.pointerType === 'mouse' && e.button === 0) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    dragged = true;
    svg.classList.add('drag');
    view = { ...view, x: drag.vx + dx, y: drag.vy + dy };
    moved = true;
    apply();
  });
  const endDrag = () => { drag = null; svg.classList.remove('drag'); };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointerleave', endDrag);
  svg.addEventListener('click', (e) => {
    if (dragged) return;
    const g = (e.target as Element).closest<SVGGElement>('.tb-n');
    if (g) { roam(g); select(g.dataset.id!); } else if (s.sel) clear();
  });
  /* only a pinch (ctrl+wheel) zooms; a plain wheel keeps scrolling the page */
  svg.addEventListener('wheel', (e) => { if (e.ctrlKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 0.89); } }, { passive: false });
  svg.addEventListener('keydown', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.tb-n');
    if (!g) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g.dataset.id!); }
    else if (e.key === 'Escape' && s.sel) { e.preventDefault(); clear(); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const to = nearest(byId.get(g.dataset.id!)!, e.key);
      if (to) roam(to);
    }
  });
  function zoom(by: number) {
    const k = Math.min(fitK * 4, Math.max(fitK * 0.6, view.k * by)), w = svg.clientWidth / 2, h = svg.clientHeight / 2;
    view = { k, x: w - ((w - view.x) * k) / view.k, y: h - ((h - view.y) * k) / view.k };
    moved = true;
    apply();
  }
  function showResults() {
    const hits = search(s.q);
    results.hidden = !hits.length;
    results.innerHTML = hits.map((r) => `<button type="button" data-go="${r.id}"><b>${r.label}</b><small>${r.sub}</small></button>`).join('');
    input.setAttribute('aria-expanded', String(!!hits.length));
  }
  input.addEventListener('input', () => { s = reduceBrain(s, { type: 'query', q: input.value }); showResults(); paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const first = results.querySelector<HTMLElement>('[data-go]'); if (first) { e.preventDefault(); first.click(); } }
    else if (e.key === 'Escape') { input.value = ''; s = reduceBrain(s, { type: 'query', q: '' }); showResults(); paint(); }
    else if (e.key === 'ArrowDown') { const first = results.querySelector<HTMLElement>('[data-go]'); if (first) { e.preventDefault(); first.focus(); } }
  });
  results.addEventListener('keydown', (e) => {
    const all = [...results.querySelectorAll<HTMLElement>('button')], at = all.indexOf(e.target as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); (all[at + (e.key === 'ArrowDown' ? 1 : -1)] ?? input).focus(); }
    else if (e.key === 'Escape') { input.focus(); results.hidden = true; }
  });
  document.addEventListener('pointerdown', (e) => { if (!results.hidden && !(e.target as Element).closest('.tb-find')) results.hidden = true; });

  root.querySelector('[data-screen-panel="brain"]')!.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    const { go, f, ans, needs, z } = b.dataset;
    if (go) {
      if (b.closest('.tb-res')) { input.value = ''; s = reduceBrain(s, { type: 'query', q: '' }); showResults(); }
      select(go, true);
    } else if (f) { s = reduceBrain(s, { type: 'filter', filter: f as BrainState['filter'] }); if (s.sel) clear(); else paint(); host.say(f === 'unsure' ? `Showing ${unsure(host.state()).size} things Tuck is unsure about.` : 'Showing everything.'); }
    else if (ans) { const n = nodeOf(s.sel!); if (n?.need !== undefined) { host.answer(n.need, ans as 'yes' | 'no'); showPanel(true); paint(); } }
    else if (needs !== undefined) host.openNeeds(Number(needs));
    else if ('clear' in b.dataset) clear();
    else if (z === 'in') zoom(1.25);
    else if (z === 'out') zoom(0.8);
    else if (z === 'fit') { if (s.sel) clear(); else fit(); }
    else if ('replay' in b.dataset) read();
  });

  /* Tuck reads: the map grows out from You while a counter runs. Short, once, and skipped for reduced motion. */
  function read() {
    if (s.sel) clear();
    svg.classList.remove('tb-reading', 'tb-wait');
    if (calm()) return;
    void svg.getBoundingClientRect();
    svg.classList.add('tb-reading');
    const total = fileCount('you'), t0 = performance.now(), run = ++reading, label = pill.querySelector('span')!;
    pill.hidden = false;
    host.say(`Tuck is reading ${total} files.`);
    const tick = () => {
      if (run !== reading) return;
      const p = Math.min(1, (performance.now() - t0) / 2200);
      label.textContent = `Tuck is reading ${Math.round(p * total)} of ${total} files in Downloads, Desktop and Documents`;
      if (p < 1) { requestAnimationFrame(tick); return; }
      const open = unsure(host.state()).size;
      label.textContent = `Read ${total} files. ${open ? `Unsure about ${open}.` : 'Sure about all of them.'} Press any node.`;
      host.say(label.textContent);
      setTimeout(() => { if (run === reading) { pill.hidden = true; svg.classList.remove('tb-reading'); } }, 2400);
    };
    requestAnimationFrame(tick);
  }

  new ResizeObserver(() => { if (!moved && !s.sel) fit(); else apply(); }).observe(svg);
  fit();
  paint();
  if (calm()) svg.classList.remove('tb-wait');
  else {
    const seen = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting) && host.visible()) { seen.disconnect(); if (s.sel) svg.classList.remove('tb-wait'); else read(); } }, { threshold: 0.35 });
    seen.observe(stage);
  }
  return {
    sync() { paint(); if (s.sel) showPanel(false); },
    shown() { if (!moved && !s.sel) fit(); },
    answerKey(kind: 'yes' | 'no') { const n = s.sel ? nodeOf(s.sel) : null; if (n?.need !== undefined && unsure(host.state()).has(n.id)) { host.answer(n.need, kind); showPanel(true); paint(); return true; } return false; },
  };
}
