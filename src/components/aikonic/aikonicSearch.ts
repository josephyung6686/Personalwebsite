// A small, real hybrid search for the Aikonic demo. Pure logic with no DOM.
// The meetings belong to a made-up tea chain. Nothing here comes from Aikonic's product or its users.

export type Lang = 'en' | 'yue' | 'cmn' | 'ja';
export type Mode = 'keyword' | 'semantic' | 'both';
export type Passage = { id: string; meetingId: string; lang: Lang; start: number; speaker: string; text: string; gloss?: string };
export type Meeting = { id: string; name: string; title: string; lang: Lang; duration: number; passages: Passage[] };
export type Hit = { passage: Passage; score: number; keyword: boolean; semantic: boolean; ranks: { keyword?: number; semantic?: number } };
export type Segment = { text: string; kind: 'keyword' | 'meaning' | null };

export const LANG_NAME: Record<Lang, string> = { en: 'English', yue: 'Cantonese', cmn: 'Mandarin', ja: 'Japanese' };
export const LANG_TAG: Record<Lang, string> = { en: 'en', yue: 'yue-Hant', cmn: 'zh-Hans', ja: 'ja' };

// A made-up Japanese meeting. It is a normal recording, and the "before" and "after" of the chunking fix both read it.
export type Utterance = { start: number; text: string; gloss: string };
export const JA_MEETING: Utterance[] = [
  { start: 0, text: '本日は大阪店の開店準備について確認します。', gloss: 'Today we will go over the Osaka store opening.' },
  { start: 252, text: '内装工事は予定どおり来週で終わる見込みです。', gloss: 'The fit-out should finish next week as planned.' },
  { start: 577, text: 'スタッフの研修は開店の二週間前に始めます。', gloss: 'Staff training starts two weeks before opening.' },
  { start: 845, text: '予算は百万円増えましたが、部長の承認を得ました。', gloss: 'The budget rose by a million yen, and the department head approved it.' },
  { start: 1308, text: '次回の会議までに仕入れ先を決めてください。', gloss: 'Please decide on the supplier by the next meeting.' },
];

const build = (id: string, name: string, title: string, lang: Lang, duration: number, rows: [number, string, string, string?][]): Meeting => ({
  id, name, title, lang, duration,
  passages: rows.map(([start, speaker, text, gloss], i) => ({ id: `${id}-${i}`, meetingId: id, lang, start, speaker, text, gloss })),
});

