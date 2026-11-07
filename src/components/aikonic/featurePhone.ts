// The phone view: the same note as the window, at phone size, with the app's language switch. The sample note is translated;
// other notes keep their English content under localized app text. The translations are invented sample data.
import { BUILT } from './aikonicBuilt';
import { drawerMarkup, el, fillOnOpen, pressGroup } from './aikonicDom';
import { NOTES, flatten, type Block, type TodoState, type Todo } from './aikonicNotes';

export type LocaleId = 'en' | 'ja' | 'zh-Hant';
export const LOCALES: { id: LocaleId; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'ja', label: 'JA' },
  { id: 'zh-Hant', label: '繁中' },
];
const TRANSLATED = 'launch';
export const STRINGS = {
  en: {
    title: 'Q3 launch sync', summary: 'Summary', todosH: 'To-dos', share: 'Share note', retry: 'Try again', saved: 'Saved on this device',
    notSaved: 'Could not save here. Check marks will reset when you leave.',
    failed: 'Could not share this note. Check your connection and try again.', shared: 'Note shared.',
    blocks: NOTES.launch.blocks, todos: NOTES.launch.todos,
  },
  ja: {
    title: 'Q3 ローンチ定例', summary: '要約', todosH: 'やること', share: 'ノートを共有', retry: '再試行', saved: 'この端末に保存しました',
    notSaved: '保存できませんでした。画面を離れるとチェックは元に戻ります。',
    failed: 'ノートを共有できませんでした。接続を確認して、もう一度お試しください。', shared: 'ノートを共有しました。',
    blocks: [
      { type: 'heading', text: '決定事項' }, { type: 'bullet', text: '九龍店の開店を9月21日に変更する。' },
      { type: 'heading', text: 'リスク' }, { type: 'bullet', text: '茶葉の第2便が10日遅れている。' }, { type: 'bullet', text: '蓋の漏れが最も多い苦情である。' },
    ] as Block[],
    todos: [{ id: 'fitout', text: '内装工事の新しい日程を確認する' }, { id: 'supplier', text: '代替の仕入れ先に連絡する' }, { id: 'lids', text: '新しい蓋を発注する' }],
  },
  'zh-Hant': {
    title: 'Q3 上線會議', summary: '摘要', todosH: '待辦事項', share: '分享筆記', retry: '重試', saved: '已儲存在此裝置',
    notSaved: '無法儲存。離開後勾選會還原。',
    failed: '無法分享此筆記。請檢查連線後再試一次。', shared: '已分享筆記。',
    blocks: [
      { type: 'heading', text: '決定' }, { type: 'bullet', text: '九龍分店開幕改為9月21日。' },
      { type: 'heading', text: '風險' }, { type: 'bullet', text: '第二批茶葉延遲十天。' }, { type: 'bullet', text: '杯蓋漏水是最多的投訴。' },
    ] as Block[],
    todos: [{ id: 'fitout', text: '確認新的裝修日期' }, { id: 'supplier', text: '聯絡備用供應商' }, { id: 'lids', text: '訂購新杯蓋' }],
  },
};

/** What the phone shows for a note in a language. `translated` is false when the content stays in English under localized app text. */
export function noteFor(meetingId: string, locale: LocaleId): { blocks: Block[]; todos: Todo[]; translated: boolean } {
  if (meetingId === TRANSLATED) return { blocks: STRINGS[locale].blocks, todos: STRINGS[locale].todos, translated: true };
  return { ...NOTES[meetingId], translated: locale === 'en' };
}

