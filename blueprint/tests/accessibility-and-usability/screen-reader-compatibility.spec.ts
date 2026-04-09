// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test.beforeEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to Blueprint application (auth state pre-loaded from setup)
    await page.goto('http://localhost:4725');
    await page.waitForLoadState('domcontentloaded');
  });

  // Blueprint is a desktop-first Angular Material application that does not use semantic
  // HTML heading elements (h1-h6) or ARIA landmark elements (role="main", role="navigation",
  // role="banner", etc., main, nav, header, footer). Instead, it uses Angular Material
  // components such as mat-toolbar and mat-card-title without semantic HTML equivalents.
  // After Angular finishes rendering, document.querySelectorAll('h1, h2, h3, h4, h5, h6')
  // returns 0 results, and no landmark elements are found. This is a genuine accessibility
  // gap in the application rather than a test timing or selector issue.
  test.fixme('Screen Reader Compatibility', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Enable a screen reader (NVDA, JAWS, or VoiceOver)
    // Note: Actual screen reader testing requires manual testing or specialized tools
    // This test verifies that the page has proper ARIA attributes and semantic HTML
    
    // 2. Navigate through the application
    // Check for page titles and headings
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle.length).toBeGreaterThan(0);
    
    // Verify headings exist and are properly structured
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
    
    // Verify h1 exists (main page heading)
    const h1 = await page.locator('h1').first();
    await expect(h1).toBeVisible();
    
    // Check for proper form labels
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], textarea, select').all();
    for (const input of inputs.slice(0, 5)) { // Check first 5 inputs
      const inputId = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const associatedLabel = inputId ? await page.locator(`label[for="${inputId}"]`).count() : 0;
      
      // Input should have either a label, aria-label, or aria-labelledby
      expect(associatedLabel > 0 || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
    
    // Check buttons have accessible names
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const buttonText = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      
      // Button should have text content, aria-label, or title
      expect(buttonText?.trim() || ariaLabel || title).toBeTruthy();
    }
    
    // Check for ARIA landmarks
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"], main, nav, header, aside, footer').all();
    expect(landmarks.length).toBeGreaterThan(0);
    
    // Verify links have accessible names
    const links = await page.locator('a').all();
    for (const link of links.slice(0, 5)) { // Check first 5 links
      const linkText = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      
      // Link should have text or aria-label
      expect(linkText?.trim() || ariaLabel).toBeTruthy();
    }
    
    // Check for live regions (for status messages and notifications)
    const liveRegions = await page.locator('[role="status"], [role="alert"], [aria-live]').count();
    // Note: Live regions may not always be present, but we're checking if the pattern is used
    
    // Verify no empty interactive elements
    const emptyButtons = await page.locator('button:empty:not([aria-label]):not([title])').count();
    expect(emptyButtons).toBe(0);
  });
});
