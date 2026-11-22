import { type Annotation, normalize } from 'penciled/headless';
import { browser } from 'wxt/browser';
import {
  deletedKey,
  metaKey,
  type PageData,
  type PageMeta,
  pageKey,
  type Tombstone,
} from '../storage.ts';
import { assemble, decodePage, encodePage, pageHash, type SyncedPage } from './codec.ts';
import { expire, mergePage, type PageCopy, sameAnnotations, samePage } from './merge.ts';
import { isEnabledChange, setSyncStatus, syncEnabled, syncStatus } from './state.ts';
import type { SyncTransport } from './transport.ts';

export interface SyncOptions {
  /** How long to wait after a change before syncing, so a burst of edits is one write. */
  delay?: number;
  /** How long to wait before trying again after a failure. */
  retry?: number;
  now?: () => number;
}

export interface Sync {
  /** Merges what's in sync into this device, and this device's pages into sync. */
  run(): Promise<void>;
  /** Runs after `delay`, once however many times it's called meanwhile. */
  schedule(delay?: number): void;
  /** Runs now, and again whenever this device's highlights or the synced ones change. */
  start(): () => void;
}

const DELETED = 'deleted:';

/**
 * Syncs highlights through `transport`. This device's storage stays the source of truth: sync
 * holds as many of the most recently changed pages as fit, and a page missing from it is never
 * deleted here. Only tombstones delete.
 */
export function createSync(transport: SyncTransport, options: SyncOptions = {}): Sync {
  const { delay = 3_000, retry = 60_000, now = Date.now } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let again = false;

  const schedule = (wait = delay) => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), wait);
  };

  const run = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await once();
      } while (again);
    })().finally(() => {
      running = undefined;
    });
    return running;
  };

  const once = async () => {
    if (!(await syncEnabled())) return forget(now());
    try {
      // Another tab can write while this merges; then it starts again from what's stored.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await pass(transport, now())) return;
      }
      schedule();
    } catch (error) {
      await report(transport, now(), error);
      schedule(retry);
    }
  };

  return {
    run,
    schedule,
    start() {
      const local = (changes: Record<string, { newValue?: unknown }>) => {
        const keys = Object.keys(changes);
        const pages = keys.some(
          (k) => k.startsWith('page:') || k.startsWith('meta:') || k.startsWith(DELETED),
        );
        if (pages || keys.some((k) => isEnabledChange(k) && changes[k]!.newValue === true)) {
          schedule();
        }
      };
      browser.storage.local.onChanged.addListener(local);
      const remote = transport.onChanged(() => schedule());
      schedule(0);
      return () => {
        clearTimeout(timer);
        browser.storage.local.onChanged.removeListener(local);
        remote();
      };
    },
  };
}

/** This device's pages, deletions included. */
function readLocal(all: Record<string, unknown>): Map<string, PageCopy> {
  const pages = new Map<string, PageCopy>();
  const page = (id: string) => {
    let copy = pages.get(id);
    if (!copy) {
      copy = { url: id, title: '', updatedAt: '', annotations: [], deleted: {} };
      pages.set(id, copy);
    }
    return copy;
  };
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('page:')) {
      const id = key.slice(5);
      const meta = all[metaKey(id)] as PageMeta | undefined;
      Object.assign(page(id), {
        url: meta?.url ?? id,
        title: meta?.title ?? '',
        updatedAt: meta?.updatedAt ?? '',
        annotations: (value as PageData).annotations,
      });
    } else if (key.startsWith(DELETED)) {
      const { page: id, at } = value as Tombstone;
      page(id).deleted[key.slice(DELETED.length)] = at;
    }
  }
  return pages;
}

/** Forgets expired deletions, which are kept even while sync is off. */
async function forget(now: number) {
  const all = await browser.storage.local.get(null);
  const expired: string[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(DELETED)) continue;
    const at = (value as Tombstone).at;
    if (!Object.keys(expire({ [key]: at }, now)).length) expired.push(key);
  }
  if (expired.length) await browser.storage.local.remove(expired);
}

