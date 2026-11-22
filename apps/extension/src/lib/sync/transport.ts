import { browser } from 'wxt/browser';

/** How much a transport can hold. Chunking and the page budget are planned from these. */
export interface SyncQuota {
  /** Bytes for every item, counted as each key's length plus its JSON-encoded value's. */
  totalBytes: number;
  /** Bytes for one item, counted the same way. */
  itemBytes: number;
  maxItems: number;
}

/**
 * Where synced annotations travel between devices. It only moves opaque string items: chunking,
 * compression, merging, tombstones and the status the reader sees all live above it, so another
 * transport (an end-to-end encrypted relay, say) can replace `storage.sync` without changing them.
 */
export interface SyncTransport {
  readonly quota: SyncQuota;
  /** Every annotation item this transport holds, by key. */
  getAll(): Promise<Record<string, string>>;
  set(items: Record<string, string>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  /** Removes every annotation item, leaving anything else the transport holds alone. */
  clear(): Promise<void>;
  /** Bytes and items used by things that aren't annotations, and must always fit. */
  reserved(): Promise<{ bytes: number; items: number }>;
  /** What one item counts for against `quota`. */
  size(key: string, value: string): number;
  /** Calls `fn` when annotation items change, here or on another device. */
  onChanged(fn: () => void): () => void;
}

// Annotation items in storage.sync start with this, so they never collide with the settings.
const PREFIX = 'a:';

/** What one item counts for against the quota, as Chrome and Firefox measure it. */
export const itemSize = (key: string, value: unknown): number =>
  key.length + new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * `storage.sync`: Chrome and Edge sync it when the reader is signed in with sync on; Firefox syncs
 * it when they're signed in to Firefox Sync with Add-ons selected. Elsewhere it stays on the device,
 * which is harmless. Both browsers document the same limits: 102,400 bytes in all, 8,192 per item
 * and 512 items. Chrome also allows 120 writes a minute and 1,800 an hour; Firefox documents none.
 */
export function storageSyncTransport(): SyncTransport {
  const area = browser.storage.sync;
  const all = async () => (await area.get(null)) as Record<string, unknown>;
  const ours = (key: string) => key.startsWith(PREFIX);
  return {
    quota: { totalBytes: 102_400, itemBytes: 8_192, maxItems: 512 },
    async getAll() {
      const items: Record<string, string> = {};
      for (const [key, value] of Object.entries(await all())) {
        if (ours(key) && typeof value === 'string') items[key.slice(PREFIX.length)] = value;
      }
      return items;
    },
    set: (items) =>
      area.set(Object.fromEntries(Object.entries(items).map(([k, v]) => [PREFIX + k, v]))),
    remove: (keys) => area.remove(keys.map((k) => PREFIX + k)),
    async clear() {
      const keys = Object.keys(await all()).filter(ours);
      if (keys.length) await area.remove(keys);
    },
    size: (key, value) => itemSize(PREFIX + key, value),
    async reserved() {
      // The settings can grow to a full item, and must always fit: reserving that much for them
      // keeps them syncing however full the annotations get.
      let bytes = 8_192;
      let items = 1;
      for (const [key, value] of Object.entries(await all())) {
        if (ours(key) || key === 'settings') continue;
        bytes += itemSize(key, value);
        items++;
      }
      return { bytes, items };
    },
    onChanged(fn) {
      const listener = (changes: Record<string, unknown>) => {
        if (Object.keys(changes).some(ours)) fn();
      };
      area.onChanged.addListener(listener);
      return () => area.onChanged.removeListener(listener);
    },
  };
}
