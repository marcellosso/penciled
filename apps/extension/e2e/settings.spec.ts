import { expect, synced as inSync, painted, select, stored, test } from './fixtures.ts';

const ARTICLE = 'http://localhost:5180/article.html';
const toolbar = '[data-penciled-popover=toolbar]';
const action = (key: string) => `[data-penciled-action="${key}"]`;

test('the theme applies to open pages right away', async ({ context, extension }) => {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  const settings = await context.newPage();
  await settings.goto(`${extension}/options.html#settings`);
  await settings.getByRole('radio', { name: 'Dark' }).check();
  await select(page, 'lazy dog');
  await expect(page.locator(toolbar)).toHaveAttribute('data-penciled-theme', 'dark');
});

test('with the toolbar off on selection, Alt+A opens it', async ({ context, extension }) => {
  const settings = await context.newPage();
  await settings.goto(`${extension}/options.html#settings`);
  await settings.getByRole('checkbox', { name: 'Show the toolbar when I select text' }).uncheck();

  const page = await context.newPage();
  await page.goto(ARTICLE);
  await select(page, 'lazy dog');
  await page.waitForTimeout(400);
  await expect(page.locator(toolbar)).toHaveCount(0);
  await page.keyboard.press('Alt+A');
  await expect(page.locator(action('color-c1'))).toBeFocused();
});

test('editing, removing and replacing colors never hides a highlight', async ({
  context,
  background,
  extension,
}) => {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await select(page, 'lazy dog');
  await page.locator(action('color-c1')).click();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c1': ['lazy dog'] });
  const value = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--penciled-c1').trim(),
    );

  const settings = await context.newPage();
  await settings.goto(`${extension}/options.html#settings`);
  const yellow = settings.locator('[data-color=c1]');
  await expect(yellow).toContainText('1 highlight');

  // Editing a color recolors its highlights.
  await yellow.getByLabel('Yellow: color').fill('#ff0000');
  await expect.poll(value).toBe('#ff000080');

  // Removing a color in use retires it: not offered any more, but still painted.
  await yellow.getByRole('button', { name: 'Remove' }).click();
  await expect(settings.getByText('1 highlight still use it.')).toBeVisible();
  await select(page, 'bushy tail');
  await expect(page.locator(action('color-c2'))).toBeVisible();
  await expect(page.locator(action('color-c1'))).toHaveCount(0);
  expect(await painted(page)).toMatchObject({ 'penciled-c1': ['lazy dog'] });
  expect(await value()).toBe('#ff000080');

  // Moving its highlights to another color lets it go.
  await settings.getByLabel('Move Yellow highlights to').selectOption({ label: 'Blue' });
  await settings.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(settings.getByText('Removed colors')).toHaveCount(0);
  await expect
    .poll(() => stored(background))
    .toMatchObject({ [`page:${ARTICLE}`]: { annotations: [{ quote: 'lazy dog', color: 'c3' }] } });
  await page.reload();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c3': ['lazy dog'] });
});

test('colors can be added up to a full toolbar row, and unused ones removed', async ({
  context,
  extension,
}) => {
  const settings = await context.newPage();
  await settings.goto(`${extension}/options.html#settings`);
  const add = settings.getByRole('button', { name: 'Add a color' });
  for (let i = 0; i < 3; i++) await add.click();
  await expect(settings.locator('.colors li')).toHaveCount(8);
  await expect(add).toBeDisabled();

  const page = await context.newPage();
  await page.goto(ARTICLE);
  await select(page, 'lazy dog');
  await expect(page.locator(action('color-c8'))).toBeVisible();

  // Unused, so it's gone for good.
  await settings.locator('[data-color=c8]').getByRole('button', { name: 'Remove' }).click();
  await expect(settings.locator('.colors li')).toHaveCount(7);
  await expect(settings.getByText('Removed colors')).toHaveCount(0);
});

test('highlights go to browser sync only once it is turned on, and leave it when turned off', async ({
  context,
  background,
  extension,
}) => {
  const synced = () => inSync(background);
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await select(page, 'lazy dog');
  await page.locator(action('color-c1')).click();
  await expect.poll(() => stored(background)).toHaveProperty([`page:${ARTICLE}`]);
  await page.waitForTimeout(500);
  expect(await synced()).toEqual([]);

  const settings = await context.newPage();
  await settings.goto(`${extension}/options.html#settings`);
  const toggle = settings.getByRole('checkbox', { name: 'Sync my highlights and notes' });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(settings.getByRole('status')).toHaveText('Your 1 page with highlights is syncing.', {
    timeout: 10_000,
  });
  expect((await synced()).length).toBeGreaterThan(0);

  await settings.getByRole('checkbox', { name: 'Sync my highlights and notes' }).uncheck();
  await expect.poll(synced).toEqual([]);
  // This computer's copy stays.
  expect(await stored(background)).toHaveProperty([`page:${ARTICLE}`]);
});
