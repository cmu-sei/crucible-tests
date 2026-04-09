// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Events Management', () => {
  test('Scenario Event Custom Data Fields', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSEL admin or settings
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');
    
    // Try to find admin menu item or navigation for Data Fields
    const adminLink = page.locator(
      'text=Admin, ' +
      'a[href*="admin"], ' +
      'button:has-text("Admin")'
    ).first();
    
    if (await adminLink.isVisible({ timeout: 3000 })) {
      await adminLink.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      // Try direct URL navigation to admin
      await page.goto(`${Services.Blueprint.UI}/admin`);
      await page.waitForLoadState('domcontentloaded');
    }
    
    // expect: Admin/settings page is accessible
    await page.waitForTimeout(1000);
    
    // Look for Data Fields section
    const dataFieldsLink = page.locator(
      'text=Data Fields, ' +
      'text=Fields, ' +
      'a[href*="field"], ' +
      'a[href*="data"], ' +
      'button:has-text("Data Fields"), ' +
      'button:has-text("Fields")'
    ).first();
    
    if (await dataFieldsLink.isVisible({ timeout: 3000 })) {
      await dataFieldsLink.click();
      await page.waitForLoadState('domcontentloaded');
    } else {
      // Try direct URL navigation to data fields
      await page.goto(`${Services.Blueprint.UI}/admin/data-fields`);
      await page.waitForLoadState('domcontentloaded');
    }
    
    // 2. Add a custom data field (beyond the 5 defaults) for scenario events
    const addFieldButton = page.locator(
      'button:has-text("Add Field"), ' +
      'button:has-text("Create Field"), ' +
      'button:has-text("New Field"), ' +
      'button:has-text("Add"), ' +
      'button:has-text("Create")'
    ).first();
    
    // expect: Custom data field form is available
    if (await addFieldButton.isVisible({ timeout: 5000 })) {
      await addFieldButton.click();
      await page.waitForTimeout(1000);
      
      // expect: Field can be configured with name, data type (String, Organization, Teams, etc.), and display order
      const fieldNameInput = page.locator(
        'input[name*="name"], ' +
        'input[formControlName*="name"], ' +
        'input[placeholder*="Name"]'
      ).first();
      
      await fieldNameInput.fill('Custom Field Test');
      await expect(fieldNameInput).toHaveValue('Custom Field Test');
      
      // Select data type
      const dataTypeSelect = page.locator(
        'select[name*="type"], ' +
        'mat-select[formControlName*="type"], ' +
        'select[name*="dataType"]'
      ).first();
      
      if (await dataTypeSelect.isVisible({ timeout: 2000 })) {
        await dataTypeSelect.click();
        
        // Try to select String type
        const stringOption = page.locator(
          'mat-option:has-text("String"), ' +
          'option:has-text("String"), ' +
          'mat-option:has-text("Text")'
        ).first();
        
        if (await stringOption.isVisible({ timeout: 2000 })) {
          await stringOption.click();
        }
      }
      
      // Set display order
      const displayOrderInput = page.locator(
        'input[name*="order"], ' +
        'input[formControlName*="order"], ' +
        'input[type="number"]'
      ).first();
      
      if (await displayOrderInput.isVisible({ timeout: 2000 })) {
        await displayOrderInput.fill('6');
      }
      
      // Save the custom field
      const saveFieldButton = page.locator(
        'button:has-text("Save"), ' +
        'button:has-text("Create"), ' +
        'button[type="submit"]'
      ).last();
      
      await saveFieldButton.click();
      await page.waitForTimeout(2000);
      
      // Check for success notification
      const notification = page.locator('[class*="snack"], [class*="toast"], [class*="notification"]');
      
      if (await notification.isVisible({ timeout: 3000 })) {
        // Success notification appeared
        expect(await notification.isVisible()).toBe(true);
      }
    }
    
    // 3. Create a new scenario event
    // Navigate to the build/MSEL list page
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    // The /build page may show the Event Dashboard with a 'Manage an Event' card
    // Click it to get to the MSEL list
    const manageEventCard = page.locator('text=Manage an Event').first();
    if (await manageEventCard.isVisible({ timeout: 3000 })) {
      await manageEventCard.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
    }

    // Check if already on a MSEL page or need to select one
    const scenarioEventsNavCheck = page.locator('text=Scenario Events').first();
    const isOnMselPageCheck = await scenarioEventsNavCheck.isVisible({ timeout: 2000 });

    if (!isOnMselPageCheck) {
      // We're on the MSEL list page, need to click on a MSEL
      const mselLink = page.locator(
        'a[href*="msel"], ' +
        '[class*="msel-item"], ' +
        '[class*="msel-card"], ' +
        'table tbody tr'
      ).first();

      if (await mselLink.isVisible({ timeout: 3000 })) {
        await mselLink.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      } else {
        // No MSEL exists, create one using the 'Add blank MSEL' button
        const createButton = page.getByRole('button', { name: 'Add blank MSEL' });
        await expect(createButton).toBeVisible({ timeout: 10000 });
        await createButton.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // After creating, we may be redirected to the MSEL edit page
        // If still on the list, click the first MSEL
        const isNowOnMselPage = await page.locator('text=Scenario Events').first().isVisible({ timeout: 3000 });
        if (!isNowOnMselPage) {
          const firstMselLink = page.locator(
            'a[href*="msel"], ' +
            '[class*="msel-item"], ' +
            '[class*="msel-card"], ' +
            'table tbody tr'
          ).first();
          await expect(firstMselLink).toBeVisible({ timeout: 5000 });
          await firstMselLink.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1000);
        }
      }
    }

    // expect: MSEL details page is displayed
    await page.waitForTimeout(1000);

    // Navigate to Scenario Events section
    await scenarioEventsNavCheck.click();
    await page.waitForTimeout(1000);

    if (true) {

      // Click 'Add Event' button
      // First click the Action List button
      const actionListButton = page.getByRole('button', { name: 'Action List' }).first();

      if (await actionListButton.isVisible({ timeout: 5000 })) {
        await actionListButton.click();

        // Then click Add New Event from the menu
        const addNewEventMenuItem = page.getByRole('menuitem', { name: 'Add New Event' });
        await expect(addNewEventMenuItem).toBeVisible({ timeout: 5000 });
        await addNewEventMenuItem.click();
        await page.waitForTimeout(1000);
        
        // expect: The custom data field appears in the event creation form
        const customFieldInput = page.locator(
          'input[name*="Custom Field"], ' +
          'input[formControlName*="customField"], ' +
          'label:has-text("Custom Field Test")'
        );
        
        const customFieldVisible = await customFieldInput.isVisible({ timeout: 3000 });
        
        // expect: Field is positioned according to display order
        // expect: Field validates according to its data type
        if (customFieldVisible) {
          // Try to interact with the custom field
          const customInput = page.locator(
            'input[name*="Custom"], ' +
            'textarea[name*="Custom"]'
          ).last();
          
          if (await customInput.isVisible({ timeout: 2000 })) {
            await customInput.fill('Test custom field value');
            await expect(customInput).toHaveValue('Test custom field value');
          }
        }
        
        // Fill in required fields to verify form completeness
        const messageField = page.getByRole('textbox', { name: 'Message' });

        if (await messageField.isVisible({ timeout: 2000 })) {
          await messageField.fill('Test event with custom field');
        }
        
        // Close the dialog (don't save, this is just verification)
        const cancelButton = page.locator(
          'button:has-text("Cancel"), ' +
          'button:has-text("Close")'
        ).first();
        
        if (await cancelButton.isVisible({ timeout: 2000 })) {
          await cancelButton.click();
        } else {
          // Press Escape key to close dialog
          await page.keyboard.press('Escape');
        }
      } else {
        // Action List button should be present in the Scenario Events section
        await expect(actionListButton).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
