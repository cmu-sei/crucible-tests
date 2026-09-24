// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { authenticateConsoleWithKeycloak } from '../../../console/fixtures';
import { tokenUserId } from '../../../player-helpers';
import { seedViewWithVm, SeededViewWithVm } from '../../vm-helpers';
import { watchHub } from '../../hub-watch';

/**
 * Every hub invocation the two clients make, driven from a browser and checked against the server's answer.
 *
 * The other two files here assert what arrives: a row appearing because `VmCreated` was delivered, a name
 * appearing because presence was broadcast. Between them they *cause* four invocations —
 * `JoinView`, `JoinViewUsers`, `JoinVm`, `SetActiveVirtualMachine` — and leave five untouched:
 * `LeaveView`, `LeaveViewUsers`, `LeaveVm`, `LeaveUser` and `UnsetActiveVirtualMachine`, plus `JoinUser`
 * and the whole of `/hubs/progress`.
 *
 * The untouched ones are the ones with no readout at all, which is why they need a file of their own. A
 * `Join*` at least shows up as something arriving later; a `Leave*` succeeds by making broadcasts *stop*,
 * and nothing on screen distinguishes "the group was left" from "the invocation was rejected and the
 * connection stayed up". Both clients invoke without awaiting - `this.hubConnection.invoke('LeaveVm', vmId)`,
 * promise dropped - so a hub that renamed a method or changed its parameter count breaks these silently in
 * production, and the only visible consequence is presence rows that never clear and broadcasts sent to a
 * connection that has gone.
 *
 * So the assertion is the completion frame. {@link watchHub} reads the socket and waits for the server's
 * answer to the exact invocation, which is the one thing that says the method existed under that name with
 * that many arguments. SignalR dispatches on *both*, so an argument added to a hub method is as invisible
 * from the client as a rename.
 *
 * Each test also asserts the DOM change that is supposed to *cause* the invocation - the component gone, the
 * tab switched - before waiting for the frame. Without that a broken navigation and a broken hub call fail
 * identically, and the failure that matters would be reported against the wrong repository.
 *
 * The leak `console-presence.spec.ts` documents applies here too: `SetActiveVirtualMachine` writes a
 * `VmUsers` row per (user, team) that no endpoint deletes and nothing cascades. Deleting the view leaves the
 * admin's row orphaned on ids that no longer resolve, invisible to every list in the estate.
 */
