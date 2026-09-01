// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { authenticateConsoleWithKeycloak } from '../../../console/fixtures';
import {
  addUserToTeam,
  deletePlayerUser,
  getPlayerToken,
  provisionPlayerUser,
} from '../../../player-helpers';
import {
  createKeycloakUser,
  deleteKeycloakUser,
  getKeycloakAdminToken,
  tempUsername,
} from '../../../keycloak-admin';
import { seedViewWithVm, SeededViewWithVm } from '../../vm-helpers';

/**
 * Presence: what one person sees of *another* person's console, live.
 *
 * This is the only place in either suite that opens two sessions as two different
 * users, and presence is the reason it has to. Every message here is broadcast to
 * groups derived from the *acting* user's teams and views, and every one of them is
 * addressed to somebody else — so a single session can watch the whole feature work
 * and learn nothing: an unset team, a group name assembled differently on the two
 * ends, or a token without the claim the username is read from all leave the acting
 * user's own screen perfectly correct.
 *
 * Two readouts, one per app, both fed by `VmHub.SetActiveVirtualMachine`:
 *
 *   - **`vm.ui`'s User Follow tab** — a row per user per team, showing which VM they
 *     are on now and which they were on last. Populated by `JoinViewUsers` (a request
 *     the *watcher* makes) and then moved by `ActiveVirtualMachine` messages.
 *   - **`console.ui`'s options bar** — "Connected: …" beside the console toolbar,
 *     which is the literal answer to "who else is looking at this machine". Populated
 *     only by `CurrentVirtualMachineUsers`, and only for a connection that invoked
 *     `JoinVm`.
 *
 * Four things that shape the setup, all of them load-bearing:
 *
 *   - **The other user has to be a real Keycloak account.** Presence is keyed by
 *     `sub`, so two browser sessions as `admin` are one user to the hub.
 *   - **They have to be in a team in the view, and it has to be their first.** The
 *     Player API makes a user's first team in a view their *primary* team, and
 *     `SetActiveVirtualMachine` scopes both broadcasts to the primary team and the
 *     views reachable from it. A user with no primary team is reported to nobody, and
 *     nothing on either screen says so.
 *   - **They have to exist in Player.** There is no endpoint that creates a user for
 *     someone else; the row appears when a token is first presented
 *     (`provisionPlayerUser`), and until it does the user is not in the list
 *     `JoinViewUsers` builds, which means no row to move.
 *   - **The seeded VM needs a real url.** The Last VM cell renders
 *     `getVmUrl(vm.url)` → `new URL(url)`, which *throws* on the empty string the API
 *     defaults to, taking the whole table's render with it. It points at the VM API's
 *     health endpoint: inert, reachable, and absolute.
 *
 * One leak is accepted here, as it already is in `usage-reporting.spec.ts`:
 * `VmHub.UpdateVmUser` writes a `VmUsers` row per (user, team) that no endpoint can
 * delete and nothing cascades. Deleting the Keycloak user, the Player user and the
 * view — which this file does — leaves that row orphaned in the VM API's database,
 * keyed on ids that no longer resolve. It is invisible to every list in the estate.
 */
