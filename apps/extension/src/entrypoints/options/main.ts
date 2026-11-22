import '../../assets/ui.css';
import { browser } from 'wxt/browser';
import { h } from '../../lib/dom.ts';
import { onSettings } from '../../lib/settings.ts';
import { onDisabledSites } from '../../lib/sites.ts';
import { onSyncState } from '../../lib/sync/state.ts';
import { notesView } from './notes.ts';
import { settingsView } from './settings.ts';

const app = document.getElementById('app')!;
const VIEWS = { notes: ['Notes', notesView], settings: ['Settings', settingsView] } as const;
type View = keyof typeof VIEWS;

const current = (): View => (location.hash === '#settings' ? 'settings' : 'notes');

async function render() {
  const view = current();
  const [title, content] = VIEWS[view];
  const children = await content(render);
  // Switched tabs while this one loaded.
  if (view !== current()) return;
  // Re-rendering replaces every element, so focus moves to the new copy of the focused one.
  const focused = document.activeElement?.id;
  app.replaceChildren(
    h(
      'header',
      {},
      h('h1', {}, 'penciled'),
      h(
        'nav',
        { 'aria-label': 'Sections' },
        ...(Object.keys(VIEWS) as View[]).map((v) =>
          h('a', { href: `#${v}`, 'aria-current': v === view && 'page' }, VIEWS[v][0]),
        ),
      ),
    ),
    ...children,
  );
  document.title = `${title} – penciled`;
  const again = focused && document.getElementById(focused);
  if (again instanceof HTMLInputElement) {
    again.focus();
    again.selectionStart = again.value.length;
  }
}

render();
window.addEventListener('hashchange', render);
onSettings(render);
onDisabledSites(render);
onSyncState(render);
// Highlights added, changed or removed in open tabs.
browser.storage.local.onChanged.addListener((changes) => {
  if (Object.keys(changes).some((key) => key.startsWith('page:'))) render();
});
