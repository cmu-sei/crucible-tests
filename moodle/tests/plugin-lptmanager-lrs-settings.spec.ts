// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';

// Guards for tool_lptmanager PR #23 (Fix LRS sync request timeouts). The timeout,
// pagination, and checkpoint behavior are covered by the plugin's PHPUnit task tests;
// the only browser-observable surface is the admin settings page (two new settings)
// and the "Create learning plan templates" nav label whose duplicate lang key was
// removed. These assert the settings render with their documented defaults and bounds,
// and that the createnavlink label resolves (a missing lang key would render a
// [[...]] placeholder, which the text assertions below would catch).

type LrsSetting = {
  // Moodle wraps each admin setting row in id="admin-<name without plugin prefix>".
  rowId: string;
  label: string;
  descriptionFragment: string;
  defaultValue: string;
};

const lrsSettings: LrsSetting[] = [
  {
    rowId: 'admin-lrs_request_timeout',
    label: 'LRS request timeout',
    descriptionFragment: 'Maximum total time in seconds for each LRS request (1-300)',
    defaultValue: '15',
  },
  {
    rowId: 'admin-lrs_max_pages_per_verb',
    label: 'LRS page limit per verb',
    descriptionFragment: 'Maximum number of statement pages to process for each verb in one task run (1-1000)',
    defaultValue: '20',
  },
];

async function openLrsSettingsPage(page: Page): Promise<void> {
  await page.goto(`${Services.Moodle}/admin/settings.php?section=tool_lptmanager`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.locator('body')).toHaveAttribute('id', /page-admin-setting-tool_lptmanager/);
}

test.describe('tool_lptmanager LRS sync settings', () => {
  test('exposes bounded request-timeout and page-limit settings with documented defaults', async ({
    moodleAdminPage: page,
  }) => {
    await openLrsSettingsPage(page);

    for (const setting of lrsSettings) {
      const row = page.locator(`#${setting.rowId}`);
      await expect(row, `${setting.label} setting row should render`).toBeVisible();

      // Label and description text resolve (a missing/duplicate lang key would render
      // a [[...]] placeholder instead, failing these assertions).
      await expect(row.locator('.form-label')).toContainText(setting.label);
      await expect(row.getByText(setting.descriptionFragment)).toBeVisible();

      // Documented default: Moodle renders "Default: N" from settings.php regardless of
      // any saved value. Exact match so "Default: 15" can't be satisfied by "Default: 150".
      await expect(row.getByText(`Default: ${setting.defaultValue}`, { exact: true })).toBeVisible();

      // On an unmodified install the field renders that same default as its value.
      const input = row.locator('.form-setting input[type="text"], .form-setting input[type="number"]');
      await expect(input).toHaveCount(1);
      await expect(input).toHaveValue(setting.defaultValue);
    }
  });

  test('Create learning plan templates nav label still resolves after duplicate-key dedup', async ({
    moodleAdminPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/admin/tool/lptmanager/create.php`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // create.php calls set_title($pagetitle) and echoes $OUTPUT->heading($pagetitle),
    // both from get_string('createnavlink'). The admin layout's page-header h1 is the
    // site name, so assert the document title and the in-content heading instead.
    // If createnavlink were unresolved, both would read "[[createnavlink]]" and fail.
    await expect(page).toHaveTitle(/Create learning plan templates/);
    await expect(
      page.locator('#region-main').getByRole('heading', { name: 'Create learning plan templates' })
    ).toBeVisible();
  });
});