/** When a page last changed, deletions included, to sync the most recent ones first. */
const changedAt = (page: PageCopy) =>
  Object.values(page.deleted).reduce((max, at) => (at > max ? at : max), page.updatedAt);

/** One merge in both directions. Returns false if a tab wrote meanwhile, to start again. */
async function pass(transport: SyncTransport, now: number): Promise<boolean> {
  const [stored, items] = await Promise.all([browser.storage.local.get(null), transport.getAll()]);
  const mine = readLocal(stored);
  const chunks = assemble(items);

  // What's in sync, by page id. Pages still being written by another device are skipped.
  const theirs = new Map<string, { copy: PageCopy; parts: string[] }>();
  const incomplete = new Set<string>();
  for (const chunk of chunks.values()) {
    if (chunk.data === undefined) {
      incomplete.add(chunk.hash);
      continue;
    }
    const page = await decodePage(chunk.data);
    // Unreadable, or not the page its key says: replaced below by whatever belongs there.
    if (!page || (await pageHash(page.id)) !== chunk.hash) continue;
    // Validated, but kept as written: a normalized copy could differ from the other device's
    // and make the two rewrite each other's pages forever.
    const annotations = page.annotations.filter((a): a is Annotation => !!normalize(a));
    theirs.set(page.id, { copy: { ...page, annotations }, parts: chunk.parts! });
  }

  // Merge into this device.
  const merged = new Map<string, PageCopy>();
  const writes: Record<string, unknown> = {};
  const removes: string[] = [];
  const touched: string[] = [];
  for (const id of new Set([...mine.keys(), ...theirs.keys()])) {
    const own = mine.get(id);
    const page = mergePage(own, theirs.get(id)?.copy);
    page.deleted = expire(page.deleted, now);
    merged.set(id, page);

    const had = own?.annotations ?? [];
    const metaChanged =
      own?.url !== page.url || own.title !== page.title || own.updatedAt !== page.updatedAt;
    if (page.annotations.length && (!sameAnnotations(had, page.annotations) || metaChanged)) {
      touched.push(id);
      writes[pageKey(id)] = { version: 1, annotations: page.annotations } satisfies PageData;
      writes[metaKey(id)] = {
        url: page.url,
        title: page.title,
        count: page.annotations.length,
        updatedAt: page.updatedAt,
      } satisfies PageMeta;
    } else if (!page.annotations.length && had.length) {
      touched.push(id);
      removes.push(pageKey(id), metaKey(id));
    }
    for (const [annotation, at] of Object.entries(page.deleted)) {
      if (own?.deleted[annotation] !== at) {
        writes[deletedKey(annotation)] = { page: id, at } satisfies Tombstone;
      }
    }
    for (const annotation of Object.keys(own?.deleted ?? {})) {
      if (!(annotation in page.deleted)) removes.push(deletedKey(annotation));
    }
  }

  if (touched.length) {
    // Storage has no transactions. Checking just before writing keeps the window in which a
    // tab's edit could be overwritten as small as it can be, and the tab's write wins after it.
    const keys = touched.map(pageKey);
    const current = await browser.storage.local.get(keys);
    if (keys.some((k) => JSON.stringify(current[k]) !== JSON.stringify(stored[k]))) return false;
  }
  if (Object.keys(writes).length) await browser.storage.local.set(writes);
  if (removes.length) await browser.storage.local.remove(removes);

  // Then into sync, most recently changed first, as many as fit.
  const reserved = await transport.reserved();
  const { quota } = transport;
  let budget = quota.totalBytes - reserved.bytes;
  const itemBudget = quota.maxItems - reserved.items;
  const order = [...merged]
    .filter(([, p]) => p.annotations.length || Object.keys(p.deleted).length)
    .sort(([, a], [, b]) => changedAt(b).localeCompare(changedAt(a)));
  const encoded = new Map<string, Record<string, string>>();
  const total = [...merged.values()].filter((p) => p.annotations.length).length;

  for (let attempt = 0; ; attempt++) {
    const next: Record<string, string> = {};
    // Another device's half-written pages are left alone, and still take up room.
    const kept = new Set<string>();
    let bytes = 0;
    let count = 0;
    for (const [key, value] of Object.entries(items)) {
      if (incomplete.has(key.slice(0, key.lastIndexOf('.')))) {
        kept.add(key);
        bytes += transport.size(key, value);
        count++;
      }
    }
    let synced = 0;
    const hashes = new Set<string>();
    for (const [id, page] of order) {
      const hash = await pageHash(id);
      if (hashes.has(hash)) continue;
      hashes.add(hash);
      const remote = theirs.get(id);
      let pageItems: Record<string, string>;
      if (remote && samePage(remote.copy, page)) {
        pageItems = Object.fromEntries(remote.parts.map((k) => [k, items[k]!]));
      } else {
        pageItems =
          encoded.get(id) ??
          (await encodePage(hash, toSynced(id, page), quota.itemBytes, transport.size));
        encoded.set(id, pageItems);
      }
      const entries = Object.entries(pageItems);
      const size = entries.reduce((sum, [k, v]) => sum + transport.size(k, v), 0);
      if (bytes + size > budget || count + entries.length > itemBudget) continue;
      for (const [k, v] of entries) {
        next[k] = v;
        kept.delete(k);
      }
      bytes += size;
      count += entries.length;
      if (page.annotations.length) synced++;
    }

    const toSet = Object.fromEntries(Object.entries(next).filter(([k, v]) => items[k] !== v));
    const toRemove = Object.keys(items).filter((k) => !(k in next) && !kept.has(k));
    try {
      // Removed first, so the quota is never exceeded part-way. A page missing from sync for a
      // moment deletes nothing anywhere.
      if (toRemove.length) await transport.remove(toRemove);
      if (Object.keys(toSet).length) await transport.set(toSet);
    } catch (error) {
      // The estimate was off: the browser counts differently, or something else grew. Try with
      // less, and say so if that fails too. Nothing on this device changes either way.
      if (isQuotaError(error) && attempt < 3) {
        budget = Math.floor(budget * 0.8);
        for (const k of toRemove) delete items[k];
        continue;
      }
      throw error;
    }
    // Turned off while this ran: take back what it just wrote.
    if (!(await syncEnabled())) {
      await transport.clear();
      return true;
    }
    await setSyncStatus({
      state: synced < total ? 'partial' : 'synced',
      synced,
      total,
      bytes,
      budget,
      at: new Date(now).toISOString(),
    });
    return true;
  }
}

const toSynced = (id: string, page: PageCopy): SyncedPage => ({
  id,
  url: page.url,
  title: page.title,
  updatedAt: page.updatedAt,
  annotations: page.annotations,
  deleted: page.deleted,
});

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isQuotaError = (error: unknown) =>
  /QUOTA_BYTES|MAX_ITEMS|quota/i.test(message(error)) && !/WRITE_OPERATIONS/.test(message(error));

async function report(transport: SyncTransport, now: number, error: unknown) {
  const text = message(error);
  const previous = await syncStatus();
  if (!(await syncEnabled())) return;
  await setSyncStatus({
    state: 'error',
    synced: previous?.synced ?? 0,
    total: previous?.total ?? 0,
    bytes: previous?.bytes ?? 0,
    budget: previous?.budget ?? transport.quota.totalBytes,
    at: new Date(now).toISOString(),
    error: /WRITE_OPERATIONS/.test(text)
      ? 'browser sync limits how often extensions can save.'
      : isQuotaError(error)
        ? 'browser sync is full.'
        : text,
  });
}
