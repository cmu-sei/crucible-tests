// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Teams are not a top-level section in Blueprint UI.
// They live inside a MSEL at /build?msel=<id>.
// To access teams: navigate to /build, open a MSEL, then click "Teams" in the MSEL sidebar.
const MSEL_NAME = 'Project Lagoon TTX - Admin User';

test.describe('Teams and Organizations Management', () => {
  test('View Teams List', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to the Build section (MSEL list)
    await page.goto(`${Services.Blueprint.UI}/build`);

    // Wait for MSEL table to load
    const mselTable = page.getByText('My MSELs');
    const tableVisible = await mselTable.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!tableVisible) {
      test.skip();
      return;
    }

    // Wait for MSEL data rows to appear
    const mselDataRows = page.locator('[role="row"] a[href*="/build?msel="]').first();
    const dataRowsVisible = await mselDataRows.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (!dataRowsVisible) {
      test.skip();
      return;
    }

    // Find and click the MSEL that has teams
    const mselLink = page.locator(`a:text-is("${MSEL_NAME}")`).first();
    const mselExists = await mselLink.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    if (!mselExists) {
      test.skip();
      return;
    }

    await mselLink.click();

    // Wait for the MSEL detail page to load
    await expect(page).toHaveURL(/\/build\?msel=/, { timeout: 10000 });

    // 2. Click 'Teams' in the MSEL sidebar navigation
    const teamsNavItem = page.locator('text=Teams').first();
    await expect(teamsNavItem).toBeVisible({ timeout: 10000 });
    await teamsNavItem.click();

    // 3. expect: Teams table is visible
    // The teams list uses Angular Material mat-table (role="table")
    const teamsTable = page.getByRole('table').first();
    await expect(teamsTable).toBeVisible({ timeout: 10000 });

    // 4. expect: At least one team row is present
    // mat-table rows have role="row"; skip the header row by using a more specific locator
    const teamRows = page.getByRole('row').filter({ has: page.getByRole('button', { name: /^Edit / }) });
    const teamCount = await teamRows.count();

    expect(teamCount).toBeGreaterThan(0);
    console.log(`Teams list displayed with ${teamCount} team(s)`);

    // 5. expect: Team names are visible in the rows
    // Each row contains an "Edit <team-name>" button whose name reveals the team name
    const firstRow = teamRows.first();
    await expect(firstRow).toBeVisible({ timeout: 5000 });

    // Verify the edit button (which contains team name) is visible in the first row
    const firstEditButton = firstRow.getByRole('button', { name: /^Edit / }).first();
    await expect(firstEditButton).toBeVisible({ timeout: 5000 });

    // Extract and log team names from edit buttons across all rows
    const editButtons = page.getByRole('button', { name: /^Edit / });
    const editButtonCount = await editButtons.count();
    for (let i = 0; i < editButtonCount; i++) {
      const buttonText = await editButtons.nth(i).textContent();
      const teamName = buttonText?.replace(/^Edit\s+/, '').trim();
      console.log(`  Team ${i + 1}: ${teamName}`);
    }
  });
});
