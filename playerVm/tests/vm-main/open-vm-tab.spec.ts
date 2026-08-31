// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { seedViewWithVm } from '../../vm-helpers';

/**
 * Opening a VM from the list. This is the whole point of the page — the tab strip
 * on `views/:viewId` grows a tab per opened VM, each one an `app-focused-app`
 * iframe, and the set of open tabs is part of the persisted UI session. Nothing
 * touched any of it: `app-focused-app` was reachable from no test in either suite,
 * and neither was `remove()` or `openInNewTab()`.
 *
 * The seeded VM's `url` points at the VM API's readiness endpoint. It needs to be
 * *something* — `app-focused-app` iframes `vm.url` verbatim — and this is the
 * cheapest thing in the deployment that answers 200 with no framing headers and
 * nothing to load. What is asserted is the `src` the UI computed, never anything
 * about the page inside: a real VM console is console.ui's route, which has its
 * own specs, and pointing this at one would make a test of the tab strip fail
 * whenever a console failed to connect.
 */
test.describe('View page opened VM tabs', () => {
  let seeded: Awaited<ReturnType<typeof seedViewWithVm>>;
  /** What `vm.url` was seeded as; the iframe `src` is this plus a theme param. */
  let vmUrl: string;

  test.beforeAll(async () => {
    vmUrl = `${Services.PlayerVM.API.replace(/\/$/, '')}/api/health/ready`;
    seeded = await seedViewWithVm('E2E Vm Main Open', { vmUrl });
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  /** The VM list, with the seeded VM's row visible. */
  async function openVmList(page) {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    const vmList = page.locator('app-vm-list');
    await expect(vmList.getByRole('link', { name: seeded.vmName })).toBeVisible({
      timeout: 30000,
    });
    return vmList;
  }

  test('Clicking a VM opens a tab holding the VM in an iframe', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    await vmList.getByRole('link', { name: seeded.vmName }).click();

    // The row is an anchor with a real `href`, and `openHere` cancels the
    // navigation only when the VM is `embeddable` and Ctrl is not held. So "the
    // page did not navigate" is the behaviour, not a side effect of it.
    await expect(page).toHaveURL(new RegExp(`/views/${seeded.viewId}$`));

    const vmTab = page.getByRole('tab', { name: seeded.vmName });
    await expect(vmTab).toBeVisible();
    await expect(vmTab).toHaveAttribute('aria-selected', 'true');

    // `addThemeQueryParam` is applied by the row and again by `app-focused-app`;
    // `searchParams.set` makes that idempotent, so the src is the VM url with one
    // theme param. The theme itself comes from the user's saved preference, so it
    // is asserted as present rather than pinned to a value.
    const iframe = page.locator('app-focused-app iframe');
    await expect(iframe).toHaveAttribute('src', new RegExp(`^${escapeRegExp(vmUrl)}\\?theme=`));
  });

  test('Closing an opened tab removes it and returns to the VM List', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    await vmList.getByRole('link', { name: seeded.vmName }).click();
    await expect(page.getByRole('tab', { name: seeded.vmName })).toBeVisible();

    // The close button lives inside the tab's own label, next to the name.
    await page.getByRole('button', { name: `Close ${seeded.vmName}` }).click();

    await expect(page.getByRole('tab', { name: seeded.vmName })).toHaveCount(0);
    await expect(page.locator('app-focused-app')).toHaveCount(0);
    // `remove()` selects tab 0 before splicing, which matters: leaving
    // `selectedIndex` pointing past the end of a shortened tab list is how a tab
    // strip ends up with nothing showing.
    await expect(page.getByRole('tab', { name: 'VM List' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('Open in Browser Tab opens the VM in a real browser tab', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    await vmList.getByRole('link', { name: seeded.vmName }).click();
    await expect(page.getByRole('tab', { name: seeded.vmName })).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Open in Browser Tab' }).click(),
    ]);

    // `openInNewTab` hands `window.open` the themed url — the same string the
    // iframe would have had, which is what makes the two ways of opening a VM
    // equivalent.
    await expect(popup).toHaveURL(new RegExp(`^${escapeRegExp(vmUrl)}\\?theme=`));
    await popup.close();

    // Selecting tab 0 is the other half of what the handler does, and it does
    // happen — unlike the removal the next test is about.
    await expect(page.getByRole('tab', { name: 'VM List' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('Open in Browser Tab removes the in-app tab it popped out', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // Regression: `openInNewTab` dropped the VM from `openVms` but left it in the
    // persisted session, and the session replay in `ngOnInit` re-added the tab it
    // had just removed — so the VM ended up open twice, once in a browser tab and
    // once behind the VM List, and a reload brought the in-app one back. Popping
    // out is a move, not a copy.
    //
    // The reload is the load-bearing half of this test. The replay is asynchronous,
    // so an immediate "the tab is gone" assertion can win a race against it and go
    // green against the bug; what the session holds after a reload cannot.
    const vmList = await openVmList(page);
    await vmList.getByRole('link', { name: seeded.vmName }).click();
    await expect(page.getByRole('tab', { name: seeded.vmName })).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Open in Browser Tab' }).click(),
    ]);
    await popup.close();

    await expect(page.getByRole('tab', { name: seeded.vmName })).toHaveCount(0);
    await expect(page.locator('app-focused-app')).toHaveCount(0);

    // And it stays gone: the tab is only really closed if the session forgot it.
    await page.reload();
    await expect(page.getByRole('tab', { name: 'VM List' })).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByRole('tab', { name: seeded.vmName })).toHaveCount(0);
  });

  test('An opened VM tab is restored after a reload', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    await vmList.getByRole('link', { name: seeded.vmName }).click();
    await expect(page.getByRole('tab', { name: seeded.vmName })).toBeVisible();

    await page.reload();

    // `ngOnInit` replays `session.openedVms` through `onOpenVmHere(vm, true)` and
    // then restores `tabOpened`, so the restored state has to bring back both the
    // tab and its content — the iframe is asserted because a tab restored without
    // its url is an empty pane with the right label.
    const restoredTab = page.getByRole('tab', { name: seeded.vmName });
    await expect(restoredTab).toBeVisible({ timeout: 30000 });
    await expect(restoredTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('app-focused-app iframe')).toHaveAttribute(
      'src',
      new RegExp(`^${escapeRegExp(vmUrl)}\\?theme=`)
    );

    // Cleared so the persisted session does not outlive the test. The browser
    // context is per-test today, but `openedVms` is the one part of this session
    // that would follow a reused profile into another spec and add a tab it never
    // asked for.
    await page.getByRole('button', { name: `Close ${seeded.vmName}` }).click();
    await expect(page.getByRole('tab', { name: seeded.vmName })).toHaveCount(0);
  });
});

/** The seeded url is built from an env-driven base, so it is not a safe regex. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
