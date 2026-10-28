import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  // Imports are written out, as in the rest of the repo.
  imports: false,
  // WXT defaults Firefox to MV2; one manifest version keeps the browsers alike.
  manifestVersion: 3,
  zip: {
    artifactTemplate: 'penciled-{{version}}-{{browser}}.zip',
    sourcesTemplate: 'penciled-{{version}}-sources.zip',
    // Firefox's reviewers rebuild from the sources zip, which needs the penciled package and the
    // workspace around it. The README says how to build.
    sourcesRoot: '../..',
    includeSources: [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'packages/penciled/{package.json,tsconfig.json,tsdown.config.ts,LICENSE}',
      'packages/penciled/src/**',
      'apps/extension/{package.json,tsconfig.json,wxt.config.ts,README.md}',
      'apps/extension/{src,public}/**',
    ],
  },
  // Older targets make the CSS minifier rewrite light-dark() into variables that resolve on the
  // toolbar's shadow host, which pins the toolbar to light when its theme follows the system.
  vite: ({ browser }) => {
    const target = browser === 'firefox' ? 'firefox140' : 'chrome123';
    return { build: { target, cssTarget: target } };
  },
  manifest: ({ browser }) => ({
    // Firefox Add-ons caps names at 45 characters.
    name:
      browser === 'firefox'
        ? 'penciled – Highlighter & Notes for web pages'
        : 'penciled – Highlighter & Notes for any web page',
    short_name: 'penciled',
    description:
      'Highlight text and take notes on any website. Your highlights come back when you return. Nothing leaves your browser.',
    homepage_url: 'https://www.penciled.org/extension/',
    // The first versions with both the Highlight API and light-dark(), which penciled's colors use.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              // Permanent: AMO ties the listing and users' installs to it.
              id: 'penciled@penciled.org',
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
            // Firefox for Android only reads data_collection_permissions from 142.
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : { minimum_chrome_version: '123' }),
    // Notes stay in this browser; unlimitedStorage lifts the 10 MB cap without an install warning.
    permissions: ['storage', 'unlimitedStorage'],
    commands: {
      toggle: {
        suggested_key: { default: 'Alt+Shift+H' },
        description: 'Hide or show highlights on this tab',
      },
      sidebar: {
        suggested_key: { default: 'Alt+Shift+N' },
        description: 'Open or close the notes sidebar',
      },
    },
  }),
});
