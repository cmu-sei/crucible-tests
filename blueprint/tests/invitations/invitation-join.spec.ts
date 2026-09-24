// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license
// information.

// spec: specs/blueprint-test-plan.md
//
// Using an invitation link as a second, temporary user. The admin copies the link from the
// Invitations section; the temporary user follows it in their own browser context, signs in,
// and is joined to the invitation's team. launch-and-join-workflows/join-active-event.spec.ts
// covers the Join card for a user who is already on a team; this spec covers how the link
// itself gets a new user onto a team, how uses are counted, and the email-domain gate.
//
// The MSEL is Deployed with a synthetic Player View id and `usePlayer` off, so the join
// touches no other application. A successful join sends the browser to
// `${PlayerUrl}/view/<id>`; Player itself is stubbed in the temporary user's context,
// because a view that does not exist would only bounce around Player's own login.

import { test, expect, Services } from '../../fixtures';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
} from '../../../keycloak-admin';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  createTeam,
  createInvitation,
  listInvitations,
  createBlueprintUser,
  deleteBlueprintUser,
  navigateToMselSection,
  signInToBlueprintAs,
  tempBlueprintName,
} from '../../test-helpers';

/** A context for the temporary user, with Player answered by a stub page. */
async function newInviteeContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: { cookies: [], origins: [] },
  });
  await context.route(`${Services.Player.UI}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>Player stub</body></html>' })
  );
  return context;
}

/** Read the join link off an invitation's Copy button, as a user would copy it. */
async function copiedInvitationLink(page: Page, emailDomain: string): Promise<string> {
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: `Edit ${emailDomain} invitation` }) });
  const copy = row.locator('button[title^="Copy Invitation Link:"]');
  await expect(copy).toBeEnabled();
  const title = await copy.getAttribute('title');
  return title!.replace(/^Copy Invitation Link: /, '');
}

function remainingUses(page: Page, emailDomain: string) {
  return page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: `Edit ${emailDomain} invitation` }) })
    .getByRole('cell')
    .nth(5);
}

test.describe('Invitation Links', () => {
  const password = 'TestPass-123!';
  let token: string;
  let kcToken: string;
  let kcUser: { id: string; username: string } | undefined;
  let mselId: string | undefined;
  let mselName: string;
  let playerViewId: string;
  let alphaId: string;
  let bravoId: string;
  let inviteeContext: BrowserContext | undefined;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    kcToken = await getKeycloakAdminToken();
    // createKeycloakUser gives the user `<username>@test.local`.
    kcUser = await createKeycloakUser(kcToken, { username: tempUsername('bp-invitee'), password });
    // Pending upstream: on a user's first sign-in, the app's concurrent first requests each
    // insert the Blueprint user row. The loser's failed insert is swallowed but stays tracked
    // in its DbContext, so if that request is the join, its save retries the insert and
    // returns 500. The user is therefore created up front, as if they had signed in before.
    // When first-request provisioning is race-free, drop this and let sign-in create them.
    await createBlueprintUser(token, { id: kcUser.id, name: kcUser.username });

    mselName = tempBlueprintName('TestBP-InvitationJoin');
    const msel = await createMsel(token, { name: mselName, status: 'Deployed' });
    mselId = msel.id;
    playerViewId = randomUUID();
    await updateMsel(token, mselId, { playerViewId });
    alphaId = (await createTeam(token, mselId, { name: 'Alpha Team', shortName: 'ALPHA' })).id;
    bravoId = (await createTeam(token, mselId, { name: 'Bravo Team', shortName: 'BRAVO' })).id;
    await createInvitation(token, mselId, alphaId, { emailDomain: '@test.local', maxUsersAllowed: 2 });
    await createInvitation(token, mselId, bravoId, { emailDomain: '@elsewhere.test', maxUsersAllowed: 2 });
  });

  test.afterEach(async () => {
    await inviteeContext?.close();
    inviteeContext = undefined;
    if (mselId) await deleteMsel(token, mselId);
    mselId = undefined;
    if (kcUser) {
      await deleteBlueprintUser(token, kcUser.id);
      await deleteKeycloakUser(kcToken, kcUser.id);
    }
    kcUser = undefined;
  });

  test('A new user joins the invitation team through its link', async ({
    blueprintAuthenticatedPage: page,
    browser,
  }) => {
    await navigateToMselSection(page, mselId!, 'Invitations');
    await expect(remainingUses(page, '@test.local')).toHaveText('2');
    const link = await copiedInvitationLink(page, '@test.local');

    inviteeContext = await newInviteeContext(browser);
    const invitee = await inviteeContext.newPage();
    await signInToBlueprintAs(invitee, kcUser!.username, password, link);

    // expect: once signed in, the link joins the user and sends them to the Player View
    await expect(invitee).toHaveURL(`${Services.Player.UI}/view/${playerViewId}`, { timeout: 30000 });

    // expect: the invitation has one use fewer
    await navigateToMselSection(page, mselId!, 'Invitations');
    await expect(remainingUses(page, '@test.local')).toHaveText('1');
    await expect(remainingUses(page, '@elsewhere.test')).toHaveText('2');

    // expect: the user is now on a team in the MSEL, so it is offered on their Join page
    await invitee.goto(`${Services.Blueprint.UI}/join`, { waitUntil: 'domcontentloaded' });
    const card = invitee.locator('.card-container mat-card').filter({ hasText: mselName });
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card.getByTitle(`Join ${mselName}`)).toBeEnabled();

    // Secondary: the use was recorded against the ALPHA invitation. Blueprint's
    // JsonIntegerConverter writes integers as JSON strings, so compare them as numbers.
    const invitations = await listInvitations(token, mselId!);
    expect(Number(invitations.find((i) => i.teamId === alphaId)?.userCount)).toBe(1);
    expect(Number(invitations.find((i) => i.teamId === bravoId)?.userCount)).toBe(0);
  });

  test('A link whose email domain does not match the user is refused', async ({
    blueprintAuthenticatedPage: page,
    browser,
  }) => {
    await navigateToMselSection(page, mselId!, 'Invitations');
    const link = await copiedInvitationLink(page, '@elsewhere.test');

    inviteeContext = await newInviteeContext(browser);
    const invitee = await inviteeContext.newPage();
    await signInToBlueprintAs(invitee, kcUser!.username, password, link);

    // expect: the join is refused with the reason, and the user stays in Blueprint
    const error = invitee.locator('mat-bottom-sheet-container');
    await expect(error).toContainText(
      `Your email (${kcUser!.username}@test.local) does not match the invitation requirements`,
      { timeout: 30000 }
    );
    await expect(error).toContainText('@elsewhere.test');
    expect(invitee.url().startsWith(Services.Blueprint.UI)).toBe(true);

    // expect: the refused attempt did not consume a use
    await navigateToMselSection(page, mselId!, 'Invitations');
    await expect(remainingUses(page, '@elsewhere.test')).toHaveText('2');
    const invitations = await listInvitations(token, mselId!);
    expect(Number(invitations.find((i) => i.teamId === bravoId)?.userCount)).toBe(0);
  });
});
