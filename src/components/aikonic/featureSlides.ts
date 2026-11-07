// "Open slides": a simple sample outline, made from the recording's own summary and to-dos. Nothing is generated here.
import { el } from './aikonicDom';
import { NOTES } from './aikonicNotes';

export type Slide = { title: string; points: string[] };

export function outlineFor(meetingId: string, title: string): Slide[] {
  const note = NOTES[meetingId];
  const slides: Slide[] = [{ title, points: [] }];
  for (const b of note.blocks) {
    if (b.type === 'heading') slides.push({ title: b.text, points: [] });
    else slides[slides.length - 1].points.push(b.text);
  }
  slides.push({ title: 'To-dos', points: note.todos.map((t) => t.text) });
  return slides;
}

export function mount(host: HTMLElement, ctx: { meetingId: () => string; title: () => string }) {
  const head = el('p', 'aik-view-h');
  const list = el('ol', 'aik-slides');
  host.append(head, el('p', 'aik-note', 'A sample outline, from this recording’s summary and to-dos.'), list);
  return {
    show(): void {
      head.textContent = `Slides: ${ctx.title()}`;
      list.replaceChildren(...outlineFor(ctx.meetingId(), ctx.title()).map((s, i) => {
        const li = el('li');
        li.append(el('small', '', `Slide ${i + 1}`), el('p', 'aik-slide-h', s.title));
        if (s.points.length) {
          const points = el('ul', 'aik-block-l');
          points.append(...s.points.map((p) => el('li', '', p)));
          li.append(points);
        }
        return li;
      }));
    },
  };
}
