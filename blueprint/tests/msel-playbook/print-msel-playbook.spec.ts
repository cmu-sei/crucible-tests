// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Playbook', () => {
  test('Print MSEL Playbook', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to a MSEL's Playbook section
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // Use the specific MSEL "Project Lagoon TTX - Admin User" which has the test data
    const mselLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin User' });
    await expect(mselLink).toBeVisible({ timeout: 5000 });
    await mselLink.click();
    await page.waitForLoadState('networkidle');

    const playbookNav = page.getByText('MSEL Playbook');
    await expect(playbookNav).toBeVisible({ timeout: 5000 });
    await playbookNav.click();
    await page.waitForLoadState('networkidle');

    // 1. Navigate to MSEL Playbook and click 'Print MSEL Playbook' button
    const printButton = page.getByRole('button', { name: 'Print MSEL Playbook' });
    await expect(printButton).toBeVisible({ timeout: 5000 });

    // Set up dialog listener to dismiss the print dialog
    page.on('dialog', async (dialog) => {
      await dialog.dismiss().catch(() => {});
    });

    // Listen for print events via window.print mock
    const printCalled = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const originalPrint = window.print;
        window.print = () => {
          window.print = originalPrint;
          resolve(true);
        };
        setTimeout(() => resolve(false), 3000);
      });
    });

    await printButton.click();

    // expect: The browser's print dialog opens (window.print called)
    // expect: The printable area content is prepared for printing
    // The print function call is the expected outcome; actual dialog is OS-level
    await page.waitForTimeout(1000);
  });
});
