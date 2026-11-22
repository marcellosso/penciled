import { browser } from 'wxt/browser';

/** A highlight color. Annotations store its `id`, so its label and value can change freely. */
export interface PaletteColor {
  id: string;
  label: string;
  /** `#rrggbb`. Highlights get a fixed transparency on top, so text stays readable. */
  value: string;
  /** Retired: no longer offered for new highlights, but still paints the ones using it. */
  hidden?: boolean;
}

export type Theme = 'auto' | 'light' | 'dark';

/** What clicking penciled's button in the browser's toolbar opens. */
export type ButtonOpens = 'popup' | 'sidebar';

export interface Settings {
  /** The toolbar's theme. `auto` follows the operating system. */
  theme: Theme;
  /** Whether selecting text opens the toolbar. When off, the toolbar shortcut opens it. */
  openOnSelect: boolean;
  colors: PaletteColor[];
  /** Ignored in browsers without a sidebar, where the button always opens the popup. */
  buttonOpens: ButtonOpens;
}

/** More colors don't fit on one row of the toolbar. */
export const MAX_COLORS = 8;

/** penciled's preset colors, at full strength. */
export const DEFAULTS: Settings = {
  theme: 'auto',
  openOnSelect: true,
  buttonOpens: 'sidebar',
  colors: [
    { id: 'c1', label: 'Yellow', value: '#fde047' },
    { id: 'c2', label: 'Green', value: '#86efac' },
    { id: 'c3', label: 'Blue', value: '#93c5fd' },
    { id: 'c4', label: 'Pink', value: '#f9a8d4' },
    { id: 'c5', label: 'Purple', value: '#c4b5fd' },
  ],
};

// Synced, so they follow the reader to their other computers. Notes sync only if the reader turns
// that on (see sync/), and then under their own keys.
const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.sync.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULTS, ...stored };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.sync.set({ [KEY]: next });
  return next;
}

/** Calls `fn` with the new settings whenever they change, in any tab or window. */
export function onSettings(fn: (settings: Settings, previous: Settings) => void): () => void {
  const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
    const change = changes[KEY];
    if (!change) return;
    fn(
      { ...DEFAULTS, ...(change.newValue as Partial<Settings>) },
      { ...DEFAULTS, ...(change.oldValue as Partial<Settings>) },
    );
  };
  browser.storage.sync.onChanged.addListener(listener);
  return () => browser.storage.sync.onChanged.removeListener(listener);
}

/** An id no color in `colors` has had, so retired colors' highlights never change color. */
export function nextColorId(colors: PaletteColor[]): string {
  const used = colors.map((c) => Number(c.id.slice(1)) || 0);
  return `c${Math.max(0, ...used) + 1}`;
}
