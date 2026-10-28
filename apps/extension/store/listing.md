# Store listings

What to fill in on the [Chrome Web Store](https://chrome.google.com/webstore/devconsole), [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge/) and [Firefox Add-ons](https://addons.mozilla.org/developers/) dashboards. Upload `penciled-<version>-chrome.zip`, `penciled-<version>-edge.zip` and `penciled-<version>-firefox.zip` from the [extension release](https://github.com/marcellosso/penciled/releases?q=extension&expanded=true).

Screenshots are in `screenshots/` (1280×800), and the Chrome Web Store's promo tiles in `promo/`: `small-tile.png` (440×280) and `marquee.png` (1400×560). Regenerate them all with `pnpm --filter extension screenshots`. No promo video for now. The store icon is `public/icon/128.png`; regenerate the icons with `pnpm --filter extension icons`.

## Listing

- **Name:** penciled – Highlighter & Notes for any web page (from the manifest; "for web pages" on Firefox, which caps names at 45 characters)
- **Summary:** Highlight text and take notes on any website. Your highlights come back when you return. Nothing leaves your browser. (from the manifest, under 132 characters)
- **Category:** Productivity → Tools (Chrome) · Productivity (Edge) · Other (Firefox)
- **Language:** English
- **Homepage:** https://www.penciled.org/extension/
- **Support:** https://github.com/marcellosso/penciled/issues
- **Privacy policy:** https://www.penciled.org/extension/privacy/

## Description

```
Highlight text and take notes on any website, like reading with a pencil in hand. Your highlights come back every time you return to the page.

• Select text and pick a color to highlight it. Add a note to remember why.
• Click penciled's toolbar button to keep your highlights in a sidebar beside the page, and jump to any of them.
• The notes page lists every highlight from every site, with search.
• Export your notes as a backup or as Markdown, and import them in another browser.
• Make it yours: your own colors, a light or dark toolbar, or a toolbar that only opens when you press Alt+A.
• Hide highlights on a tab with Alt+Shift+H, or turn penciled off for a whole site.
• Looks right on dark websites too.

Private by design
penciled has no account, no servers and no analytics. It makes no network requests: your highlights are saved in your browser and never leave it. It's open source, so you can check: https://github.com/marcellosso/penciled

Highlights never change the page itself. They're drawn by the browser, so pages keep working exactly as before. If a page changes so much that penciled can't be sure where a highlight belongs, it doesn't guess: it lists the highlight as not found, so you can still read or delete it.

Not supported yet: text inside frames (such as embedded posts), PDFs, and text fields. Highlights don't sync between computers; use export and import to move them.

Built on penciled, the open-source text annotation library: https://www.penciled.org
```

## Privacy practices (Chrome)

- **Single purpose:** Lets the reader highlight text and write notes on web pages, and find them again later.
- **Permission justifications:**
  - `storage`: saves the reader's highlights, notes and settings in the browser.
  - `unlimitedStorage`: readers who highlight a lot can exceed the 10 MB default; highlights are never deleted to make room.
  - Host permission (`<all_urls>`, through the content script): the reader can highlight on any website, so the content script runs on every page to show their highlights and the toolbar.
- **Remote code:** No, it doesn't use remote code.
- **Data usage:** none of the listed types of data is collected. Website content (the highlighted text, with a little of the text around it, and the page's address and title) is stored locally only and is never transmitted, so it isn't "collected" in the store's sense. Certify all three statements: not sold, not used for unrelated purposes, not used for credit.

## Firefox Add-ons

- **Listing:** "On this site", so it's signed and listed on addons.mozilla.org. Zen, Floorp, LibreWolf and other Firefox-based browsers install from there.
- **Source code:** yes, the package is bundled and minified. Upload `penciled-<version>-sources.zip` from the same release.
- **Notes to reviewer:** Build steps are in apps/extension/README.md inside the sources zip, under "Building from source". The build is made with WXT and is reproducible: the output matches the uploaded package.
- **Data collection:** none, declared in the manifest (`data_collection_permissions`).
- **License:** MIT.
