// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createMselDataField,
  createRenderableScenarioEvent,
  setScenarioEventFieldValue,
  getScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  tempBlueprintName,
} from '../../test-helpers';

const IP_FIELD = 'Attacker IP';
const NETWORK_FIELD = 'Target Network';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    // Seed: a MSEL with just a Description, one IP Address and one Network field. The fields
    // go in before any event, so each event gets a DataValue for them. Not the standard set:
    // every DataValue is broadcast over SignalR, and with stateful reconnect a closed page
    // from another worker can stall those broadcasts, and the request, once its buffer fills.
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    await createMselDataField(token, mselId, { name: 'Description', dataType: 'String', displayOrder: 1 });
    await createMselDataField(token, mselId, { name: IP_FIELD, dataType: 'IpAddress', displayOrder: 2 });
    await createMselDataField(token, mselId, { name: NETWORK_FIELD, dataType: 'Network', displayOrder: 3 });
  });

  test.afterEach(async () => {
    // Deleting the MSEL cascades to its events and data fields.
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('IP Address and Network fields reject bad values and block Save', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    const description = tempBlueprintName('TestBP-IpEvent');
    const { id: eventId } = await createRenderableScenarioEvent(token, mselId, description);

    // 1. Open the event's Edit dialog
    await navigateToMselSection(page, mselId, 'Scenario Events');
    const eventRow = await findScenarioEventRow(page, description);
    await eventRow.getByRole('button', { name: /Action List/i }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Event' });
    await expect(dialog).toBeVisible({ timeout: 10000 });
    const save = dialog.getByRole('button', { name: /^Save$/ });
    const ipInput = dialog.getByRole('textbox', { name: IP_FIELD });
    const networkInput = dialog.getByRole('textbox', { name: NETWORK_FIELD });
    // a has: locator is resolved inside each candidate, so it must not start from the dialog
    const ipField = dialog.locator('mat-form-field', { has: page.getByRole('textbox', { name: IP_FIELD }) });
    const networkField = dialog.locator('mat-form-field', { has: page.getByRole('textbox', { name: NETWORK_FIELD }) });

    // 2. An out-of-range address
    await ipInput.fill('10.0.0.256');
    // expect: The field shows the error and Save is disabled
    await expect(ipField.locator('mat-error')).toHaveText(/Enter an IPv4 or IPv6 address/);
    await expect(save).toBeDisabled();

    // 3. A CIDR block in the single-address field
    await ipInput.fill('10.0.0.25/24');
    // expect: The error points at the Network type
    await expect(ipField.locator('mat-error')).toHaveText(/Use a Network field/);

    // 4. A valid address
    await ipInput.fill('10.0.0.25');
    // expect: The error clears and Save is enabled again
    await expect(ipField.locator('mat-error')).toHaveCount(0);
    await expect(save).toBeEnabled();

    // 5. A network with host bits set
    await networkInput.fill('10.1.0.5/24');
    // expect: The error suggests the network address, and Save is disabled
    await expect(networkField.locator('mat-error')).toHaveText(/Did you mean 10\.1\.0\.0\/24\?/);
    await expect(save).toBeDisabled();

    // 6. A network with no prefix length
    await networkInput.fill('10.1.0.0');
    // expect: The error asks for the prefix length
    await expect(networkField.locator('mat-error')).toHaveText(/Add a prefix length/);

    // 7. The suggested network, then Save
    await networkInput.fill('10.1.0.0/24');
    await expect(networkField.locator('mat-error')).toHaveCount(0);
    const savePromise = page.waitForResponse(
      (res) => /\/api\/scenarioevents\//i.test(res.url()) && res.request().method() === 'PUT',
      { timeout: 15000 }
    );
    await save.click();
    expect((await savePromise).status()).toBe(200);
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // expect: Both values are saved as typed
    const values = ((await getScenarioEvent(token, eventId)).dataValues ?? []).map((dv: any) => dv.value);
    expect(values).toEqual(expect.arrayContaining(['10.0.0.25', '10.1.0.0/24']));
  });

  test('IP Address column sorts by address, not as text', async ({ blueprintAuthenticatedPage: page }) => {
    // Seed: three events whose addresses sort differently as text (10.0.0.10 < 10.0.0.9 < 9.1.1.1)
    const addresses = ['10.0.0.10', '9.1.1.1', '10.0.0.9'];
    const prefix = tempBlueprintName('TestBP-IpSort');
    for (const [i, address] of addresses.entries()) {
      const { id } = await createRenderableScenarioEvent(token, mselId, `${prefix} ${i}`);
      await setScenarioEventFieldValue(token, id, IP_FIELD, address);
    }

    // 1. Sort the Scenario Events grid by the IP Address column
    await navigateToMselSection(page, mselId, 'Scenario Events');
    await findScenarioEventRow(page, `${prefix} 0`);
    await page.locator('th').filter({ hasText: IP_FIELD }).locator('.mat-sort-header-container').click();

    // expect: Ascending order is numeric: 9.1.1.1, 10.0.0.9, 10.0.0.10
    const order = async () =>
      (await page.locator('table tbody tr').filter({ hasText: prefix }).allInnerTexts())
        .map((text) => addresses.find((a) => new RegExp(`(^|\\s)${a.replace(/\./g, '\\.')}(\\s|$)`).test(text)));
    await expect.poll(order, { timeout: 10000 }).toEqual(['9.1.1.1', '10.0.0.9', '10.0.0.10']);
  });
});
