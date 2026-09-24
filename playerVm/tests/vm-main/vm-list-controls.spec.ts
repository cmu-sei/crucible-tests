// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { seedViewWithVm } from '../../vm-helpers';

/**
 * The VM list's own toolbar — everything above the rows on `views/:viewId`. None
 * of it had a test: search and its clear button, the power-state filter, the two
 * IP checkboxes, Sort by Team, and the actions menu with the five power
 * operations and the two "open selected" items.
 *
 * Two constraints shape what these tests can assert, and both are properties of
 * the app rather than of this environment:
 *
 * The search box binds `(keyup)`, not `(input)`. `fill()` sets the value and
 * dispatches `input`, so the filter never runs — the Clear Search button appears
 * (it is driven by the ngModel value) while the rows stay exactly as they were,
 * which reads as "search is broken" in a trace and is really the test typing
 * wrong. Every search here goes through `pressSequentially`.
 *
 * Pending upstream: a seeded VM is `PowerState=Unknown` (see `vm-helpers.ts` for
 * why the API cannot seed anything else), and the list binds
 * `[dtsDisabled]="vm.powerState.toString() === 'Unknown'"`. So no VM in a seeded
 * view can be selected, `selectedVms` cannot leave zero, and the five power
 * operations plus the two "open selected" items can only be covered as far as
 * "offered, and disabled with nothing selected". Driving one of them needs a real
 * hypervisor behind the VM API.
 */
