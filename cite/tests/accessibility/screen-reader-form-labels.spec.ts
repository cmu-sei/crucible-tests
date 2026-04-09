// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.setup.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Screen Reader Compatibility - Form Labels', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to the home page and check form inputs
    await page.waitForLoadState('networkidle');

    // Wait for the page to be loaded with content
    await expect(page.locator('text=My Evaluations')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // expect: All form fields have associated labels
    // Check all visible inputs on the main page
    const inputs = page.locator('input:visible, select:visible, textarea:visible');
    const inputCount = await inputs.count();

    console.log(`Found ${inputCount} form inputs to check for labels`);

    if (inputCount === 0) {
      // No inputs on the main page, check if we can find any interactive elements
      test.skip(true, 'No visible form inputs found on evaluations page');
      return;
    }

    const inputsWithoutLabels: string[] = [];

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const labelInfo = await input.evaluate((el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
        // Skip hidden inputs
        if (el.offsetParent === null) {
          return { hasLabel: true, reason: 'hidden input', tagName: el.tagName, type: el.getAttribute('type') || 'unknown' };
        }

        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const placeholder = el.getAttribute('placeholder');
        const title = el.getAttribute('title');
        const label = id ? document.querySelector(`label[for="${id}"]`) : null;

        // Check if input is within a mat-form-field (Angular Material)
        const matFormField = el.closest('mat-form-field');
        const matLabel = matFormField ? matFormField.querySelector('mat-label') : null;

        // Determine what kind of label exists
        let reason = '';
        if (label) reason = 'explicit label';
        else if (matLabel) reason = 'mat-label';
        else if (ariaLabel) reason = 'aria-label';
        else if (ariaLabelledBy) reason = 'aria-labelledby';
        else if (placeholder) reason = 'placeholder';
        else if (title) reason = 'title attribute';
        else reason = 'none';

        const hasLabel = !!(label || ariaLabel || ariaLabelledBy || placeholder || matLabel || title);

        return {
          hasLabel,
          reason,
          tagName: el.tagName,
          type: el.getAttribute('type') || 'unknown',
          id: el.id || 'no-id',
          name: el.getAttribute('name') || 'no-name'
        };
      });

      if (!labelInfo.hasLabel) {
        inputsWithoutLabels.push(`${labelInfo.tagName}[type="${labelInfo.type}"][id="${labelInfo.id}"][name="${labelInfo.name}"]`);
      }

      console.log(`Input ${i}: ${labelInfo.tagName}[${labelInfo.type}] - ${labelInfo.reason}`);
    }

    // expect: Labels are programmatically linked to inputs
    if (inputsWithoutLabels.length > 0) {
      console.error('Inputs without labels:', inputsWithoutLabels);
      expect(inputsWithoutLabels.length).toBe(0);
    }

    expect(inputCount).toBeGreaterThan(0); // Ensure we actually found and checked some inputs
  });
});
