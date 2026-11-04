import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';
import { graphiteDark, graphiteLight } from './src/code-themes.mjs';
import { disambiguation } from './src/faq.ts';

// The public URL, for canonical links, Open Graph and the sitemap. Set SITE_URL to override it.
// It must be the primary domain on Vercel: the apex redirects to www, and a canonical URL that
// redirects is ignored by search engines.
const site = process.env.SITE_URL ?? 'https://www.penciled.org';
const ogImage = new URL('/og.png', site).href;

// The source file behind a sitemap URL: a docs page, or the hand-written landing page.
const src = fileURLToPath(new URL('./src/', import.meta.url));
// Data files whose text appears on a page, so a change to them changes the page too.
const pageData = {
  '/': ['faq.ts', 'skins.ts'],
  '/faq/': ['faq.ts'],
  '/alternatives/': ['alternatives.ts'],
  '/playground/': ['components/Playground.astro'],
};
function sourceFile(pathname) {
  if (pathname === '/') return `${src}pages/index.astro`;
  const slug = pathname.replace(/^\/|\/$/g, '');
  const base = `${src}content/docs/${slug}`;
  return [`${base}.mdx`, `${base}.md`, `${base}/index.mdx`, `${base}/index.md`].find((file) =>
    existsSync(file),
  );
}

// Commits that are the boundary of a shallow clone appear to touch every file, so their dates say
// nothing about when a page changed.
let shallowBoundary;
function isShallowBoundary(commit) {
  if (!shallowBoundary) {
    try {
      const file = execFileSync(
        'git',
        ['rev-parse', '--path-format=absolute', '--git-path', 'shallow'],
        {
          encoding: 'utf8',
          cwd: src,
        },
      );
      shallowBoundary = new Set(readFileSync(file.trim(), 'utf8').split('\n').filter(Boolean));
    } catch {
      shallowBoundary = new Set();
    }
  }
  return shallowBoundary.has(commit);
}

