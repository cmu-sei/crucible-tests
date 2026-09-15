// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import fs from 'fs';
import { test, expect, Services } from '../../fixtures';
import { getViewTeams } from '../../../player-helpers';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  createUsageLoggingSession,
  deleteViewUsageLoggingSessions,
  isUsageLoggingEnabled,
  listUsageLoggingSessions,
  seedViewWithVm,
  SeededViewWithVm,
} from '../../vm-helpers';

/**
 * The Usage Logging tab — the one feature of this page behind a deployment switch.
 *
 * `VmUsageLogging:Enabled` decides whether the whole feature answers at all: with it
 * off, every endpoint but `isloggingenabled` returns 404 "Vm Usage Logging is
 * disabled", and the VM UI *disables* the tab rather than hiding it. `vm.api` covers
 * both branches in process (`VmUsageLoggingSessionEndpointTests` and
 * `VmUsageLoggingDisabledEndpointTests`), but a browser only ever sees the branch its
 * deployment is configured for, so the other one cannot be tested here at all.
 *
 * That is why the first test below is unconditional and asserts both branches against
 * the setting the API reports: whichever way a deployment is configured, one real
 * assertion is made about what the tab does there. The rest of the file is the enabled
 * branch, and skips (fails under CI/`CRUCIBLE_STRICT`) when the feature is off — a
 * session cannot be created to look at when the API will not create one.
 */
