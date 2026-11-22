import type { Annotation } from 'penciled/headless';
import { beforeEach, expect, test } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { restoreBackup } from '../src/lib/backup.ts';
import { deleteAnnotation, listPages } from '../src/lib/pages.ts';
import { getSettings, saveSettings } from '../src/lib/settings.ts';
import { deletedKey, extensionStorage, pageEntries } from '../src/lib/storage.ts';
import { assemble, decodePage, encodePage, type SyncedPage } from '../src/lib/sync/codec.ts';
import { createSync } from '../src/lib/sync/engine.ts';
import { mergePage, type PageCopy, TOMBSTONE_TTL } from '../src/lib/sync/merge.ts';
import { describeStatus, setSyncEnabled, syncEnabled, syncStatus } from '../src/lib/sync/state.ts';
import { itemSize, type SyncTransport, storageSyncTransport } from '../src/lib/sync/transport.ts';

const annotation = (id: string, patch: Partial<Annotation> = {}): Annotation => ({
  version: 1,
  id,
  quote: id,
  prefix: '',
  suffix: '',
  start: 0,
  end: id.length,
  color: 'c1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

// Text that doesn't compress, to fill the quota quickly.
const noise = (bytes: number) => {
  const random = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...random)).slice(0, bytes);
};

const url = (n: number | string) => `https://example.com/${n}`;

/** Stores annotations on a page, as a tab would. */
const store = (page: string, annotations: Annotation[], updatedAt?: string) => {
  const entries = pageEntries(page, { url: page, title: `Page ${page}` }, annotations);
  if (updatedAt) Object.assign(entries[`meta:${page}`]!, { updatedAt });
  return browser.storage.local.set(entries);
};

const local = async (page: string) => (await listPages()).find((p) => p.id === page)?.annotations;

/** Our items in storage.sync. */
const synced = async () =>
  Object.keys(await browser.storage.sync.get(null)).filter((k) => k.startsWith('a:'));

// Each device has its own local storage; they share storage.sync, as browser sync would.
const devices = new Map<string, Record<string, unknown>>();
let current: string | undefined;
async function on(device: string) {
  if (current) devices.set(current, await browser.storage.local.get(null));
  await browser.storage.local.clear();
  await browser.storage.local.set(devices.get(device) ?? {});
  current = device;
}

/** storage.sync with smaller limits, failing like Chrome does past them. */
function limited(totalBytes: number, failAlways = false): SyncTransport {
  const inner = storageSyncTransport();
  return {
    ...inner,
    quota: { ...inner.quota, totalBytes },
    async set(items) {
      const existing = await inner.getAll();
      const all = { ...existing, ...items };
      const reserved = await inner.reserved();
      const used = Object.entries(all).reduce((n, [k, v]) => n + inner.size(k, v), 0);
      if (failAlways || used + reserved.bytes > totalBytes) {
        throw new Error('QUOTA_BYTES quota exceeded');
      }
      await inner.set(items);
    },
  };
}

const run = (transport: SyncTransport = storageSyncTransport(), now = Date.now()) =>
  createSync(transport, { now: () => now }).run();

beforeEach(async () => {
  fakeBrowser.reset();
  devices.clear();
  current = undefined;
});

test('pages larger than one item are split into chunks that each fit, and reassembled', async () => {
  const page: SyncedPage = {
    id: url(1),
    url: url(1),
    title: 'Long',
    updatedAt: '2026-01-01T00:00:00.000Z',
    annotations: Array.from({ length: 20 }, (_, i) =>
      annotation(`a${i}`, { quote: noise(1_000), note: noise(500) }),
    ),
    deleted: { gone: '2026-01-02T00:00:00.000Z' },
  };
  const transport = storageSyncTransport();
  const items = await encodePage('h', page, 8_192, transport.size);
  expect(Object.keys(items).length).toBeGreaterThan(3);
  for (const [key, value] of Object.entries(items)) {
    expect(transport.size(key, value)).toBeLessThanOrEqual(8_192);
  }
  const chunks = assemble(items).get('h')!;
  expect(await decodePage(chunks.data!)).toEqual(page);

  // A chunk that hasn't arrived yet: the page isn't read half-written.
  const partial = { ...items };
  delete partial['h.1'];
  expect(assemble(partial).get('h')!.data).toBeUndefined();
});

