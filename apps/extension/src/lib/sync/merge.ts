import type { Annotation } from 'penciled/headless';

/** One page's side of a merge: what a device holds for it. */
export interface PageCopy {
  url: string;
  title: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
  annotations: Annotation[];
  /** When each deleted annotation was deleted, by id. */
  deleted: Record<string, string>;
}

/** How long a deletion is remembered. A device offline for longer can bring a deleted one back. */
export const TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Merges two copies of a page. Each annotation is taken from whichever copy changed it last, and
 * a deletion wins over any change made before it. `mine` keeps its order and wins ties.
 */
export function mergePage(mine: PageCopy | undefined, theirs: PageCopy | undefined): PageCopy {
  if (!mine || !theirs) return (mine ?? theirs)!;
  const deleted = { ...mine.deleted };
  for (const [id, at] of Object.entries(theirs.deleted)) {
    if (!deleted[id] || deleted[id]! < at) deleted[id] = at;
  }
  const annotations = new Map(mine.annotations.map((a) => [a.id, a]));
  for (const a of theirs.annotations) {
    const own = annotations.get(a.id);
    if (!own || own.updatedAt < a.updatedAt) annotations.set(a.id, a);
  }
  const newer = theirs.updatedAt > mine.updatedAt ? theirs : mine;
  return {
    url: newer.url,
    title: newer.title,
    updatedAt: newer.updatedAt,
    annotations: [...annotations.values()].filter(
      (a) => !deleted[a.id] || deleted[a.id]! < a.updatedAt,
    ),
    deleted,
  };
}

/** Forgets deletions older than the TTL. */
export function expire(deleted: Record<string, string>, now: number): Record<string, string> {
  const cutoff = new Date(now - TOMBSTONE_TTL).toISOString();
  return Object.fromEntries(Object.entries(deleted).filter(([, at]) => at >= cutoff));
}

/** Compares two pages' content, ignoring the order of their annotations. */
export function samePage(a: PageCopy | undefined, b: PageCopy | undefined): boolean {
  return canonical(a) === canonical(b);
}

const canonical = (page: PageCopy | undefined) =>
  page &&
  JSON.stringify([
    page.url,
    page.title,
    page.updatedAt,
    [...page.annotations].sort((x, y) => (x.id < y.id ? -1 : 1)),
    Object.entries(page.deleted).sort(([x], [y]) => (x < y ? -1 : 1)),
  ]);

/** Whether two pages have the same annotations, ignoring order and metadata. */
export function sameAnnotations(a: Annotation[], b: Annotation[]): boolean {
  const sorted = (list: Annotation[]) =>
    JSON.stringify([...list].sort((x, y) => (x.id < y.id ? -1 : 1)));
  return sorted(a) === sorted(b);
}
