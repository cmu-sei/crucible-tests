// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { watchHub } from '../../hub-watch';
import {
  createVm,
  deleteVm,
  getTeamVms,
  seedViewWithVm,
  SeededViewWithVm,
  updateVm,
} from '../../vm-helpers';

/**
 * `VmHub` driven over a live connection: a VM created, renamed or deleted by another
 * client, landing in a list a browser already has open.
 *
 * Nothing else asserts this. `vm.api`'s own suite drives the event handlers into a
 * recording hub context and checks the *group names* they send to, and
 * `tests/contract/signalr-contract.spec.ts` checks that `vm.ui` registers handlers of
 * the right arity for the names the hub sends — but no test in either repository has
 * ever run a real SignalR connection from a browser to this hub. Between the two
 * halves sit the things only a live connection can fail: the connection itself
 * (`${basePath}/hubs/vm` and the bearer token it carries), `JoinView` actually being
 * invoked for the view on screen, and the store update reaching the table binding.
 * Every one of those breaks silently — the list simply stops moving, and looks
 * exactly like a list nobody has changed.
 *
 * What makes these tests worth their runtime is the counter: **the VM list is fetched
 * once and never refetched.** `vm-list.component` calls `GetViewVms` behind a
 * `hasLoadedVms` guard and there is no polling anywhere in `vm.ui`, so every test here
 * counts responses on `/views/{viewId}/vms` and asserts the count did not move across
 * the mutation. Without that, a passing assertion would be equally consistent with the
 * page having quietly reloaded its list, and the hub being dead. With it, the row can
 * only have arrived over the connection.
 *
 * The "other client" is the VM API called directly over HTTP, which is not a contrived
 * stand-in: Caster and Steamfitter create and destroy a view's VMs through that API
 * while people are sat in front of this page, and that is the scenario the hub exists
 * for.
 *
 * Each test seeds its own view, because two of them change what the view contains.
 */
test.describe('Live VM list updates', () => {
  let seeded: SeededViewWithVm;

  /** Cleanup for anything a test made beyond the seed, drained in `afterEach`. */
  const cleanups: Array<() => Promise<void>> = [];

  test.beforeEach(async () => {
    seeded = await seedViewWithVm('E2E Vm Realtime');
  });

  test.afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      await cleanup();
    }
    await seeded?.cleanup();
  });

  /**
   * Start counting the page's requests for this view's VM list. Must be called
   * before the navigation that loads it, so the initial fetch is counted too — a
   * count that never moved *and never started* would mean the matcher is wrong
   * rather than that the page behaved.
   */
  const countVmListFetches = (page: Page): (() => number) => {
    let count = 0;
    page.on('response', (response) => {
      if (response.url().includes(`/views/${seeded.viewId}/vms`)) {
        count += 1;
      }
    });
    return () => count;
  };

  /**
   * Open the view page, wait until it is both showing the seeded VM and subscribed to
   * the view's updates, and hand back the list and the fetch counter. Locators are
   * scoped to `app-vm-list`: the VM List tab has no `matTabContent`, so its content
   * stays in the DOM after a tab switch.
   *
   * Waiting for `JoinView` to *complete* is not belt-and-braces, it is what makes these
   * tests deterministic. The list is drawn from an HTTP response, and `SignalRService`
   * connects independently and a beat later — so a mutation fired the moment the row
   * appears is routinely broadcast before this page is in the view's group, and a
   * broadcast sent to a group nobody has joined is simply gone. (That is also true of a
   * real session: a change made during the second it takes to connect is never seen.
   * Nothing here can fix that, so the tests wait for the state a user spends the session
   * in.)
   */
  const openVmList = async (page: Page) => {
    const hub = watchHub(page, '/hubs/vm');
    const fetches = countVmListFetches(page);
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    const list = page.locator('app-vm-list');
    await expect(list.getByRole('link', { name: seeded.vmName })).toBeVisible({
      timeout: 30000,
    });

    const loaded = fetches();
    expect(
      loaded,
      'The VM list was drawn without a request this counter recognised — the URL it matches on has moved, and "no refetch" below would pass no matter what the page did'
    ).toBeGreaterThan(0);

    await hub.expectCompleted('JoinView', {
      match: (args) => args.includes(seeded.viewId),
      why:
        'Until it completes the page is subscribed to nothing, so no update below could arrive: either ' +
        'the connection failed (token, path) or the hub rejected the invocation.',
    });

    return { list, fetches, loaded };
  };

  test('A VM created by another client appears in an open list', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const { list, fetches, loaded } = await openVmList(page);

    const addedName = `E2E Vm Realtime Added VM ${Date.now()}`;
    const added = await createVm(seeded.token, addedName, [seeded.teamId]);
    cleanups.push(() => deleteVm(seeded.token, added.id));

    // `VmCreatedSignalRHandler` sends `VmCreated` to the view group this page joined,
    // and `vm.ui` puts it in the store; the table's data source is bound to the store,
    // so the row is the whole round trip.
    await expect(list.getByRole('link', { name: addedName })).toBeVisible({ timeout: 30000 });

    expect(fetches(), 'The page refetched the VM list, so the new row proves nothing about the hub').toBe(loaded);
  });

  test('A VM renamed by another client is renamed in the open list', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const { list, fetches, loaded } = await openVmList(page);

    const renamed = `E2E Vm Realtime Renamed VM ${Date.now()}`;
    const updated = await updateVm(seeded.token, seeded.vmId, { name: renamed });
    // Asserted first so a failure below is about delivery and not about the API
    // having refused the rename.
    expect(updated.name).toBe(renamed);

    // The narrowest test of `modifiedProperties` there is. `VmUpdated` carries the
    // whole VM *and* a list of camel-cased property names, and the client copies only
    // the properties on that list onto the stored entity — so a name missing from the
    // list leaves the old label on screen, and a name that is not a property of the
    // client's `Vm` writes `undefined` and blanks it. Both keep the connection up.
    await expect(list.getByRole('link', { name: renamed })).toBeVisible({ timeout: 30000 });
    await expect(list.getByRole('link', { name: seeded.vmName, exact: true })).toHaveCount(0);

    expect(fetches(), 'The page refetched the VM list, so the new label proves nothing about the hub').toBe(loaded);
  });

  test('A VM deleted by another client disappears from the open list', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const { list, fetches, loaded } = await openVmList(page);

    await deleteVm(seeded.token, seeded.vmId);
    // `deleteVm` warns rather than throws, so confirm the record is actually gone:
    // otherwise a delete the API rejected and a `VmDeleted` that never arrived look
    // identical from the browser.
    expect((await getTeamVms(seeded.token, seeded.teamId)).map((x) => x.id)).not.toContain(
      seeded.vmId
    );

    // `VmDeleted` carries only the id — the row going is the client having found the
    // entity by it. A VM whose teams were never loaded is broadcast to `Clients.All`
    // instead, which this path deliberately does not take: the VM was deleted through
    // the service that loads them.
    await expect(list.getByRole('link', { name: seeded.vmName })).toHaveCount(0, {
      timeout: 30000,
    });

    expect(fetches(), 'The page refetched the VM list, so the missing row proves nothing about the hub').toBe(loaded);
  });
});
