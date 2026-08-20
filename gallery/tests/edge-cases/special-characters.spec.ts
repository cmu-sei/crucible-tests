// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, apiDeleteCollectionById } from '../../fixtures';
import type { Locator, Page } from '@playwright/test';

/**
 * Create a collection through the admin UI and return its API id.
 *
 * The id comes from the POST response rather than from the table, so the caller can
 * register it for teardown before any assertion has a chance to throw.
 */
async function createCollectionViaUi(
  page: Page,
  name: string,
  description: string
): Promise<string> {
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/collections') && response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Add Collection' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Description').fill(description);
  await dialog.getByRole('button', { name: 'Save' }).click();

  const response = await created;
  expect(response.status()).toBe(201);
  const collection = await response.json();

  // The dialog closing is the app's own signal that the save round-trip finished.
  await expect(dialog).not.toBeVisible();

  // The value must survive the round trip byte-for-byte — no stripping, escaping or
  // mangling of the special characters on the way in.
  expect(collection.name).toBe(name);
  expect(collection.description).toBe(description);

  return collection.id;
}

/**
 * Filter the admin Collections list down to one name and return its row.
 *
 * The list paginates at 10 and concurrent specs seed their own collections, so a
 * freshly-created row routinely lands on page 2+; searching first is what brings it
 * onto page 1.
 */
async function findCollectionRow(page: Page, name: string): Promise<Locator> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  await searchField.clear();
  await searchField.fill(name);

  const row = page.locator('app-admin-collections tr.element-row').filter({ hasText: name });
  await expect(row).toBeVisible();
  return row;
}

test.describe('Edge Cases and Negative Testing', () => {
  // Ids are captured from the create responses and deleted here, so a failure in the
  // middle of the test cannot leave collections behind.
  const createdCollectionIds: string[] = [];

  test.afterEach(async () => {
    while (createdCollectionIds.length > 0) {
      const id = createdCollectionIds.pop() as string;
      await apiDeleteCollectionById(id, 'Special Characters test collection');
    }
  });

  test('Special Characters and Input Sanitization', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    // 1. Create a collection with special characters in the name, and 3. HTML tags in
    // the description (same record — the description field is where the HTML goes).
    const xssName = `<script>alert('xss')</script> ${suffix}`;
    const htmlDescription = '<b>HTML tags</b>';
    createdCollectionIds.push(await createCollectionViaUi(page, xssName, htmlDescription));

    // expect: Special characters are handled correctly — the row is found and its name
    // reads back exactly as typed.
    const xssRow = await findCollectionRow(page, xssName);
    const nameCell = xssRow.getByRole('cell').nth(1);
    const descriptionCell = xssRow.getByRole('cell').nth(2);
    await expect(nameCell).toHaveText(xssName);

    // expect: No XSS vulnerabilities — the payload is rendered as text, not parsed as
    // markup. Angular interpolation escapes it, so the literal '<script>' shows up in
    // innerText while no script element is created. Asserting both directions matters:
    // visible text alone would also pass if the browser had silently executed the tag.
    await expect(nameCell.locator('script')).toHaveCount(0);
    await expect(page.locator('app-admin-collections tbody script')).toHaveCount(0);
    expect(await nameCell.innerHTML()).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt; " + suffix
    );

    // 3. expect: HTML in the description is escaped or rendered harmless — the <b> is
    // shown as text, not as a bold element.
    await expect(descriptionCell).toHaveText(htmlDescription);
    await expect(descriptionCell.locator('b')).toHaveCount(0);

    // 2. Create a collection with Unicode characters
    const unicodeName = `Unicode 测试 🎯 ${suffix}`;
    createdCollectionIds.push(await createCollectionViaUi(page, unicodeName, 'Unicode test'));

    // expect: Unicode characters are stored and displayed correctly — CJK and the
    // astral-plane emoji both survive intact.
    const unicodeRow = await findCollectionRow(page, unicodeName);
    await expect(unicodeRow.getByRole('cell').nth(1)).toHaveText(unicodeName);
  });
});