export const MEETINGS: Meeting[] = [
  build('launch', 'Q3 launch sync', 'Q3 launch sync', 'en', 2292, [
    [134, 'Priya', 'The Kowloon opening is still set for early September.'],
    [461, 'Sam', 'Purchase order PO-8812 has not shipped. Our supplier blames a delay.'],
    [806, 'Priya', 'Marketing can hold the launch two weeks if we decide by Friday.'],
    [1378, 'Sam', 'The decision: move the opening to the third week of September.'],
  ]),
  build('menu', 'Menu review', '新品會議 Menu review', 'yue', 1860, [
    [185, 'Ka Yan', '新出嗰隻桂花烏龍試飲反應好好，不過成本貴過預期，每杯多咗三蚊。', 'The new osmanthus oolong tasted well, but it costs more than expected, three dollars more a cup.'],
    [562, 'Ho Yin', '最大問題係供應商出唔到貨，珍珠要遲兩個禮拜先到。', 'The biggest problem is the supplier cannot ship. The pearls will arrive two weeks late.'],
    [948, 'Ka Yan', '咁九龍分店開張可能要推遲，我哋下禮拜再定日子。', 'Then the Kowloon store opening may have to be pushed back. We will set the date next week.'],
    [1290, 'Ho Yin', '客人投訴杯蓋漏水，呢批要全部回水，順手換過另一間廠。', 'Customers complained the lids leak. Give all of this batch their money back, and switch to another factory.'],
    [1626, 'Ka Yan', '新同事嘅培訓下個月開始，每間分店派兩個人上嚟學。', 'Training for new staff starts next month. Each store sends two people.'],
  ]),
  build('supply', 'Supply chain weekly', '供应链周会 Supply chain weekly', 'cmn', 1740, [
    [100, 'Lin Wei', '这周最大的风险是港口拥堵，第二批茶叶的交货时间延迟了十天。', 'The biggest risk this week is port congestion. Delivery of the second batch of tea slipped ten days.'],
    [495, 'Lin Wei', '我们已经联系备用供应商，价格高百分之八，但可以月底前到货。', 'We contacted a backup supplier. They cost eight percent more, but can deliver by the end of the month.'],
    [1012, 'Chen Jing', '如果下个季度预算不变，就要减少新店数量，先暂停招聘。', 'If the budget stays flat next quarter, we open fewer stores and pause hiring first.'],
    [1449, 'Chen Jing', '客户退款的流程太慢了，平均要五天，我们要缩短到两天。', 'The customer refund process is too slow, five days on average. We want it down to two.'],
  ]),
  build('osaka', 'Osaka store prep', '開店準備 Osaka store prep', 'ja', 1620, JA_MEETING.map((l, i) => [l.start, i % 2 ? 'Ren' : 'Aoi', l.text, l.gloss] as [number, string, string, string])),
  build('support', 'Customer support retro', 'Customer support retro', 'en', 2030, [
    [273, 'Dana', 'Refunds take five days on average because every one needs a manager to sign off.'],
    [680, 'Omar', 'Most complaints this month are about leaking lids, not the drinks.'],
    [1085, 'Dana', 'Training for new store staff should begin before the opening, not after it.'],
    [1787, 'Omar', 'Let us freeze new headcount until the budget review.'],
  ]),
  build('board', 'Board prep', 'Board prep', 'en', 1500, [
    [210, 'Mara', 'The board wants the budget review by the end of the month.'],
    [930, 'Mara', 'Prices stay as they are this year.'],
  ]),
];

/** Every recording sits in one folder. The open recording's folder is what the agent's tools are scoped to. */
export const FOLDERS = [
  { id: 'stores', name: 'Store openings', meetings: ['launch', 'menu', 'supply', 'osaka'] },
  { id: 'support', name: 'Customer support', meetings: ['support'] },
  { id: 'finance', name: 'Finance', meetings: ['board'] },
];
export const meetingById = (id: string): Meeting => MEETINGS.find((m) => m.id === id)!;
export const folderOf = (meetingId: string) => FOLDERS.find((f) => f.meetings.includes(meetingId))!;
export const PASSAGES: Passage[] = MEETINGS.flatMap((m) => m.passages);

export const SUGGESTIONS: { query: string; hint: string }[] = [
  { query: 'supplier delay', hint: 'English finds Chinese' },
  { query: '退款', hint: 'Chinese finds English' },
  { query: 'why is the opening late', hint: 'Said another way' },
  { query: 'PO-8812', hint: 'An exact code' },
];

// Traditional to Simplified, one character to one, in pairs, for the characters this demo is likely to meet. A real system would use a full table.
const PAIRS = '應应貨货遲迟開开張张問问題题係系禮礼會会議议產产線线圖图業业廠厂蓋盖訴诉換换過过間间請请訓训預预費费錢钱單单運运門门後后時时為为個个們们來来這这還还進进價价風风險险較较減减數数處处現现發发達达將将對对經经與与無无關关東东見见樣样總总點点從从兩两師师隻只試试飲饮貴贵烏乌龍龙順顺學学遲迟業业';
const T2S = new Map(Array.from({ length: PAIRS.length / 2 }, (_, i) => [PAIRS[i * 2], PAIRS[i * 2 + 1]] as const));

/** Lowercase and map to Simplified. Keeps string length, so positions found here highlight the original text. */
export function fold(text: string): string {
  return [...text.toLowerCase()].map((c) => T2S.get(c) ?? c).join('');
}

