// Fails the docs build when a sitemap URL has no `lastmod`, so a page whose date can't be worked
// out (a source file that isn't found, or a shallow git clone) doesn't go unnoticed.
import { readdirSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const sitemaps = readdirSync(dist).filter((name) => /^sitemap-\d+\.xml$/.test(name));
if (sitemaps.length === 0) {
  console.error('check-sitemap-lastmod: no sitemap found in dist/. Run astro build first.');
  process.exit(1);
}

const urls = sitemaps.flatMap((name) =>
  [...readFileSync(new URL(name, dist), 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
    ([, entry]) => ({
      loc: entry.match(/<loc>(.*?)<\/loc>/)?.[1],
      lastmod: entry.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
    }),
  ),
);
const missing = urls.filter(({ lastmod }) => !lastmod);

if (missing.length > 0) {
  console.error(
    `check-sitemap-lastmod: ${missing.length} of ${urls.length} sitemap URLs have no lastmod:\n` +
      missing.map(({ loc }) => `  ${loc}`).join('\n') +
      '\nMake sure the build has the full git history (on Vercel, set VERCEL_DEEP_CLONE=true), and that sourceFile() in astro.config.mjs finds the page source.',
  );
  process.exit(1);
}
console.log(`check-sitemap-lastmod: all ${urls.length} sitemap URLs have a lastmod.`);