test.describe('Usage Logging tab', () => {
  let seeded: SeededViewWithVm;
  let teamName: string;
  let usageLoggingEnabled = false;

  test.beforeAll(async () => {
    seeded = await seedViewWithVm('E2E Vm Usage Logging');
    usageLoggingEnabled = await isUsageLoggingEnabled(seeded.token);
    // The Teams control and the table's Teams column both work in team *names*,
    // and the seeder only hands back the id.
    const teams = await getViewTeams(seeded.token, seeded.viewId);
    teamName = teams[0].name;
  });

  // Sessions live in the VM API's separate logging database, keyed by view id, and
  // nothing cascades them off the Player view — so this runs per test rather than
  // once at the end, both to leave nothing behind if a later test fails and to give
  // each test an empty table to assert against.
  test.afterEach(async () => {
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

  test('Usage Logging tab is enabled exactly when the API says logging is on', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);

    const tab = page.getByRole('tab', { name: 'Usage Logging' });
    await expect(tab).toBeVisible({ timeout: 30000 });

    // The tab is in the strip either way — `showUsageLogging$` is about
    // permissions, and `[disabled]="!usageLoggingEnabled"` is what the setting
    // drives. A deployment with logging off shows a tab that cannot be opened,
    // which is the intended behaviour and not a fault.
    await expect(tab).toHaveAttribute('aria-disabled', String(!usageLoggingEnabled));

    const usageLogging = page.locator('app-vm-usage-logging');

    if (usageLoggingEnabled) {
      await tab.click();
      await expect(usageLogging).toBeVisible({ timeout: 30000 });
      await expect(usageLogging.getByRole('textbox', { name: 'Log Name' })).toBeVisible();
      await expect(usageLogging.getByRole('button', { name: 'Refresh' })).toBeVisible();
      return;
    }

    // A disabled `mat-tab` is `pointer-events: none`, so a real click cannot reach
    // it and Playwright would fail the actionability check rather than assert
    // anything. Dispatching the event directly is the only way to put the click
    // *through* the CSS and onto `_handleClick`, which is where the guard that
    // matters lives: the tab body is wrapped in `<ng-template matTabContent>`, so a
    // click the guard lets through would instantiate the component.
    await tab.dispatchEvent('click');
    await expect(tab).toHaveAttribute('aria-selected', 'false');
    await expect(usageLogging).toHaveCount(0);
  });

  test('A session created through the form appears in the table', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no session can be created'
    );

    const sessionName = `E2E Form Session ${Date.now()}`;

    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Usage Logging' }).click();

    const usageLogging = page.locator('app-vm-usage-logging');
    await expect(usageLogging).toBeVisible({ timeout: 30000 });

    // Typed rather than filled. The name reaches the component through
    // `(change)="updateLogName($event)"` — the `[(value)]` next to it is one-way in
    // practice, because `matInput` has no `valueChange` output — and a `change`
    // event only follows a blur when the value was changed by keystrokes.
    const logName = usageLogging.getByRole('textbox', { name: 'Log Name' });
    await logName.pressSequentially(sessionName);
    await logName.blur();

    await usageLogging.getByRole('combobox', { name: 'Teams' }).click();
    // The options are in an overlay on `body`, not inside the component.
    await page.getByRole('option', { name: teamName }).click();
    await page.keyboard.press('Escape');

    const today = new Date();
    await usageLogging.getByPlaceholder('Start date').fill(monthDayYear(today));
    await usageLogging.getByPlaceholder('End date').fill(monthDayYear(today));

    await usageLogging.getByRole('button', { name: 'Add' }).click();

    const row = usageLogging.locator('tr').filter({ hasText: sessionName });
    await expect(row).toBeVisible({ timeout: 30000 });
    // The Teams column renders `getTeamName(teamId)` against the view's teams, so
    // this is also the assertion that the session was filed against the team the
    // form selected rather than against no team at all.
    await expect(row).toContainText(teamName);

    // `createNewSession` clears the name on success and leaves it alone otherwise,
    // so an empty box is the UI's own report that the POST came back.
    await expect(logName).toHaveValue('');

    // And the row is a record, not just a row: the API has it under this view.
    const sessions = await listUsageLoggingSessions(seeded.token, seeded.viewId);
    expect(sessions.map((x) => x.sessionName)).toContain(sessionName);
  });

  test('Download CSV saves the session log under the session name', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no session can be created'
    );

    const sessionName = `E2E Csv Session ${Date.now()}`;
    await createUsageLoggingSession(seeded.token, {
      viewId: seeded.viewId,
      teamIds: [seeded.teamId],
      sessionName,
    });

    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Usage Logging' }).click();

    const usageLogging = page.locator('app-vm-usage-logging');
    const row = usageLogging.locator('tr').filter({ hasText: sessionName });
    await expect(row).toBeVisible({ timeout: 30000 });

    // Subscribed before the click, because the download can start before `click()`
    // resolves and an event that has already fired is not waited for.
    const started = page.waitForEvent('download', { timeout: 30000 });
    await row.getByRole('button', { name: 'Download CSV' }).click();
    const download = await started;

    // The client names the file itself (`saveAs(blob, name + '.csv')`) rather than
    // taking the API's `FileDownloadName`, so this is the browser half of the
    // download and not a restatement of what the endpoint sets.
    expect(download.suggestedFilename()).toBe(`${sessionName}.csv`);

    const path = await download.path();
    const csv = fs.readFileSync(path, 'utf8');
    // A session with no console activity still yields the header row — the columns
    // are the report's whole vocabulary, and an empty body is what "nobody opened a
    // VM" looks like.
    expect(csv.split(/\r?\n/)[0]).toBe(
      'SessionID, LogID, VmID, VmName, IpAddress, UserId, UserName, VmActiveDateTime, VmInactiveDateTime'
    );
  });

  test('End closes a session that is still running', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no session can be created'
    );

    const sessionName = `E2E End Session ${Date.now()}`;
    // An hour out rather than the helper's end-of-day default, so the session is
    // unambiguously still running whatever time of day the suite runs at —
    // `isSessionActive` is what puts the End button in the row.
    const session = await createUsageLoggingSession(seeded.token, {
      viewId: seeded.viewId,
      teamIds: [seeded.teamId],
      sessionName,
      sessionEnd: new Date(Date.now() + 60 * 60 * 1000),
    });

    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Usage Logging' }).click();

    const usageLogging = page.locator('app-vm-usage-logging');
    const row = usageLogging.locator('tr').filter({ hasText: sessionName });
    await expect(row).toBeVisible({ timeout: 30000 });

    const end = row.getByRole('button', { name: 'End' });
    await expect(end).toBeVisible();
    await end.click();

    // The button is the assertion: it is rendered only for a session whose end is
    // in the future, so its disappearance is the row saying the end moved to now.
    await expect(end).toHaveCount(0, { timeout: 30000 });

    const [stored] = (await listUsageLoggingSessions(seeded.token, seeded.viewId)).filter(
      (x) => x.id === session.id
    );
    expect(new Date(stored.sessionEnd).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('Delete removes the row only after the confirmation is confirmed', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), so no session can be created'
    );

    const sessionName = `E2E Delete Session ${Date.now()}`;
    await createUsageLoggingSession(seeded.token, {
      viewId: seeded.viewId,
      teamIds: [seeded.teamId],
      sessionName,
    });

    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Usage Logging' }).click();

    const usageLogging = page.locator('app-vm-usage-logging');
    const row = usageLogging.locator('tr').filter({ hasText: sessionName });
    await expect(row).toBeVisible({ timeout: 30000 });

    // Cancel first. Deleting a session drops every log entry with it (the entries
    // cascade off it in the logging database), so the confirmation is the only thing
    // between a mis-click and the recorded history of an exercise.
    await row.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 30000 });
    await expect(dialog).toContainText(`Delete Logging Session: ${sessionName}`);
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(row).toBeVisible();
    expect(
      (await listUsageLoggingSessions(seeded.token, seeded.viewId)).map((x) => x.sessionName)
    ).toContain(sessionName);

    // Then confirm.
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(row).toHaveCount(0, { timeout: 30000 });
    expect(
      (await listUsageLoggingSessions(seeded.token, seeded.viewId)).map((x) => x.sessionName)
    ).not.toContain(sessionName);
  });
});
