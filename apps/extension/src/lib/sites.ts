import { browser } from 'wxt/browser';

// Sites where penciled is turned off. Kept on this computer, even with sync on: a site can be worth
// turning off on one computer and not another.
const KEY = 'disabled-sites';

/** The site a URL belongs to, as shown to the reader and stored in the disabled list. */
export function siteOf(href: string): string {
  const url = new URL(href);
  return url.hostname.replace(/^www\./, '') || url.protocol.replace(/:$/, '');
}

export async function disabledSites(): Promise<string[]> {
  return ((await browser.storage.local.get(KEY))[KEY] as string[] | undefined) ?? [];
}

export async function setSiteEnabled(site: string, enabled: boolean): Promise<void> {
  const sites = (await disabledSites()).filter((s) => s !== site);
  if (!enabled) sites.push(site);
  await browser.storage.local.set({ [KEY]: sites.sort() });
}

/** Calls `fn` with the disabled sites whenever the list changes. */
export function onDisabledSites(fn: (sites: string[]) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    if (KEY in changes) fn((changes[KEY]!.newValue as string[] | undefined) ?? []);
  };
  browser.storage.local.onChanged.addListener(listener);
  return () => browser.storage.local.onChanged.removeListener(listener);
}
