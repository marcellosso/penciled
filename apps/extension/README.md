# penciled for the browser

A browser extension for highlighting text and taking notes on any web page, built on [penciled](../../packages/penciled). For readers: [www.penciled.org/extension](https://www.penciled.org/extension/). Highlights are saved in the browser (`chrome.storage.local`) and come back when you return to a page. Nothing is sent anywhere.

## Development

```sh
pnpm ext:dev     # builds penciled, then opens Chromium with the extension, reloading on changes
pnpm ext:build   # production build in apps/extension/.output/chrome-mv3
pnpm --filter extension dev:firefox     # the same as ext:dev, in Firefox (build penciled first)
pnpm --filter extension build:firefox   # production build in apps/extension/.output/firefox-mv3
pnpm --filter extension lint:firefox    # builds for Firefox and runs Mozilla's add-on linter
pnpm --filter extension test       # unit tests (Node, with WXT's fake browser APIs)
pnpm --filter extension test:e2e   # builds, then runs Playwright against the unpacked extension
```

To try a build by hand, open `chrome://extensions`, turn on developer mode and load `apps/extension/.output/chrome-mv3` with "Load unpacked". In Firefox, Zen and other Firefox-based browsers, open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on" and pick `apps/extension/.output/firefox-mv3/manifest.json`. It stays until the browser restarts.

Firefox needs version 140 or later, the first with the CSS Custom Highlight API. The end-to-end tests run in Chromium only, because Playwright can't load extensions in Firefox, so check Firefox changes by hand.

## Releasing

The extension is versioned separately from the library, and changesets ignores it.

1. Bump `version` in `package.json` and add a section for it to [CHANGELOG.md](./CHANGELOG.md).
2. After merging, tag the commit `extension-v<version>` and push the tag. The [Extension release](../../.github/workflows/extension-release.yml) workflow builds `penciled-<version>-chrome.zip`, `-edge.zip`, `-firefox.zip` and `-sources.zip` and attaches them to a GitHub release.
3. Upload the zips to the stores by hand. Firefox Add-ons also asks for `-sources.zip`, since the extension is bundled; its reviewers build from it with the steps below. [store/listing.md](./store/listing.md) has the listing text, and `store/screenshots/` the screenshots (`pnpm --filter extension screenshots` retakes them).

## Building from source

These steps rebuild the Firefox package from `penciled-<version>-sources.zip`, which holds this extension, the penciled package it's built on and the workspace files. They need Node 24 and pnpm 10.19.0 (`corepack enable` picks it up from `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm --filter penciled build
pnpm --filter extension build:firefox
```

The extension is then in `apps/extension/.output/firefox-mv3`.

## How it works

- `src/entrypoints/content.ts` runs on every page. It calls `annotate(document.body)` with the toolbar mounted in a shadow root outside `<body>`, so the page's CSS can't reach it. penciled's stylesheet is also added to the page itself, where the highlights are painted.
- `src/lib/url.ts` turns the page's address into the id annotations are stored under, without the fragment, tracking parameters, `www.` or a trailing slash. Single-page apps get a new id on every navigation.
- `src/lib/storage.ts` stores each page's annotations under `page:<id>` and a summary for the notes page under `meta:<id>`. Each change is applied to what's stored, so two tabs on the same page don't overwrite each other.
- `src/lib/scheme.ts` sets each color's highlight value for the page's actual background, since many dark sites don't declare a `color-scheme`.
- `src/entrypoints/popup/` lists the current page's highlights, including ones that can no longer be found, and turns penciled off for the site. It talks to the page's content script with the messages in `src/lib/messages.ts`.
- `src/entrypoints/sidepanel/` is the sidebar (Chrome's side panel, Firefox's sidebar). **This page** asks the active tab's content script for its highlights, as the popup does, and follows tab switches; content scripts send it `changed` when a single-page app navigates or the shortcut hides highlights. **All pages** reads storage. Both refresh when storage changes. The list search is shared with the notes page (`src/lib/search.ts`), where `#word`s in a search are tags that must all match.
- Tags are kept in each annotation's `meta.tags` (`src/lib/tags.ts`), so penciled's data shape and backups don't change. They're lowercase, without `#`, with hyphens for spaces. The sidebar edits them (`sidepanel/tags.ts`): through the content script for the tab's own page, as with deleting, and in storage for other pages.
- `src/lib/sidebar.ts` wraps the two browsers' sidebar APIs. The background sets whether the toolbar button opens the popup or the sidebar, following the `buttonOpens` setting, and handles the sidebar shortcut. Chrome can't tell whether its side panel is open, so each open sidebar keeps a port to the background, which closes it through the port.
- `src/entrypoints/options/` is the extension's page, with two tabs. **Notes** (`notes.ts`) lists every highlight by site and page, searches them, opens or deletes them, and exports or imports them. **Settings** (`settings.ts`) has the toolbar theme, whether selecting text opens the toolbar, the color palette, the sites penciled is off on, and shortcuts. Settings live in `chrome.storage.sync` (`src/lib/settings.ts`). Open tabs apply changes right away.
- Colors have stable ids (`c1`, `c2`, …), which is what highlights store. A removed color that's still in use is kept but hidden from the toolbar, so no settings change can make a highlight disappear.
- `src/lib/backup.ts` exports everything as JSON (annotations in penciled's own format, plus the palette) or Markdown. Importing runs each annotation through penciled's `normalize()` and keeps whichever copy of a highlight changed last. Colors the palette doesn't have are added as removed colors, so imported highlights keep their color.
- Opening a highlight from the notes page opens a new tab and leaves a short-lived `open` entry in storage; the content script for that page scrolls to the highlight and clears it.
- Each content script watches its page's storage key, so deleting, recoloring or importing highlights elsewhere applies to open tabs straight away.
- `src/entrypoints/background.ts` passes the "hide or show highlights on this tab" shortcut to the tab.

The end-to-end tests open the popup and the sidebar in a tab, naming the page's tab with `popup.html?tab=<id>` or `sidepanel.html?tab=<id>`.
