import { resolve } from 'node:path';
import {
  type BrowserContext,
  test as base,
  chromium,
  type Page,
  type Worker,
} from '@playwright/test';

/**
 * A Chromium profile with the built extension loaded, its background service worker, and the
 * base URL of its pages.
 */
export const test = base.extend<{ context: BrowserContext; background: Worker; extension: string }>(
  {
    // biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures take their dependencies first.
    context: async ({}, use) => {
      const path = resolve(import.meta.dirname, '../.output/chrome-mv3');
      const context = await chromium.launchPersistentContext('', {
        channel: 'chromium',
        args: [`--disable-extensions-except=${path}`, `--load-extension=${path}`],
      });
      await use(context);
      await context.close();
    },
    background: async ({ context }, use) => {
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
      await use(worker);
    },
    extension: async ({ background }, use) => {
      // URL.origin is "null" for chrome-extension: URLs.
      await use(background.url().split('/').slice(0, 3).join('/'));
    },
  },
);

export const { expect } = test;

/**
 * Finds the first occurrence of `text` on the page and selects it, or returns the middle of its
 * first character to click. Runs in the page, so it can't use anything outside itself.
 */
function locate({ text, selecting }: { text: string; selecting: boolean }) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const i = n.data.indexOf(text);
    if (i < 0) continue;
    const range = document.createRange();
    range.setStart(n, i);
    range.setEnd(n, i + (selecting ? text.length : 1));
    if (selecting) {
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
    }
    const rect = range.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  throw new Error(`"${text}" not found`);
}

/**
 * Waits for the content script to start penciled on the page. It runs at document_idle and loads
 * the settings first, so on a slow machine a selection made right after `goto` comes before
 * penciled listens for it, and the toolbar never opens.
 */
function started(page: Page): Promise<void> {
  return page.locator('penciled-ui').waitFor({ state: 'attached' });
}

/** Selects the first occurrence of `text` on the page, as a reader would. */
export async function select(page: Page, text: string): Promise<void> {
  await started(page);
  await page.evaluate(locate, { text, selecting: true });
}

/** Clicks the first character of the first occurrence of `text` on the page. */
export async function click(page: Page, text: string): Promise<void> {
  await started(page);
  const { x, y } = await page.evaluate(locate, { text, selecting: false });
  await page.mouse.click(x, y);
}

/** The text of every painted highlight, by registry name. */
export function painted(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() =>
    Object.fromEntries(
      [...CSS.highlights].map(([name, h]) => [name, [...h].map((r) => (r as Range).toString())]),
    ),
  );
}

/** Everything the extension stored. */
export function stored(background: Worker): Promise<Record<string, unknown>> {
  // Runs in the worker, where Chrome's extension API is `chrome`.
  return background.evaluate(() =>
    (globalThis as unknown as Chrome).chrome.storage.local.get(null),
  );
}

/** penciled's highlights in browser sync: the keys of their items. */
export function synced(background: Worker): Promise<string[]> {
  return background.evaluate(async () =>
    Object.keys(await (globalThis as unknown as Chrome).chrome.storage.sync.get(null)).filter((k) =>
      k.startsWith('a:'),
    ),
  );
}

type Chrome = { chrome: typeof import('wxt/browser').browser };

/** The id of the tab showing `page`, as the extension knows it. */
export async function tabId(background: Worker, page: Page): Promise<number> {
  // Without the `tabs` permission, which penciled doesn't ask for, tabs' URLs are hidden: the
  // page is found as the active tab instead.
  await page.bringToFront();
  return background.evaluate(async () => {
    const chrome = (globalThis as unknown as Chrome).chrome;
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab!.id!;
  });
}

/** Sends the content script in `page` a message, as the popup and the shortcut do. */
export function send(background: Worker, page: Page, message: unknown): Promise<unknown> {
  return tabId(background, page).then((id) =>
    background.evaluate(
      ([id, message]) => (globalThis as unknown as Chrome).chrome.tabs.sendMessage(id, message),
      [id, message] as const,
    ),
  );
}

/** Writes to the extension's storage, as another tab or the settings page would. */
export function store(
  background: Worker,
  area: 'local' | 'sync',
  items: Record<string, unknown>,
): Promise<void> {
  return background.evaluate(
    ([area, items]) => (globalThis as unknown as Chrome).chrome.storage[area].set(items),
    [area, items] as const,
  );
}
