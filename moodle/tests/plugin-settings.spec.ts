// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';

const crucibleActivityId = process.env.MOODLE_CRUCIBLE_ACTIVITY_ID || '3';
const topomojoActivityId = process.env.MOODLE_TOPOMOJO_ACTIVITY_ID || '21';

const settingsPages = [
  { name: 'Crucible', updateId: crucibleActivityId },
  { name: 'TopoMojo', updateId: topomojoActivityId },
];

async function openSettingsPage(page: Page, updateId: string): Promise<void> {
  await page.goto(`${Services.Moodle}/course/modedit.php?update=${updateId}&return=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.locator('body')).toHaveAttribute('id', /page-(course-modedit|mod-.*-mod)/);
  await page.getByRole('button', { name: /^Expand all$/ }).click();
}

test.describe('Moodle plugin settings pages', () => {
  test('Crucible and TopoMojo use Timer wording and expose max score field', async ({ moodleAdminPage: page }) => {
    for (const settings of settingsPages) {
      await openSettingsPage(page, settings.updateId);

      await expect(page.locator('label[for="id_clock"]')).toHaveText('Timer');
      await expect(page.locator('label[for="id_clock"]')).not.toHaveText('Clock');
      await expect(page.locator('label[for="id_grade"]')).toHaveText('Grade');
      await expect(page.locator('#id_grade')).toHaveCount(1);
    }
  });
});
