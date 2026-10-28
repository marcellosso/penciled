# penciled.org, JavaScript highlights & notes library

[![npm version](https://img.shields.io/npm/v/penciled)](https://www.npmjs.com/package/penciled)
[![min+gzip size](https://img.shields.io/bundlejs/size/penciled?label=min%2Bgzip)](https://bundlejs.com/?q=penciled)
[![CI](https://github.com/marcellosso/penciled/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/marcellosso/penciled/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/penciled)](https://github.com/marcellosso/penciled/blob/main/LICENSE)

**penciled** (penciled.org, also called penciled.js) is a 15 kB open-source JavaScript library for persistent text highlights and notes on any web page, with a [browser extension](https://www.penciled.org/extension/) built on it. Highlights are painted with the CSS Custom Highlight API, so your DOM is never touched. Think **Sonner, for text annotations**.

Not to be confused with Penciled, the healthcare company at penciled.com.

**Browser support:** Chrome/Edge 105+, Safari 17.2+, Firefox 140+; no fallback on older browsers, `annotate()` only warns. [Details](https://www.penciled.org/guides/browser-support/)

[Documentation](https://www.penciled.org) · [Playground](https://www.penciled.org/playground/) · [npm](https://www.npmjs.com/package/penciled) · [Compare](https://www.penciled.org/compare/) · [Browser extension](https://www.penciled.org/extension/)

![Selecting a sentence, highlighting it in yellow and adding a note. After a reload the highlight comes back, and hovering it shows the note.](./.github/assets/demo.gif)

```sh
npm install penciled
```

```ts
import { annotate } from 'penciled';
import 'penciled/styles.css';

annotate('#article');
```

Readers can now select text to highlight it, add a note, or click a highlight to change it. Annotations are saved to `localStorage` and come back on reload.

[![Edit on StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/marcellosso/penciled/tree/main/examples/vanilla?file=main.js)

## Features

- **Beautiful by default.** A floating toolbar and note editor that appear only when needed, in light and dark themes.
- **Yours to style.** Theme the UI with CSS custom properties, or restyle anything: default selectors have (almost) zero specificity, so your CSS wins. Need a different UI altogether? Go headless and build your own. See [Theming](https://www.penciled.org/guides/theming/).
- **Framework-agnostic.** Plain DOM, with an optional React adapter. Highlights are painted with the [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API), so your DOM is never modified.
- **Reliable anchoring.** Highlights are re-anchored when the content changes. When penciled can't be sure where a highlight belongs, it leaves it out instead of highlighting the wrong text.
- **Persistent.** Uses `localStorage` out of the box. Plug in your own storage adapter to save to a backend.
- **Accessible.** Keyboard shortcuts for the toolbar and for moving between annotations, with screen-reader announcements.
- **Small.** About 15 kB min+gzip with the UI, 6 kB headless. One dependency (`@floating-ui/dom`).

## Browser extension

Not building a site? [penciled for the browser](https://www.penciled.org/extension/) lets you highlight and take notes on any website, in Chrome, Edge and other Chromium browsers 123+ and Firefox 140+. Install it for [Chrome](https://chromewebstore.google.com/detail/edpobhdkceoadekhpdagmnknocckaaje), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/penciled-highlighter/) or [Edge](https://microsoftedge.microsoft.com/addons/detail/penciled-%E2%80%93-highlighter-/abhbgdlbgleahgeodcifnpecikbdciml). It's built on this library and lives in [`apps/extension`](./apps/extension).

## Saving to your backend

```ts
annotate('#article', {
  documentId: 'post-42',
  storage: {
    load: (documentId) => fetch(`/api/annotations/${documentId}`).then((r) => r.json()),
    save: (documentId, annotations) =>
      fetch(`/api/annotations/${documentId}`, {
        method: 'PUT',
        body: JSON.stringify(annotations),
      }).then(() => {}),
  },
});
```

Adapters can also implement `create`, `update` and `delete` to save one annotation at a time. See [Custom storage](https://www.penciled.org/recipes/rest-storage/).

## React

```tsx
import { Annotatable } from 'penciled/react';
import 'penciled/styles.css';

export function Article({ children }) {
  return <Annotatable options={{ documentId: 'post-42' }}>{children}</Annotatable>;
}
```

There is also a `useAnnotations(ref, options)` hook. See [React](https://www.penciled.org/recipes/react/).

## Headless

`penciled/headless` is the engine without the UI. It handles anchoring, painting, persistence and events, and you build the interface with whatever components and styles you already use.

```ts
import { annotate } from 'penciled/headless';

const annotator = annotate('#article');
annotator.on('select', (context) => {
  // Show your own UI for the selected text or annotation.
});
```

## Browser support

Chrome and Edge 105+, Safari 17.2+ and Firefox 140+, on desktop and mobile. With the default styles, the minimums are Chrome and Edge 123+ and Safari 17.5+. In older browsers `annotate()` logs a warning and does nothing. Importing is safe during server-side rendering. See [Browser support](https://www.penciled.org/guides/browser-support/).

## FAQ

### What is penciled?

penciled (penciled.org, also called penciled.js) is a 15 kB open-source JavaScript library that lets readers highlight text and write notes on any web page. Call `annotate('#article')` and readers get a floating toolbar and a note editor. Annotations are saved to `localStorage`, or to your own backend through a storage adapter. It's MIT licensed and published on npm as `penciled`.

### Does penciled modify my page's DOM?

No. Highlights are painted by the browser with the CSS Custom Highlight API, so your text is never wrapped in `<mark>` or `<span>` elements, and frameworks can re-render the page as often as they like. The only elements penciled adds are its own toolbar, note editor and screen-reader live region, outside your content.

### Does it work with React and server-side rendering?

Yes. `penciled/react` has a `useAnnotations()` hook and an `<Annotatable>` component, and every entry point is safe to import during server-side rendering, in Next.js, Astro, Remix and others. Only `annotate()` needs a browser. With other frameworks, call `annotate()` on a mounted element and `destroy()` when it unmounts.

### Can I save annotations to my own backend?

Yes. Pass a storage adapter with async `load()` and `save()` methods, and optionally `create()`, `update()` and `delete()` to save one annotation at a time. Annotations are plain JSON, and `toW3C()` converts them to W3C Web Annotations.

### How is penciled different from web-highlighter or Recogito?

web-highlighter wraps each highlight in `<span>` elements and leaves the UI and storage to you. Recogito's Text Annotator is a larger framework built around the W3C Web Annotation model, with multi-user features, for research and collaborative annotation. penciled never changes your DOM, ships a toolbar, note editor and persistence, and is about 15 kB with the UI. In exchange it needs a browser with the CSS Custom Highlight API, while both of the others also work in older browsers. The comparison page at [https://www.penciled.org/compare/](https://www.penciled.org/compare/) covers them, three more libraries and Hypothesis.

### Is there a browser extension?

Yes. penciled for the browser lets readers highlight text and take notes on any website, in Chrome, Edge and other Chromium browsers 123+ and Firefox 140+. It's free, open source and built on this library. Highlights stay in the browser, with no account, and nothing is sent anywhere. See [https://www.penciled.org/extension/](https://www.penciled.org/extension/)

### Is this penciled.com, the healthcare company?

No. penciled.org is an open-source JavaScript highlights & notes library and browser extension, at [www.penciled.org](https://www.penciled.org). It is not related to Penciled, the healthcare company at penciled.com.


## Development

| Path | What |
|---|---|
| [`packages/penciled`](./packages/penciled) | The library: `penciled`, `penciled/headless`, `penciled/react` and `penciled/styles.css` |
| [`apps/docs`](./apps/docs) | The documentation site and playground (Astro + Starlight) |

```sh
pnpm install
pnpm test
pnpm docs:dev
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## License

[MIT](./LICENSE) © Marcel Losso