test.describe('View page VM list controls', () => {
  // Two teams: `canSortByTeams$` is `getTeams(viewId).length > 1`, so the Sort by
  // Team checkbox is not rendered at all for a view with only its Admin team. The
  // second team deliberately holds no VM — `filterGroups` only builds a group for
  // a team that owns a row, so the grouped list still shows exactly one panel and
  // the test can name it.
  let seeded: Awaited<ReturnType<typeof seedViewWithVm>>;

  test.beforeAll(async () => {
    seeded = await seedViewWithVm('E2E Vm List Controls', {
      extraTeamNames: ['E2E Second Team'],
    });
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

  test('Search filters the list and Clear Search restores it', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    const search = vmList.getByRole('textbox', { name: 'Search' });
    const vmRow = vmList.getByRole('link', { name: seeded.vmName });

    // A string that cannot match any VM name in any environment: the assertion is
    // "the filter ran", and a term that happened to match something else would
    // leave the row hidden for the wrong reason.
    await search.click();
    await search.pressSequentially('zzz-matches-no-vm');
    await expect(vmRow).toBeHidden();

    // The clear button only exists while `filterString != ''`, so its presence is
    // itself part of the assertion.
    await vmList.getByRole('button', { name: 'Clear Search' }).click();
    await expect(search).toHaveValue('');
    await expect(vmRow).toBeVisible();
    await expect(vmList.getByRole('button', { name: 'Clear Search' })).toHaveCount(0);
  });

  test('Search term is remembered across a reload', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    const search = vmList.getByRole('textbox', { name: 'Search' });

    await search.click();
    await search.pressSequentially('zzz-matches-no-vm');
    await expect(vmList.getByRole('link', { name: seeded.vmName })).toBeHidden();

    await page.reload();

    // Round trip through the persisted UI session: `searchValueChanged` on the way
    // out, and the `uiSession` setter calling `applyFilter(val.searchValue)` on the
    // way back — which is why the *rows* are asserted and not just the input value.
    // A restore that repopulated the box without re-filtering would look right.
    const restoredSearch = page
      .locator('app-vm-list')
      .getByRole('textbox', { name: 'Search' });
    await expect(restoredSearch).toHaveValue('zzz-matches-no-vm', { timeout: 30000 });
    await expect(
      page.locator('app-vm-list').getByRole('link', { name: seeded.vmName })
    ).toBeHidden();
  });

  test('Power-state filter hides a VM in an unmatched state', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    const vmRow = vmList.getByRole('link', { name: seeded.vmName });

    const showFilter = vmList.getByRole('combobox', { name: 'Show' });
    await showFilter.click();
    // Options render in an overlay appended to the body, outside `app-vm-list`.
    await page.getByRole('option', { name: 'Powered On' }).click();

    // Wait for the overlay to be torn down before touching the select again: it
    // closes on an animation and its backdrop swallows the next click while it is
    // still there, which Firefox reaches far more often than Chromium.
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(showFilter).toContainText('Powered On');

    // `applyFilterByPower` keeps only `powerState === 'On'`, and a seeded VM is
    // `Unknown` — so this is a real filter result, not an empty list by accident:
    // the same VM comes back under "All Machines" below.
    await expect(vmRow).toBeHidden();

    await showFilter.click();
    await page.getByRole('option', { name: 'All Machines' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(vmRow).toBeVisible();
  });

  test('Show IPs and IPv4 Only are remembered across a reload', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);

    const showIps = vmList.getByRole('checkbox', { name: 'Show IPs' });
    await expect(showIps).not.toBeChecked();
    await showIps.check();

    // IPv4 Only only exists while Show IPs is on, and starts checked — the session
    // ships with `showIPv4OnlySelected: true`.
    const ipv4Only = vmList.getByRole('checkbox', { name: 'IPv4 Only' });
    await expect(ipv4Only).toBeChecked();
    await ipv4Only.uncheck();

    await page.reload();

    // Both flags travel on their own emitters (`showIPsSelectedChanged`,
    // `showIPv4OnlySelectedChanged`) and are restored by the one `uiSession`
    // setter, so they are asserted together: a restore that read the wrong field
    // would still leave one of them right.
    const restored = page.locator('app-vm-list');
    await expect(restored.getByRole('checkbox', { name: 'Show IPs' })).toBeChecked({
      timeout: 30000,
    });
    await expect(restored.getByRole('checkbox', { name: 'IPv4 Only' })).not.toBeChecked();
  });

  test('Sort by Team groups the list under the owning team', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);
    const vmRow = vmList.getByRole('link', { name: seeded.vmName });

    await vmList.getByRole('checkbox', { name: 'Sort by Team' }).click();

    // Grouping replaces the flat list: `@if (!sortByTeams)` removes the ungrouped
    // container outright, and the rows move inside a collapsed expansion panel per
    // team that owns one. Only the Admin team owns the seeded VM, so the second
    // team gets no panel.
    const adminPanel = vmList.getByRole('button', { name: /Admin/ });
    await expect(adminPanel).toBeVisible();
    await expect(vmRow).toBeHidden();

    await adminPanel.click();
    await expect(vmRow).toBeVisible();

    // Ungrouping puts it back, which is what makes the assertion above about
    // grouping rather than about the row having been destroyed.
    await vmList.getByRole('checkbox', { name: 'Sort by Team' }).click();
    await expect(adminPanel).toHaveCount(0);
    await expect(vmRow).toBeVisible();
  });

  test('Actions menu offers every bulk operation, disabled with nothing selected', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);

    // The trigger doubles as the selection count.
    await vmList.getByRole('button', { name: '0 selected' }).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Clear Selections is the one item that is never disabled — it is a no-op with
    // nothing selected, and its own test below drives the confirmation.
    await expect(menu.getByRole('menuitem', { name: 'Clear Selections' })).toBeEnabled();

    // Pending upstream: these can only be checked in their disabled state. A
    // seeded VM's power state is Unknown, `[dtsDisabled]` therefore blocks
    // selecting it, and `selectedVms.length` cannot leave zero from a browser —
    // see the file comment. Asserting the disabled state is still worth doing: it
    // is the guard that stops a bulk power-off being issued against no VMs, and
    // Revert additionally proves `canRevertVms` reached the template.
    for (const name of [
      'Power On',
      'Power Off',
      'Reboot',
      'Shutdown',
      'Revert',
      'Open in Player tab',
      'Open in browser tab',
    ]) {
      await expect(menu.getByRole('menuitem', { name })).toBeDisabled();
    }
  });

  test('Clear Selections asks for confirmation before clearing', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    const vmList = await openVmList(page);

    await vmList.getByRole('button', { name: '0 selected' }).click();
    await page.getByRole('menuitem', { name: 'Clear Selections' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Are you sure you want to clear your selections?')
    ).toBeVisible();

    // Cancel first: `clearSelections` filters its subscription on `result === true`,
    // so a cancel must reach no further than closing the dialog.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // Then confirm, which runs the real clear path. There is nothing selected to
    // clear (see the file comment), so what this proves is that the path completes
    // — `selectContainer.clearSelection()` resolves against a live container — and
    // that the count is unchanged rather than blanked.
    await vmList.getByRole('button', { name: '0 selected' }).click();
    await page.getByRole('menuitem', { name: 'Clear Selections' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(vmList.getByRole('button', { name: '0 selected' })).toBeVisible();
  });

  test('Search typed while sorted by team is remembered', async ({
    playerVmAuthenticatedPage: page,
  }) => {
    // Regression: `applyFilter` cleared the current team panel's selection without
    // checking there was one, and `currentPanelIndex` is only set by clicking a
    // panel — so typing in the search box on a freshly grouped list threw
    // `Cannot read properties of undefined (reading 'clearSelection')`. The app's
    // global handler swallowed it and the rows still filtered, which is why it went
    // unnoticed; what it actually broke was the line after the throw,
    // `searchValueChanged.emit(filterValue)`. The term never reached the UI session,
    // so grouping the list silently stopped the search box being remembered.
    //
    // Hence: no panel is clicked before typing, and the assertion is on what the
    // *persisted* session did rather than on the filtered rows, which were never
    // the part that broke.
    const vmList = await openVmList(page);
    await vmList.getByRole('checkbox', { name: 'Sort by Team' }).click();
    await expect(vmList.getByRole('button', { name: /Admin/ })).toBeVisible();

    const search = vmList.getByRole('textbox', { name: 'Search' });
    await search.click();
    await search.pressSequentially('zzz-matches-no-vm');

    await page.reload();

    await expect(
      page.locator('app-vm-list').getByRole('textbox', { name: 'Search' })
    ).toHaveValue('zzz-matches-no-vm', { timeout: 30000 });
  });
});
