// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  deleteScenarioEvent,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('MSEL Playbook', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    // Create at least one scenario event so the playbook has content
    // Use the renderable variant: the playbook renders an event's DataValues, and a MSEL
    // created via POST /api/msels has no DataFields, so a bare createScenarioEvent yields a
    // row with nothing in it. (`description`/`moveNumber` are not API fields — see
    // createScenarioEvent's doc comment.)
    const event = await createRenderableScenarioEvent(
      token,
      mselId,
      'Test scenario event for playbook',
      { deltaSeconds: 0 }
    );
    eventId = event.id;
  });

  test.afterEach(async () => {
    try {
      if (eventId) await deleteScenarioEvent(token, eventId);
    } catch (err) {
      console.warn(`Cleanup failed for event ${eventId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('View MSEL Playbook', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to the MSEL Playbook section
    await navigateToMselSection(page, mselId, 'MSEL Playbook');

    // expect: The MSEL Playbook section loads
    const playbookHeading = page.getByRole('heading', { name: 'MSEL Playbook' });
    await expect(playbookHeading).toBeVisible({ timeout: 5000 });

    // expect: Scenario events are displayed in a table format
    const eventsTable = page.getByRole('table');
    await expect(eventsTable).toBeVisible({ timeout: 5000 });

    // expect: Pagination controls are shown (mat-paginator group)
    // The paginator renders as a group with status text and navigation buttons
    const paginator = page.getByRole('group');
    await expect(paginator).toBeVisible({ timeout: 5000 });

    // expect: Pagination status is displayed (e.g., "1 – 1 of 1")
    const paginationStatus = page.getByRole('status');
    await expect(paginationStatus).toBeVisible({ timeout: 5000 });

    // 2. Navigate through pages using pagination controls (if multiple pages exist)
    const nextPageButton = page.getByRole('button', { name: 'Next page' });
    const nextVisible = await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (nextVisible) {
      const isDisabled = await nextPageButton.isDisabled();
      if (!isDisabled) {
        await nextPageButton.click();

        // expect: Previous page button works
        const prevPageButton = page.getByRole('button', { name: 'Previous page' });
        await expect(prevPageButton).toBeVisible({ timeout: 5000 });
        await expect(prevPageButton).not.toBeDisabled();
      }
    }

    // 3. Verify the scenario event content is displayed
    // expect: The table shows execution time, move, and group information
    const moveCell = page.getByRole('cell', { name: 'Move' });
    await expect(moveCell).toBeVisible({ timeout: 5000 });

    const groupCell = page.getByRole('cell', { name: 'Group' });
    await expect(groupCell).toBeVisible({ timeout: 5000 });
  });
});
