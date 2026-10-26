# penciled: Svelte example

A minimal Svelte 5 app using an inline action to connect `annotate()` to a mounted article.
[Open it on StackBlitz](https://stackblitz.com/github/marcellosso/penciled/tree/main/examples/svelte?file=src/App.svelte),
or run it locally with Node 22.12+ or 24+:

```sh
npm install
npm run dev
```

It installs `penciled` from npm, not from this repository. Use a browser with the CSS Custom Highlight
API, such as a current Chrome, Firefox or Safari.

Select some text to highlight it or add a note, then reload the page to see it restored from
`localStorage`. Click **Hide article** to remove the node: Svelte calls the action's `destroy()` method,
which destroys the annotation instance. **Show article** mounts a new instance with the same
`documentId`, restoring the saved annotations. Keep that ID stable for the same document and use a
different ID for different content.

To check the production build:

```sh
npm run build
```

The browser test checks highlighting, adding a note, persistence across reload, and cleanup and
restoration through two unmount/remount cycles in Chromium, Firefox and WebKit:

```sh
npx playwright install chromium firefox webkit
npm test
```
