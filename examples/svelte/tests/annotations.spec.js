import { expect, test } from '@playwright/test';

test('highlights and notes persist; unmounting destroys the instance', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const article = page.locator('article');
  await expect(article).toBeVisible();
  const originalMarkup = await article.innerHTML();
  const text = 'Select a few words';

  const rect = () =>
    article.evaluate((node, text) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let child = walker.nextNode(); child; child = walker.nextNode()) {
        const offset = child.data.indexOf(text);
        if (offset < 0) continue;
        const range = document.createRange();
        range.setStart(child, offset);
        range.setEnd(child, offset + text.length);
        const { left, right, top, bottom } = range.getBoundingClientRect();
        return { left, right, top, bottom };
      }
      throw new Error('Example text not found');
    }, text);

  const painted = () =>
    page.evaluate(() =>
      [...(CSS.highlights.get('penciled-green') ?? [])].map((range) => range.toString()),
    );

  const selection = await rect();
  const y = (selection.top + selection.bottom) / 2;
  await page.mouse.move(selection.left + 1, y);
  await page.mouse.down();
  await page.mouse.move(selection.right - 1, y, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Highlight green', exact: true }).click();
  await expect.poll(painted).toEqual([text]);

  await page.mouse.click((selection.left + selection.right) / 2, y);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Persistent Svelte note');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem('penciled:svelte-example'))?.annotations?.[0]?.note,
      ),
    )
    .toBe('Persistent Svelte note');

  await page.reload();
  await expect.poll(painted).toEqual([text]);
  const restored = await rect();
  await page.mouse.click(
    (restored.left + restored.right) / 2,
    (restored.top + restored.bottom) / 2,
  );
  await expect(page.locator('[data-penciled-note]')).toHaveText('Persistent Svelte note');

  for (let cycle = 0; cycle < 2; cycle++) {
    await page.getByRole('button', { name: 'Hide article', exact: true }).click();
    await expect(article).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => CSS.highlights.size)).toBe(0);
    await expect(page.locator('[data-penciled-popover]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show article', exact: true }).click();
    await expect.poll(painted).toEqual([text]);
  }

  expect(await article.innerHTML()).toBe(originalMarkup);
  expect(errors).toEqual([]);
});