test.describe('Player VM hub invocations', () => {
  let seeded: SeededViewWithVm;
  /** The admin's own user id. They follow themselves in the `JoinUser` test - see there for why. */
  let userId: string;

  test.beforeAll(async () => {
    seeded = await seedViewWithVm('E2E Vm Hub Invocations');
    userId = tokenUserId(seeded.token);
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  /**
   * Navigate the way the app does, without reloading it.
   *
   * This matters because `ngOnDestroy` is the only thing that invokes `LeaveView`, `LeaveViewUsers`,
   * `LeaveVm` and `LeaveUser`, and a browser closing a page or following a link to a new document does not
   * run it. A real session leaves these routes through the Angular router - a link, a tab, the Back button -
   * so that is what has to be reproduced, and `page.goto` would test nothing.
   *
   * `pushState` alone does not reach the router: it changes the URL and Angular never hears about it. Back
   * then Forward does, because both produce a `popstate` the router's location subscription acts on, and it
   * is the same event a user pressing Back produces. The Back lands on the URL already displayed, which the
   * router ignores as a same-URL navigation; the Forward is the one that navigates.
   */
  const navigateInApp = async (page: Page, url: string): Promise<void> => {
    const target = new URL(url);

    await page.evaluate((to) => history.pushState(null, '', to), `${target.pathname}${target.search}`);
    await page.goBack();
    await page.goForward();
  };

  /** Open the seeded view in the VM UI and wait until it has joined the view's group. */
  const openView = async (page: Page) => {
    const hub = watchHub(page, '/hubs/vm');

    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await expect(
      page.locator('app-vm-list').getByRole('link', { name: seeded.vmName })
    ).toBeVisible({ timeout: 60000 });
    await hub.expectCompleted('JoinView', {
      match: (args) => args.includes(seeded.viewId),
      why: 'Nothing below can be a *leave* until the page has joined.',
    });

    return hub;
  };

  /**
   * Open the seeded VM's console in the Console UI, as the admin. Attach the watcher before calling this:
   * the connection is opened during the console page's `ngOnInit`.
   */
  const openConsole = async (page: Page) => {
    await authenticateConsoleWithKeycloak(page);
    await page.goto(`${Services.Console.UI}/vm/${seeded.vmId}/console`);
    // A seeded VM is `Type=Unknown`, which mounts the same components as vSphere. They never reach a
    // screen, which nothing here depends on - the hub calls are made from `ngOnInit`, not from the console.
    await expect(page.locator('app-console')).toBeVisible({ timeout: 60000 });
  };

  /**
   * `vm-main.component.ngOnDestroy` invokes `LeaveView`, and this is the only thing in either suite that
   * runs it. `/usage` is the destination only because it is a sibling route that does not need a view.
   */
  test('Leaving a view page leaves the view group', async ({ playerVmAuthenticatedPage: page }) => {
    const hub = await openView(page);

    await navigateInApp(page, `${Services.PlayerVM.UI}/usage`);
    // The component going is what invokes it, so this is the precondition rather than a second assertion:
    // a router that never moved would otherwise be reported as a hub that never answered.
    await expect(page.locator('app-vm-main')).toHaveCount(0, { timeout: 30000 });

    await hub.expectCompleted('LeaveView', {
      match: (args) => args.includes(seeded.viewId),
      why:
        'The connection keeps receiving this view\'s broadcasts after the page has left it, and the ' +
        'client has no handler for a view it is no longer showing.',
    });
  });

  /**
   * The User Follow tab is a lazy `ng-template matTabContent`, so switching tabs destroys `app-user-list`.
   * Its `@Input() set isActive` is what invokes both `JoinViewUsers` and `LeaveViewUsers` - Material sets it
   * to false as the selection changes, while the content is still attached.
   */
  test('Switching away from User Follow leaves the view users group', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const hub = await openView(page);

    await page.getByRole('tab', { name: 'User Follow' }).click();
    await expect(page.locator('app-user-list')).toBeVisible({ timeout: 30000 });
    await hub.expectCompleted('JoinViewUsers', {
      match: (args) => args.includes(seeded.viewId),
      why: 'The tab draws its teams from this invocation\'s *result*, so it cannot have been rejected.',
    });

    await page.getByRole('tab', { name: 'VM List' }).click();
    await expect(page.locator('app-user-list')).toHaveCount(0, { timeout: 30000 });

    await hub.expectCompleted('LeaveViewUsers', {
      match: (args) => args.includes(seeded.viewId),
      why:
        'Presence updates for every user in the view keep arriving at a page showing the VM list, where ' +
        'nothing consumes them.',
    });
  });

  /**
   * `console-page.component.ngOnDestroy` invokes `LeaveVm`. The destination is the user-follow route because
   * it is the only other route the Console UI has that is not the not-found page.
   */
  test('Leaving a console leaves that VM\'s presence channel', async ({ page }) => {
    const hub = watchHub(page, '/hubs/vm');

    await openConsole(page);
    await hub.expectCompleted('JoinVm', {
      match: (args) => args.includes(seeded.vmId),
      why: 'Nothing below can be a *leave* until the console has joined.',
    });

    await navigateInApp(
      page,
      `${Services.Console.UI}/user/${userId}/view/${seeded.viewId}/console?teamId=${seeded.teamId}`
    );
    // `app-console` is inside both pages, so the page component is what distinguishes them.
    await expect(page.locator('app-console-page')).toHaveCount(0, { timeout: 30000 });

    await hub.expectCompleted('LeaveVm', {
      match: (args) => args.includes(seeded.vmId),
      why:
        'This connection stays in the VM\'s presence channel, so everyone still on that console is told ' +
        'about a viewer who has gone.',
    });
  });

  /**
   * `JoinUser` and `LeaveUser`, from the Console UI's follow route.
   *
   * The admin follows *themselves*, which is not a trick: the hub's only check is that the caller can see
   * the team (`visibility.TeamIds.Contains(teamId)`), the seeded Admin team is one the admin is a member of,
   * and the VM UI's user list offers every user in the view including the caller. Following someone else
   * would need a second Keycloak account, which `console-presence.spec.ts` already pays for to assert what
   * only two users can show; nothing about these two invocations needs it.
   */
  test('Following a user joins that user\'s group, and leaving it leaves', async ({ page }) => {
    const hub = watchHub(page, '/hubs/vm');

    await authenticateConsoleWithKeycloak(page);
    await page.goto(
      `${Services.Console.UI}/user/${userId}/view/${seeded.viewId}/console?teamId=${seeded.teamId}`
    );
    await expect(page.locator('app-user-follow-page')).toHaveCount(1, { timeout: 60000 });

    // Three arguments, and the hub rejects a team the caller cannot see with a `HubException` - which is
    // exactly the error the client drops on the floor, and which arrives here as the completion's `error`.
    await hub.expectCompleted('JoinUser', {
      match: (args) => args.length === 3 && args.includes(userId),
      why: 'The page then shows nobody: the followed user\'s console comes from this invocation\'s result.',
    });

    await navigateInApp(page, `${Services.Console.UI}/vm/${seeded.vmId}/console`);
    await expect(page.locator('app-user-follow-page')).toHaveCount(0, { timeout: 30000 });

    await hub.expectCompleted('LeaveUser', {
      // Two arguments, not three: the hub takes the team from the groups it derives for the view.
      match: (args) => args.length === 2 && args.includes(userId),
      why: 'The connection keeps being told where a user it is no longer following has gone.',
    });
  });

  /**
   * `UnsetActiveVirtualMachine`, the one invocation that takes no arguments - and the one that keeps a
   * console from being reported as occupied by someone who has switched away from the tab. The hub's
   * `OnDisconnectedAsync` does the same work, so a session that ends by closing the browser is covered
   * either way; this is the path a session that stays open takes, and it is the only one a client can get
   * wrong.
   */
  test('A console losing focus unsets the active VM', async ({ page }) => {
    const hub = watchHub(page, '/hubs/vm');

    await openConsole(page);

    // `ngOnInit` only claims the VM `if (document.hasFocus())`, which a page that has never been
    // interacted with may not report. `window:focus` is the other way in and the one a user switching back
    // to the tab takes.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await hub.expectCompleted('SetActiveVirtualMachine', {
      match: (args) => args.includes(seeded.vmId),
      why: 'There is then nothing to unset, and the assertion below would pass on a hub doing no work.',
    });

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));

    await hub.expectCompleted('UnsetActiveVirtualMachine', {
      // No arguments at all: the hub takes the user from the connection. A client that started passing one
      // would find no method with that signature, and SignalR would reject it by name and arity.
      match: (args) => args.length === 0,
      why:
        'The user is left showing as active on this VM to everyone following them, until the connection ' +
        'itself drops.',
    });
  });

  /**
   * `/hubs/progress`, the second hub, which nothing else in either suite connects to.
   *
   * `NotificationService` dials it from the options bar and invokes `Join(vmId)`; the hub answers power-state
   * and revert progress on it. A rejected `Join` leaves the toolbar's task list permanently empty, which is
   * indistinguishable from a VM with nothing running on it - and `Join` takes a `string`, not a `Guid`, so it
   * is also the one hub method whose parameter type could change without the client noticing.
   */
  test('A console joins the progress hub for its VM', async ({ page }) => {
    const progress = watchHub(page, '/hubs/progress');

    await authenticateConsoleWithKeycloak(page);
    await page.goto(`${Services.Console.UI}/vm/${seeded.vmId}/console`);
    // The options bar is what connects, and it is deferred on the VM's type being vSphere or Unknown.
    await expect(page.locator('app-options-bar')).toHaveCount(1, { timeout: 60000 });

    await progress.expectCompleted('Join', {
      match: (args) => args.includes(seeded.vmId),
      why: 'The toolbar reports no task ever running on this VM, however long one takes.',
    });
  });
});
