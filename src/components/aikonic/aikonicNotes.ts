// Each recording's summary and to-dos, as structured blocks. The screen renders the blocks; the phone view can flatten them.
export type Block = { type: 'heading' | 'bullet'; text: string };
export type Todo = { id: string; text: string };
export type Note = { blocks: Block[]; todos: Todo[] };

const h = (text: string): Block => ({ type: 'heading', text });
const b = (text: string): Block => ({ type: 'bullet', text });

export const NOTES: Record<string, Note> = {
  launch: {
    blocks: [h('Decisions'), b('Move the Kowloon opening to 21 September.'), h('Risks'), b('The second tea shipment is ten days late.'), b('Leaking lids are the top complaint.')],
    todos: [{ id: 'fitout', text: 'Confirm the new fit-out date' }, { id: 'supplier', text: 'Contact the backup supplier' }, { id: 'lids', text: 'Order new lids' }],
  },
  menu: {
    blocks: [h('Decisions'), b('Set the new Kowloon date next week.'), h('Risks'), b('The supplier cannot ship, so the pearls will be two weeks late.')],
    todos: [{ id: 'menu-lids', text: 'Switch the lids to another factory' }, { id: 'menu-train', text: 'Send two people from each store to training' }],
  },
  supply: {
    blocks: [h('Risks'), b('Port congestion delayed the second tea batch by ten days.'), h('Options'), b('A backup supplier costs eight percent more and can deliver by month end.')],
    todos: [{ id: 'supply-backup', text: 'Decide on the backup supplier' }, { id: 'supply-refund', text: 'Cut the refund process to two days' }],
  },
  osaka: {
    blocks: [h('Status'), b('The fit-out should finish next week as planned.'), b('The budget rose by a million yen, and it was approved.')],
    todos: [{ id: 'osaka-train', text: 'Start staff training two weeks before opening' }, { id: 'osaka-supplier', text: 'Decide on the supplier by the next meeting' }],
  },
  support: {
    blocks: [h('Findings'), b('Refunds take five days because every one needs a manager.'), b('Most complaints are about leaking lids.')],
    todos: [{ id: 'support-train', text: 'Train new staff before the opening' }, { id: 'support-freeze', text: 'Freeze new headcount until the budget review' }],
  },
  board: {
    blocks: [h('Decisions'), b('The budget review is due by the end of the month.'), b('Prices stay as they are this year.')],
    todos: [{ id: 'board-review', text: 'Send the budget review to the board' }],
  },
};

export const flatten = (blocks: Block[]): string => blocks.map((x) => x.text).join(' ');

export const TODO_KEY = 'aikonic-demo-todos';
export type Store = Pick<Storage, 'getItem' | 'setItem'> | null;

/** Reads saved completion. Blocked storage or junk in it counts as nothing saved, never as an error on screen. */
export function loadTodos(store: Store): Set<string> {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(TODO_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
/** Returns whether the save worked, so the screen can say so instead of failing silently. */
export function saveTodos(store: Store, done: Iterable<string>): boolean {
  try {
    if (!store) return false;
    store.setItem(TODO_KEY, JSON.stringify([...done]));
    return true;
  } catch {
    return false;
  }
}

export function getStore(): Store {
  try { return window.localStorage; } catch { return null; }
}

/** The one set of completed to-dos, shared by the To-dos tab and the phone view, so it is visibly the same note. */
export type TodoState = { done: Set<string>; saved: 'none' | 'saved' | 'failed'; toggle: (id: string, on: boolean) => void; reload: () => void };
