import { type Annotation, normalize } from 'penciled/headless';
import { browser } from 'wxt/browser';
import { listPages, type Page } from './pages.ts';
import { getSettings, nextColorId, type PaletteColor, saveSettings } from './settings.ts';
import { siteOf } from './sites.ts';
import { deletedKey, type PageData, pageEntries, pageKey, type Tombstone } from './storage.ts';
import { tagsOf } from './tags.ts';
import { pageId } from './url.ts';

/** Everything penciled stores in this browser, as an exported file holds it. */
export interface Backup {
  format: 'penciled-extension';
  version: 1;
  /** ISO 8601 timestamp. */
  exportedAt: string;
  /** The palette, so highlights keep their colors in a browser with different settings. */
  colors: PaletteColor[];
  pages: { url: string; title: string; annotations: Annotation[] }[];
}

export async function createBackup(): Promise<Backup> {
  const [pages, { colors }] = await Promise.all([listPages(), getSettings()]);
  return {
    format: 'penciled-extension',
    version: 1,
    exportedAt: new Date().toISOString(),
    colors,
    pages: pages.map(({ url, title, annotations }) => ({ url, title, annotations })),
  };
}

export class BackupError extends Error {}

/**
 * Adds a backup's highlights to what's stored. Highlights already here are kept, unless the
 * backup's copy was changed more recently. Returns how many highlights were added or updated.
 */
export async function restoreBackup(data: unknown): Promise<number> {
  const backup = data as Partial<Backup> | null;
  if (backup?.format !== 'penciled-extension' || !Array.isArray(backup.pages)) {
    throw new BackupError('This file isn’t a penciled backup.');
  }
  if (backup.version !== 1) {
    throw new BackupError('This backup is from a newer version of penciled. Update it first.');
  }

  const settings = await getSettings();
  const colors = [...settings.colors];
  const color = colorMatcher(colors, Array.isArray(backup.colors) ? backup.colors : []);

  const stored = await browser.storage.local.get(null);
  const entries: Record<string, unknown> = {};
  const now = new Date().toISOString();
  // Restored annotations that were deleted here, whose deletion is forgotten.
  const undeleted: string[] = [];
  let changed = 0;
  for (const page of backup.pages) {
    let id: string;
    try {
      id = pageId(page?.url);
    } catch {
      // Not a URL.
      continue;
    }
    // Pages listed twice in the backup are merged.
    const before = entries[pageKey(id)] ?? stored[pageKey(id)];
    const merged = new Map((before as PageData | undefined)?.annotations.map((a) => [a.id, a]));
    let pageChanged = false;
    for (const raw of Array.isArray(page.annotations) ? page.annotations : []) {
      const a = normalize(raw);
      if (!a) continue;
      a.color = color(a.color);
      const mine = merged.get(a.id);
      if (mine && mine.updatedAt >= a.updatedAt) continue;
      // Restoring counts as a change made now, so syncing doesn't delete it again.
      const tombstone = stored[deletedKey(a.id)] as Tombstone | undefined;
      if (!mine && tombstone) {
        // Later than the deletion, even within the same millisecond.
        const after = new Date(Date.parse(tombstone.at) + 1).toISOString();
        a.updatedAt = after > now ? after : now;
        undeleted.push(deletedKey(a.id));
      }
      merged.set(a.id, a);
      pageChanged = true;
      changed++;
    }
    if (!pageChanged) continue;
    const title = typeof page.title === 'string' ? page.title : '';
    Object.assign(entries, pageEntries(id, { url: page.url, title }, [...merged.values()]));
  }

  if (colors.length > settings.colors.length) await saveSettings({ colors });
  await browser.storage.local.set(entries);
  if (undeleted.length) await browser.storage.local.remove(undeleted);
  return changed;
}

/**
 * Maps the backup's color ids to this browser's. A color is matched by id when it's the same
 * color, then by value; otherwise it's added as a removed color, so its highlights keep painting
 * in it without crowding the toolbar. Adds to `colors` as it goes.
 */
function colorMatcher(colors: PaletteColor[], theirs: PaletteColor[]): (id: string) => string {
  const fallback = colors.find((c) => !c.hidden)?.id ?? colors[0]!.id;
  const map = new Map<string, string>();
  return (id) => {
    const known = map.get(id);
    if (known) return known;
    const their = theirs.find((c) => c?.id === id && /^#[\da-f]{6}$/i.test(c.value));
    let mine: string;
    if (!their) {
      mine = colors.some((c) => c.id === id) ? id : fallback;
    } else {
      const value = their.value.toLowerCase();
      const match =
        colors.find((c) => c.id === id && c.value.toLowerCase() === value) ??
        colors.find((c) => c.value.toLowerCase() === value);
      if (match) mine = match.id;
      else {
        mine = nextColorId(colors);
        const label = typeof their.label === 'string' && their.label ? their.label : 'Imported';
        colors.push({ id: mine, label: label.slice(0, 24), value, hidden: true });
      }
    }
    map.set(id, mine);
    return mine;
  };
}

/** The pages as Markdown: a heading per site and page, each highlight quoted with its note. */
export function toMarkdown(pages: Page[]): string {
  const lines = ['# penciled notes', '', `Exported ${new Date().toLocaleDateString()}.`];
  for (const [site, list] of bySite(pages)) {
    lines.push('', `## ${site}`);
    for (const page of list) {
      lines.push('', `### [${escapeLink(page.title || page.url)}](<${page.url}>)`);
      for (const a of page.annotations) {
        lines.push('', `> ${a.quote}`);
        if (a.note) lines.push('', a.note);
        const tags = tagsOf(a);
        if (tags.length) lines.push('', tags.map((t) => `#${t}`).join(' '));
      }
    }
  }
  return `${lines.join('\n')}\n`;
}

const escapeLink = (text: string) => text.replace(/[\\[\]]/g, '\\$&');

const siteName = (url: string) => {
  try {
    return siteOf(url);
  } catch {
    return url;
  }
};

/** Pages grouped by site, keeping their order. */
export function bySite(pages: Page[]): Map<string, Page[]> {
  const sites = new Map<string, Page[]>();
  for (const page of pages) {
    const site = siteName(page.url);
    sites.set(site, [...(sites.get(site) ?? []), page]);
  }
  return sites;
}