// When a page last changed: its `lastUpdated` frontmatter if it has one, like Starlight, otherwise
// the date of the last commit that touched it or its data files. Unknown dates are left out rather
// than guessed.
function lastModified(pathname) {
  const file = sourceFile(pathname);
  if (!file) return undefined;
  const frontmatter = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const override = frontmatter.match(/^lastUpdated:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
  if (override) return new Date(override);
  try {
    const files = [file, ...(pageData[pathname] ?? []).map((name) => `${src}${name}`)];
    const [commit, date] = execFileSync('git', ['log', '-1', '--format=%H %cI', '--', ...files], {
      encoding: 'utf8',
      cwd: src,
    })
      .trim()
      .split(' ');
    return date && !isShallowBoundary(commit) ? new Date(date) : undefined;
  } catch {
    return undefined;
  }
}

export default defineConfig({
  site,
  // In production, vercel.json proxies /ingest to PostHog; this does the same for `astro dev`.
  vite: {
    server: {
      proxy: {
        '/ingest/static': {
          target: 'https://us-assets.i.posthog.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
        '/ingest': {
          target: 'https://us.i.posthog.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ingest/, ''),
        },
      },
    },
  },
  integrations: [
    // Starlight adds the sitemap itself unless it's already configured; this adds `lastmod`.
    sitemap({
      serialize(item) {
        const lastmod = lastModified(new URL(item.url).pathname);
        return lastmod ? { ...item, lastmod: lastmod.toISOString() } : item;
      },
    }),
    starlight({
      title: 'penciled',
      description:
        'penciled.org is an open-source JavaScript library and browser extension for persistent text highlights and notes (local, no account).',
      favicon: '/favicon.svg',
      plugins: [
        starlightLlmsTxt({
          projectName: 'penciled.org',
          description:
            'penciled.org is an open-source JavaScript library and browser extension for persistent text highlights and notes (local, no account). The library is 15 kB and published on npm as `penciled`; it is also known as penciled.js.',
          // Right below the description, so it's read before anything else about the project.
          details: [
            disambiguation,
            '',
            "- `annotate('#article')` adds a floating toolbar and a note editor, and saves annotations to `localStorage` or a custom storage adapter.",
            '- Highlights are painted with the CSS Custom Highlight API, so the host DOM is never modified.',
            '- Entry points: `penciled` (with the default UI), `penciled/headless` (the engine only), `penciled/react` and `penciled/styles.css`.',
            '- It is a text annotation library, not a website review tool: no screenshots, drawing, threaded discussions, accounts or sync backend.',
            '- The browser extension, penciled for the browser, brings the same highlights and notes to any website in Chrome, Edge and Firefox. Highlights stay in the browser.',
          ].join('\n'),
          optionalLinks: [
            { label: 'GitHub', url: 'https://github.com/marcellosso/penciled' },
            { label: 'npm', url: 'https://www.npmjs.com/package/penciled' },
          ],
        }),
      ],
      components: {
        Head: './src/components/Head.astro',
        Footer: './src/components/Footer.astro',
      },
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: ogImage } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        {
          tag: 'meta',
          attrs: { property: 'og:image:alt', content: 'penciled: Read with a pencil in hand.' },
        },
        { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
        {
          tag: 'meta',
          attrs: {
            name: 'theme-color',
            content: '#fbfaf8',
            media: '(prefers-color-scheme: light)',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'theme-color', content: '#141413', media: '(prefers-color-scheme: dark)' },
        },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/marcellosso/penciled' },
      ],
      editLink: {
        baseUrl: 'https://github.com/marcellosso/penciled/edit/main/apps/docs/',
      },
      customCss: [
        '@fontsource-variable/source-serif-4/opsz.css',
        '@fontsource-variable/geist',
        '@fontsource-variable/geist-mono',
        './src/styles/tokens.css',
        'penciled/styles.css',
        './src/styles/starlight.css',
        './src/styles/custom.css',
      ],
      expressiveCode: {
        themes: [graphiteDark, graphiteLight],
        defaultProps: { wrap: true, overridesByLang: { 'sh,bash,shell': { frame: 'none' } } },
        styleOverrides: {
          borderRadius: '0.625rem',
          borderWidth: '0px',
          codeFontFamily: 'var(--pd-mono)',
          codeFontSize: '0.8125rem',
          codeLineHeight: '1.7',
          codePaddingBlock: '1rem',
          codePaddingInline: '1.125rem',
          uiFontFamily: 'var(--pd-sans)',
          frames: {
            shadowColor: 'transparent',
            frameBoxShadowCssValue: 'none',
            editorTabBarBackground: 'transparent',
            editorTabBarBorderBottomColor: 'transparent',
            editorTabBarBorderColor: 'transparent',
            editorActiveTabBackground: 'transparent',
            editorActiveTabForeground: 'var(--pd-muted)',
            editorActiveTabBorderColor: 'transparent',
            editorActiveTabIndicatorTopColor: 'transparent',
            editorActiveTabIndicatorBottomColor: 'transparent',
            editorTabsMarginInlineStart: '0',
            terminalBackground: 'var(--pd-paper)',
            terminalTitlebarBackground: 'transparent',
            terminalTitlebarBorderBottomColor: 'transparent',
            terminalTitlebarDotsOpacity: '0',
            terminalTitlebarForeground: 'var(--pd-muted)',
            inlineButtonBackground: 'var(--pd-fg)',
            inlineButtonForeground: 'var(--pd-fg)',
            inlineButtonBorder: 'var(--pd-hairline-strong)',
            inlineButtonBorderOpacity: '0',
            inlineButtonBackgroundIdleOpacity: '0',
            inlineButtonBackgroundHoverOrFocusOpacity: '0.08',
            inlineButtonBackgroundActiveOpacity: '0.12',
          },
        },
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Getting started', slug: 'getting-started' },
            { label: 'Playground', slug: 'playground' },
            { label: 'Compare with other libraries', slug: 'compare' },
            { label: 'FAQ', slug: 'faq' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Theming and customization', slug: 'guides/theming' },
            { label: 'Anchoring and limitations', slug: 'guides/anchoring' },
            { label: 'Highlight text without spans', slug: 'guides/highlight-without-spans' },
            { label: 'Browser support', slug: 'guides/browser-support' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'React', slug: 'recipes/react' },
            { label: 'Custom storage (REST API)', slug: 'recipes/rest-storage' },
            { label: '“Ask AI” action', slug: 'recipes/ask-ai' },
            { label: 'Read-only publisher annotations', slug: 'recipes/read-only' },
            { label: 'Export, import and W3C', slug: 'recipes/export-import' },
          ],
        },
        {
          label: 'Browser extension',
          items: [
            { label: 'Overview', slug: 'extension' },
            { label: 'Privacy', slug: 'extension/privacy' },
            { label: 'Alternatives', slug: 'alternatives' },
          ],
        },
        {
          label: 'API reference',
          items: [
            { label: 'annotate() options', slug: 'reference/options' },
            { label: 'Instance', slug: 'reference/instance' },
            { label: 'Events', slug: 'reference/events' },
            { label: 'Types', slug: 'reference/types' },
            { label: 'penciled/headless', slug: 'reference/headless' },
          ],
        },
      ],
    }),
  ],
});
