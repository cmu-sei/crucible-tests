// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { test, expect, Services } from '../fixtures';

// mod_groupquiz site administration (Site administration > Plugins > Activity
// modules > Group Quiz). These are read-only assertions against the settings page:
// nothing is saved, so no cleanup is required and the site defaults are unchanged.
test.describe('mod_groupquiz admin settings', () => {
  test.beforeEach(async ({ moodleAdminPage: page }) => {
    await page.goto(`${Services.Moodle}/admin/settings.php?section=modsettinggroupquiz`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.locator('body')).toHaveAttribute(
      'id',
      /page-admin-setting-modsettinggroupquiz/
    );
  });

  test('publishes the enabled question types and user picture defaults', async ({
    moodleAdminPage: page,
  }) => {
    const main = page.locator('#region-main');
    await expect(main.getByRole('heading', { name: 'Group Quiz', level: 2 })).toBeVisible();

    // Question types offered by the activity's question bank.
    const qtypes = page.locator('#admin-enabledqtypes');
    await expect(qtypes.locator('.form-label')).toContainText('Enable question types');
    await expect(qtypes).toContainText(
      'Question types that are enabled for use within instances of the group quiz activity.'
    );
    // True/False is the qtype the attempt specs seed, so it must ship enabled.
    const trueFalse = qtypes.locator('input[type="checkbox"][name*="truefalse"]');
    await expect(trueFalse).toBeChecked();

    // Avatar size shown beside each group response.
    const picture = page.locator('#admin-showuserpicture');
    await expect(picture.locator('.form-label')).toContainText("Show the user's picture");
    const pictureSelect = picture.locator('select');
    await expect(pictureSelect).toHaveValue('1');
    await expect(pictureSelect.locator('option')).toHaveText([/No image/, /Small image/]);
    await expect(picture).toContainText('Default: Small image');
  });

  test('exposes every review option across the four review windows', async ({
    moodleAdminPage: page,
  }) => {
    const main = page.locator('#region-main');
    await expect(main.getByRole('heading', { name: 'Review options', level: 3 })).toBeVisible();

    // One row per reviewable item; each row carries the four timing columns.
    const reviewFields = [
      'reviewattempt',
      'reviewcorrectness',
      'reviewmarks',
      'reviewspecificfeedback',
      'reviewgeneralfeedback',
      'reviewrightanswer',
      'reviewoverallfeedback',
      'reviewmanualcomment',
    ];
    for (const field of reviewFields) {
      const row = page.locator(`#admin-${field}`);
      await expect(row, `#admin-${field} should render`).toBeVisible();
      await expect(row).toContainText('Default: Everything on');
    }

    const attempt = page.locator('#admin-reviewattempt');
    for (const column of [
      'During the attempt',
      'Immediately after the attempt',
      'While the quiz is open',
      'After the quiz is closed',
    ]) {
      await expect(attempt).toContainText(column);
    }
  });

  test('does not offer site-wide time limit or shuffle defaults', async ({
    moodleAdminPage: page,
  }) => {
    // Pending upstream: mod_groupquiz builds a second admin_settingpage
    // ($groupsettings) holding the activity intro, the "Time limit" duration
    // default and the "Shuffle within questions" default, but never registers that
    // page with $ADMIN, so none of those three settings can be reached from Site
    // administration. Asserting the behavior the site actually has; when the page
    // is registered these rows should instead be asserted present with their
    // documented defaults (time limit 0, shuffle answers on).
    await expect(page.locator('#admin-timelimit')).toHaveCount(0);
    await expect(page.locator('#admin-shuffleanswers')).toHaveCount(0);
    await expect(page.locator('#region-main')).not.toContainText('Shuffle within questions');
  });
});