test('pages are compressed', async () => {
  const quote = 'The same sentence, again and again. '.repeat(200);
  const page: SyncedPage = {
    id: url(1),
    url: url(1),
    title: '',
    updatedAt: '',
    annotations: [annotation('a', { quote })],
    deleted: {},
  };
  const items = await encodePage('h', page, 8_192, itemSize);
  expect(Object.keys(items)).toHaveLength(1);
  expect(items['h.0']!.length).toBeLessThan(quote.length / 5);
});

test('the last change to an annotation wins, and different annotations both survive', () => {
  const copy = (annotations: Annotation[], deleted = {}): PageCopy => ({
    url: url(1),
    title: '',
    updatedAt: '',
    annotations,
    deleted,
  });
  const merged = mergePage(
    copy([
      annotation('a', { note: 'mine', updatedAt: '2026-01-02T00:00:00.000Z' }),
      annotation('b'),
    ]),
    copy([
      annotation('a', { note: 'theirs', updatedAt: '2026-01-03T00:00:00.000Z' }),
      annotation('c'),
    ]),
  );
  expect(merged.annotations.map((a) => [a.id, a.note])).toEqual([
    ['a', 'theirs'],
    ['b', undefined],
    ['c', undefined],
  ]);
  // An edit made after a deletion brings the annotation back; one made before doesn't.
  const deleted = { a: '2026-01-02T12:00:00.000Z' };
  const edited = (at: string) => copy([annotation('a', { updatedAt: at })]);
  expect(mergePage(copy([], deleted), edited('2026-01-02T00:00:00.000Z')).annotations).toEqual([]);
  expect(mergePage(copy([], deleted), edited('2026-01-03T00:00:00.000Z')).annotations).toHaveLength(
    1,
  );
});

test('highlights made on two devices end up on both', async () => {
  await on('a');
  await setSyncEnabled(true);
  await store(url(1), [annotation('a1')]);
  await run();

  await on('b');
  await setSyncEnabled(true);
  await store(url(1), [annotation('b1')]);
  await store(url(2), [annotation('b2')]);
  await run();
  expect((await local(url(1)))!.map((a) => a.id).sort()).toEqual(['a1', 'b1']);

  await on('a');
  await run();
  expect((await local(url(1)))!.map((a) => a.id).sort()).toEqual(['a1', 'b1']);
  expect((await local(url(2)))!.map((a) => a.id)).toEqual(['b2']);
  expect((await syncStatus())!).toMatchObject({ state: 'synced', synced: 2, total: 2 });
});

test('the same highlight edited on two devices keeps the later edit', async () => {
  await on('a');
  await setSyncEnabled(true);
  await store(url(1), [annotation('x', { note: 'old', updatedAt: '2026-02-01T00:00:00.000Z' })]);
  await run();
  await on('b');
  await setSyncEnabled(true);
  await store(url(1), [annotation('x', { note: 'new', updatedAt: '2026-03-01T00:00:00.000Z' })]);
  await run();
  await on('a');
  await run();
  expect((await local(url(1)))!.map((a) => a.note)).toEqual(['new']);
});

test('a highlight deleted on one device is deleted on the other', async () => {
  await on('a');
  await setSyncEnabled(true);
  const page = () => ({ url: url(1), title: '' });
  await extensionStorage(page).save(url(1), [annotation('x'), annotation('y')]);
  await run();
  await on('b');
  await setSyncEnabled(true);
  await run();
  expect(await local(url(1))).toHaveLength(2);

  // Deleted in a tab on b, and on b's notes page.
  await extensionStorage(page).delete!(url(1), 'x');
  await deleteAnnotation((await listPages())[0]!, 'y');
  expect(await browser.storage.local.get(deletedKey('x'))).not.toEqual({});
  await run();

  await on('a');
  await run();
  expect(await local(url(1))).toBeUndefined();
});

test('deletions are forgotten after the TTL, here and in sync', async () => {
  await setSyncEnabled(true);
  await store(url(1), [annotation('x')]);
  await extensionStorage(() => ({ url: url(1), title: '' })).delete!(url(1), 'x');
  await run();
  expect(await synced()).not.toEqual([]);
  await run(storageSyncTransport(), Date.now() + TOMBSTONE_TTL + 60_000);
  expect(await browser.storage.local.get(deletedKey('x'))).toEqual({});
  expect(await synced()).toEqual([]);

  // Forgotten while sync is off too.
  await setSyncEnabled(false);
  await extensionStorage(() => ({ url: url(2), title: '' })).save(url(2), [annotation('y')]);
  await extensionStorage(() => ({ url: url(2), title: '' })).delete!(url(2), 'y');
  await run(storageSyncTransport(), Date.now() + TOMBSTONE_TTL + 60_000);
  expect(await browser.storage.local.get(deletedKey('y'))).toEqual({});
});

