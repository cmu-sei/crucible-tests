// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import { MoodleLabModule, resolveMoodleLabActivityCmid } from '../db-helpers';

const settingsPages: { name: string; module: MoodleLabModule }[] = [
  { name: 'Crucible', module: 'crucible' },
  { name: 'TopoMojo', module: 'topomojo' },
];

async function openSettingsPage(page: Page, updateId: number): Promise<void> {
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
      await openSettingsPage(page, await resolveMoodleLabActivityCmid(settings.module));

      await expect(page.locator('label[for="id_clock"]')).toHaveText('Timer');
      await expect(page.locator('label[for="id_clock"]')).not.toHaveText('Clock');
      await expect(page.locator('label[for="id_grade"]')).toHaveText('Grade');
      await expect(page.locator('#id_grade')).toHaveCount(1);
    }
  });
});
