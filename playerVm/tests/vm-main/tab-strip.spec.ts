// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { isUsageLoggingEnabled, seedViewWithVm } from '../../vm-helpers';
import { requirePrecondition } from '../../../shared-fixtures';

/**
 * `views/:viewId` — the page a Player user spends the session on. Everything the
 * VM UI does for a view hangs off the tab strip this renders, and five of the six
 * components it mounts were reachable from no test in either suite.
 *
 * Each tab is one test rather than one long walk because they mount independently
 * and fail independently: `mat-tab` bodies other than the VM List's are wrapped in
 * `<ng-template matTabContent>`, so clicking the tab is the *only* thing that
 * instantiates the component. A single test that clicked all five would report the
 * first breakage and say nothing about the rest.
 *
 * Locators are scoped to the component element (`app-iso-list`, `app-user-list`, …)
 * rather than to a `tabpanel` role. Two reasons: the assertion "this component
 * mounted" is exactly what a lazy tab is worth testing for, and the VM List tab has
 * no `matTabContent`, so its content stays in the DOM after a switch — a page-wide
 * `getByRole('textbox', { name: 'Search' })` matches both the VM list's search box
 * and the one belonging to whichever tab is now showing.
 */
test.describe('View page tab strip', () => {
  // One view for the whole file: nothing here mutates it, and the tabs that read
  // permissions read them from the seeding user, who is the view's creator.
  let seeded: Awaited<ReturnType<typeof seedViewWithVm>>;
  let usageLoggingEnabled = false;

  test.beforeAll(async () => {
    seeded = await seedViewWithVm('E2E Vm Main Tabs');
    usageLoggingEnabled = await isUsageLoggingEnabled(seeded.token);
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  // No per-test reset of the persisted UI session (selected tab, search string,
  // opened VMs — localStorage key `akita-vm-ui`, written by `persistState` in
  // main.ts). Nothing clears it because nothing has to: `page` is a fresh browser
  // context per test, so each test starts with an empty origin. If this app ever
  // opts into the suite's shared `storageState`, the tests that assert a default
  // (this one lands on tab 0; the reload test below decides what "restored"
  // means) need that key removed first, because a reused profile carries the
  // previous test's tab selection.

  test('View page opens on the VM List tab with the whole tab strip', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);

    const vmListTab = page.getByRole('tab', { name: 'VM List' });
    await expect(vmListTab).toBeVisible({ timeout: 30000 });
    // Every tab the seeding user's permissions allow. `admin` holds the Keycloak
    // Administrator realm role, which maps to every Player system permission, so
    // the three permission-gated tabs (Usage Logging, Networks, Files) all render.
    // A deployment where they did not would be a permissions regression, not an
    // environment difference — hence a plain assertion and not a precondition.
    await expect(page.getByRole('tab', { name: 'User Follow' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Usage Logging' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Networks' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Files' })).toBeVisible();

    // `selectedTab` defaults to 0 and the VM list is not lazy, so this is the tab
    // the page lands on with no persisted session.
    await expect(vmListTab).toHaveAttribute('aria-selected', 'true');

    const vmList = page.locator('app-vm-list');
    await expect(vmList.getByText('Virtual Machines')).toBeVisible();
    await expect(vmList.getByRole('link', { name: seeded.vmName })).toBeVisible();

    // Navigated directly rather than embedded, so the VM UI draws its own topbar.
    // The iframe test below is the other half of this assertion.
    await expect(page.locator('app-topbar')).toBeVisible();
  });

  test('User Follow tab mounts the user list with a panel per team', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'User Follow' }).click();

    const userList = page.locator('app-user-list');
    await expect(userList).toBeVisible({ timeout: 30000 });
    await expect(userList.getByRole('button', { name: 'Expand All' })).toBeVisible();
    await expect(userList.getByRole('button', { name: 'Collapse All' })).toBeVisible();

    // `[teams]="teams$ | async"` — the view's teams as the VM API reports them,
    // which for a seeded view is the single Admin team the Player API created.
    await expect(userList.getByRole('button', { name: /Admin/ })).toBeVisible();
  });

  test('Usage Logging tab mounts the session form', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // The tab is rendered either way and `[disabled]="!usageLoggingEnabled"` is
    // what changes, so this cannot be asserted unconditionally: clicking a
    // disabled `mat-tab` mounts nothing and the test would fail on a deployment
    // that is configured exactly as intended. Not seedable — it is
    // `VmUsageLogging:Enabled` on the API.
    requirePrecondition(
      usageLoggingEnabled,
      'VM usage logging is disabled on this VM API (VmUsageLogging:Enabled), which disables the Usage Logging tab'
    );

    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Usage Logging' }).click();

    const usageLogging = page.locator('app-vm-usage-logging');
    await expect(usageLogging).toBeVisible({ timeout: 30000 });
    await expect(usageLogging.getByRole('textbox', { name: 'Log Name' })).toBeVisible();
    await expect(usageLogging.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('Networks tab mounts network permissions', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Networks' }).click();

    const networks = page.locator('app-network-permissions');
    await expect(networks).toBeVisible({ timeout: 30000 });
    await expect(
      networks.getByRole('heading', { name: 'Network Permissions' })
    ).toBeVisible();
    // `[canManage]="canManageNetworks$ | async"` is true for this user, so the
    // creation form is present rather than just the read-only list.
    await expect(networks.getByRole('combobox', { name: 'Provider Type' })).toBeVisible();
  });

  test('Files tab mounts the ISO list', async ({ playerVmAuthenticatedPage: page }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);
    await page.getByRole('tab', { name: 'Files' }).click();

    const isoList = page.locator('app-iso-list');
    await expect(isoList).toBeVisible({ timeout: 30000 });
    // Upload appears for a user with an upload permission and *not* in all-views
    // mode; the toggle appears for a user who may view all views. Both are true
    // for the seeding user, which is why the pair is asserted together — they are
    // the two halves of `showIsos$`.
    await expect(isoList.getByRole('button', { name: 'Upload' })).toBeVisible();
    await expect(isoList.getByText('Show ISOs from all views')).toBeVisible();
  });

  test('Selected tab survives a reload', async ({ playerVmAuthenticatedPage: page }) => {
    await page.goto(`${Services.PlayerVM.UI}/views/${seeded.viewId}`);

    const filesTab = page.getByRole('tab', { name: 'Files' });
    await expect(filesTab).toBeVisible({ timeout: 30000 });
    await filesTab.click();
    await expect(page.locator('app-iso-list')).toBeVisible();

    await page.reload();

    // `ngOnInit` restores `selectedTab` from the persisted session, and the
    // restored index has to re-mount the lazy content — a restore that selected
    // the tab without instantiating the component would look right and be empty.
    await expect(page.getByRole('tab', { name: 'Files' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 30000 }
    );
    await expect(page.locator('app-iso-list')).toBeVisible();
    await expect(page.locator('app-iso-list').getByText('Show ISOs from all views')).toBeVisible();
  });

  test('Unknown view renders View Not Found with no tab strip', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // The all-zero uuid is well-formed, so it takes the real lookup path rather
    // than the "not a uuid" short-circuit: the teams request comes back empty,
    // `viewExists$` goes false, and with no usage-logging sessions for that id
    // `hasUsageData$` is false too, which is the only combination that reaches
    // `app-page-not-found`.
    await page.goto(`${Services.PlayerVM.UI}/views/00000000-0000-0000-0000-000000000000`);

    await expect(page.locator('app-page-not-found')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('View Not Found')).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
    await expect(page.locator('app-vm-list')).toHaveCount(0);
  });

  test('Embedded in an iframe the tab strip renders without its own topbar', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // How every real user sees this page: Player's app-view embeds the VM UI in an
    // iframe, and `hideTopbar = this.inIframe()` suppresses the VM UI's own topbar
    // so Player's is the only one. Both suites otherwise navigate the VM UI's
    // routes directly, which never takes that branch — so the embedded rendering
    // has never been exercised, in either repository.
    //
    // The host page is synthesised on the VM UI's own origin instead of driving
    // Player: same origin means the OIDC session already in this context carries
    // into the frame with no second login, and the test then depends on the VM
    // UI's behaviour rather than on Player's view page finding an application to
    // embed. Player's own embedding is Player's to test.
    const hostUrl = `${Services.PlayerVM.UI.replace(/\/$/, '')}/e2e-embed-host`;
    const embeddedUrl = `${Services.PlayerVM.UI}/views/${seeded.viewId}`;

    await page.route(hostUrl, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body:
          '<!doctype html><html><body style="margin:0">' +
          `<iframe title="embedded" src="${embeddedUrl}" ` +
          'style="width:100vw;height:100vh;border:0"></iframe>' +
          '</body></html>',
      })
    );

    await page.goto(hostUrl);
    const embedded = page.frameLocator('iframe[title="embedded"]');

    await expect(embedded.getByRole('tab', { name: 'VM List' })).toBeVisible({
      timeout: 30000,
    });
    await expect(embedded.locator('app-vm-list').getByRole('link', { name: seeded.vmName })).toBeVisible();
    await expect(embedded.getByRole('tab', { name: 'Files' })).toBeVisible();

    // The point of the test: no topbar inside the frame. `hideTopbar` gates an
    // `@if`, so a regression leaves a second topbar stacked under Player's.
    await expect(embedded.locator('app-topbar')).toHaveCount(0);
  });
});
