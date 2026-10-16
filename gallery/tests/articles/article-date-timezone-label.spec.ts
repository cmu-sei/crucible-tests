// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import type { Page } from '@playwright/test';
import {
  test,
  expect,
  Services,
  apiCreateCollection,
  apiCreateArticle,
  apiDeleteCollectionById,
} from '../../fixtures';

/**
 * The Edit Article dialog labels Posted Date / Time with a zone abbreviation.
 * The abbreviation has to come from the posted date, not from today: in New
 * York a January date is EST and a July date is EDT whatever day the test runs.
 * Whichever half of the year the run falls in, one of the two articles is on
 * the other side of a DST boundary, so a label taken from today fails one.
 */
test.use({ timezoneId: 'America/New_York' });

async function openEditArticleDialog(page: Page, collectionName: string, articleName: string) {
  await page.goto(`${Services.Gallery.UI}/admin?section=collections`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('textbox', { name: 'Search' }).fill(collectionName);
  const row = page.getByRole('row').filter({ hasText: collectionName });
  await expect(row).toHaveCount(1);
  // The name cell, not the first cell — the first cell is the actions cell.
  await row.getByRole('cell', { name: collectionName }).click();

  const articlesPanel = page.getByRole('region', { name: 'Articles' });
  await page.getByRole('button', { name: 'Articles', exact: true }).click();
  await expect(articlesPanel).toBeVisible();
  await articlesPanel.getByRole('textbox', { name: 'Search' }).fill(articleName);
  // force: the enclosing disabled expansion-panel header makes Playwright treat
  // the button as disabled — see edit-article.spec.ts.
  await articlesPanel.getByRole('button', { name: `Edit ${articleName}` }).click({ force: true });

  const dialog = page.getByRole('dialog', { name: 'Edit Article' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Article date time zone label', () => {
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id);
    }
  });

  test('Posted Date / Time is labeled with the zone in effect on that date', async ({
    galleryAuthenticatedPage: page,
  }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `Timezone Label Collection ${unique}`;
    const collection = await apiCreateCollection(collectionName, 'Collection for time zone label tests');
    createdCollectionIds.push(collection.id);

    // Noon in New York on each date: 17:00Z in winter, 16:00Z in summer.
    const cases = [
      { name: `Winter Article ${unique}`, datePosted: '2026-01-15T17:00:00Z', label: '15 Jan 2026 12:00 EST' },
      { name: `Summer Article ${unique}`, datePosted: '2026-07-15T16:00:00Z', label: '15 Jul 2026 12:00 EDT' },
    ];
    for (const c of cases) {
      await apiCreateArticle(collection.id, c.name, { datePosted: c.datePosted });
    }

    for (const c of cases) {
      const dialog = await openEditArticleDialog(page, collectionName, c.name);
      await expect(dialog.locator('.datetime-field span', { hasText: c.label.slice(0, 11) })).toHaveText(c.label);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
    }
  });
});
