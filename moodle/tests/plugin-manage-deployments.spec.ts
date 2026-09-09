// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import {
  cleanupMoodleCrucibleParticipant,
  MoodleCrucibleParticipant,
  seedMoodleCrucibleParticipant,
} from '../db-helpers';

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

function addMinutes(datetime: string, minutes: number): string {
  const timestamp = Date.parse(`${datetime}:00Z`);
  return new Date(timestamp + minutes * 60_000).toISOString().slice(0, 16);
}

async function openScheduleModal(page: Page, participant: MoodleCrucibleParticipant) {
  await openManagePage(page, `/mod/crucible/manage_deployments.php?id=${crucibleActivityId}`);

  const row = page.locator(`.mod-crucible-users-table tr[data-userid="${participant.userId}"]`);
  await expect(row).toContainText(participant.displayName);
  await row.locator('.user-checkbox').check();
  await page.getByRole('button', { name: /Schedule Selected/ }).click();

  const dialog = page.locator('.modal-dialog', { hasText: /Schedule Selected/ }).last();
  await expect(dialog).toBeVisible();
  return { dialog, row };
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

  test.describe('Crucible schedule validation', () => {
    let participant: MoodleCrucibleParticipant | undefined;

    test.beforeEach(async () => {
      participant = await seedMoodleCrucibleParticipant(crucibleActivityId);
    });

    test.afterEach(async () => {
      await cleanupMoodleCrucibleParticipant(participant);
      participant = undefined;
    });

    test('refreshes the schedule default and rejects a past time without submitting', async ({ moodleAdminPage: page }) => {
      await openManagePage(page, `/mod/crucible/manage_deployments.php?id=${crucibleActivityId}`);
      const templateDatetime = await page.locator('#schedule-modal-content #scheduledfor-input').inputValue();

      // The modal body is rendered at page load. Advance the browser wall clock
      // before opening it to prove that the displayed default is refreshed.
      await page.evaluate((advanceMs) => {
        const originalNow = Date.now.bind(Date);
        Date.now = () => originalNow() + advanceMs;
      }, 2 * 60_000);
      const row = page.locator(`.mod-crucible-users-table tr[data-userid="${participant!.userId}"]`);
      await expect(row).toContainText(participant!.displayName);
      await row.locator('.user-checkbox').check();
      await page.getByRole('button', { name: /Schedule Selected/ }).click();

      const dialog = page.locator('.modal-dialog', { hasText: /Schedule Selected/ }).last();
      await expect(dialog).toBeVisible();
      const datetimeInput = dialog.locator('#scheduledfor-input');
      await expect(datetimeInput).toHaveValue(addMinutes(templateDatetime, 2));

      let scheduleSubmissions = 0;
      page.on('request', request => {
        if (request.method() === 'POST'
          && request.url().includes('/mod/crucible/manage_deployments_action.php')
          && request.postData()?.includes('action=schedule_selected')) {
          scheduleSubmissions++;
        }
      });

      await datetimeInput.fill('2000-01-01T00:00');
      await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();

      await expect(dialog).toBeVisible();
      await expect(dialog.locator('#schedule-past-error')).toBeVisible();
      expect(scheduleSubmissions).toBe(0);
    });

    test('submits a valid future schedule successfully', async ({ moodleAdminPage: page }) => {
      const { dialog, row } = await openScheduleModal(page, participant!);
      const datetimeInput = dialog.locator('#scheduledfor-input');
      const defaultDatetime = await datetimeInput.inputValue();

      await datetimeInput.fill(addMinutes(defaultDatetime, 24 * 60));
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        dialog.getByRole('button', { name: 'Schedule', exact: true }).click(),
      ]);

      await expect(page.getByText(/Deployment scheduled for 1 user\(s\)/i)).toBeVisible();
      await expect(row).toHaveAttribute('data-status', 'scheduled');
    });
  });
});