const STOP = new Set('a an and are as at be but by can did do does for from had has have how i if in is it its let not of on or our so that the their them they this to us was we were what when where who why will with you about'.split(' '));
const CJK = /[\u3040-\u30ff㐀-鿿]+/g;
const LATIN = /[a-z0-9]+(?:-[a-z0-9]+)*/g;
const stem = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** Words for Latin text, overlapping character pairs for Chinese. A passage also indexes single characters; a query only uses them alone. */
export function tokenize(text: string, isQuery = false): string[] {
  const t = fold(text);
  const out: string[] = [];
  for (const w of t.match(LATIN) ?? []) {
    if (STOP.has(w)) continue;
    out.push(stem(w));
    if (w.includes('-')) out.push(...w.split('-').map(stem));
  }
  for (const run of t.match(CJK) ?? []) {
    const chars = [...run];
    if (!isQuery || chars.length === 1) out.push(...chars);
    for (let i = 0; i + 1 < chars.length; i++) out.push(chars[i] + chars[i + 1]);
  }
  return out;
}

// BM25 over the sample corpus: the standard keyword scoring formula.
const DOCS = PASSAGES.map((p) => {
  const tf = new Map<string, number>();
  const tokens = tokenize(p.text);
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { tf, length: tokens.length };
});
const AVG_LEN = DOCS.reduce((a, d) => a + d.length, 0) / DOCS.length;
const DF = new Map<string, number>();
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) ?? 0) + 1);

function bm25(terms: string[], doc: (typeof DOCS)[number]): number {
  let score = 0;
  for (const t of new Set(terms)) {
    const f = doc.tf.get(t);
    if (!f) continue;
    const df = DF.get(t) ?? 0;
    const idf = Math.log(1 + (DOCS.length - df + 0.5) / (df + 0.5));
    score += (idf * f * 2.2) / (f + 1.2 * (0.25 + (0.75 * doc.length) / AVG_LEN));
  }
  return score;
}

// The stand-in for an embedding model: each concept lists its words in English, Cantonese and Mandarin, already folded to Simplified.
const CONCEPTS: Record<string, string[]> = {
  supplier: ['supplier', 'suppliers', 'vendor', 'vendors', '供应商', '供货商', '厂', '仕入れ先'],
  delay: ['delay', 'delays', 'delayed', 'late', 'later', 'slip', 'slipped', 'postpone', 'postponed', 'pushed back', 'hold', 'move', 'behind', '延迟', '推迟', '迟', '拥堵', '延误'],
  opening: ['opening', 'open', 'launch', 'launches', 'launched', 'grand opening', 'new store', '开张', '开业', '新店', '开店'],
  refund: ['refund', 'refunds', 'refunded', 'money back', 'reimburse', '退款', '退钱', '回水'],
  budget: ['budget', 'budgets', 'cost', 'costs', 'spend', 'spending', '预算', '成本', '予算'],
  price: ['price', 'prices', 'pricing', 'expensive', '价格', '贵', '三蚊'],
  hiring: ['hiring', 'hire', 'headcount', 'recruit', 'recruiting', '招聘', '请人'],
  complaint: ['complaint', 'complaints', 'complain', 'complained', '投诉'],
  training: ['training', 'train', 'onboarding', '培训', '研修'],
  shipping: ['shipped', 'ship', 'shipment', 'shipping', 'delivery', 'deliver', '到货', '交货', '出货', '货'],
  ingredient: ['pearl', 'pearls', 'tapioca', 'tea', 'oolong', '珍珠', '茶叶', '乌龙'],
  defect: ['leak', 'leaks', 'leaking', 'lid', 'lids', '漏水', '杯盖'],
  decision: ['decide', 'decided', 'decision', '决定', '定日子'],
};

