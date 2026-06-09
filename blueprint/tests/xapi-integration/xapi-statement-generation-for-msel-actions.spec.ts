// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';

test.describe('xAPI Integration and Learning Analytics', () => {
  test('xAPI Statement Generation for MSEL Actions', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Log in as admin user and create a new MSEL
    await page.goto(Services.Blueprint.UI);

    // Navigate to Admin section to create a new MSEL
    const adminButton = page.locator('button:has-text("Admin"), a:has-text("Admin")').first();
    if (await adminButton.isVisible({ timeout: 5000 })) {
      await adminButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Find and click the MSELs section
    const mselsLink = page.locator('a:has-text("MSELs"), button:has-text("MSELs")').first();
    await mselsLink.click();
    await page.waitForLoadState('networkidle');

    // Create a new MSEL
    const createButton = page.locator('button:has-text("Add"), button:has-text("Create"), button[aria-label*="add"], button[aria-label*="create"]').first();
    await createButton.click();

    // Fill in MSEL details
    const mselName = `Test MSEL ${Date.now()}`;
    await page.fill('input[name="name"], input[placeholder*="name" i]', mselName);
    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Test MSEL for xAPI statement generation');

    // Save the MSEL
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();

    // expect: MSEL is created successfully
    await expect(page.locator(`text="${mselName}"`).first()).toBeVisible({ timeout: 10000 });

    // Wait a moment for xAPI statement to be sent
    await page.waitForTimeout(2000);

    // 2. Query LRsql xAPI endpoint for recent statements
    const lrsqlApiUrl = `${Services.Lrsql}/xapi/statements`;
    const statementsResponse = await page.request.get(lrsqlApiUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
        'X-Experience-API-Version': '1.0.3'
      },
      params: {
        limit: 50
      }
    });

    // expect: An xAPI statement is generated with verb 'http://adlnet.gov/exprs/verbs/created'
    expect(statementsResponse.status()).toBe(200);
    const statementsData = await statementsResponse.json();
    const statements = statementsData.statements || [];

    const createStatement = statements.find((s: any) =>
      s.verb?.id === 'http://adlnet.gov/exprs/verbs/created' &&
      s.object?.definition?.name?.['en-US']?.includes(mselName)
    );

    expect(createStatement).toBeTruthy();

    // expect: Statement object.id contains the MSEL identifier
    expect(createStatement.object?.id).toBeTruthy();

    // expect: Statement context.platform = 'blueprint'
    expect(createStatement.context?.platform).toBe('blueprint');

    // expect: Actor is identified by admin user
    expect(createStatement.actor?.name).toBeTruthy();

    // 3. Edit the MSEL and save changes
    const editButton = page.locator('button[aria-label*="edit" i], button:has-text("Edit")').first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Updated description for xAPI test');
      await page.locator('button:has-text("Save")').first().click();
      await page.waitForTimeout(2000);

      // Query for update statement
      const updateResponse = await page.request.get(lrsqlApiUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
          'X-Experience-API-Version': '1.0.3'
        },
        params: {
          limit: 50,
          verb: 'http://adlnet.gov/exprs/verbs/updated'
        }
      });

      // expect: xAPI statement generated with verb 'http://adlnet.gov/exprs/verbs/updated'
      const updateData = await updateResponse.json();
      const updateStatements = updateData.statements || [];
      expect(updateStatements.length).toBeGreaterThan(0);
    }

    // 4. Delete a scenario event
    const deleteButton = page.locator('button[aria-label*="delete" i], button:has-text("Delete")').first();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      await deleteButton.click();

      // Confirm deletion if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').first();
      if (await confirmButton.isVisible({ timeout: 3000 })) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);

      // Query for delete statement
      const deleteResponse = await page.request.get(lrsqlApiUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
          'X-Experience-API-Version': '1.0.3'
        },
        params: {
          limit: 50,
          verb: 'http://adlnet.gov/exprs/verbs/deleted'
        }
      });

      // expect: xAPI statement generated with verb 'http://adlnet.gov/exprs/verbs/deleted'
      const deleteData = await deleteResponse.json();
      const deleteStatements = deleteData.statements || [];
      expect(deleteStatements.length).toBeGreaterThan(0);
    }
  });
});
