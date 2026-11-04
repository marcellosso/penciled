// When each page of the site last changed, for `lastmod` in the sitemap.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('./src/', import.meta.url));

/** The source file behind a sitemap URL: a docs page, or the hand-written landing page. */
export function sourceFile(pathname) {
  if (pathname === '/') return `${src}pages/index.astro`;
  const slug = pathname.replace(/^\/|\/$/g, '');
  const base = `${src}content/docs/${slug}`;
  return [`${base}.mdx`, `${base}.md`, `${base}/index.mdx`, `${base}/index.md`].find((file) =>
    existsSync(file),
  );
}

// Relative imports (`import x from './x'`, `import './x'`, multi-line named imports) and relative
// Markdown images. Code blocks are left out, since the imports in examples aren't real.
const importPattern = /\bimport\s+(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
const imagePattern = /!\[[^\]]*\]\((\.{1,2}\/[^)\s]+)/g;
const parsed = /\.(mdx?|astro|[cm]?[jt]s)$/;

/**
 * A page's source file and every local file it renders: components, data files, scripts, styles
 * and images it imports, followed through imports of their own. A change to any of them changes
 * the page, so they all count towards its date.
 */
export function sourceFiles(file, seen = new Set()) {
  if (seen.has(file) || !file.startsWith(src) || !existsSync(file)) return seen;
  seen.add(file);
  if (!parsed.test(file)) return seen;
  const text = readFileSync(file, 'utf8').replace(/^([ \t]*)(`{3,}|~{3,})[\s\S]*?^\1\2/gm, '');
  for (const pattern of [importPattern, imagePattern]) {
    for (const [, specifier] of text.matchAll(pattern)) {
      sourceFiles(resolve(dirname(file), specifier), seen);
    }
  }
  return seen;
}

// The commits at the boundary of a shallow clone appear to touch every file, so their dates say
// nothing about when a page changed.
let shallowBoundary;
function isShallowBoundary(commit) {
  if (!shallowBoundary) {
    try {
      const file = execFileSync(
        'git',
        ['rev-parse', '--path-format=absolute', '--git-path', 'shallow'],
        { encoding: 'utf8', cwd: src },
      );
      shallowBoundary = new Set(readFileSync(file.trim(), 'utf8').split('\n').filter(Boolean));
    } catch {
      shallowBoundary = new Set();
    }
  }
  return shallowBoundary.has(commit);
}

/**
 * When a page last changed: its `lastUpdated` frontmatter if it has one, like Starlight, otherwise
 * the date of the last commit that touched its source or any file it renders. Unknown dates are
 * left out rather than guessed: never the build date.
 */
export function lastModified(pathname) {
  const file = sourceFile(pathname);
  if (!file) return undefined;
  const frontmatter = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const override = frontmatter.match(/^lastUpdated:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
  if (override) return new Date(override);
  try {
    const files = [...sourceFiles(file)];
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
