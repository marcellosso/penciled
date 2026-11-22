import { browser } from 'wxt/browser';
import { h } from '../../lib/dom.ts';
import { colorUsage, recolor } from '../../lib/pages.ts';
import { highlight } from '../../lib/scheme.ts';
import {
  type ButtonOpens,
  getSettings,
  MAX_COLORS,
  nextColorId,
  type PaletteColor,
  saveSettings,
  type Theme,
} from '../../lib/settings.ts';
import { hasSidebar } from '../../lib/sidebar.ts';
import { disabledSites, setSiteEnabled } from '../../lib/sites.ts';
import { describeStatus, setSyncEnabled, syncEnabled, syncStatus } from '../../lib/sync/state.ts';

const dark = matchMedia('(prefers-color-scheme: dark)').matches;
// Suggestions for new colors, in order.
const SUGGESTED = ['#fdba74', '#5eead4', '#a5b4fc', '#fca5a5', '#bef264', '#d8b4fe', '#67e8f9'];

// penciled's own shortcuts, as Mac keyboards label them.
const MAC = /Mac/.test(navigator.platform);
const key = (k: string) => (MAC ? `⌥${k}` : `Alt+${k}`);

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function section(title: string, ...children: (Node | string | false | undefined)[]) {
  return h('section', {}, h('h2', {}, title), ...children);
}

