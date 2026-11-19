// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Browser, Page, request as playwrightRequest } from '@playwright/test';
import { test, expect, Services, authenticateMoodleWithKeycloak } from '../fixtures';
import { runMoodlePhp } from '../cli-helpers';
import {
  createKeycloakUser,
  deleteKeycloakUser,
  getKeycloakAdminToken,
  tempUsername,
  KeycloakUser,
} from '../../keycloak-admin';

// block_crucible's site role map grants a Moodle role at site level from Keycloak group
// membership, read from the Keycloak admin API at login - never from a profile field. These
// drive it end to end: a real group, a real Keycloak login, and Moodle's own role pages.

const realm = 'crucible';
const keycloak = Services.Keycloak.replace(/\/$/, '');

interface KcResponse {
  status: number;
  ok: boolean;
  location?: string;
  text: string;
}

async function kcFetch(token: string, method: string, path: string, data?: unknown): Promise<KcResponse> {
  const ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.fetch(`${keycloak}/admin/realms/${realm}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data,
    });
    return { status: res.status(), ok: res.ok(), location: res.headers()['location'], text: await res.text() };
  } finally {
    await ctx.dispose();
  }
}

async function createGroup(token: string, name: string): Promise<string> {
  const res = await kcFetch(token, 'POST', '/groups', { name });
  if (res.status !== 201) {
    throw new Error(`Keycloak createGroup(${name}) failed (${res.status}): ${res.text}`);
  }
  const id = res.location?.split('/').pop();
  if (!id) {
    throw new Error(`Keycloak createGroup(${name}) returned no Location`);
  }
  return id;
}

async function setMembership(token: string, userId: string, groupId: string, member: boolean): Promise<void> {
  const res = await kcFetch(token, member ? 'PUT' : 'DELETE', `/users/${userId}/groups/${groupId}`);
  if (!res.ok) {
    throw new Error(`Keycloak group membership change failed (${res.status}): ${res.text}`);
  }
}

/** Log a Keycloak user into Moodle in a context of its own, then close it. */
async function logInOnce(browser: Browser, user: KeycloakUser): Promise<void> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    await authenticateMoodleWithKeycloak(await context.newPage(), user.username, user.password);
  } finally {
    await context.close();
  }
}

/** Moodle user id for a Keycloak user, or 0 before their first login. */
function moodleUserId(user: KeycloakUser): number {
  return Number(runMoodlePhp(
    `echo (int)$DB->get_field('user', 'id', ['idnumber' => '${user.id}', 'deleted' => 0]);`
  ));
}

/** How many site-level grants of the role block_crucible holds for the user. */
function managedSiteGrants(userId: number, roleId: number): number {
  return Number(runMoodlePhp(
    `echo $DB->count_records('role_assignments', ['userid' => ${userId}, 'roleid' => ${roleId}, ` +
      `'contextid' => context_system::instance()->id, 'component' => 'block_crucible']);`
  ));
}

async function openSitePicker(page: Page): Promise<void> {
  await page.goto(`${Services.Moodle}/blocks/crucible/manage_rolemap.php?map=site`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.getByRole('heading', { name: 'Site role mappings', level: 2 })).toBeVisible();
}

test.describe('block_crucible site role mappings', () => {
  // The map is one site-wide setting, so two browser projects running at once would
  // overwrite each other's mapping. What is under test is server-side, so one browser is enough.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Site-wide setting under test; one project avoids a race on it');

  test('a Keycloak group grants a site role at login that Moodle cannot remove, and leaving revokes it', async ({
    moodleAdminPage: page,
    browser,
  }) => {
    test.setTimeout(240_000);

    // The master-realm admin token lives about a minute, and a slow browser's two logins
    // outlast it, so every Keycloak call asks for a fresh one.
    const token = getKeycloakAdminToken;
    const groupName = tempUsername('e2e-site-admins');
    const managerId = Number(runMoodlePhp(`echo (int)$DB->get_field('role', 'id', ['shortname' => 'manager']);`));
    const previousMap = runMoodlePhp(`echo (string)get_config('block_crucible', 'siterolemap');`);
    let groupId: string | undefined;
    let user: KeycloakUser | undefined;

    try {
      groupId = await createGroup(await token(), groupName);
      user = await createKeycloakUser(await token(), { username: tempUsername('e2e-siterole'), password: 'E2e-site-role-1!' });
      await setMembership(await token(), user.id, groupId, true);
      runMoodlePhp(`set_config('siterolemap', ${JSON.stringify(`${groupName}|manager`)}, 'block_crucible');`);

      await test.step('logging in as a group member grants the role at site level', async () => {
        await logInOnce(browser, user!);
        const userId = moodleUserId(user!);
        expect(userId, 'the Keycloak login should have created the Moodle account').toBeGreaterThan(0);
        expect(managedSiteGrants(userId, managerId)).toBe(1);
      });

      await test.step('the picker page lists the member as holding the role through the plugin', async () => {
        await openSitePicker(page);
        await expect(page.getByText(groupName).first()).toBeVisible();
        await expect(page.getByText('Granted at site level').first()).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Who holds manager at site level' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Test User' }).first()).toBeVisible();
      });

      await test.step('Moodle\'s role page will not remove the grant', async () => {
        const userId = moodleUserId(user!);
        await page.goto(`${Services.Moodle}/admin/roles/assign.php?contextid=1&roleid=${managerId}`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        const option = page.locator(`#removeselect option[value="${userId}"]`);
        await expect(option).toBeDisabled();

        // Even a forced request leaves it: the page only unassigns manual grants.
        await option.evaluate((el) => {
          (el as HTMLOptionElement).disabled = false;
          (el as HTMLOptionElement).selected = true;
        });
        await page.locator('#remove').evaluate((el) => {
          (el as HTMLInputElement).disabled = false;
        });
        await page.locator('#remove').click();
        await page.waitForLoadState('domcontentloaded');
        expect(managedSiteGrants(userId, managerId)).toBe(1);
      });

      await test.step('leaving the group revokes the role at the next login, inside the org role throttle', async () => {
        await setMembership(await token(), user!.id, groupId!, false);
        await logInOnce(browser, user!);
        expect(managedSiteGrants(moodleUserId(user!), managerId)).toBe(0);
      });
    } finally {
      runMoodlePhp(`set_config('siterolemap', ${JSON.stringify(previousMap)}, 'block_crucible');`);
      if (user) {
        const userId = moodleUserId(user);
        if (userId > 0) {
          runMoodlePhp(`delete_user($DB->get_record('user', ['id' => ${userId}]));`);
        }
        await deleteKeycloakUser(await token(), user.id);
      }
      if (groupId) {
        await kcFetch(await token(), 'DELETE', `/groups/${groupId}`);
      }
    }
  });
});
