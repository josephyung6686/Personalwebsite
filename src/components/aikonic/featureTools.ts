// What Ask does when told to act. A small command reader standing in for the conversational agent: every call is checked
// against the open recording's folder before anything happens. The groups are from his report; the 21 tools are not named.
import { BUILT } from './aikonicBuilt';
import { el } from './aikonicDom';
import { FOLDERS, isQuestion, meetingById } from './aikonicSearch';

export const TOOL_COUNT = 21;
export const GROUPS = [
  { id: 'podcast', name: 'Generate a podcast episode from an individual recording or folder', outcome: 'Episode queued' },
  { id: 'summary', name: 'Produce or regenerate a meeting summary', outcome: 'Summary regenerated' },
  { id: 'edit', name: 'Edit transcript and summary files', outcome: 'Edit saved' },
  { id: 'move', name: 'Move and reorganize recordings between folders', outcome: 'Recording moved' },
  { id: 'memory', name: 'Trigger correction and memory operations', outcome: 'Memory operation triggered' },
  { id: 'manage', name: 'Manage recordings through conversational commands', outcome: 'Recording updated' },
] as const;
export type GroupId = (typeof GROUPS)[number]['id'];

export const COMMANDS = [
  'Generate a podcast from Q3 launch sync',
  'Regenerate the summary of Menu review',
  'Edit the transcript of Q3 launch sync',
  'Move this to the Q3 folder',
  'Remember that the opening moved to 21 September',
  'Rename Menu review to Menu tasting',
  'Summarize Board prep',
];

export type ToolResult =
  | { kind: 'empty' }
  | { kind: 'no-tool' }
  | { kind: 'need-target'; group: GroupId; options: string[] }
  | { kind: 'refused'; group: GroupId; target: string; owner: string; scope: string }
  | { kind: 'call'; group: GroupId; target: string; scope: string; outcome: string; dest?: string };

const INTENTS: [GroupId, RegExp][] = [
  ['edit', /\b(edit|rewrite|fix|change)\b/],
  ['memory', /\b(remember|memory|forget|correct|correction)\b/],
  ['podcast', /\b(podcast|episode)\b/],
  ['summary', /\b(summary|summari[sz]e|recap|regenerate)\b/],
  ['move', /\b(move|reorganize|reorganise)\b/],
  ['manage', /\b(rename|delete|archive|list|manage)\b/],
];
const names = (meetings: string[]) => meetings.map((id) => meetingById(id).name);

/** Reads a command, finds which capability it needs, then checks everything it names against the open folder. "This" means the open recording. */
export function interpret(text: string, folderId: string, openRecording?: string): ToolResult {
  const t = text.trim().toLowerCase();
  if (!t) return { kind: 'empty' };
  // A question is for search, even when it happens to contain a command word.
  if (isQuestion(t)) return { kind: 'no-tool' };
  const group = INTENTS.find(([, re]) => re.test(t))?.[0];
  if (!group) return { kind: 'no-tool' };
  const here = FOLDERS.find((f) => f.id === folderId)!;

  for (const f of FOLDERS) {
    if (f.id === here.id) continue;
    const named = names(f.meetings).find((r) => t.includes(r.toLowerCase())) ?? (t.includes(f.name.toLowerCase()) ? f.name : null);
    if (named) return { kind: 'refused', group, target: named, owner: f.name, scope: here.name };
  }
  const options = names(here.meetings);
  const saysThis = /\b(this|it)\b/.test(t.replace('this folder', ''));
  const recording = options.find((r) => t.includes(r.toLowerCase())) ?? (saysThis ? openRecording : undefined);
  const wholeFolder = t.includes('this folder') || t.includes(here.name.toLowerCase()) || group === 'memory';
  const target = recording ?? (wholeFolder ? `Folder: ${here.name}` : null);
  if (!target) return { kind: 'need-target', group, options };
  const dest = group === 'move' ? text.trim().match(/\bto\s+(?:the\s+)?(.+?)(?:\s+folder)?[.!]?$/i)?.[1] : undefined;
  return { kind: 'call', group, target, scope: here.name, outcome: GROUPS.find((g) => g.id === group)!.outcome, dest };
}

export type ToolCall = Exclude<ToolResult, { kind: 'empty' } | { kind: 'no-tool' }>;

const whole = (target: string) => target.startsWith('Folder: ');
const plain = (target: string) => target.replace('Folder: ', '');
const DONE: Record<GroupId, (what: string, r: Extract<ToolResult, { kind: 'call' }>) => string> = {
  podcast: (w) => `Queued a podcast of ${w}.`,
  summary: (w, r) => `Summarized ${w}.${whole(r.target) ? '' : ' It’s on the Summary tab.'}`,
  edit: (w) => `Saved your edit to ${w}.`,
  move: (w, r) => (whole(r.target) ? 'Which recording should I move?' : r.dest ? `Moved ${w} to the ${r.dest} folder.` : `Where should ${w} go? Name a folder.`),
  memory: () => 'Got it, I’ll remember that.',
  manage: (w) => `Updated ${w}.`,
};

/** What Ask says back, as a person would: one sentence, with the technical record kept for the drawer. */
export function replyFor(r: ToolCall): string {
  if (r.kind === 'need-target') return `Which recording do you mean? This folder has ${r.options.join(', ')}.`;
  if (r.kind === 'refused') return `I can only work in the folder you have open, so I left ${r.target} alone.`;
  return DONE[r.group](plain(r.target), r);
}

const row = (label: string, value: string) => {
  const line = el('div', 'aik-row');
  line.append(el('dt', '', label), el('dd', '', value));
  return line;
};

/** The drawer's record of the last request: what the folder check saw and decided. */
export function renderCall(box: HTMLElement, r: ToolCall | null): void {
  if (!r) {
    box.replaceChildren(el('p', 'aik-note', 'Send a request, and the check it went through appears here.'));
    return;
  }
  const rows = el('dl', 'aik-rows');
  rows.append(row('Capability', GROUPS.find((g) => g.id === r.group)!.name));
  if (r.kind === 'need-target') {
    box.replaceChildren(el('p', 'aik-h', 'Last request: which recording?'), rows, el('p', 'aik-note', `This folder can only reach: ${r.options.join(', ')}.`));
    return;
  }
  rows.append(row('Folder scope', r.scope));
  if (r.kind === 'refused') {
    rows.append(row('Target', `${r.target}, in ${r.owner}`));
    box.replaceChildren(el('p', 'aik-h', 'Last request: refused, outside this folder'), rows, el('p', 'aik-note', 'Nothing was read or changed.'));
    return;
  }
  rows.append(row('Target', r.target));
  if (r.dest) rows.append(row('To', r.dest));
  rows.append(row('Result (simulated)', r.outcome));
  box.replaceChildren(el('p', 'aik-h', 'Last request: tool call allowed'), rows);
}

export function fillDrawer(body: HTMLElement): void {
  body.innerHTML = `
    <p class="aik-built"><b>What I built</b> ${BUILT.tools}</p>
    <div class="aik-last"></div>
    <p class="aik-note"><b>${TOOL_COUNT} discrete tool calls</b>, each scoped to a narrow capability instead of one general-purpose action. What they cover:</p>
    <ul class="aik-groups">${GROUPS.map((g) => `<li><i aria-hidden="true"></i>${g.name}</li>`).join('')}</ul>
    <p class="aik-note">Six capability groups from the work. The individual tools are not named here. Every call is folder-scoped, so the agent can only read or modify recordings in the folder this conversation can access.</p>
    <p class="aik-note">Citations stay traceable to a recording and timestamp. One that resolves to no recording stays plain text and is never a link.</p>`;
}