test('a restored backup brings back highlights deleted earlier, and they stay', async () => {
  await on('a');
  await setSyncEnabled(true);
  await store(url(1), [annotation('x')]);
  await run();
  await on('b');
  await setSyncEnabled(true);
  await run();
  await deleteAnnotation((await listPages())[0]!, 'x');
  await run();
  await on('a');
  await run();
  expect(await local(url(1))).toBeUndefined();

  const backup = {
    format: 'penciled-extension',
    version: 1,
    exportedAt: '',
    colors: [],
    pages: [{ url: url(1), title: '', annotations: [annotation('x')] }],
  };
  expect(await restoreBackup(backup)).toBe(1);
  await run();
  await on('b');
  await run();
  expect((await local(url(1)))!.map((a) => a.id)).toEqual(['x']);
});

test('past the quota, the most recent pages sync and the rest stay local, untouched', async () => {
  await saveSettings({ theme: 'dark' });
  await setSyncEnabled(true);
  for (let i = 0; i < 6; i++) {
    await store(
      url(i),
      [annotation(`a${i}`, { quote: noise(2_000) })],
      `2026-01-0${i + 1}T00:00:00.000Z`,
    );
  }
  const before = await browser.storage.local.get(null);
  // Room for the settings' reserved item and about three pages.
  await run(limited(8_192 + 3 * 2_200));

  const status = (await syncStatus())!;
  expect(status).toMatchObject({ state: 'partial', total: 6 });
  expect(status.synced).toBeGreaterThan(0);
  expect(status.synced).toBeLessThan(6);
  expect(describeStatus(status)).toBe(
    `Syncing ${status.synced} of 6 pages, the most recently changed. Browser sync has no room for the rest. Your copy on this computer is complete.`,
  );
  const after = await browser.storage.local.get(null);
  delete before['sync-status'];
  delete after['sync-status'];
  expect(after).toEqual(before);

  // The newest pages are the ones in sync.
  await on('other');
  await setSyncEnabled(true);
  await run(limited(8_192 + 3 * 2_200));
  const there = (await listPages()).map((p) => p.id);
  expect(there).toHaveLength(status.synced);
  expect(there).toContain(url(5));
  expect(there).not.toContain(url(0));

  // Settings still sync.
  await saveSettings({ theme: 'light' });
  expect((await getSettings()).theme).toBe('light');
});

test('a failed sync says so, and leaves local data alone', async () => {
  await setSyncEnabled(true);
  await store(url(1), [annotation('a')]);
  const before = await listPages();
  await run(limited(102_400, true));
  const status = (await syncStatus())!;
  expect(status.state).toBe('error');
  expect(describeStatus(status)).toMatch(/^Sync didn’t work: browser sync is full\. Your copy/);
  expect(await listPages()).toEqual(before);
});

test('nothing goes to sync until it is turned on, and turning it off clears it', async () => {
  await saveSettings({ theme: 'dark' });
  await store(url(1), [annotation('a')]);
  expect(await syncEnabled()).toBe(false);
  await run();
  expect(await synced()).toEqual([]);

  await setSyncEnabled(true);
  await run();
  expect(await synced()).not.toEqual([]);

  await setSyncEnabled(false);
  expect(await synced()).toEqual([]);
  expect(await syncStatus()).toBeUndefined();
  // Only penciled's synced highlights go: the settings and this device's highlights stay.
  expect((await getSettings()).theme).toBe('dark');
  expect(await local(url(1))).toHaveLength(1);
  await run();
  expect(await synced()).toEqual([]);

  // Turned on again, the local copy syncs again.
  await setSyncEnabled(true);
  await run();
  expect(await synced()).not.toEqual([]);
});

test('turned off while a sync is writing, it takes back what it wrote', async () => {
  await setSyncEnabled(true);
  await store(url(1), [annotation('a')]);
  const inner = storageSyncTransport();
  const transport: SyncTransport = {
    ...inner,
    async set(items) {
      await setSyncEnabled(false, inner);
      await inner.set(items);
    },
  };
  await run(transport);
  expect(await synced()).toEqual([]);
});
