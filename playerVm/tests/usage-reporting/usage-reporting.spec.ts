// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { authenticateConsoleWithKeycloak } from '../../../console/fixtures';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  createUsageLoggingSession,
  deleteViewUsageLoggingSessions,
  isUsageLoggingEnabled,
  seedViewWithVm,
  SeededViewWithVm,
  todaysLoggingWindow,
  usageLogEntries,
} from '../../vm-helpers';

/**
 * `usage` — VM Usage Reporting, the read side of usage logging and the only route in
 * this app that is not about a single view.
 *
 * It had no test in either suite. `vm.api` covers the report handler in process, but
 * the page that spends it was never drawn: the two report formats, the empty-range
 * branch, the CSV, and the table itself.
 *
 * The awkward part, and the reason the last test is as long as it is: a row in this
 * report cannot be seeded. Log entries are written in exactly one place —
 * `VmHub.SetActiveVirtualMachine` — there is no endpoint that creates one, and this
 * suite has no SignalR client. The only way to put data in the report is to open a VM
 * console in a browser and leave it, which is what that test does. Everything the
 * report can only say about real data is asserted in that one test rather than spread
 * over several, because each one would have to drive a console of its own.
 */
test.describe('VM Usage Reporting', () => {
  let seeded: SeededViewWithVm;
  let usageLoggingEnabled = false;

  test.beforeAll(async () => {
    seeded = await seedViewWithVm('E2E Vm Usage Report');
    usageLoggingEnabled = await isUsageLoggingEnabled(seeded.token);
  });

  test.afterEach(async () => {
    // Sessions do not cascade off the Player view — see `deleteViewUsageLoggingSessions`.
    if (seeded) {
      await deleteViewUsageLoggingSessions(seeded.token, seeded.viewId);
    }
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  /** A date as `MatNativeDateAdapter` parses it back out of the range inputs. */
  const monthDayYear = (date: Date): string =>
    `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

  const setRange = async (page: Page, start: Date, end: Date): Promise<void> => {
    await page.getByPlaceholder('Start date').fill(monthDayYear(start));
    await page.getByPlaceholder('End date').fill(monthDayYear(end));
  };

  test('Usage report page renders both formats with nothing to report yet', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // Unconditional: the page is behind no permission and no setting. With logging
    // switched off the report request 404s and the page shows the same empty state,
    // so everything below holds either way — which is the point, because a
    // deployment with logging off would otherwise have no browser coverage of this
    // route at all.
    await page.goto(`${Services.PlayerVM.UI}/usage`);

    await expect(page.getByRole('heading', { name: 'VM Usage Reporting' })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole('radio', { name: 'By User' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'By Session' })).toBeVisible();

    // `readyToGet()` is false until both ends of the range are set, and the CSV
    // button until a report has come back with rows — so on arrival neither can be
    // pressed, and the table is not rendered at all.
    await expect(page.getByRole('button', { name: 'Get' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'CSV' })).toBeDisabled();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByText('No data found for the selected date range.')).toBeVisible();

    // Setting a range is the only thing that enables Get. Asserted because the page
    // offers no other feedback that the pickers were understood.
    const today = new Date();
    await setRange(page, today, today);
    await expect(page.getByRole('button', { name: 'Get' })).toBeEnabled();
  });

  test('A range with no sessions in it reports no data', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so the report endpoint returns 404 rather than an empty report'
    );

    await page.goto(`${Services.PlayerVM.UI}/usage`);
    await expect(page.getByRole('heading', { name: 'VM Usage Reporting' })).toBeVisible({
      timeout: 30000,
    });

    // A range far enough back that no deployment can have data in it. The empty
    // state is already on screen before Get is pressed, so the response is what
    // separates "no data" from "not asked yet" — without it this test would pass
    // against a page that never made the request.
    const answered = page.waitForResponse(
      (response) => response.url().includes('/api/vmusageloggingsessions/report'),
      { timeout: 30000 }
    );
    await setRange(page, new Date(2000, 0, 1), new Date(2000, 0, 2));
    await page.getByRole('button', { name: 'Get' }).click();

    const response = await answered;
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);

    await expect(page.getByText('No data found for the selected date range.')).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'CSV' })).toBeDisabled();
  });

  test('A console session that has ended appears in the report', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no log entry can be recorded'
    );

    const sessionName = `E2E Report Session ${Date.now()}`;
    // The default window is today 00:01 to today 23:59, which is what makes the
    // session both *running* now (so the hub attaches an entry to it) and wholly
    // *inside* a report range of today (so the report selects it). See
    // `todaysLoggingWindow` for why one day is the only window that satisfies both.
    const session = await createUsageLoggingSession(seeded.token, {
      viewId: seeded.viewId,
      teamIds: [seeded.teamId],
      sessionName,
    });

    // A second page in the same browser context: the Keycloak session is shared, and
    // closing it is what disconnects the hub — which is the only thing that closes
    // the log entry (`OnDisconnectedAsync` → `CloseVmLogEntry`). Driving the console
    // on this test's own page would mean navigating away to reach the report, which
    // does the same thing far less legibly.
    const consolePage = await page.context().newPage();
    try {
      await authenticateConsoleWithKeycloak(consolePage);
      await consolePage.goto(`${Services.Console.UI}/vm/${seeded.vmId}/console`);
      await expect(consolePage.locator('app-console')).toBeVisible({ timeout: 60000 });

      // `ngOnInit` claims the VM only `if (document.hasFocus())`, which a page that
      // has never been interacted with may not report, and only after
      // `startConnection()` has resolved — which nothing on the page announces. The
      // component's `window:focus` handler is the other way in and the one a user
      // switching back to the tab takes, so the wait re-fires it until an entry
      // appears. Every focus that lands records its own entry; the report groups by
      // session, VM and user, so two or three of them are still one row.
      await consolePage.bringToFront();
      await expect
        .poll(
          async () => {
            await consolePage.evaluate(() => window.dispatchEvent(new Event('focus')));
            return (await usageLogEntries(seeded.token, session.id)).length;
          },
          { timeout: 60000, intervals: [1000, 2000, 3000] }
        )
        .toBeGreaterThan(0);
    } finally {
      await consolePage.close();
    }

    // Closed by the disconnect, not by anything the report page does. Until this is
    // true the entry is invisible to the report, which filters on
    // `VmInactiveDT > VmActiveDT` — an open console is not yet usage.
    await expect
      .poll(
        async () => (await usageLogEntries(seeded.token, session.id)).filter((x) => x.closed).length,
        { timeout: 60000, intervals: [1000, 2000, 3000] }
      )
      .toBeGreaterThan(0);

    await page.goto(`${Services.PlayerVM.UI}/usage`);
    await expect(page.getByRole('heading', { name: 'VM Usage Reporting' })).toBeVisible({
      timeout: 30000,
    });

    const reportWindow = todaysLoggingWindow();
    await setRange(page, reportWindow.start, reportWindow.end);
    await page.getByRole('button', { name: 'Get' }).click();

    // The row, scoped by session name rather than by count: the report is
    // deployment-wide, and another spec's view may legitimately have activity in the
    // same day.
    const row = page.locator('tr').filter({ hasText: sessionName });
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText(seeded.vmName);
    await expect(page.getByText('No data found for the selected date range.')).toHaveCount(0);

    // "By User" is the default format and puts the user first; "By Session" reorders
    // the same rows around the session. Both are a separate `displayedColumns` list,
    // so the table is rebuilt rather than re-sorted.
    await expect(page.getByRole('columnheader').first()).toHaveText('User');
    await page.getByRole('radio', { name: 'By Session' }).click();
    await expect(page.getByRole('columnheader').first()).toHaveText('Session');
    await expect(page.locator('tr').filter({ hasText: sessionName })).toBeVisible();

    // The CSV is built in the browser out of the rows it already has, so it only
    // exists once a report has come back with data.
    const csv = page.getByRole('button', { name: 'CSV' });
    await expect(csv).toBeEnabled();
    const started = page.waitForEvent('download', { timeout: 30000 });
    await csv.click();
    const download = await started;
    expect(download.suggestedFilename()).toBe('VmUsageData.csv');
  });
});
