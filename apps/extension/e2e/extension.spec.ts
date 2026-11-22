import { click, expect, painted, select, stored, test } from './fixtures.ts';

const toolbar = '[data-penciled-popover=toolbar]';
const action = (key: string) => `[data-penciled-action="${key}"]`;

test('highlights text, and restores it when the page is reloaded', async ({
  context,
  background,
}) => {
  const page = await context.newPage();
  await page.goto('/article.html?utm_source=newsletter#intro');
  await select(page, 'lazy dog');
  await page.locator(action('color-c2')).click();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });

  // Stored under the page's address without its fragment or tracking parameters.
  await expect
    .poll(() => stored(background))
    .toMatchObject({
      'page:http://localhost:5180/article.html': {
        version: 1,
        annotations: [{ quote: 'lazy dog', color: 'c2' }],
      },
      'meta:http://localhost:5180/article.html': { title: 'An article', count: 1 },
    });

  await page.goto('/article.html');
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c2': ['lazy dog'] });
});

test('adds a note in the shadow root, and removes highlights', async ({ context, background }) => {
  const page = await context.newPage();
  await page.goto('/article.html');
  await select(page, 'bushy tail');
  await page.locator(action('note')).click();
  await page.locator(`${toolbar} textarea`).fill('Foxes use it for balance.');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect
    .poll(() => stored(background))
    .toMatchObject({
      'page:http://localhost:5180/article.html': {
        annotations: [{ quote: 'bushy tail', note: 'Foxes use it for balance.' }],
      },
    });

  // Nothing is added to the page's body: the UI lives in a shadow root outside it.
  expect(await page.locator('body [data-penciled]').count()).toBe(0);

  await page.reload();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c1': ['bushy tail'] });
  await click(page, 'bushy tail');
  await page.locator(action('remove')).click();
  // The page is gone. Only the deletion is remembered, so syncing can delete it elsewhere.
  await expect
    .poll(async () => Object.keys(await stored(background)).map((k) => k.split(':')[0]))
    .toEqual(['deleted']);
});

test('ignores selections in editable content', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/article.html');
  await select(page, 'editable draft');
  await page.waitForTimeout(400);
  await expect(page.locator(toolbar)).toHaveCount(0);
});

test('page CSS cannot reach the toolbar', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/hostile.html');
  await select(page, 'brown fox');
  const swatch = page.locator(action('color-c1'));
  await expect(swatch).toBeVisible();
  const box = await swatch.boundingBox();
  // The page hides buttons and sets every element's text to 40px.
  expect(box!.height).toBeLessThan(40);
  await swatch.click();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c1': ['brown fox'] });
});

test('each address in a single-page app has its own highlights', async ({
  context,
  background,
}) => {
  const page = await context.newPage();
  await page.goto('/spa/foxes');
  await select(page, 'bushy tail');
  await page.locator(action('color-c3')).click();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c3': ['bushy tail'] });

  await page.getByRole('link', { name: 'Dogs' }).click();
  await expect(page.getByText('domesticated')).toBeVisible();
  await expect.poll(() => painted(page)).toEqual({});
  await select(page, 'the wolf');
  await page.locator(action('color-c4')).click();

  await page.goBack();
  await expect.poll(() => painted(page)).toMatchObject({ 'penciled-c3': ['bushy tail'] });
  const keys = Object.keys(await stored(background)).filter((k) => k.startsWith('page:'));
  expect(keys.sort()).toEqual([
    'page:http://localhost:5180/spa/dogs',
    'page:http://localhost:5180/spa/foxes',
  ]);
});

test('dark pages get dark highlight colors, even without a color-scheme', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/dark.html');
  const yellow = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--penciled-c1').trim(),
    );
  await expect.poll(yellow).toBe('#fde04747');
  // The site switches to a light theme.
  await page.evaluate(() => document.body.classList.add('light'));
  await expect.poll(yellow).toBe('#fde04780');
});

test('the toolbar follows the system theme', async ({ context }) => {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/article.html');
  await select(page, 'lazy dog');
  const background = () =>
    page.locator(toolbar).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect.poll(background).toBe('rgb(24, 24, 27)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(background).toBe('rgb(255, 255, 255)');
});
