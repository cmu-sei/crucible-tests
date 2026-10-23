// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';

const BRAND_BLUE = '#1565c0';
const BRAND_BLUE_RGB = 'rgb(21, 101, 192)';
const DEFAULT_RED_RGB = 'rgb(196, 18, 48)';

// Serve the deployed settings.json with brandColor set (or removed when undefined).
async function overrideBrandColor(page: Page, brandColor: string | undefined): Promise<void> {
  await page.route('**/assets/settings.json', async (route) => {
    const response = await route.fetch();
    const settings = await response.json();
    delete settings.brandColor;
    if (brandColor) {
      settings.brandColor = brandColor;
    }
    await route.fulfill({ response, json: settings });
  });
}

test.describe('Home Page and Navigation', () => {
  test('Brand Color Setting - Applies Across Branding and Controls', async ({ page }) => {

    // 1. Load the landing page with settings.json brandColor set to blue
    await overrideBrandColor(page, BRAND_BLUE);
    await page.goto(Services.TopoMojo.UI, { waitUntil: 'domcontentloaded' });

    // expect: Navigation bar background uses the brand color
    const navbar = page.locator('nav.navbar');
    await expect(navbar).toBeVisible({ timeout: 15000 });
    await expect(navbar).toHaveCSS('background-color', BRAND_BLUE_RGB);

    // expect: Footer bar uses the brand color
    await expect(page.locator('footer')).toHaveCSS('background-color', BRAND_BLUE_RGB);

    // expect: Home page title uses the brand color
    await expect(page.locator('h1.display-1')).toHaveCSS('color', BRAND_BLUE_RGB);

    // expect: Primary buttons (Login) use the brand color
    await expect(page.locator('.btn-primary').first()).toHaveCSS('background-color', BRAND_BLUE_RGB);
  });

  test('Brand Color Setting - Table Headers Follow Brand Color', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Reload with settings.json brandColor set to blue
    await overrideBrandColor(page, BRAND_BLUE);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // 2. Open Admin > Templates
    await page.getByRole('button', { name: 'Admin' }).click();
    const templatesTab = page.getByRole('link', { name: 'Templates', exact: true });
    await templatesTab.click();
    await expect(page).toHaveURL(/\/admin\/templates/);

    // expect: Sortable column headers use the brand color
    const header = page.getByRole('button', { name: 'Sort by template name.' });
    await expect(header).toBeVisible({ timeout: 15000 });
    await expect(header).toHaveCSS('color', BRAND_BLUE_RGB);

    // expect: Active admin tab uses the brand color (blurred so it is not the focus/hover shade)
    await header.hover();
    await templatesTab.blur();
    await expect(templatesTab).toHaveCSS('color', BRAND_BLUE_RGB);
  });

  test('Brand Color Setting - Default When Unset', async ({ page }) => {

    // 1. Load the landing page with no brandColor in settings.json
    await overrideBrandColor(page, undefined);
    await page.goto(Services.TopoMojo.UI, { waitUntil: 'domcontentloaded' });

    // expect: Navigation bar keeps the built-in primary color
    const navbar = page.locator('nav.navbar');
    await expect(navbar).toBeVisible({ timeout: 15000 });
    await expect(navbar).toHaveCSS('background-color', DEFAULT_RED_RGB);

    // expect: Home page title keeps the built-in primary color
    await expect(page.locator('h1.display-1')).toHaveCSS('color', DEFAULT_RED_RGB);
  });

  test('Brand Color Setting - Invalid Value Keeps Default', async ({ page }) => {

    // 1. Load the landing page with a malformed brandColor (missing the leading #)
    await overrideBrandColor(page, '1565c0');
    await page.goto(Services.TopoMojo.UI, { waitUntil: 'domcontentloaded' });

    // expect: Navigation bar keeps the built-in primary color instead of going transparent
    const navbar = page.locator('nav.navbar');
    await expect(navbar).toBeVisible({ timeout: 15000 });
    await expect(navbar).toHaveCSS('background-color', DEFAULT_RED_RGB);
  });
});
