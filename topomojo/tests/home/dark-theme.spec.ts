// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// $dark-bg (#212529), or #101215 under a configured background image (html.has-bg-image).
const DARK_BG_RGB = /^rgb\((33, 37, 41|16, 18, 21)\)$/;
const LIGHT_BG_RGB = 'rgb(255, 255, 255)';

test.describe('Home Page and Navigation', () => {
  test('Dark Theme - Query Param Applies and Persists', async ({ page }) => {

    // 1. Load the landing page with ?theme=dark-theme
    await page.goto(`${Services.TopoMojo.UI}/?theme=dark-theme`, { waitUntil: 'domcontentloaded' });

    // expect: The dark theme is applied to the page
    const html = page.locator('html');
    await expect(html).toHaveClass(/\bdark-theme\b/, { timeout: 15000 });
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG_RGB);

    // theme-init.js applies the class before Angular starts; the app saves the choice once it does
    await expect(page.locator('nav.navbar')).toBeVisible({ timeout: 15000 });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('topomojo.theme'))).toBe('dark-theme');

    // 2. Reload without the query param
    await page.goto(Services.TopoMojo.UI, { waitUntil: 'domcontentloaded' });

    // expect: The dark theme is still applied
    await expect(page.locator('nav.navbar')).toBeVisible({ timeout: 15000 });
    await expect(html).toHaveClass(/\bdark-theme\b/);

    // 3. Load with an unknown ?theme= value
    await page.goto(`${Services.TopoMojo.UI}/?theme=bogus`, { waitUntil: 'domcontentloaded' });

    // expect: The saved dark theme is kept
    await expect(page.locator('nav.navbar')).toBeVisible({ timeout: 15000 });
    await expect(html).toHaveClass(/\bdark-theme\b/);

    // 4. Load with ?theme=light-theme
    await page.goto(`${Services.TopoMojo.UI}/?theme=light-theme`, { waitUntil: 'domcontentloaded' });

    // expect: The light theme is applied
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG_RGB, { timeout: 15000 });
    await expect(html).not.toHaveClass(/\bdark-theme\b/);
  });

  test('Dark Theme - Toggle Button Switches and Persists', async ({ page }) => {

    // 1. Load the landing page in the light theme
    await page.goto(Services.TopoMojo.UI, { waitUntil: 'domcontentloaded' });
    const html = page.locator('html');
    const toDark = page.getByRole('button', { name: 'Switch to dark theme' });
    await expect(toDark).toBeVisible({ timeout: 15000 });
    await expect(html).not.toHaveClass(/\bdark-theme\b/);

    // 2. Click the theme toggle in the navigation bar
    await toDark.click();

    // expect: The dark theme is applied and the toggle now offers the light theme
    await expect(html).toHaveClass(/\bdark-theme\b/);
    await expect(page.locator('body')).toHaveCSS('background-color', DARK_BG_RGB);
    const toLight = page.getByRole('button', { name: 'Switch to light theme' });
    await expect(toLight).toBeVisible();

    // 3. Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // expect: The dark theme is still applied
    await expect(toLight).toBeVisible({ timeout: 15000 });
    await expect(html).toHaveClass(/\bdark-theme\b/);

    // 4. Click the toggle again
    await toLight.click();

    // expect: The light theme is applied
    await expect(html).not.toHaveClass(/\bdark-theme\b/);
    await expect(page.locator('body')).toHaveCSS('background-color', LIGHT_BG_RGB);
  });

  test.describe('with a dark OS preference', () => {
    test.use({ colorScheme: 'dark' });

    test('Dark Theme - Follows OS Preference Until Chosen', async ({ page }) => {

      // 1. Load the landing page with no saved theme
      await page.goto(Services.TopoMojo.UI, { waitUntil: 'domcontentloaded' });

      // expect: The dark theme is applied from the OS preference
      const html = page.locator('html');
      await expect(page.locator('nav.navbar')).toBeVisible({ timeout: 15000 });
      await expect(html).toHaveClass(/\bdark-theme\b/);

      // 2. Choose the light theme with the toggle
      await page.getByRole('button', { name: 'Switch to light theme' }).click();
      await page.reload({ waitUntil: 'domcontentloaded' });

      // expect: The saved choice wins over the OS preference
      await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible({ timeout: 15000 });
      await expect(html).not.toHaveClass(/\bdark-theme\b/);
    });
  });
});
