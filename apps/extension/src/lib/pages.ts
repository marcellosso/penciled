import type { Annotation } from 'penciled/headless';
import { browser } from 'wxt/browser';
import { type PageData, type PageMeta, pageKey, writePage } from './storage.ts';
import { withTags } from './tags.ts';

/** An annotated page, as the notes page lists it. */
export interface Page extends PageMeta {
  id: string;
  annotations: Annotation[];
}

/** Every annotated page, most recently changed first. */
export async function listPages(): Promise<Page[]> {
  const all = await browser.storage.local.get(null);
  const pages: Page[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith('page:')) continue;
    const id = key.slice(5);
    const meta = all[`meta:${id}`] as PageMeta | undefined;
    const { annotations } = value as PageData;
    pages.push({
      id,
      url: meta?.url ?? id,
      title: meta?.title ?? '',
      count: annotations.length,
      updatedAt: meta?.updatedAt ?? '',
      annotations,
    });
  }
  return pages.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Every annotated page's annotations, by page id. */
export async function allPages(): Promise<Map<string, Annotation[]>> {
  return new Map((await listPages()).map((p) => [p.id, p.annotations]));
}

/** How many highlights use each color id, across every page. */
export async function colorUsage(): Promise<Map<string, number>> {
  const usage = new Map<string, number>();
  for (const annotations of (await allPages()).values()) {
    for (const a of annotations) usage.set(a.color, (usage.get(a.color) ?? 0) + 1);
  }
  return usage;
}

/** Moves every highlight colored `from` to `to`. Open tabs follow through storage. */
export async function recolor(from: string, to: string): Promise<void> {
  const updatedAt = new Date().toISOString();
  const changed: Record<string, PageData> = {};
  for (const [id, annotations] of await allPages()) {
    if (!annotations.some((a) => a.color === from)) continue;
    changed[pageKey(id)] = {
      version: 1,
      annotations: annotations.map((a) => (a.color === from ? { ...a, color: to, updatedAt } : a)),
    };
  }
  await browser.storage.local.set(changed);
}

/** Deletes one annotation. A tab open on the page removes it too. */
export async function deleteAnnotation(page: Page, id: string): Promise<void> {
  const key = pageKey(page.id);
  const data = (await browser.storage.local.get(key))[key] as PageData | undefined;
  const annotations = (data?.annotations ?? []).filter((a) => a.id !== id);
  await writePage(page.id, page, annotations, [id]);
}

/** Sets one annotation's tags. A tab open on the page picks them up. */
export async function setTags(page: Page, id: string, tags: string[]): Promise<void> {
  const key = pageKey(page.id);
  const data = (await browser.storage.local.get(key))[key] as PageData | undefined;
  const updatedAt = new Date().toISOString();
  const annotations = (data?.annotations ?? []).map((a) =>
    a.id === id ? { ...a, meta: withTags(a.meta, tags), updatedAt } : a,
  );
  await writePage(page.id, page, annotations);
}

// Read by the content script of the tab opened from the notes page, to scroll to the highlight.
const OPEN = 'open';
const OPEN_FOR = 60_000;

/** Opens `page` in a new tab, scrolled to annotation `id`. */
export async function openAnnotation(page: Page, id: string): Promise<void> {
  await browser.storage.local.set({ [OPEN]: { page: page.id, id, at: Date.now() } });
  await browser.tabs.create({ url: page.url });
}

/** The annotation to scroll to on page `pageId`, if it was just opened from the notes page. */
export async function takeOpened(pageId: string): Promise<string | undefined> {
  const open = (await browser.storage.local.get(OPEN))[OPEN] as
    | { page: string; id: string; at: number }
    | undefined;
  if (open?.page !== pageId || Date.now() - open.at > OPEN_FOR) return;
  await browser.storage.local.remove(OPEN);
  return open.id;
}
