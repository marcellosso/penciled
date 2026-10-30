# Site analytics

penciled.org (the landing page and the docs) reports to PostHog: project **penciled** (ID 697762), US Cloud. The setup lives in [`src/scripts/analytics.ts`](./src/scripts/analytics.ts), loaded by the landing page and by Starlight's `Head` override.

- **Automatic events:** `$pageview` (also on client-side history changes), `$pageleave` and `$autocapture`. Session recording is off.
- **Super property:** every event carries `product: "penciled"`.
- **Persons:** anonymous visitors don't create person profiles (`person_profiles: 'identified_only'`).
- **Proxy:** events go to `/ingest`, which `vercel.json` rewrites to `us.i.posthog.com` (and `/ingest/static` to `us-assets.i.posthog.com`), so ad blockers don't drop them. `astro dev` proxies `/ingest` the same way. The rewrites use `(.*)`, not `:path*`: posthog-js calls paths with a trailing slash (`/e/`, `/i/v0/e/`, `/flags/`), and Vercel compiles `:path*` to a pattern that doesn't match one, so those requests fell through to the site's 404 page.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `PUBLIC_POSTHOG_KEY` | the penciled project token | Public: it can only send events. |
| `PUBLIC_POSTHOG_HOST` | `/ingest` | Set `https://us.i.posthog.com` to skip the proxy. |

See [`.env.example`](./.env.example). Neither variable is required.

## Custom events

Every click event has `location` (`header`, `hero`, `footer`, `landing` or `docs`) and `path`.

| Event | When | Extra properties |
| --- | --- | --- |
| `extension_install_clicked` | A link to the Chrome Web Store, Firefox Add-ons or Edge Add-ons | `browser`: `chrome`, `firefox` or `edge` |
| `github_clicked` | A link to the GitHub repo (header, footer, edit links, Markdown) | `url` |
| `npm_clicked` | A link to the npm package | |
| `install_command_copied` | The landing page's copy button, or copying a docs code block that installs penciled (`npm`/`pnpm`/`yarn`/`bun`) | `command`: the first line copied |
| `docs_cta_clicked` | "Read the docs" (hero) or "Get started" (end of the landing page) | |
| `stackblitz_opened` | The "Edit on StackBlitz" link | |
| `demo_highlight_created` | The visitor's first highlight in the landing page demo, once per page view (the seeded highlights don't count) | `color` |

Link events are classified by destination in one delegated listener, so new links to the stores, GitHub or npm are tracked without changes. To track another internal link, add `data-ph-event="<event_name>"` to it.
