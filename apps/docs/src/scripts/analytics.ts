// PostHog product analytics for the site: pageviews, pageleaves, autocapture and a few named
// events for the main calls to action (listed in apps/docs/ANALYTICS.md). Events go to /ingest,
// which vercel.json (and the dev server) proxies to PostHog, so ad blockers don't drop them.
import posthog from 'posthog-js';

// The project token is public: it can only send events, not read them.
const key =
  import.meta.env.PUBLIC_POSTHOG_KEY || 'phc_p94VgqcYgGXsRoJHSzjvLsG4Gy9KMZHCR8LYUoqj4Apm';
const host = import.meta.env.PUBLIC_POSTHOG_HOST || '/ingest';

posthog.init(key, {
  api_host: host,
  ui_host: 'https://us.posthog.com',
  // The site is a multi-page app, but history_change also covers any client-side navigation.
  capture_pageview: 'history_change',
  capture_pageleave: true,
  autocapture: true,
  disable_session_recording: true,
  person_profiles: 'identified_only',
});
posthog.register({ product: 'penciled' });

/** Where on the site a click happened, so the same CTA can be compared across places. */
function placement(el: Element): string {
  if (el.closest('header')) return 'header';
  if (el.closest('footer')) return 'footer';
  if (el.closest('.band')) return 'hero';
  return window.location.pathname === '/' ? 'landing' : 'docs';
}

const STORES: Record<string, string> = {
  'chromewebstore.google.com': 'chrome',
  'addons.mozilla.org': 'firefox',
  'microsoftedge.microsoft.com': 'edge',
};

// Outbound links, classified by where they go. One delegated listener covers the landing page and
// every docs page, including links written in Markdown.
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as Element | null;
    const link = target?.closest<HTMLAnchorElement>('a[href]');
    if (link) {
      const url = new URL(link.href, window.location.href);
      const props = { location: placement(link), path: window.location.pathname };
      const browser = STORES[url.hostname];
      if (browser) posthog.capture('extension_install_clicked', { ...props, browser });
      else if (url.hostname === 'github.com' && url.pathname.startsWith('/marcellosso/penciled')) {
        posthog.capture('github_clicked', { ...props, url: url.href });
      } else if (url.hostname === 'www.npmjs.com') posthog.capture('npm_clicked', props);
      else if (url.hostname === 'stackblitz.com') posthog.capture('stackblitz_opened', props);
      else if (link.dataset.phEvent) posthog.capture(link.dataset.phEvent, props);
      return;
    }

    // Copying an install command: the landing page's button, or a code block's copy button in the
    // docs (Expressive Code keeps the code in data-code, with U+007F for line breaks).
    const copy = target?.closest<HTMLElement>('#copy-install, [data-code]');
    const code = copy?.id === 'copy-install' ? 'npm install penciled' : copy?.dataset.code;
    if (copy && code && /\b(npm|pnpm|yarn|bun)\b[^\n\x7f]*\bpenciled\b/.test(code)) {
      posthog.capture('install_command_copied', {
        location: placement(copy),
        path: window.location.pathname,
        command: code.split(/[\n\x7f]/)[0],
      });
    }
  },
  { capture: true },
);
