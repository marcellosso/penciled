# penciled

## 0.5.1

### Patch Changes

- 1701bda: Update the package description, keywords and README so penciled is easier to find on npm. No code changes.

## 0.5.0

### Minor Changes

- 8e1a675: Export `normalize()`, which checks and upgrades annotation data without a running instance: it fills in defaults, drops unknown fields and returns `undefined` for anything that isn't an annotation. Use it to validate uploads or stored data on your server.

## 0.4.0

### Minor Changes

- 9762397: Add an `openOnSelect` option. With `false`, selecting text doesn't open the toolbar until the reader presses the toolbar shortcut (`Alt+A` by default). Clicking an annotation still opens it.
  
  Colors can now be `hidden`: annotations that already use a hidden color keep painting in it, but the toolbar only offers it on those annotations. This lets you retire a color without repainting existing highlights in the default color.

## 0.3.0

### Minor Changes

- f769fc3: Re-anchoring now costs much less on large pages and pages that keep changing:
  
  - Indexing a page's text was quadratic in the number of text nodes in Chromium. A long Wikipedia article went from about 165 ms to 13 ms.
  - On content that changes faster than every 100 ms (tickers, live feeds), re-anchoring was postponed indefinitely. Changes now join the pending batch, so highlights keep up.
  - With no annotations, penciled no longer watches the page or builds its text index until text is selected.
  - When re-anchoring is slow, it is spaced out to take about a tenth of the main thread at most, and it runs when the browser is idle.
  - Hidden tabs re-anchor when they're shown again.
- cf7c6f6: Selections in editable content (`contenteditable` editors) no longer open the toolbar or emit `select`. Text being edited changes under any annotation, and the toolbar got in the way of typing.
- be5ee55: Add a `root` option that mounts the toolbar, note preview and live region somewhere other than `document.body`. Pass a shadow root to keep the page's CSS away from penciled's UI, for example in a browser extension. Keyboard shortcuts, focus handling and clicks inside the UI work across the shadow boundary.

## 0.2.1

### Patch Changes

- 7e672d2: Fix transparent highlights and color swatches in apps whose bundler runs Lightning CSS for older browsers (Next.js 16, Vite with `css.transformer: 'lightningcss'`). Lightning CSS rewrites `light-dark()` into variables that were never set on the page root, so every default color resolved to nothing. Colors now default to light unless the page declares a `color-scheme`.
  
  Fix the note editor losing its styles on pages with element resets such as Tailwind's preflight or normalize.css (no padding, a resize handle, a transparent Save button). Rules for penciled's own buttons, note field and shortcut hint now start with `[data-penciled-popover]` (specificity 0,1,0) instead of zero specificity. Any class selector still overrides them.

## 0.2.0

### Minor Changes

- f5b0645: The `data-penciled-*` styling hooks are now a stable, documented API. Restyle the toolbar, note editor and note preview with selectors like `[data-penciled-popover]`, `[data-penciled-swatch]` and `[data-penciled-action='note']`, and they won't break without a major version. See [Targeting the UI](https://www.penciled.org/guides/theming/#targeting-the-ui) for the full list.
  
  `[data-penciled-popover]` now has a value, so you can style the two cards separately: `[data-penciled-popover='toolbar']` or `[data-penciled-popover='preview']`. Existing `[data-penciled-popover]` selectors still match both.
  
  Cards placed at `bottom-start` or `bottom-end` now animate in from their top edge, like cards placed at `bottom`.

## 0.1.0

### Minor Changes

- 5f1f3b0: Initial release. `annotate()` adds text highlights and notes to any element, with a floating toolbar, a note editor, five color presets, light and dark themes and keyboard access. Highlights are painted with the CSS Custom Highlight API without modifying your DOM, re-anchored when the content changes, and saved to `localStorage` or your own storage adapter. Also includes `penciled/headless` (the engine without UI), `penciled/react` (`useAnnotations` and `<Annotatable>`), and conversion to and from the W3C Web Annotation format.
