import type { Annotation, AnnotationStorage } from 'penciled/headless';
import { browser } from 'wxt/browser';

/** What the notes page lists for a page without loading its annotations. */
export interface PageMeta {
  /** The address the page was last annotated at, to open it from the notes page. */
  url: string;
  title: string;
  count: number;
  /** ISO 8601 timestamp. */
  updatedAt: string;
}

export interface PageData {
  version: 1;
  annotations: Annotation[];
}

/** A deleted annotation, remembered so that syncing deletes it on other devices too. */
export interface Tombstone {
  /** The id of the page it was on. */
  page: string;
  /** ISO 8601 timestamp. */
  at: string;
}

/** Each page's annotations, and its metadata, live under their own keys. */
export const pageKey = (id: string): string => `page:${id}`;
export const metaKey = (id: string): string => `meta:${id}`;
/**
 * Each deletion gets its own key, so two tabs deleting at once never overwrite each other's.
 * Annotation ids are unique across pages.
 */
export const deletedKey = (annotationId: string): string => `deleted:${annotationId}`;

/** The storage entries recording that annotations `ids` on page `page` were deleted now. */
export function tombstones(page: string, ids: string[]): Record<string, Tombstone> {
  const at = new Date().toISOString();
  return Object.fromEntries(ids.map((id) => [deletedKey(id), { page, at }]));
}

/**
 * Stores `annotations` as page `id`'s, or removes the page when there are none left. `deleted`
 * lists the annotations this change deleted.
 */
export async function writePage(
  id: string,
  page: { url: string; title: string },
  annotations: Annotation[],
  deleted: string[] = [],
): Promise<void> {
  const gone = tombstones(id, deleted);
  if (!annotations.length) {
    if (deleted.length) await browser.storage.local.set(gone);
    return browser.storage.local.remove([pageKey(id), metaKey(id)]);
  }
  await browser.storage.local.set({ ...gone, ...pageEntries(id, page, annotations) });
}

/** The storage entries for page `id`, to write several pages at once. */
export function pageEntries(
  id: string,
  page: { url: string; title: string },
  annotations: Annotation[],
): Record<string, PageData | PageMeta> {
  const meta: PageMeta = {
    url: page.url,
    title: page.title,
    count: annotations.length,
    updatedAt: new Date().toISOString(),
  };
  return { [pageKey(id)]: { version: 1, annotations }, [metaKey(id)]: meta };
}

/**
 * Stores annotations in `chrome.storage.local`. Each change is applied to what's stored rather
 * than overwriting it, so the same page open in two tabs doesn't lose either tab's changes.
 */
export function extensionStorage(page: () => { url: string; title: string }): AnnotationStorage {
  // Changes are applied one at a time: each reads what the previous one wrote.
  let queue = Promise.resolve();

  const read = async (id: string) => {
    const key = pageKey(id);
    const data = (await browser.storage.local.get(key))[key] as PageData | undefined;
    return data?.annotations ?? [];
  };

  const change = (id: string, edit: (annotations: Annotation[]) => Annotation[]) => {
    const next = queue.then(async () => {
      const before = await read(id);
      const after = edit(before);
      // Compared with what this tab read, not with what's stored now: annotations another tab or
      // a sync added meanwhile weren't deleted here.
      const kept = new Set(after.map((a) => a.id));
      const deleted = before.filter((a) => !kept.has(a.id)).map((a) => a.id);
      await writePage(id, page(), after, deleted);
    });
    queue = next.catch(() => {});
    return next;
  };

  const put = (id: string, a: Annotation) =>
    change(id, (list) => [...list.filter((b) => b.id !== a.id), a]);

  return {
    load: read,
    save: (id, annotations) => change(id, () => annotations),
    create: put,
    update: put,
    delete: (id, annotationId) => change(id, (list) => list.filter((a) => a.id !== annotationId)),
  };
}