/** The settings tab. */
export async function settingsView(): Promise<Node[]> {
  const [settings, sites, usage, commands, syncing, status] = await Promise.all([
    getSettings(),
    disabledSites(),
    colorUsage(),
    browser.commands.getAll(),
    syncEnabled(),
    syncStatus(),
  ]);
  const used = (c: PaletteColor) => usage.get(c.id) ?? 0;
  const visible = settings.colors.filter((c) => !c.hidden);
  const retired = settings.colors.filter((c) => c.hidden);
  const setColors = (colors: PaletteColor[]) => saveSettings({ colors });
  const change = (id: string, patch: Partial<PaletteColor>) =>
    setColors(settings.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  // A retired color nobody uses any more can go.
  const drop = (id: string) => setColors(settings.colors.filter((c) => c.id !== id));

  // Theme
  const theme = h(
    'div',
    { role: 'radiogroup', 'aria-label': 'Toolbar theme', class: 'choices' },
    ...(
      [
        ['auto', 'Match my system'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ] as [Theme, string][]
    ).map(([value, label]) => {
      const input = h('input', {
        type: 'radio',
        name: 'theme',
        value,
        checked: settings.theme === value,
      });
      input.onchange = () => saveSettings({ theme: value });
      return h('label', {}, input, label);
    }),
  );

  // Toolbar
  const openOnSelect = h('input', { type: 'checkbox', checked: settings.openOnSelect });
  openOnSelect.onchange = () => saveSettings({ openOnSelect: openOnSelect.checked });

  // Toolbar button
  const button = h(
    'div',
    { role: 'radiogroup', 'aria-label': 'The penciled button opens', class: 'choices' },
    ...(
      [
        ['popup', 'This page’s highlights'],
        ['sidebar', 'The sidebar'],
      ] as [ButtonOpens, string][]
    ).map(([value, label]) => {
      const input = h('input', {
        type: 'radio',
        name: 'button',
        value,
        checked: settings.buttonOpens === value,
      });
      input.onchange = () => saveSettings({ buttonOpens: value });
      return h('label', {}, input, label);
    }),
  );

  // Colors
  const swatch = (c: PaletteColor) => {
    const sample = h('span', { class: 'sample' }, 'Sample');
    sample.style.background = highlight(c.value, dark);
    return sample;
  };
  const colorRow = (c: PaletteColor) => {
    const value = h('input', { type: 'color', value: c.value, 'aria-label': `${c.label}: color` });
    value.onchange = () => change(c.id, { value: value.value });
    const label = h('input', {
      type: 'text',
      value: c.label,
      maxlength: 24,
      required: true,
      'aria-label': `${c.label}: name`,
    });
    label.onchange = () => label.value.trim() && change(c.id, { label: label.value.trim() });
    const remove = h(
      'button',
      { type: 'button', class: 'link', disabled: visible.length < 2 },
      'Remove',
    );
    remove.onclick = () => (used(c) ? change(c.id, { hidden: true }) : drop(c.id));
    return h(
      'li',
      { 'data-color': c.id },
      value,
      label,
      swatch(c),
      h('span', { class: 'hint' }, plural(used(c), 'highlight')),
      remove,
    );
  };
  const retiredRow = (c: PaletteColor) => {
    const target = h(
      'select',
      { 'aria-label': `Move ${c.label} highlights to` },
      ...visible.map((v) => h('option', { value: v.id }, v.label)),
    );
    const move = h('button', { type: 'button' }, 'Move');
    move.onclick = async () => {
      await recolor(c.id, target.value);
      await drop(c.id);
    };
    const restore = h(
      'button',
      { type: 'button', class: 'link', disabled: visible.length >= MAX_COLORS },
      'Restore',
    );
    restore.onclick = () => change(c.id, { hidden: false });
    // Its last highlights were deleted since it was removed.
    const remove = h('button', { type: 'button' }, 'Delete');
    remove.onclick = () => drop(c.id);
    return h(
      'li',
      { 'data-color': c.id },
      swatch(c),
      h('span', {}, c.label),
      used(c)
        ? h('span', { class: 'hint' }, `${plural(used(c), 'highlight')} still use it.`)
        : h('span', { class: 'hint' }, 'No highlights use it any more.'),
      used(c) ? h('span', { class: 'move' }, 'Move them to', target, move) : remove,
      restore,
    );
  };
  const add = h(
    'button',
    { type: 'button', disabled: visible.length >= MAX_COLORS },
    'Add a color',
  );
  add.onclick = () => {
    const taken = new Set(settings.colors.map((c) => c.value));
    const value = SUGGESTED.find((v) => !taken.has(v)) ?? SUGGESTED[0]!;
    const id = nextColorId(settings.colors);
    setColors([...settings.colors, { id, label: `Color ${id.slice(1)}`, value }]);
  };

  // Sync
  const sync = h('input', { type: 'checkbox', checked: syncing, id: 'sync' });
  sync.onchange = () => setSyncEnabled(sync.checked);
  const firefox = navigator.userAgent.includes('Firefox');

  // Sites
  const siteRow = (site: string) => {
    const on = h('button', { type: 'button', class: 'link' }, 'Turn back on');
    on.onclick = () => setSiteEnabled(site, true);
    return h('li', {}, h('span', {}, site), on);
  };

  // Shortcuts
  const shortcut = (name: string) => commands.find((c) => c.name === name)?.shortcut || 'Not set';
  const shortcuts = h('button', { type: 'button' }, 'Change shortcuts');
  // Firefox has its own call for this. Elsewhere, extension pages can't link to the browser's
  // own pages, but can open them.
  const commandsApi = browser.commands as { openShortcutSettings?: () => Promise<void> };
  shortcuts.onclick = () =>
    commandsApi.openShortcutSettings
      ? commandsApi.openShortcutSettings()
      : browser.tabs.create({ url: 'chrome://extensions/shortcuts' });

  return [
    h(
      'p',
      { class: 'hint' },
      'Settings apply to every site, and follow you to your other computers. Highlights stay on this computer unless you turn on sync below.',
    ),
    section('Toolbar theme', theme),
    section(
      'Toolbar',
      h('label', { class: 'check' }, openOnSelect, 'Show the toolbar when I select text'),
      h(
        'p',
        { class: 'hint' },
        `When this is off, select text and press ${key('A')} to highlight it. Clicking a highlight always opens it.`,
      ),
    ),
    ...(hasSidebar()
      ? [
          section(
            'The penciled button',
            h(
              'p',
              { class: 'hint' },
              'What opens when you click penciled in the browser’s toolbar.',
            ),
            button,
          ),
        ]
      : []),
    section(
      'Colors',
      h('p', { class: 'hint' }, 'Changing a color changes the highlights that use it.'),
      h('ul', { class: 'colors' }, ...visible.map(colorRow)),
      add,
      retired.length > 0 &&
        h(
          'div',
          { class: 'retired' },
          h('h3', {}, 'Removed colors'),
          h(
            'p',
            { class: 'hint' },
            'These aren’t offered any more, but highlights already using them keep their color.',
          ),
          h('ul', { class: 'colors' }, ...retired.map(retiredRow)),
        ),
    ),
    section(
      'Sync highlights',
      h('label', { class: 'check' }, sync, 'Sync my highlights and notes to my other computers'),
      h(
        'p',
        { class: 'hint' },
        firefox
          ? 'Through Firefox Sync: sign in to it, with Add-ons selected, on each computer. Firefox for Android doesn’t sync extensions’ data.'
          : 'Through your browser’s sync: sign in to the browser with sync turned on, on each computer.',
        ' penciled has no account or server of its own. Browser sync holds about 100 KB, so with many highlights only the most recently changed pages sync. Sync isn’t a backup: export one from the notes page.',
      ),
      syncing &&
        h('p', { class: 'hint', role: 'status', 'data-sync-status': '' }, describeStatus(status)),
    ),
    section(
      'Sites where penciled is off',
      sites.length
        ? h('ul', { class: 'sites' }, ...sites.map(siteRow))
        : h(
            'p',
            { class: 'hint' },
            'penciled runs on every site. Turn it off for a site from the toolbar button.',
          ),
    ),
    section(
      'Keyboard shortcuts',
      h(
        'dl',
        {},
        h('dt', {}, 'Hide or show highlights on a tab'),
        h('dd', {}, shortcut('toggle')),
        hasSidebar() && h('dt', {}, 'Open or close the sidebar'),
        hasSidebar() && h('dd', {}, shortcut('sidebar')),
        h('dt', {}, 'Open the toolbar for the selected text'),
        h('dd', {}, key('A')),
        h('dt', {}, 'Go to the next or previous highlight'),
        h('dd', {}, `${key(']')} and ${key('[')}`),
      ),
      shortcuts,
    ),
  ];
}
