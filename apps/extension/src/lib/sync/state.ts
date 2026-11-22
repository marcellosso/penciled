import { browser } from 'wxt/browser';
import { type SyncTransport, storageSyncTransport } from './transport.ts';

/** How the last sync went, as the settings page shows it. */
export interface SyncStatus {
  /**
   * `waiting` until the first sync. `partial` when browser sync has no room for every page, so
   * the most recently changed ones sync and the rest stay on this device only.
   */
  state: 'waiting' | 'synced' | 'partial' | 'error';
  /** Pages with highlights that are in browser sync. */
  synced: number;
  /** Pages with highlights on this device. */
  total: number;
  /** Bytes the synced pages use, of `budget`. */
  bytes: number;
  budget: number;
  /** ISO 8601 timestamp. */
  at: string;
  /** What went wrong, for `error`. */
  error?: string;
}

// Kept on this device: turning sync on is a choice made on each computer, not one that follows
// the reader to computers where they haven't made it.
const ENABLED = 'sync-enabled';
const STATUS = 'sync-status';

export async function syncEnabled(): Promise<boolean> {
  return (await browser.storage.local.get(ENABLED))[ENABLED] === true;
}

/**
 * Turns syncing highlights on or off on this device. Turning it off removes the highlights penciled
 * put in browser sync, leaving the ones on this device and the synced settings alone.
 */
export async function setSyncEnabled(
  enabled: boolean,
  transport: SyncTransport = storageSyncTransport(),
): Promise<void> {
  if (enabled) {
    const waiting: SyncStatus = {
      state: 'waiting',
      synced: 0,
      total: 0,
      bytes: 0,
      budget: 0,
      at: new Date().toISOString(),
    };
    await browser.storage.local.set({ [ENABLED]: true, [STATUS]: waiting });
    return;
  }
  // Turned off first, so a sync already under way clears up after itself instead of writing.
  await browser.storage.local.set({ [ENABLED]: false });
  await browser.storage.local.remove(STATUS);
  await transport.clear();
}

export async function syncStatus(): Promise<SyncStatus | undefined> {
  return (await browser.storage.local.get(STATUS))[STATUS] as SyncStatus | undefined;
}

export async function setSyncStatus(status: SyncStatus): Promise<void> {
  await browser.storage.local.set({ [STATUS]: status });
}

/** Calls `fn` when sync is turned on or off, or its status changes. */
export function onSyncState(fn: () => void): () => void {
  const listener = (changes: Record<string, unknown>) => {
    if (ENABLED in changes || STATUS in changes) fn();
  };
  browser.storage.local.onChanged.addListener(listener);
  return () => browser.storage.local.onChanged.removeListener(listener);
}

/** Whether a local storage change is to sync's on/off switch. */
export const isEnabledChange = (key: string): boolean => key === ENABLED;

const pages = (n: number) => `${n} page${n === 1 ? '' : 's'}`;

/** The status as one or two sentences for the reader. */
export function describeStatus(status: SyncStatus | undefined): string {
  if (!status || status.state === 'waiting') return 'Syncing for the first time…';
  const local = 'Your copy on this computer is complete.';
  if (status.state === 'error') {
    const reason = (status.error ?? 'something went wrong').replace(/[.\s]*$/, '.');
    return `Sync didn’t work: ${reason} ${local} penciled will try again.`;
  }
  if (status.state === 'partial') {
    return `Syncing ${status.synced} of ${pages(status.total)}, the most recently changed. Browser sync has no room for the rest. ${local}`;
  }
  if (!status.total) return 'Nothing to sync yet.';
  const full = status.budget ? Math.round((status.bytes / status.budget) * 100) : 0;
  const all =
    status.total === 1
      ? 'Your 1 page with highlights is syncing.'
      : `All ${pages(status.total)} with highlights are syncing.`;
  return full >= 80
    ? `${all} Browser sync is ${full}% full: when it fills up, only the most recently changed pages will sync.`
    : all;
}