const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);
/** Every position of a term in folded text. Latin terms must sit on word edges; Chinese has no word edges to check. */
function findTerm(folded: string, term: string): number[] {
  const out: number[] = [];
  const latin = /[a-z0-9]/.test(term[0]);
  for (let at = folded.indexOf(term); at >= 0; at = folded.indexOf(term, at + 1)) {
    if (!latin || (!isWordChar(folded[at - 1]) && !isWordChar(folded[at + term.length]))) out.push(at);
  }
  return out;
}

export function conceptsOf(text: string): Set<string> {
  const folded = fold(text);
  const found = new Set<string>();
  for (const [id, terms] of Object.entries(CONCEPTS)) if (terms.some((t) => findTerm(folded, t).length > 0)) found.add(id);
  return found;
}

export const CONCEPT_COUNT = Object.keys(CONCEPTS).length;
const VECTORS = PASSAGES.map((p) => conceptsOf(p.text));
const SEMANTIC_FLOOR = 0.4;

/** Cosine similarity between two concept sets, which is what an embedding comparison would do over real vectors. */
function cosine(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const c of a) if (b.has(c)) shared++;
  return shared / Math.sqrt(a.size * b.size);
}

const byScore = (a: { i: number; score: number }, b: { i: number; score: number }) => b.score - a.score || a.i - b.i;

function keywordList(query: string) {
  const terms = tokenize(query, true);
  return DOCS.map((d, i) => ({ i, score: bm25(terms, d) })).filter((r) => r.score > 0).sort(byScore);
}
function semanticList(query: string) {
  const q = conceptsOf(query);
  return VECTORS.map((v, i) => ({ i, score: cosine(q, v) })).filter((r) => r.score >= SEMANTIC_FLOOR).sort(byScore);
}

const RRF_K = 60;

/** Runs one mode. Both merges the two ranked lists with Reciprocal Rank Fusion, so neither scoring scale can drown the other.
 *  With the embedding service down, vector search has nothing to return, and keyword search keeps answering on its own. */
export function search(query: string, mode: Mode, opts: { embeddingsDown?: boolean } = {}): Hit[] {
  if (!query.trim()) return [];
  const kw = mode === 'semantic' ? [] : keywordList(query);
  const sem = mode === 'keyword' || opts.embeddingsDown ? [] : semanticList(query);
  const rank = (list: { i: number }[], i: number) => { const at = list.findIndex((r) => r.i === i); return at < 0 ? undefined : at + 1; };
  const hit = (i: number, score: number): Hit => {
    const ranks = { keyword: rank(kw, i), semantic: rank(sem, i) };
    return { passage: PASSAGES[i], score, keyword: ranks.keyword !== undefined, semantic: ranks.semantic !== undefined, ranks };
  };
  if (mode === 'keyword') return kw.map((r) => hit(r.i, r.score));
  if (mode === 'semantic') return sem.map((r) => hit(r.i, r.score));
  const fused = new Map<number, number>();
  [kw, sem].forEach((list) => list.forEach((r, at) => fused.set(r.i, (fused.get(r.i) ?? 0) + 1 / (RRF_K + at + 1))));
  return [...fused].map(([i, score]) => ({ i, score })).sort(byScore).map((r) => hit(r.i, r.score));
}

/** Cuts a passage into plain and marked pieces, marking only what the given mode used. Literal query words win over related ones. */
export function segments(hit: Hit, query: string, mode: Mode): Segment[] {
  const text = hit.passage.text;
  const folded = fold(text);
  const kinds: Segment['kind'][] = new Array(text.length).fill(null);
  const mark = (term: string, kind: 'keyword' | 'meaning') => {
    for (const at of findTerm(folded, term)) for (let k = at; k < at + term.length; k++) if (kinds[k] !== 'keyword') kinds[k] = kind;
  };
  if (mode !== 'keyword') {
    const shared = conceptsOf(query);
    for (const id of shared) for (const term of CONCEPTS[id]) mark(term, 'meaning');
  }
  if (mode !== 'semantic') {
    for (const t of tokenize(query, true)) {
      if (/[a-z0-9]/.test(t[0])) {
        // The stem was searched, so highlight the word in the form the passage uses it.
        for (const form of [t, `${t}s`]) mark(form, 'keyword');
      } else {
        mark(t, 'keyword');
      }
    }
  }
  const out: Segment[] = [];
  for (let k = 0; k < text.length; k++) {
    const last = out[out.length - 1];
    if (last && last.kind === kinds[k]) last.text += text[k];
    else out.push({ text: text[k], kind: kinds[k] });
  }
  return out;
}

