# penciled for the browser

## Unreleased

- Sync your highlights and notes between computers, through your browser's own sync. Turn it on under **Sync highlights** in the settings, on each computer. It's off unless you turn it on, and needs no penciled account: Chrome and Edge sync it when you're signed in with sync on, Firefox when you're signed in to Firefox Sync with Add-ons selected. Browser sync holds about 100 KB, so with many highlights only the most recently changed pages sync; the settings say when that happens. Your highlights on each computer are always kept in full.

## 0.4.0

- penciled's toolbar button now opens the sidebar. If you'd rather have the menu, choose **This page's highlights** under **The penciled button** in the settings. If you've changed any setting before, the button keeps opening the menu. Browsers without a sidebar always open the menu.
- The sidebar has an **All notes** button, and an eye that hides or shows highlights on the tab, as Alt+Shift+H does.

## 0.3.0

- A sidebar keeps your highlights beside the page as you read. **This page** follows the tab you're on; **All pages** lists and searches highlights from every site. Open it from the new button in penciled's menu, or press Alt+Shift+N to open or close it.
- A new setting makes penciled's toolbar button open the sidebar instead of the menu.
- Tag your highlights in the sidebar, with suggestions from the tags you already use. Click a tag to show only highlights with it, or search for `#tag` in the sidebar or on the notes page. Markdown exports include tags.

## 0.2.1

- Fixes penciled not starting on any page in Firefox and Firefox-based browsers.

## 0.2.0

- penciled now works in Firefox 140 or later, and in Firefox-based browsers such as Zen, Floorp and LibreWolf.
- In Firefox, **Change shortcuts** on the settings page opens Firefox's shortcut settings.

## 0.1.0

The first release.

- Highlight text on any web page in one of five colors, and add notes. Highlights come back when you return to the page.
- The toolbar button lists the page's highlights. Click one to scroll to it, or turn penciled off for the whole site.
- The notes page lists every highlight from every site, with search. Open, delete, export (JSON or Markdown) and import them.
- Settings: toolbar theme, whether selecting text opens the toolbar, your own color palette, and the sites penciled is off on.
- Press Alt+Shift+H to hide or show highlights on a tab.
- Nothing leaves your browser: no accounts, no network requests, no analytics.
