// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';

const crucibleActivityId = process.env.MOODLE_CRUCIBLE_ACTIVITY_ID || '3';
const topomojoActivityId = process.env.MOODLE_TOPOMOJO_ACTIVITY_ID || '21';

const managePages = [
  {
    name: 'Crucible',
    path: `/mod/crucible/manage_deployments.php?id=${crucibleActivityId}`,
    table: '.mod-crucible-users-table',
  },
  {
    name: 'TopoMojo',
    path: `/mod/topomojo/manage.php?id=${topomojoActivityId}`,
    table: '.mod-topomojo-users-table',
  },
];

async function openManagePage(page: Page, path: string): Promise<void> {
  await page.goto(`${Services.Moodle}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Manage Deployments' })).toBeVisible();
}

test.describe('Moodle plugin manage deployment pages', () => {
  test('Crucible and TopoMojo use matching table headers and extend modal behavior', async ({ moodleAdminPage: page }) => {
    const consoleErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    for (const managePage of managePages) {
      await openManagePage(page, managePage.path);

      await expect(page.locator(`${managePage.table} th`).first()).toHaveCSS('background-color', 'rgb(245, 245, 245)');
      await expect(page.locator(`${managePage.table} .cell-status`, { hasText: /^Active$/ })).toHaveCount(0);
      await expect(page.locator('#schedule-modal-content #scheduledfor-input')).toHaveAttribute(
        'value',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      );

      const inProgressRow = page.locator(`${managePage.table} tbody tr[data-status="in progress"]`).first();
      if (await inProgressRow.count() === 0) {
        continue;
      }

      await inProgressRow.locator('.user-checkbox').check();
      await page.getByRole('button', { name: /Extend Selected/ }).click();

      const dialog = page.locator('.modal-dialog', { hasText: /Extend Selected/ }).last();
      const intervalInput = dialog.locator('#extend-interval-input');
      await expect(intervalInput).toBeVisible();
      await expect(intervalInput).toHaveAttribute('min', '1');
      await expect(intervalInput).toHaveAttribute('max', /\d+/);

      await intervalInput.fill('12');
      await intervalInput.press('Enter');
      await expect(intervalInput).toBeVisible();
      await expect(intervalInput).toHaveValue('12');

      await dialog.getByRole('button', { name: /Cancel/i }).click();
    }

    expect(consoleErrors.filter(error => error.includes('does not conform to the required format'))).toEqual([]);
  });
});