/** True when the query and the passage are in different languages: Chinese on one side, English on the other. */
export function crossesLanguage(query: string, passage: Passage): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(query) !== (passage.lang !== 'en');
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Citation safeguards. An answer keeps a reference to its source; a reference that resolves to no recording stays plain text.
export const ANSWER: { text: string; ref: string }[] = [
  { text: 'The Kowloon opening moved to the third week of September.', ref: 'launch-3' },
  { text: 'The supplier could not ship the pearls on time.', ref: 'menu-1' },
  { text: 'A permit review may also have played a part.', ref: 'ops-7' },
];
export const resolveCitation = (ref: string): Passage | null => PASSAGES.find((p) => p.id === ref) ?? null;

export const SAMPLE_QUESTION = 'Why did the Kowloon opening move?';
/** `away` names the folder a prompt reaches outside of, so its hint can disappear once that folder is the open one. */
export const ASK_PROMPTS: { text: string; hint?: string; away?: string }[] = [
  { text: SAMPLE_QUESTION },
  { text: 'Move this to the Q3 folder' },
  { text: 'Summarize Board prep', hint: 'In another folder', away: 'finance' },
];

export const isQuestion = (text: string): boolean => {
  const t = text.trim().toLowerCase();
  return t.endsWith('?') || /^(why|what|when|who|where|how|did|does|do|is|are|was|were|can|could)\b/.test(t);
};

/** No language model runs here. The sample question has a written answer, and anything else is stitched from the top search hits.
 *  A real question may lean on a stray keyword. Anything else needs a match in meaning, so "Order me a pizza" does not cite a purchase order. */
export function answerFor(text: string): { text: string; ref: string }[] {
  if (text.trim().toLowerCase() === SAMPLE_QUESTION.toLowerCase()) return ANSWER;
  return search(text, isQuestion(text) ? 'both' : 'semantic').slice(0, 2).map((h) => ({ text: h.passage.gloss ?? h.passage.text, ref: h.passage.id }));
}

// Multilingual chunking: two ways of estimating how long the Japanese meeting's text is.
export type Chunk = { start: number; lines: Utterance[]; length: number };
export const CHUNK_LIMIT = 12;

/** The original estimate: split on spaces. Fine for English. Japanese has no spaces, so a whole line counts as one word. */
export const countBySpaces = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
/** The fixed estimate: Chinese and Japanese characters count for themselves, and Latin text still counts by word. */
export function estimateLength(text: string): number {
  const cjk = text.match(/[\u3040-\u30ff\u3400-\u9fff]/g)?.length ?? 0;
  const latin = text.replace(/[\u3040-\u30ff\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return Math.ceil(cjk / 2) + latin;
}

/** Closes a chunk once the next line would pass the limit. A chunk's timestamp is its first line, so one huge chunk has one useless timestamp. */
export function chunkLines(lines: Utterance[], estimate: (t: string) => number, limit = CHUNK_LIMIT): Chunk[] {
  const out: Chunk[] = [];
  for (const line of lines) {
    const size = estimate(line.text);
    const last = out[out.length - 1];
    if (last && last.length + size <= limit) { last.lines.push(line); last.length += size; }
    else out.push({ start: line.start, lines: [line], length: size });
  }
  return out;
}
export const citeTerm = (chunks: Chunk[], term: string): number | null => chunks.find((c) => c.lines.some((l) => l.text.includes(term)))?.start ?? null;