export function mount(host: HTMLElement, ctx: { meetingId: () => string; title: () => string; todos: TodoState }) {
  host.innerHTML = `
    <p class="aik-view-h">The same note, phone size</p>
    <div class="aik-seg" role="group" aria-label="App language" data-group="lang">
      ${LOCALES.map((l, i) => `<button type="button" class="aik-key sm" data-value="${l.id}" aria-pressed="${i === 0}">${l.label}</button>`).join('')}
    </div>
    <div class="aik-phone">
      <p class="aik-phone-bar" aria-hidden="true"><span>9:41</span><span>Aikonic</span></p>
      <div class="aik-phone-body">
        <p class="aik-phone-title"></p>
        <p class="aik-note aik-phone-en" hidden>Only the sample note, Q3 launch sync, has translated content.</p>
        <p class="aik-phone-h aik-sum-h"></p>
        <div class="aik-sum"></div>
        <p class="aik-phone-h aik-todo-h"></p>
        <ul class="aik-todos"></ul>
        <p class="aik-saved"></p>
        <button type="button" class="aik-key pri sm aik-share"></button>
        <div class="aik-banner" hidden></div>
      </div>
    </div>
    <p class="aik-narrate" role="status"></p>
    ${drawerMarkup()}`;

  const $ = <T extends Element>(s: string) => host.querySelector<T>(s)!;
  const phone = $<HTMLElement>('.aik-phone-body');
  const narrate = $<HTMLElement>('.aik-narrate');
  const banner = $<HTMLElement>('.aik-banner');

  let locale: LocaleId = 'en';
  let layout = 'structured';
  let feedback = 'clear';
  let shareState: 'idle' | 'failed' | 'shared' = 'idle';

  function renderBanner(): void {
    const t = STRINGS[locale];
    banner.replaceChildren();
    banner.hidden = shareState === 'idle';
    banner.dataset.kind = shareState;
    if (shareState === 'failed') {
      const retry = el('button', 'aik-key sm aik-retry', t.retry);
      retry.type = 'button';
      banner.append(el('p', '', t.failed), retry);
    } else if (shareState === 'shared') {
      banner.append(el('p', '', t.shared));
    }
  }

  function render(): void {
    const t = STRINGS[locale];
    const id = ctx.meetingId();
    const note = noteFor(id, locale);
    phone.lang = locale;
    $('.aik-phone-title').textContent = id === TRANSLATED ? t.title : ctx.title();
    $<HTMLElement>('.aik-phone-en').hidden = note.translated;
    $('.aik-sum-h').textContent = t.summary;
    $('.aik-todo-h').textContent = t.todosH;
    $('.aik-share').textContent = t.share;
    const sum = $<HTMLElement>('.aik-sum');
    sum.replaceChildren();
    if (layout === 'flat') {
      sum.append(el('p', 'aik-flat', flatten(note.blocks)));
    } else {
      let list: HTMLUListElement | null = null;
      for (const b of note.blocks) {
        if (b.type === 'heading') { sum.append(el('p', 'aik-block-h', b.text)); list = null; continue; }
        if (!list) { list = el('ul', 'aik-block-l'); sum.append(list); }
        list.append(el('li', '', b.text));
      }
    }
    $('.aik-todos').replaceChildren(...note.todos.map((d) => {
      const li = el('li');
      const label = el('label');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = ctx.todos.done.has(d.id);
      box.dataset.todo = d.id;
      label.append(box, el('span', '', d.text));
      li.append(label);
      return li;
    }));
    $('.aik-saved').textContent = ctx.todos.saved === 'saved' ? t.saved : ctx.todos.saved === 'failed' ? t.notSaved : '';
    $<HTMLElement>('.aik-saved').dataset.state = ctx.todos.saved;
    renderBanner();
  }

  function setLocale(next: LocaleId): void {
    locale = next;
    host.querySelectorAll<HTMLButtonElement>('[data-group="lang"] button').forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.value === next)));
    render();
  }
  pressGroup($('[data-group="lang"]'), (v) => setLocale(v as LocaleId));

  $('.aik-todos').addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    if (!box.dataset.todo) return;
    ctx.todos.toggle(box.dataset.todo, box.checked);
    render();
    host.querySelector<HTMLInputElement>(`[data-todo="${box.dataset.todo}"]`)?.focus();
  });
  $('.aik-share').addEventListener('click', () => {
    if (feedback === 'silent') {
      shareState = 'idle';
      render();
      narrate.textContent = 'The request failed, and the screen gave no sign. That is the silent failure.';
      return;
    }
    shareState = 'failed';
    render();
    narrate.textContent = 'The request failed, and the screen said so with a way forward.';
  });
  banner.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.aik-retry')) return;
    shareState = 'shared';
    render();
    narrate.textContent = 'The retry worked.';
  });

  fillOnOpen($<HTMLDetailsElement>('.aik-drawer'), (body) => {
    body.innerHTML = `
      <p class="aik-built"><b>What I built</b> ${BUILT.web}</p>
      <p class="aik-note">Feedback from the Japan team found work that already existed but failed silently or never reached the screen.</p>
      <p class="aik-h" id="aik-sum-lab">Summary rendering</p>
      <div class="aik-seg" role="group" aria-labelledby="aik-sum-lab" data-group="summary">
        <button type="button" class="aik-key sm" data-value="flat" aria-pressed="false">Before: flat</button>
        <button type="button" class="aik-key sm" data-value="structured" aria-pressed="true">After: structured</button>
      </div>
      <p class="aik-h" id="aik-fail-lab">When an action fails</p>
      <div class="aik-seg" role="group" aria-labelledby="aik-fail-lab" data-group="fail">
        <button type="button" class="aik-key sm" data-value="silent" aria-pressed="false">Before: silent</button>
        <button type="button" class="aik-key sm" data-value="clear" aria-pressed="true">After: clear</button>
      </div>
      <p class="aik-note">Then press Share note on the phone. It always fails the first time here.</p>
      <p class="aik-h">To-dos across a reload</p>
      <p class="aik-note">Tick a to-do, then reload. It stays ticked, here or on a real page reload.</p>
      <button type="button" class="aik-key sm aik-reload">Reload this screen</button>`;
    pressGroup(body.querySelector('[data-group="summary"]')!, (v) => {
      layout = v;
      narrate.textContent = v === 'flat' ? 'Same data, shown as one block of text. The block types are ignored.' : 'Same data, rendered by its block types.';
      render();
    });
    pressGroup(body.querySelector('[data-group="fail"]')!, (v) => {
      feedback = v;
      shareState = 'idle';
      narrate.textContent = '';
      render();
    });
    body.querySelector('.aik-reload')!.addEventListener('click', () => {
      ctx.todos.reload();
      shareState = 'idle';
      render();
      narrate.textContent = `Reloaded from storage: ${ctx.todos.done.size} ${ctx.todos.done.size === 1 ? 'to-do' : 'to-dos'} still ticked.`;
    });
  });

  return { show: render, setLocale };
}