test.describe('Console presence across two sessions', () => {
  /** Absolute, reachable and inert — see the Last VM cell note above. */
  const vmUrl = `${Services.PlayerVM.API.replace(/\/$/, '')}/api/health/ready`;

  let seeded: SeededViewWithVm;
  /** The second user's Player display name — how they are labelled on screen. */
  let memberName: string;
  let memberUsername: string;
  let memberPassword: string;

  /** Teardown for the shared setup, drained in reverse in `afterAll`. */
  const setupCleanups: Array<() => Promise<void>> = [];
  /** Teardown for one test's browser context, drained in `afterEach`. */
  const testCleanups: Array<() => Promise<void>> = [];

  test.beforeAll(async () => {
    const stamp = Date.now();
    seeded = await seedViewWithVm('E2E Vm Presence', { vmUrl });
    setupCleanups.push(() => seeded.cleanup());

    const keycloakAdminToken = await getKeycloakAdminToken();
    memberUsername = tempUsername('e2e-presence');
    memberPassword = `Presence-${stamp}!`;
    // The row is found by display name, which Player takes from the token's `name`
    // claim — i.e. from these two fields. Stamping the surname keeps it unique
    // against a leftover from a crashed run.
    memberName = `E2E Presence ${stamp}`;
    const member = await createKeycloakUser(keycloakAdminToken, {
      username: memberUsername,
      password: memberPassword,
      firstName: 'E2E',
      lastName: `Presence ${stamp}`,
    });
    setupCleanups.push(() => deleteKeycloakUser(keycloakAdminToken, member.id));

    const memberToken = await getPlayerToken(memberUsername, memberPassword);
    const playerUser = await provisionPlayerUser(memberToken, member.id);
    setupCleanups.push(() => deletePlayerUser(seeded.token, member.id));
    // If this ever fails, the realm has stopped issuing `name` and every screen in
    // Player is labelling users by something else too.
    expect(playerUser.name).toBe(memberName);

    await addUserToTeam(seeded.token, seeded.teamId, member.id);
  });

  test.afterEach(async () => {
    for (const cleanup of testCleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  test.afterAll(async () => {
    for (const cleanup of setupCleanups.splice(0).reverse()) {
      await cleanup();
    }
  });

  /**
   * Open the seeded VM's console as the second user, in a browser context of its own.
   *
   * The context is the point: Keycloak's session cookie is per-context, so this is
   * what makes the two sessions two users rather than two tabs. `use.ignoreHTTPSErrors`
   * from the config does not reach `browser.newContext`, hence passing it here — the
   * Keycloak certificate is self-signed.
   *
   * Returns the page, still open. Closing it is what ends the session: the hub's
   * `OnDisconnectedAsync` is the only thing that clears presence.
   */
  const openMemberConsole = async (context: BrowserContext): Promise<Page> => {
    const consolePage = await context.newPage();
    await authenticateConsoleWithKeycloak(consolePage, memberUsername, memberPassword);
    await consolePage.goto(`${Services.Console.UI}/vm/${seeded.vmId}/console`);
    // A seeded VM is `Type=Unknown`, which mounts the same console components as
    // vSphere; they never reach a screen, which nothing here depends on.
    await expect(consolePage.locator('app-console')).toBeVisible({ timeout: 60000 });
    await consolePage.bringToFront();
    return consolePage;
  };

  /**
   * Wait for `read()` to report `expected`, re-firing `window:focus` on the member's
   * console each round.
   *
   * `console-page.component` claims the VM in `ngOnInit` only `if (document.hasFocus())`
   * — which a page that has never been interacted with may not report, and only once
   * `startConnection()` has resolved, which nothing on the page announces. Its
   * `window:focus` handler is the other way in and the one a user switching back to the
   * tab takes. Re-firing it also covers the other end of the race: the watcher joins
   * its group asynchronously too, and a broadcast sent before it got there is simply
   * gone. Every focus that lands re-broadcasts, so a late watcher still sees one.
   */
  const pollWhileFocusing = async (
    consolePage: Page,
    read: () => Promise<string>,
    expected: string
  ): Promise<void> => {
    await expect
      .poll(
        async () => {
          await consolePage.evaluate(() => window.dispatchEvent(new Event('focus')));
          return read();
        },
        { timeout: 90000, intervals: [1000, 2000, 3000] }
      )
      .toContain(expected);
  };

  test("Another user's console appears against them in User Follow, and clears when they leave", async ({
    playerVmAuthenticatedPage: page,
    browser,
  }) => {
    // The VM List tab first, and not just for the sake of it: the Virtual Machine cell
    // renders `vmsQuery.selectEntity(activeVmId)`, so a VM the store has never heard of
    // draws as "None" — indistinguishable from nobody being on a console. Loading the
    // list is what puts the seeded VM in the store.
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await expect(
      page.locator('app-vm-list').getByRole('link', { name: seeded.vmName })
    ).toBeVisible({ timeout: 30000 });

    await page.getByRole('tab', { name: 'User Follow' }).click();
    const userList = page.locator('app-user-list');
    await expect(userList).toBeVisible({ timeout: 30000 });
    // One expansion panel per team, all collapsed, and the panels are not lazy — the
    // rows are in the DOM but not visible until something opens them.
    await userList.getByRole('button', { name: 'Expand All' }).click();

    const memberRow = userList.locator('mat-row').filter({ hasText: memberName });
    // The row exists because the user is in a team in this view, before any console:
    // `JoinViewUsers` builds it from Player's team membership, not from activity.
    await expect(memberRow).toBeVisible({ timeout: 30000 });

    // Cells, not the row: after a console session the row's text contains the VM name
    // twice (active *and* last), so a row-level assertion could not tell the revert to
    // "None" from the Last VM column keeping it.
    const activeVm = memberRow.locator('.mat-column-activeVmId');
    const lastVm = memberRow.locator('.mat-column-lastVmId');
    await expect(activeVm).toHaveText('None');
    await expect(lastVm).toHaveText('None');

    const memberContext = await browser.newContext({ ignoreHTTPSErrors: true });
    testCleanups.push(() => memberContext.close());
    const consolePage = await openMemberConsole(memberContext);

    // The assertion the whole file is for: this page has made no request since the tab
    // mounted, and the console it is reporting belongs to a different user in a
    // different browser context.
    await pollWhileFocusing(
      consolePage,
      async () => (await activeVm.textContent()) ?? '',
      seeded.vmName
    );
    // Same message, second field: `lastVmId` is written from the same broadcast, which
    // is what leaves a trail after somebody logs off.
    await expect(lastVm).toHaveText(seeded.vmName);

    await consolePage.close();

    // `OnDisconnectedAsync` sends `ActiveVirtualMachine` again with a null vm and a null
    // timestamp — the same message and the same groups, which is why the row can go
    // back on its own. Nothing polls this; a client that ignored the null would leave
    // the console showing as occupied forever.
    await expect(activeVm).toHaveText('None', { timeout: 60000 });
    // And Last VM keeps it: the departure clears where they are, not where they were.
    await expect(lastVm).toHaveText(seeded.vmName);
  });

  test('A console names the other user connected to the same VM', async ({
    playerVmAuthenticatedPage: page,
    browser,
  }) => {
    // The watcher is a console of its own this time, on the same VM. `JoinVm` is what
    // subscribes it to the per-VM presence channel, and `ngOnInit` invokes it for
    // whatever VM the route names.
    await authenticateConsoleWithKeycloak(page);
    await page.goto(`${Services.Console.UI}/vm/${seeded.vmId}/console`);
    await expect(page.locator('app-console')).toBeVisible({ timeout: 60000 });

    // Only the vSphere/Unknown options bar has this readout; `app-options-bar2`
    // (Proxmox) renders no connected-users list at all. A seeded VM is `Type=Unknown`,
    // so this is the bar on screen. It is also hidden for a read-only viewer, which is
    // why the watcher is the admin: `readOnly` is false only for a user who can edit
    // the view or the team.
    const connectedUsers = page.locator('.connected-users');
    await expect(connectedUsers).not.toContainText(memberName);

    const memberContext = await browser.newContext({ ignoreHTTPSErrors: true });
    testCleanups.push(() => memberContext.close());
    const consolePage = await openMemberConsole(memberContext);

    // `CurrentVirtualMachineUsers` carries the names of everyone active on this VM in
    // the group it is addressed to, and the bar formats the first two of them. Asserted
    // as "contains": the watcher's own name may be in the list beside the member's, and
    // the order comes from a `ConcurrentDictionary`.
    await pollWhileFocusing(
      consolePage,
      async () => (await connectedUsers.textContent()) ?? '',
      memberName
    );

    await consolePage.close();

    // The disconnect re-sends the list with the departing user left out, which is the
    // half that a client keeping its own tally would get wrong.
    await expect(connectedUsers).not.toContainText(memberName, { timeout: 60000 });
  });
});
