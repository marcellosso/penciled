// The landing page's live examples. Each one is a real penciled instance; only the demo article
// is saved, the others start over on every visit.
import {
  type Action,
  type AnnotateOptions,
  type AnnotationInit,
  type Annotator,
  annotate,
} from 'penciled';
import posthog from 'posthog-js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Theme toggle, sharing Starlight's storage key so the docs follow.
document.querySelector('#theme')?.addEventListener('click', () => {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('starlight-theme', next);
});

/** A range over the first occurrence of `text` in `container`, whatever its line breaks. */
function find(container: Element, text: string): Range | undefined {
  const pattern = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const match = pattern.exec((n as Text).data);
    if (!match) continue;
    const range = document.createRange();
    range.setStart(n, match.index);
    range.setEnd(n, match.index + match[0].length);
    return range;
  }
}

type Seed = AnnotationInit & { text: string };

let seeding = false;

function seed(instance: Annotator, seeds: Seed[]) {
  seeding = true;
  for (const { text, ...init } of seeds) {
    const range = find(instance.container, text);
    if (range) instance.create(range, init);
  }
  seeding = false;
}

/** An example that starts from `seeds` on every visit. */
function example(selector: string, seeds: Seed[], options: AnnotateOptions = {}): Annotator {
  const instance = annotate(selector, { storage: 'memory', ...options });
  instance.ready.then(() => seed(instance, seeds));
  return instance;
}

// Copy the install command.
const copy = document.querySelector<HTMLButtonElement>('#copy-install');
copy?.addEventListener('click', async () => {
  await navigator.clipboard?.writeText('npm install penciled');
  copy.dataset.copied = '';
  copy.setAttribute('aria-label', 'Copied');
  setTimeout(() => {
    delete copy.dataset.copied;
    copy.setAttribute('aria-label', 'Copy install command');
  }, 1400);
});

// The demo article, saved in localStorage.
const SEEDED = 'penciled-site:demo-seeded';
const DEMO: Seed[] = [
  { text: 'a small toolbar appears', color: 'yellow' },
  {
    text: 'they come back exactly where you left them',
    color: 'green',
    note: 'Saved to localStorage by default. A storage adapter saves to your own API instead.',
  },
  {
    text: 'set aside rather than attached to the wrong words',
    color: 'pink',
    note: 'These are called orphans. They stay in your data, and come back if the text does.',
  },
  { text: 'painted by the browser itself', color: 'blue' },
];
const demo = annotate('#demo', {
  documentId: 'site-demo',
  actions: ['highlight', 'note', 'copy', 'remove'],
  noteIndicator: 'underline',
  notePreview: 'hover',
});
demo.ready.then(() => {
  if (!localStorage.getItem(SEEDED) && !demo.getAll().length) seed(demo, DEMO);
  localStorage.setItem(SEEDED, '1');
});
document.querySelector('#demo-reset')?.addEventListener('click', () => {
  demo.clear();
  seed(demo, DEMO);
});

// Storage: how much of the demo is saved.
const saved = document.querySelector('#saved');
const count = () => {
  const n = demo.getAll().length;
  if (saved) {
    saved.replaceChildren(
      `this page has saved ${n} annotation${n === 1 ? '' : 's'} from the demo under `,
      Object.assign(document.createElement('code'), { textContent: 'penciled:site-demo' }),
    );
  }
};
for (const event of ['load', 'create', 'delete'] as const) demo.on(event, count);

// The visitor's first highlight in the demo, once per page view: the site's activation moment.
let tried = false;
demo.on('create', (annotation) => {
  if (seeding || tried) return;
  tried = true;
  posthog.capture('demo_highlight_created', { color: annotation.color });
});

// Colors.
example(
  '#ex-colors',
  ['yellow', 'green', 'blue', 'pink', 'purple', 'mint'].map((color) => ({
    text: color === 'yellow' ? 'Yellow' : color,
    color,
  })),
  {
    colors: [
      'yellow',
      'green',
      'blue',
      'pink',
      'purple',
      { name: 'mint', light: '#5eead480', dark: '#2dd4bf47' },
    ],
  },
);

// Notes, three ways.
example('#ex-click', [
  {
    text: 'its highlight',
    color: 'yellow',
    note: 'Clicking opens the toolbar, with the note on top.',
  },
]);
example(
  '#ex-underline',
  [{ text: 'An underline', color: 'green', note: 'Highlights without a note have no underline.' }],
  { noteIndicator: 'underline' },
);
example(
  '#ex-hover',
  [{ text: 'this highlight', color: 'blue', note: 'Previewed on hover. Clicking still opens it.' }],
  { notePreview: 'hover' },
);

// Custom actions: a canned "Ask AI" answer, typed into a note.
const SPARKLES =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const askAI: Action = {
  id: 'ask-ai',
  label: 'Ask AI',
  icon: SPARKLES,
  async onSelect({ range, annotation, text }) {
    const a = annotation ?? actions.create(range, { color: 'purple' });
    if (!a) return;
    getSelection()?.removeAllRanges();
    const answer =
      `Demo answer. In your app, onSelect would send “${text}” to your own endpoint and save ` +
      'the reply as a note, the way this one was.';
    if (!reduced) {
      for (let i = 0; i < answer.length; i += 3) {
        actions.update(a.id, { note: `${answer.slice(0, i)}…` });
        await sleep(16);
      }
    }
    actions.update(a.id, { note: answer, meta: { source: 'ai' } });
    actions.focus(a.id);
  },
};
const actions = example('#ex-actions', [], {
  actions: ['highlight', 'note', askAI, 'remove'],
  notePreview: 'hover',
});

// Never touches your DOM: show the markup, and count mutations while you annotate.
const dom = document.querySelector('#ex-dom')!;
const html = document.querySelector('#dom-html')!;
const status = document.querySelector('#dom-status')!;
let mutations = 0;
new MutationObserver((records) => {
  mutations += records.length;
  render();
}).observe(dom, { subtree: true, childList: true, characterData: true, attributes: true });
const domExample = example('#ex-dom', []);
const render = () => {
  const n = domExample.getAll().length;
  html.textContent = dom.outerHTML;
  status.textContent = `${n} highlight${n === 1 ? '' : 's'} · ${mutations} DOM change${mutations === 1 ? '' : 's'}`;
};
for (const event of ['load', 'create', 'update', 'delete'] as const) domExample.on(event, render);
render();

// Make it yours: a look applies to the whole page, like the CSS it shows would.
const style = example('#ex-style', [
  { text: 'corners, shadows and fonts', color: 'yellow' },
  {
    text: 'this highlight',
    color: 'green',
    note: 'The note, its editor and the hover preview follow the same properties.',
  },
]);
const skinButtons = document.querySelectorAll<HTMLButtonElement>('.skins button');
for (const button of skinButtons) {
  button.addEventListener('click', () => {
    const id = button.dataset.skin!;
    if (id === 'site') delete document.documentElement.dataset.skin;
    else document.documentElement.dataset.skin = id;
    for (const b of skinButtons) b.setAttribute('aria-pressed', String(b === button));
    for (const code of document.querySelectorAll<HTMLElement>('[data-skin-code]')) {
      code.hidden = code.dataset.skinCode !== id;
    }
    // Open the toolbar on a highlight so the change is visible right away.
    const noted = style.getAll().find((a) => a.note);
    if (noted) style.focus(noted.id);
  });
}
