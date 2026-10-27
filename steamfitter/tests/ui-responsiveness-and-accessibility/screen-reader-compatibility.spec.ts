// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { Locator, Page } from '@playwright/test';
import {
  test,
  expect,
  STEAMFITTER_THEMES,
  setSteamfitterTheme,
  seedGroup,
  seedUser,
  seedSystemRole,
  deleteGroupsByPrefix,
  deleteUsersByPrefix,
  deleteSystemRolesByPrefix,
} from '../../fixtures';
import { navigateToAdminSection, navigateToHomeSection } from '../../test-helpers';

/**
 * Icon-only buttons carry no text of their own (their mat-icon is aria-hidden), so a
 * screen reader can announce one only through an aria-label, an aria-labelledby that
 * resolves, or a title. A matTooltip is not a name: it is wired up as aria-describedby.
 * This spec walks the topbar, the home sections and every admin section, with a seeded
 * group, user and custom role so their row and column buttons render, and checks that
 * every visible icon button has an accessible name, every aria-labelledby points at an
 * element that exists, and every visible image has alt text.
 */

/** Every visible icon-only button in `scope` has a non-empty accessible name. */
async function expectIconButtonsNamed(scope: Locator, where: string, atLeast = 1): Promise<void> {
  const buttons = scope.locator('.mat-mdc-icon-button:visible');
  await expect
    .poll(() => buttons.count(), {
      message: `${where}: icon buttons rendered`,
      timeout: 10000,
    })
    .toBeGreaterThanOrEqual(atLeast);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    await expect(buttons.nth(i), `${where}: icon button ${i + 1} of ${count}`).toHaveAccessibleName(
      /\S/,
    );
  }
}

/** Every aria-labelledby id on the page names an element that exists. */
async function expectLabelledByResolves(page: Page, where: string): Promise<void> {
  const dangling = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-labelledby]')).flatMap((el) =>
      (el.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .filter((id) => id && !document.getElementById(id))
        .map((id) => `${el.tagName.toLowerCase()} -> #${id}`),
    ),
  );
  expect(dangling, `${where}: aria-labelledby references with no matching id`).toEqual([]);
}

/** Every visible image has alt text. */
async function expectImagesHaveAlt(page: Page, where: string): Promise<void> {
  const images = page.locator('img:visible');
  const count = await images.count();
  for (let i = 0; i < count; i++) {
    await expect(images.nth(i), `${where}: image ${i + 1} of ${count}`).toHaveAttribute(
      'alt',
      /\S/,
    );
  }
}

async function expectAccessible(
  page: Page,
  where: string,
  atLeast = 1,
  scope: Locator = page.locator('body'),
): Promise<void> {
  await expectIconButtonsNamed(scope, where, atLeast);
  await expectLabelledByResolves(page, where);
  await expectImagesHaveAlt(page, where);
}

for (const theme of STEAMFITTER_THEMES) {
  test.describe(`${theme} theme › UI Responsiveness and Accessibility`, () => {
    const STAMP = Date.now();
    const GROUP_NAME = `E2E A11y Group ${STAMP}`;
    const USER_NAME = `E2E A11y User ${STAMP}`;
    const ROLE_NAME = `E2E A11y Role ${STAMP}`;

    test.beforeEach(async () => {
      await seedGroup(GROUP_NAME);
      await seedUser(USER_NAME);
      await seedSystemRole(ROLE_NAME);
    });

    test.afterEach(async () => {
      await deleteGroupsByPrefix(['E2E A11y Group']);
      await deleteUsersByPrefix(['E2E A11y User']);
      await deleteSystemRolesByPrefix(['E2E A11y Role']);
    });

    test('Screen reader compatibility - icon buttons, labels and images', async ({
      steamfitterAuthenticatedPage: page,
    }) => {
      await setSteamfitterTheme(page, theme);

      // 1-2. The topbar and the home sections.
      for (const section of ['Scenarios', 'Scenario Templates', 'History'] as const) {
        await navigateToHomeSection(page, section);
        // expect: The topbar Home link and user menu are labeled
        await expect(page.locator('a[title="Home"]').first()).toHaveAccessibleName(/\S/);
        await expect(page.getByRole('button', { name: /Admin User/ })).toBeVisible({
          timeout: 10000,
        });
        await expectAccessible(page, `Home › ${section}`, 0);
      }

      // 3. Every admin section. The sidebar's per-section arrow buttons are icon-only, so
      // each admin page has at least those five.
      for (const section of ['Scenario Templates', 'Scenarios'] as const) {
        await navigateToAdminSection(page, section);
        await expectAccessible(page, `Admin › ${section}`, 5);
      }

      // expect: The sidebar arrow buttons are named after their sections
      for (const section of ['Scenario Templates', 'Scenarios', 'Users', 'Roles', 'Groups']) {
        await expect(page.getByRole('button', { name: section, exact: true })).toBeVisible();
      }

      // Users: the seeded user's row buttons render once the list is filtered to it.
      await navigateToAdminSection(page, 'Users');
      await page.getByRole('textbox', { name: 'Search' }).first().fill(USER_NAME);
      await expect(page.locator('tbody tr').filter({ hasText: USER_NAME }).first()).toBeVisible({
        timeout: 10000,
      });
      await expectAccessible(page, 'Admin › Users', 6);

      // Roles: the seeded custom role exposes rename and delete buttons in its header.
      await navigateToAdminSection(page, 'Roles');
      // Each tab is checked inside its own panel, once the tab is selected, so the previous
      // panel's buttons are not counted while the switch animates.
      for (const tab of ['Scenario Template Roles', 'Scenario Roles', 'Roles']) {
        const tabButton = page.getByRole('tab', { name: tab, exact: true });
        await tabButton.click();
        await expect(tabButton).toHaveAttribute('aria-selected', 'true');
        const panel = page.getByRole('tabpanel', { name: tab, exact: true });
        await expect(panel.locator('table')).toBeVisible({ timeout: 10000 });
        await expectAccessible(page, `Admin › Roles › ${tab}`, 1, panel);
      }
      await expect(page.getByRole('button', { name: `Rename role ${ROLE_NAME}` })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByRole('button', { name: `Delete role ${ROLE_NAME}` })).toBeVisible();

      // Groups: the seeded group's row buttons, then its expanded member lists.
      await navigateToAdminSection(page, 'Groups');
      await page.getByRole('textbox', { name: 'Search Groups' }).fill(GROUP_NAME);
      const groupRow = page.locator('tbody tr').filter({ hasText: GROUP_NAME }).first();
      await expect(groupRow).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: `Delete ${GROUP_NAME}` })).toBeVisible();
      await expectAccessible(page, 'Admin › Groups', 7);

      await groupRow.click();
      const nonMembersList = page
        .locator('.mat-elevation-z8')
        .filter({ has: page.getByText('Users', { exact: true }) });
      await expect(nonMembersList).toBeVisible({ timeout: 10000 });
      await nonMembersList.getByRole('textbox', { name: 'Search' }).fill(USER_NAME);
      // expect: A non-member's add and copy-id buttons are named after the user
      await expect(nonMembersList.getByRole('button', { name: `Add ${USER_NAME}` })).toBeVisible({
        timeout: 10000,
      });
      await expect(
        nonMembersList.getByRole('button', { name: `Copy ID of ${USER_NAME}` }),
      ).toBeVisible();
      await expectAccessible(page, 'Admin › Groups › expanded group', 9);
    });
  });
}
